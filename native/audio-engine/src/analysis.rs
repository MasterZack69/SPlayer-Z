use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use anyhow::{bail, ensure, Result};
use ffmpeg_audio::{AudioError, HttpCancelHandle, ResampleOptions, SeekMode};
use parking_lot::Mutex;
use rustfft::{num_complex::Complex, FftPlanner};

use crate::analysis_verdict::SpectrumEvidence;
use crate::decoder::reader::open_source;

pub(crate) static ANALYSIS_GENERATION: AtomicU64 = AtomicU64::new(0);
static ANALYSIS_HTTP_CANCEL: Mutex<Option<(u64, HttpCancelHandle)>> = Mutex::new(None);

/** Cancel a blocked HTTP read and start a new analysis generation.
 * @returns Generation assigned to the next request.
 */
pub(crate) fn cancel() -> u64 {
    let generation = ANALYSIS_GENERATION.fetch_add(1, Ordering::Relaxed) + 1;
    if let Some((_, handle)) = ANALYSIS_HTTP_CANCEL.lock().take() {
        handle.cancel();
    }
    generation
}

/** Release the network handle owned by a completed generation.
 * @param generation - Generation whose worker has finished.
 */
pub(crate) fn clear_handle(generation: u64) {
    let mut active = ANALYSIS_HTTP_CANCEL.lock();
    if active
        .as_ref()
        .is_some_and(|(current, _)| *current == generation)
    {
        active.take();
    }
}

pub(crate) struct AudioAnalysis {
    pub sample_rate: u32,
    pub channels: u32,
    pub bit_depth: u32,
    pub bit_rate: i64,
    pub codec: String,
    pub duration_ms: f64,
    pub peak_db: f64,
    pub rms_db: f64,
    pub crest_db: f64,
    pub clipped_samples: f64,
    pub upper_band_hz: Option<f64>,
    pub verdict: String,
    pub cutoff_hz: Option<f64>,
    pub verdict_confidence: u32,
    pub sections_judged: u32,
    pub sections_agreeing: u32,
    pub columns: u32,
    pub bins: u32,
    pub spectrogram: Vec<u8>,
}

const FFT_SIZE: usize = 4096;
const HOP_SIZE: usize = FFT_SIZE / 2;
const COLUMNS: usize = 768;
const BINS: usize = 256;

/** Convert a linear amplitude into a finite decibel display value. */
fn db(amplitude: f64) -> f64 {
    20.0 * amplitude.max(1e-6).log10()
}

/** Decode a track independently of the player and measure its spectrum and levels.
 * @param source - Local path or authenticated server URL held only by the main process.
 * @param start_ms - Start of an optional CUE range in milliseconds.
 * @param end_ms - End of an optional CUE range, or zero for the full source.
 * @param generation - Generation used to stop work after navigation or another request.
 * @returns Bounded spectrogram data and measured audio levels.
 */
pub(crate) fn analyze(
    source: &str,
    start_ms: f64,
    end_ms: f64,
    generation: u64,
) -> Result<AudioAnalysis> {
    ensure!(
        start_ms.is_finite() && start_ms >= 0.0,
        "Invalid analysis start"
    );
    ensure!(
        end_ms.is_finite() && (end_ms == 0.0 || end_ms > start_ms),
        "Invalid analysis end"
    );
    if ANALYSIS_GENERATION.load(Ordering::Relaxed) != generation {
        bail!("Analysis cancelled");
    }
    let handle = HttpCancelHandle::new();
    {
        let mut active = ANALYSIS_HTTP_CANCEL.lock();
        if ANALYSIS_GENERATION.load(Ordering::Relaxed) != generation {
            bail!("Analysis cancelled");
        }
        *active = Some((generation, handle.clone()));
    }
    let (mut reader, _cancel) = open_source(source, handle)?;
    let info = reader.source_info().clone();
    let rate = info.sample_rate.max(0) as u32;
    ensure!(rate > 0 && info.channels > 0, "Audio stream has no samples");
    let duration_ms = if end_ms > start_ms {
        end_ms - start_ms
    } else {
        reader
            .duration()
            .map(|value| value.as_secs_f64() * 1000.0)
            .unwrap_or(0.0)
            - start_ms
    };
    if start_ms > 0.0 {
        reader.seek(
            Duration::from_secs_f64(start_ms / 1000.0),
            SeekMode::Accurate,
        )?;
    }
    let mut converter = reader.build_resampler(
        ResampleOptions::new()
            .sample_rate(info.sample_rate)
            .channels(1)
            .format::<f32>(),
    )?;
    let fft = FftPlanner::<f32>::new().plan_fft_forward(FFT_SIZE);
    let window: Vec<f32> = (0..FFT_SIZE)
        .map(|index| 0.5 - 0.5 * (std::f32::consts::TAU * index as f32 / FFT_SIZE as f32).cos())
        .collect();
    let mut frame = vec![Complex::new(0.0, 0.0); FFT_SIZE];
    let mut samples = Vec::<f32>::with_capacity(FFT_SIZE * 2);
    let mut spectrogram = vec![0_u8; COLUMNS * BINS];
    let mut band_sum = vec![0.0_f64; BINS];
    let mut evidence = SpectrumEvidence::new(FFT_SIZE / 2);
    let mut band_count = 0_u64;
    let mut peak = 0.0_f64;
    let mut squares = 0.0_f64;
    let mut clipped = 0_u64;
    let mut count = 0_u64;
    let mut window_start = 0_u64;
    let max_samples = if duration_ms > 0.0 {
        (duration_ms * rate as f64 / 1000.0).ceil() as u64
    } else {
        u64::MAX
    };
    let expected_windows = if max_samples == u64::MAX {
        0
    } else {
        max_samples.div_ceil(HOP_SIZE as u64)
    };

    loop {
        if ANALYSIS_GENERATION.load(Ordering::Relaxed) != generation {
            bail!("Analysis cancelled");
        }
        let decoded = match reader.receive_frame() {
            Ok(Some(decoded)) => decoded,
            Ok(None) | Err(AudioError::Eof) => break,
            Err(error) => return Err(error.into()),
        };
        converter.process::<f32>(Some(&decoded))?;
        for &sample in converter.output_as::<f32>() {
            if count >= max_samples {
                break;
            }
            let value = f64::from(sample);
            if value.is_finite() {
                let absolute = value.abs();
                peak = peak.max(absolute);
                squares += value * value;
                if absolute >= 0.99996 {
                    clipped += 1;
                }
                samples.push(sample);
            } else {
                samples.push(0.0);
            }
            count += 1;
        }
        while samples.len() >= FFT_SIZE {
            for (target, (&sample, &weight)) in frame.iter_mut().zip(samples.iter().zip(&window)) {
                *target = Complex::new(sample * weight, 0.0);
            }
            fft.process(&mut frame);
            let window_index = window_start / HOP_SIZE as u64;
            let section = if expected_windows > 0 {
                (window_index * 24 / expected_windows).min(23) as usize
            } else {
                0
            };
            evidence.add(&frame, section);
            let column = if expected_windows > 1 {
                ((window_start / HOP_SIZE as u64) * (COLUMNS - 1) as u64 / (expected_windows - 1))
                    .min((COLUMNS - 1) as u64) as usize
            } else {
                ((window_start / HOP_SIZE as u64) as usize).min(COLUMNS - 1)
            };
            for bin in 1..FFT_SIZE / 2 {
                let mapped = (bin * BINS / (FFT_SIZE / 2)).min(BINS - 1);
                let amplitude = f64::from(frame[bin].norm()) * 4.0 / FFT_SIZE as f64;
                let level = db(amplitude).clamp(-110.0, 0.0);
                let quantized = ((level + 110.0) * 255.0 / 110.0).round() as u8;
                let cell = &mut spectrogram[column * BINS + mapped];
                *cell = (*cell).max(quantized);
                band_sum[mapped] += amplitude * amplitude;
            }
            band_count += 1;
            samples.drain(..HOP_SIZE);
            window_start += HOP_SIZE as u64;
        }
        if count >= max_samples {
            break;
        }
    }
    ensure!(count > 0, "No audio samples were decoded");
    let rms = (squares / count as f64).sqrt();
    let verdict = evidence.assess(rate, info.codec_name.as_deref().unwrap_or_default());
    let reference = band_sum.iter().copied().fold(0.0_f64, f64::max);
    let threshold = (reference * 1e-6).max(1e-12);
    let upper_band_hz = if band_count > 0 && reference > 1e-9 {
        band_sum
            .iter()
            .rposition(|&power| power >= threshold)
            .map(|bin| bin as f64 * (rate as f64 / 2.0) / (BINS - 1) as f64)
    } else {
        None
    };
    Ok(AudioAnalysis {
        sample_rate: rate,
        channels: info.channels as u32,
        bit_depth: info.bits_per_sample.max(0) as u32,
        bit_rate: info.bit_rate,
        codec: info.codec_name.unwrap_or_default(),
        duration_ms: count as f64 * 1000.0 / rate as f64,
        peak_db: db(peak),
        rms_db: db(rms),
        crest_db: if rms > 0.0 { db(peak / rms) } else { 0.0 },
        clipped_samples: clipped as f64,
        upper_band_hz,
        verdict: verdict.kind.to_string(),
        cutoff_hz: verdict.cutoff_hz,
        verdict_confidence: verdict.confidence,
        sections_judged: verdict.sections_judged,
        sections_agreeing: verdict.sections_agreeing,
        columns: COLUMNS as u32,
        bins: BINS as u32,
        spectrogram,
    })
}
