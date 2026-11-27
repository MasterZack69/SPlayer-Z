use std::cmp::Ordering;

use rustfft::num_complex::Complex;

const SECTIONS: usize = 24;
const ACTIVE_FRAME_DB: f64 = -70.0;

pub(crate) struct SpectrumEvidence {
    whole: Vec<f64>,
    whole_count: u64,
    sections: Vec<Vec<f64>>,
    section_count: [u64; SECTIONS],
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
        }
    }

    /** Add an audible Hann-windowed frame to whole-track and section averages.
     * @param fft - Complex transform of the frame.
     * @param section - Equal time section containing the frame.
     */
    pub(crate) fn add(&mut self, fft: &[Complex<f32>], section: usize) {
        let mut power = 0.0;
        for value in fft.iter().take(self.whole.len()) {
            let amplitude = f64::from(value.norm()) * 4.0 / fft.len() as f64;
            power += amplitude * amplitude;
        }
        if 10.0 * power.max(1e-20).log10() <= ACTIVE_FRAME_DB {
            return;
        }
        let section = section.min(SECTIONS - 1);
        for (bin, value) in fft.iter().take(self.whole.len()).enumerate() {
            let amplitude = f64::from(value.norm()) * 4.0 / fft.len() as f64;
            let level = 20.0 * amplitude.max(1e-10).log10();
            self.whole[bin] += level;
            self.sections[section][bin] += level;
        }
        self.whole_count += 1;
        self.section_count[section] += 1;
    }

    /** Classify spectrum shape and corroborate a cutoff against time sections.
     * @param sample_rate - Decoded sample rate in hertz.
     * @param codec - Container codec name.
     * @returns Conservative Specty-style verdict and its measured evidence.
     */
    pub(crate) fn assess(&self, sample_rate: u32, codec: &str) -> Verdict {
        let codec = codec.to_ascii_lowercase();
        let lossy = codec.starts_with("mp3")
            || matches!(
                codec.as_str(),
                "mp3" | "aac" | "opus" | "vorbis" | "mp2" | "wmav2" | "ac3" | "eac3"
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
        let whole: Vec<f64> = self
            .whole
            .iter()
            .map(|v| v / self.whole_count as f64)
            .collect();
        let found = detect(&whole, sample_rate);
        if matches!(found.shape, Shape::NoSignal | Shape::Unclear) {
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
        if clear < 3 || agreeing * 2 < clear {
            return Verdict::inconclusive();
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
            let source_edge = [22_050.0, 24_000.0, 44_100.0, 48_000.0]
                .iter()
                .any(|source| {
                    edge >= source * 0.90
                        && edge <= source * 1.005
                        && sample_rate as f64 / 2.0 >= source * 1.8
                });
            kind = if source_edge && signs == 3 {
                "upsampled"
            } else if edge <= 16_800.0 && points >= 2 {
                "lossySource"
            } else if edge <= 16_800.0 || (edge <= 20_800.0 && points >= 3) {
                "possibleLossySource"
            } else {
                "bandLimited"
            };
        }
        let agreement = agreeing as f64 / clear as f64;
        let mut confidence = match found.shape {
            Shape::Cutoff => {
                28.0 + ((found.drop - 28.0) / 32.0 * 22.0).clamp(0.0, 22.0)
                    + if found.dynamic >= 35.0 { 5.0 } else { 0.0 }
                    + 25.0 * agreement
                    + 4.0 * signs as f64
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
        Verdict {
            kind,
            cutoff_hz: found.cutoff,
            confidence: confidence.round().clamp(5.0, 95.0) as u32,
            sections_judged: clear,
            sections_agreeing: agreeing,
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
    }
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
