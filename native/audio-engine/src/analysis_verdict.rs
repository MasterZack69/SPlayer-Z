use std::cmp::Ordering;

const SECTIONS: usize = 24;
const ACTIVE_FRAME_DB: f64 = -70.0;

pub(crate) struct SpectrumEvidence {
    whole: Vec<f64>,
    whole_count: u64,
    sections: Vec<Vec<f64>>,
    section_count: [u64; SECTIONS],
    quiet_frames: Vec<(f64, f64)>,
    peak_levels: Vec<[f32; 12]>,
}

pub(crate) struct Verdict {
    pub kind: &'static str,
    pub cutoff_hz: Option<f64>,
    pub confidence: u32,
    pub sections_judged: u32,
    pub sections_agreeing: u32,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Shape {
    NoSignal,
    Unclear,
    FullBand,
    Rolloff,
    Cutoff,
}

struct Detection {
    shape: Shape,
    cutoff: Option<f64>,
    drop: f64,
    gap: f64,
    dynamic: f64,
    empty_above: Option<f64>,
    rising: bool,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum FloorLevel {
    Below16Bit,
    At16Bit,
    Masked,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum UpsampleKind {
    SampleHold,
    LinearInterpolation,
}

pub(crate) struct UpsampleScan {
    windows: Vec<(u64, Vec<i32>)>,
    trailing_zeros: [u64; 25],
    nonzero: u64,
    grid_seen: Vec<bool>,
    grid_levels: usize,
    grid_samples: u64,
}

impl UpsampleScan {
    /** Reserve six bounded windows across the first decoded channel.
     * @param frames - Expected decoded frame count, or zero when unknown.
     * @returns A scan accumulator for exact interpolation fingerprints.
     */
    pub(crate) fn new(frames: u64) -> Self {
        let window = 65_536_u64.min(frames.max(1));
        let count = if frames == 0 {
            1
        } else {
            (frames / window).clamp(1, 6)
        };
        let windows = (0..count)
            .map(|index| {
                let start = if count == 1 {
                    0
                } else {
                    (frames - window) * index / (count - 1)
                };
                (start, Vec::with_capacity(window as usize))
            })
            .collect();
        Self {
            windows,
            trailing_zeros: [0; 25],
            nonzero: 0,
            grid_seen: vec![false; 65_537],
            grid_levels: 0,
            grid_samples: 0,
        }
    }

    /** Observe one original-channel sample before mixing for the spectrogram.
     * @param sample - Decoded floating-point sample.
     * @param frame - Decoded frame index.
     */
    pub(crate) fn add(&mut self, sample: f32, frame: u64) {
        let value = (f64::from(sample) * 8_388_608.0)
            .round()
            .clamp(-8_388_608.0, 8_388_607.0) as i32;
        for (start, data) in &mut self.windows {
            if frame >= *start && frame < *start + 65_536 {
                data.push(value);
            }
        }
    }

    /** Count low-bit usage and small-level occupancy across decoded channels.
     * @param sample - One decoded channel sample.
     */
    pub(crate) fn observe_depth(&mut self, sample: f32) {
        let level = (f64::from(sample).abs() * 8_388_608.0).round() as u64;
        if level == 0 { return; }
        self.nonzero += 1;
        self.trailing_zeros[level.trailing_zeros().min(24) as usize] += 1;
        if level <= 65_536 {
            let index = level as usize;
            if !self.grid_seen[index] {
                self.grid_seen[index] = true;
                self.grid_levels += 1;
            }
            self.grid_samples += 1;
        }
    }

    /** Read zero-padded depth from enough nonzero decoded samples.
     * @returns Effective bits used, if the samples support a reading.
     */
    pub(crate) fn effective_bits(&self) -> Option<u32> {
        if self.nonzero < 4096 { return None; }
        let mut below = 0;
        let mut padded = 0;
        for position in 0..24 {
            if position > 0 { below += self.trailing_zeros[position - 1]; }
            if below as f64 / self.nonzero as f64 <= 0.001 { padded = position; }
            else { break; }
        }
        let mut bits = 24 - padded as u32;
        if padded == 0 && self.grid_samples >= 5 * 65_536 {
            let fill = self.grid_levels as f64 / 65_536.0;
            if fill > 0.0 && fill <= 0.25 {
                let grid_bits = 24.0 - (1.0 / fill).log2().round();
                bits = bits.min(grid_bits.max(1.0) as u32);
            }
        }
        Some(bits)
    }

    /** Require the same exact upsampling fingerprint in every audible window.
     * @param sample_rate - Decoded sample rate in hertz.
     * @returns The source rate and interpolation kind, if proven.
     */
    pub(crate) fn finding(&self, sample_rate: u32) -> Option<(u32, UpsampleKind)> {
        let mut found = None;
        let mut active = 0;
        for (_, data) in &self.windows {
            if data.len() < 4 || data.iter().all(|&value| value == 0) {
                continue;
            }
            active += 1;
            let hit = upsample_window(data, sample_rate)?;
            if found.is_some_and(|previous| previous != hit) {
                return None;
            }
            found = Some(hit);
        }
        if active > 0 {
            found
        } else {
            None
        }
    }
}

/** Match Specty's sample-hold and linear interpolation phase checks.
 * @param samples - One decoded channel window quantized to 24-bit units.
 * @param sample_rate - Decoded sample rate in hertz.
 * @returns Source rate and fingerprint kind.
 */
fn upsample_window(samples: &[i32], sample_rate: u32) -> Option<(u32, UpsampleKind)> {
    let used = samples.iter().fold(0, |bits, &sample| bits | sample);
    if used == 0 {
        return None;
    }
    let shift = used.trailing_zeros();
    for source in [44_100_u32, 48_000] {
        if sample_rate % source != 0 {
            continue;
        }
        let ratio = (sample_rate / source) as usize;
        if !(2..=8).contains(&ratio) {
            continue;
        }
        for phase in 0..ratio {
            let mut inner = 0;
            let mut hold_violations = 0;
            let mut hold_moving = 0;
            let mut line_violations = 0;
            let mut line_moving = 0;
            for index in 1..samples.len() - 1 {
                let left = samples[index - 1] >> shift;
                let value = samples[index] >> shift;
                let right = samples[index + 1] >> shift;
                let difference = value - left;
                let bend = (left - 2 * value + right).abs();
                if (index + ratio - phase) % ratio != 0 {
                    inner += 1;
                    if difference != 0 {
                        hold_violations += 1;
                    }
                    if bend > 2 {
                        line_violations += 1;
                    }
                } else {
                    if difference != 0 {
                        hold_moving += 1;
                    }
                    if bend > 2 {
                        line_moving += 1;
                    }
                }
            }
            let allowed = inner as f64 * 0.001;
            if hold_moving >= 1000 && (hold_violations as f64) <= allowed {
                return Some((source, UpsampleKind::SampleHold));
            }
            if line_moving >= 1000 && (line_violations as f64) <= allowed {
                return Some((source, UpsampleKind::LinearInterpolation));
            }
        }
    }
    None
}

impl SpectrumEvidence {
    /** Allocate bounded, fixed-size spectrum averages for a whole track and 24 sections.
     * @param bins - Number of FFT bins below Nyquist.
     * @returns An empty accumulator.
     */
    pub(crate) fn new(bins: usize) -> Self {
        Self {
            whole: vec![0.0; bins],
            whole_count: 0,
            sections: vec![vec![0.0; bins]; SECTIONS],
            section_count: [0; SECTIONS],
            quiet_frames: Vec::with_capacity(1200),
            peak_levels: vec![[f32::NEG_INFINITY; 12]; bins],
        }
    }

    /** Add a sampled, channel-averaged Hann spectrum to the verdict evidence.
     * @param power - Per-bin power averaged over decoded channels.
     * @param section - Equal time section, or none for a short file.
     * @param sample_rate - Decoded sample rate in hertz.
     */
    pub(crate) fn add(&mut self, power: &[f64], section: Option<usize>, sample_rate: u32) {
        let frame_power = power.iter().sum::<f64>();
        let active = 10.0 * (frame_power + 1e-18).log10() > ACTIVE_FRAME_DB;
        let bin_hz = sample_rate as f64 / (power.len() * 2) as f64;
        let floor_low = (500.0 / bin_hz).ceil() as usize;
        let floor_high = ((20_000.0 / bin_hz) as usize).min(power.len() - 1);
        if floor_low <= floor_high && self.quiet_frames.len() < 1200 {
            let raw_scale = ((power.len() as f64) / 2.0).powi(2);
            let raw: Vec<f64> = power[floor_low..=floor_high]
                .iter()
                .map(|value| value * raw_scale)
                .collect();
            let mean = raw.iter().sum::<f64>() / raw.len() as f64;
            if mean > 0.0 {
                self.quiet_frames.push((mean, median(&raw)));
            }
        }
        for (bin, &value) in power.iter().enumerate() {
            let level = 10.0 * (value + 1e-18).log10();
            if active {
                self.whole[bin] += level;
                if let Some(section) = section {
                    self.sections[section.min(SECTIONS - 1)][bin] += level;
                }
                let top = &mut self.peak_levels[bin];
                let weakest = top
                    .iter()
                    .enumerate()
                    .min_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(Ordering::Equal))
                    .map(|(index, _)| index)
                    .unwrap_or(0);
                if level as f32 > top[weakest] {
                    top[weakest] = level as f32;
                }
            }
        }
        if active {
            self.whole_count += 1;
            if let Some(section) = section {
                self.section_count[section.min(SECTIONS - 1)] += 1;
            }
        }
    }

    /** Estimate quiet-passage white-noise variance as Specty's verdict does.
     * @returns Per-channel floor variance, when measured.
     */
    fn quiet_floor(&self) -> Option<f64> {
        if self.quiet_frames.is_empty() {
            return None;
        }
        let mut frames = self.quiet_frames.clone();
        frames.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(Ordering::Equal));
        let quiet = (frames.len() as f64 * 0.1).floor().max(1.0) as usize;
        let window_power = self.whole.len() as f64 * 0.75;
        let estimates: Vec<f64> = frames[..quiet]
            .iter()
            .map(|(_, median)| median / std::f64::consts::LN_2 / window_power)
            .collect();
        Some(median(&estimates))
    }

    /** Compare transient content above 24.5 kHz against the measured floor.
     * @param sample_rate - Decoded sample rate in hertz.
     * @param floor - Quiet-passage variance.
     * @param limit - Optional upper frequency for a cutoff.
     * @returns Peak-hold margin over noise, when enough frames were sampled.
     */
    fn top_margin(&self, sample_rate: u32, floor: Option<f64>, limit: Option<f64>) -> Option<f64> {
        let floor = floor.filter(|value| *value > 0.0)?;
        if self.whole_count < 20 {
            return None;
        }
        let bin_hz = sample_rate as f64 / (self.whole.len() * 2) as f64;
        let from = (24_500.0 / bin_hz).round() as usize;
        let to =
            ((sample_rate as f64 / 2.0 * 0.99).min(limit.unwrap_or(f64::MAX)) / bin_hz) as usize;
        let to = to.min(self.whole.len() - 1);
        if to < from + 16 {
            return None;
        }
        let rank = ((self.whole_count as f64 * 0.01).round() as usize).clamp(1, 12);
        let peak: Vec<f64> = self
            .peak_levels
            .iter()
            .map(|levels| {
                let mut levels = *levels;
                levels.sort_by(|a, b| b.partial_cmp(a).unwrap_or(Ordering::Equal));
                levels[rank - 1] as f64
            })
            .collect();
        let radius = (65.0 / bin_hz).round().max(1.0) as usize;
        let mut band = Vec::with_capacity(to - from + 1);
        for index in from..=to {
            let low = index.saturating_sub(radius);
            let high = (index + radius + 1).min(peak.len());
            band.push(peak[low..high].iter().sum::<f64>() / (high - low) as f64);
        }
        let level = median(&band);
        let fft_size = self.whole.len() * 2;
        let window_sum = fft_size as f64 / 2.0;
        let window_power = fft_size as f64 * 0.375;
        let bin_power = floor * 4.0 * window_power / window_sum.powi(2);
        let floor_peak = 10.0 * bin_power.log10()
            + 10.0 * (-(rank as f64 / (self.whole_count + 1) as f64).ln()).log10();
        Some(level - floor_peak)
    }

    /** Classify the source with Specty's spectrum, resolution, and reassurance rules.
     * @param sample_rate - Decoded sample rate in hertz.
     * @param codec - Container codec name.
     * @param bit_depth - Declared source depth in bits.
     * @param effective_bits - Bits used by the decoded first channel.
     * @param upsample - Exact sample interpolation fingerprint, if found.
     * @returns User-facing verdict and its measured evidence.
     */
    pub(crate) fn assess(
        &self,
        sample_rate: u32,
        codec: &str,
        bit_depth: u32,
        effective_bits: Option<u32>,
        upsample: Option<(u32, UpsampleKind)>,
    ) -> Verdict {
        let codec = codec.to_ascii_lowercase();
        let lossy = codec.starts_with("mp3")
            || matches!(
                codec.as_str(),
                "mp2"
                    | "aac"
                    | "opus"
                    | "vorbis"
                    | "wmav1"
                    | "wmav2"
                    | "ac3"
                    | "eac3"
                    | "ac4"
                    | "amr_nb"
                    | "amr_wb"
                    | "atrac3"
                    | "atrac3p"
                    | "musepack7"
                    | "musepack8"
            );
        if lossy {
            return Verdict {
                kind: "lossyCodec",
                cutoff_hz: None,
                confidence: 99,
                sections_judged: 0,
                sections_agreeing: 0,
            };
        }
        if self.whole_count == 0 {
            return Verdict::inconclusive();
        }
        if upsample.is_some() {
            return Verdict {
                kind: "upsampled",
                cutoff_hz: None,
                confidence: 97,
                sections_judged: 0,
                sections_agreeing: 0,
            };
        }
        let whole: Vec<f64> = self
            .whole
            .iter()
            .map(|v| v / self.whole_count as f64)
            .collect();
        let found = detect(&whole, sample_rate);
        if found.shape == Shape::NoSignal {
            return Verdict::inconclusive();
        }
        let mut clear = 0;
        let mut agreeing = 0;
        let mut cutoffs = Vec::new();
        for (section, &count) in self.sections.iter().zip(&self.section_count) {
            if count == 0 {
                continue;
            }
            let average: Vec<f64> = section.iter().map(|v| v / count as f64).collect();
            let current = detect(&average, sample_rate);
            if matches!(current.shape, Shape::NoSignal | Shape::Unclear) {
                continue;
            }
            clear += 1;
            if current.shape == found.shape
                && (found.shape != Shape::Cutoff
                    || (current.cutoff.unwrap_or(0.0) - found.cutoff.unwrap_or(0.0)).abs()
                        <= 1000.0)
            {
                agreeing += 1;
            }
            if let Some(edge) = current.cutoff {
                cutoffs.push(edge);
            }
        }
        let mixed = clear >= 3 && agreeing * 2 < clear;
        let too_few = clear < 3 && found.shape != Shape::Cutoff;
        let floor = self.quiet_floor();
        let padded = bit_depth > 0
            && effective_bits.is_some_and(|bits| bits <= bit_depth.min(24).saturating_sub(4));
        let mut cutoff = found.cutoff;
        if mixed || too_few || found.shape == Shape::Unclear {
            let hi_res = self.hi_res_verified(
                sample_rate,
                bit_depth,
                padded,
                floor,
                &found,
                "inconclusive",
            );
            return Verdict {
                kind: if hi_res { "hiRes" } else { "genuine" },
                cutoff_hz: None,
                confidence: 0,
                sections_judged: clear,
                sections_agreeing: agreeing,
            };
        }
        let mut kind = match found.shape {
            Shape::FullBand => {
                if sample_rate > 48_000 {
                    "hiRes"
                } else {
                    "genuine"
                }
            }
            Shape::Rolloff => "rolloff",
            Shape::Cutoff => "bandLimited",
            _ => "inconclusive",
        };
        let mut signs = 0;
        let mut signature_bonus = 0;
        let mut source_floor_at16 = false;
        if let Some(edge) = found.cutoff {
            if found.drop >= 40.0 {
                signs += 1;
            }
            if found.empty_above.is_some_and(|top| top - edge <= 1500.0) {
                signs += 1;
            }
            cutoffs.sort_by(|a, b| a.partial_cmp(b).unwrap_or(Ordering::Equal));
            if agreeing * 5 >= clear * 4
                && cutoffs
                    .get(cutoffs.len() / 2)
                    .is_some_and(|middle| (middle - edge).abs() <= 400.0)
            {
                signs += 1;
            }
            let signature = [
                16_000.0, 17_000.0, 17_500.0, 18_000.0, 18_600.0, 19_000.0, 19_500.0, 20_000.0,
                20_500.0,
            ]
            .iter()
            .any(|point| (point - edge).abs() <= 150.0);
            let points = signs + u32::from(signature);
            signature_bonus = u32::from(signature);
            let source_edge = match_upsample_edge(edge, sample_rate);
            kind = if source_edge.is_some() {
                "upsampled"
            } else if edge <= 16_800.0 && points >= 2 {
                "lossySource"
            } else if edge <= 16_800.0 || (edge <= 20_800.0 && points >= 3) {
                "possibleLossySource"
            } else {
                "bandLimited"
            };
            let from_high_rate = source_edge.is_some_and(|source| source >= 44_100.0);
            let band_share = source_edge.map_or(1.0, |source| source / (sample_rate as f64 / 2.0));
            let source_floor = classify_floor(floor, band_share);
            source_floor_at16 = source_floor == Some(FloorLevel::At16Bit);
            if kind == "upsampled" {
                if !from_high_rate && source_floor == Some(FloorLevel::Below16Bit) {
                    kind = "bandLimited";
                } else if !from_high_rate
                    && !(padded || source_floor == Some(FloorLevel::At16Bit))
                    && signs < 3
                {
                    kind = "bandLimited";
                } else if from_high_rate && signs < 3 {
                    kind = "bandLimited";
                }
            }
        }
        let agreement = if clear > 0 {
            agreeing as f64 / clear as f64
        } else {
            0.0
        };
        let mut confidence = match found.shape {
            Shape::Cutoff => {
                28.0 + ((found.drop - 28.0) / 32.0 * 22.0).clamp(0.0, 22.0)
                    + if found.dynamic >= 35.0 { 5.0 } else { 0.0 }
                    + 25.0 * agreement
                    + 4.0 * (signs + signature_bonus) as f64
            }
            Shape::FullBand => {
                30.0 + ((50.0 - found.gap) / 50.0 * 20.0).clamp(0.0, 20.0) + 40.0 * agreement
            }
            Shape::Rolloff => {
                25.0 + ((found.gap - 65.0) / 30.0 * 20.0).clamp(0.0, 20.0) + 30.0 * agreement
            }
            _ => 0.0,
        };
        if kind == "possibleLossySource" {
            confidence -= 8.0;
        }
        if kind == "bandLimited" {
            confidence -= 12.0;
        }
        if clear < 3 {
            confidence = confidence.min(49.0);
        }
        if kind == "upsampled" && source_floor_at16 {
            confidence = (confidence + 8.0).min(95.0);
        }
        if sample_rate > 48_000
            && found.shape != Shape::FullBand
            && !found.rising
            && cutoff.unwrap_or(0.0) < 24_500.0
            && self
                .top_margin(sample_rate, floor, None)
                .is_some_and(|margin| margin >= 10.0)
        {
            kind = "hiRes";
            cutoff = None;
            confidence = 60.0;
        }
        let hi_res = self.hi_res_verified(sample_rate, bit_depth, padded, floor, &found, kind);
        if kind == "hiRes" && !hi_res {
            kind = "genuine";
        }
        if matches!(kind, "bandLimited" | "rolloff" | "inconclusive") {
            kind = if hi_res { "hiRes" } else { "genuine" };
            confidence = 0.0;
        }
        Verdict {
            kind,
            cutoff_hz: cutoff,
            confidence: if confidence <= 0.0 {
                0
            } else {
                confidence.round().clamp(5.0, 95.0) as u32
            },
            sections_judged: clear,
            sections_agreeing: agreeing,
        }
    }

    /** Verify high-resolution detail through upper-band content or a deep floor.
     * @param sample_rate - Decoded sample rate in hertz.
     * @param bit_depth - Declared source depth.
     * @param padded - Whether decoded samples reveal lower effective depth.
     * @param floor - Quiet-passage noise variance.
     * @param detection - Whole-track spectral shape.
     * @param kind - Current source verdict.
     * @returns Whether Specty's Hi-Res gate is met.
     */
    fn hi_res_verified(
        &self,
        sample_rate: u32,
        bit_depth: u32,
        padded: bool,
        floor: Option<f64>,
        detection: &Detection,
        kind: &str,
    ) -> bool {
        if sample_rate <= 48_000
            || padded
            || (bit_depth > 0 && bit_depth <= 16)
            || matches!(kind, "lossySource" | "possibleLossySource")
        {
            return false;
        }
        if kind == "upsampled"
            && detection
                .cutoff
                .and_then(|edge| match_upsample_edge(edge, sample_rate))
                .is_some_and(|source| source < 44_100.0)
        {
            return false;
        }
        let floor_level = classify_floor(floor, 1.0);
        let content = !detection.rising
            && (detection.shape == Shape::FullBand
                || kind == "hiRes"
                || self
                    .top_margin(sample_rate, floor, detection.cutoff)
                    .is_some_and(|margin| margin >= 10.0));
        if content {
            floor_level != Some(FloorLevel::At16Bit)
        } else {
            floor_level == Some(FloorLevel::Below16Bit)
        }
    }
}

impl Verdict {
    /** Return an inconclusive verdict when there is insufficient evidence.
     * @returns An evidence-free verdict.
     */
    fn inconclusive() -> Self {
        Self {
            kind: "inconclusive",
            cutoff_hz: None,
            confidence: 0,
            sections_judged: 0,
            sections_agreeing: 0,
        }
    }
}

/** Find the broad spectral shape and any permanent high-frequency cliff.
 * @param average - Average per-bin levels in dB.
 * @param sample_rate - Decoded sample rate in hertz.
 * @returns Shape and evidence used for the verdict.
 */
fn detect(average: &[f64], sample_rate: u32) -> Detection {
    let bins = average.len();
    let none = || Detection {
        shape: Shape::NoSignal,
        cutoff: None,
        drop: 0.0,
        gap: 0.0,
        dynamic: 0.0,
        empty_above: None,
        rising: false,
    };
    let nyquist = sample_rate as f64 / 2.0;
    if nyquist < 10_000.0 || bins < 64 {
        return none();
    }
    let bin_hz = sample_rate as f64 / (bins * 2) as f64;
    let radius = (65.0 / bin_hz).round().max(1.0) as usize;
    let mut smooth = vec![0.0; bins];
    for (index, value) in smooth.iter_mut().enumerate() {
        let low = index.saturating_sub(radius);
        let high = (index + radius + 1).min(bins);
        *value = average[low..high].iter().sum::<f64>() / (high - low) as f64;
    }
    let low = (1500.0 / bin_hz) as usize;
    let high = ((5000.0 / bin_hz) as usize).min(bins);
    let reference = smooth[low..high].iter().sum::<f64>() / (high - low) as f64;
    if reference < -95.0 {
        return none();
    }
    let floor = median(&smooth[bins - (bins * 3 / 100).max(8)..]);
    let dynamic = reference - floor;
    let top_from = bins * 92 / 100;
    let top_to = (bins * 99 / 100).max(top_from + 8).min(bins);
    let gap = reference - median(&smooth[top_from..top_to]);
    let mut suffix_max = vec![f64::NEG_INFINITY; bins];
    let mut running = f64::NEG_INFINITY;
    for index in (0..bins).rev() {
        running = running.max(smooth[index]);
        suffix_max[index] = running;
    }
    let mut best = (0.0, 0, 0);
    if dynamic >= 25.0 {
        for width_hz in [300.0_f64, 600.0, 1200.0, 2400.0] {
            let width = ((width_hz / bin_hz).round() as usize).max(3);
            let needed = 22.0_f64.max(12.0 * width_hz / 1000.0);
            for index in (4000.0 / bin_hz).round() as usize..bins.saturating_sub(width) {
                let drop = smooth[index] - smooth[index + width];
                if drop >= needed
                    && drop > best.0
                    && suffix_max[index + width] <= smooth[index] - 15.0
                {
                    best = (drop, index, width);
                }
            }
        }
    }
    let cutoff = if best.0 > 0.0 {
        let midpoint = (smooth[best.1] + smooth[best.1 + best.2]) / 2.0;
        let edge = (best.1..=best.1 + best.2)
            .find(|&index| smooth[index] <= midpoint)
            .unwrap_or(best.1 + best.2) as f64
            * bin_hz;
        let limit = if sample_rate > 48_000 { 0.95 } else { 0.985 };
        (edge < nyquist * limit).then_some(edge)
    } else {
        None
    };
    let threshold = (floor + 6.0).max(-110.0);
    let top = (0..bins)
        .rev()
        .find(|&index| smooth[index] > threshold)
        .unwrap_or(0);
    let top_hz = (top + 1) as f64 * bin_hz;
    let empty_above =
        (top < bins - 1 && top_hz < nyquist * 0.97 && top_hz > 1000.0).then_some(top_hz);
    let rising = if sample_rate > 48_000 {
        let from = (25_000.0 / bin_hz).round() as usize;
        let to = ((nyquist * 0.99 / bin_hz) as usize).min(bins - 1);
        if to > from && (to - from) as f64 * bin_hz >= 8000.0 {
            let slice = &smooth[from..=to];
            let n = slice.len() as f64;
            let sum_x = (from..=to).map(|k| k as f64 * bin_hz / 1000.0).sum::<f64>();
            let sum_y = slice.iter().sum::<f64>();
            let sum_xy = slice
                .iter()
                .enumerate()
                .map(|(i, y)| (from + i) as f64 * bin_hz / 1000.0 * y)
                .sum::<f64>();
            let sum_xx = (from..=to)
                .map(|k| (k as f64 * bin_hz / 1000.0).powi(2))
                .sum::<f64>();
            (n * sum_xy - sum_x * sum_y) / (n * sum_xx - sum_x * sum_x) >= 0.5
        } else {
            false
        }
    } else {
        false
    };
    let shape = if cutoff.is_some() {
        Shape::Cutoff
    } else if gap <= 50.0 && rising {
        Shape::Unclear
    } else if gap <= 50.0 {
        Shape::FullBand
    } else if gap >= 65.0 && empty_above.is_some() {
        Shape::Rolloff
    } else {
        Shape::Unclear
    };
    Detection {
        shape,
        cutoff,
        drop: if best.0 > 0.0 { best.0 } else { 0.0 },
        gap,
        dynamic,
        empty_above,
        rising,
    }
}

/** Match Specty's source-Nyquist candidates for a cutoff.
 * @param edge - Detected cutoff in hertz.
 * @param sample_rate - Decoded sample rate in hertz.
 * @returns Nyquist of the plausible lower-rate source.
 */
fn match_upsample_edge(edge: f64, sample_rate: u32) -> Option<f64> {
    [22_050.0, 24_000.0, 44_100.0, 48_000.0]
        .into_iter()
        .find(|source| {
            edge >= *source * 0.9
                && edge <= *source * 1.005
                && sample_rate as f64 / 2.0 >= *source * 1.8
        })
}

/** Compare measured quiet-passage noise against flat 16-bit quantization.
 * @param variance - White-noise equivalent power per decoded channel.
 * @param band_share - Band occupied by a possible lower-rate source.
 * @returns Specty's floor class when a quiet passage was measured.
 */
fn classify_floor(variance: Option<f64>, band_share: f64) -> Option<FloorLevel> {
    let variance = variance.filter(|value| value.is_finite() && *value > 0.0)?;
    let reference = (2.0_f64).powi(-30) / 12.0;
    let difference = 10.0 * (variance * band_share / reference).log10();
    Some(if difference < -6.0 {
        FloorLevel::Below16Bit
    } else if difference > 9.5 {
        FloorLevel::Masked
    } else {
        FloorLevel::At16Bit
    })
}

/** Select the middle spectral level without changing its source slice.
 * @param values - Spectrum levels to inspect.
 * @returns Median decibel level.
 */
fn median(values: &[f64]) -> f64 {
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(Ordering::Equal));
    sorted[sorted.len() / 2]
}
