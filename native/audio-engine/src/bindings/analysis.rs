use napi::bindgen_prelude::Buffer;
use napi_derive::napi;

use crate::analysis::{analyze, cancel, clear_handle};
use crate::bindings::IntoNapiResult;

#[napi(object)]
pub struct JsAudioAnalysis {
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
    pub spectrogram: Buffer,
}

/** Analyze an audio source on a worker thread without affecting playback.
 * @param source - Local path or main-process authenticated URL.
 * @param start_ms - CUE range start in milliseconds.
 * @param end_ms - CUE range end, or zero for the whole source.
 * @returns Measured levels and a bounded spectrogram.
 */
#[napi]
pub async fn analyze_audio(
    source: String,
    start_ms: f64,
    end_ms: f64,
) -> napi::Result<JsAudioAnalysis> {
    let generation = cancel();
    let result = tokio::task::spawn_blocking(move || {
        let result = analyze(&source, start_ms, end_ms, generation);
        clear_handle(generation);
        result
    })
    .await
    .map_err(|error| napi::Error::from_reason(error.to_string()))?
    .into_napi()?;
    Ok(JsAudioAnalysis {
        sample_rate: result.sample_rate,
        channels: result.channels,
        bit_depth: result.bit_depth,
        bit_rate: result.bit_rate,
        codec: result.codec,
        duration_ms: result.duration_ms,
        peak_db: result.peak_db,
        rms_db: result.rms_db,
        crest_db: result.crest_db,
        clipped_samples: result.clipped_samples,
        upper_band_hz: result.upper_band_hz,
        verdict: result.verdict,
        cutoff_hz: result.cutoff_hz,
        verdict_confidence: result.verdict_confidence,
        sections_judged: result.sections_judged,
        sections_agreeing: result.sections_agreeing,
        columns: result.columns,
        bins: result.bins,
        spectrogram: result.spectrogram.into(),
    })
}

/** Stop the current analysis when the page closes or a new track is selected. */
#[napi]
pub fn cancel_audio_analysis() {
    let _ = cancel();
}
