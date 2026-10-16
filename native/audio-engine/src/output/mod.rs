//! Linux CPAL output configuration. Requested stream rates are not hardware clock rates.
use crate::decoder::transition_source::TransitionSource as DecoderSource;
use crate::error::{AudioErrorKind, AudioResultExt};
use anyhow::{anyhow, Context, Result};
use cpal::traits::{DeviceTrait, HostTrait};
use cpal::{FromSample, Sample, SampleFormat, SizedSample, StreamConfig, SupportedStreamConfig};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use tracing::{debug, info, warn};

/// Send a lightweight failure event without blocking the audio callback.
pub type OutputFailureCallback = Arc<dyn Fn() + Send + Sync + 'static>;
pub(crate) type OutputStream = cpal::Stream;

/// Device configuration shared with the player; playback owns the actual stream.
pub struct AudioOutput {
    device: cpal::Device,
    config: SupportedStreamConfig,
    generation: u64,
    on_failure: OutputFailureCallback,
}
impl AudioOutput {
    /// Resolve an output endpoint, preferring the source rate when supported.
    pub fn new(
        device_id: Option<&str>,
        requested_sample_rate: Option<u32>,
        generation: u64,
        on_failure: OutputFailureCallback,
    ) -> Result<Self> {
        let (device, config) = open_device(device_id, requested_sample_rate)
            .with_audio_kind(AudioErrorKind::Device)?;
        info!(
            id = device_id.unwrap_or("default"),
            sample_rate = config.sample_rate(),
            "Opening Linux audio output"
        );
        Ok(Self {
            device,
            config,
            generation,
            on_failure,
        })
    }
    /// Return the negotiated stream rate for decoder resampling.
    pub fn sample_rate(&self) -> u32 {
        self.config.sample_rate()
    }
    /// Return the negotiated stream channel count.
    pub fn channels(&self) -> u16 {
        self.config.channels()
    }
    /// Return the device label for the audio information dialog.
    pub fn device_name(&self) -> String {
        self.device
            .description()
            .map(|d| d.name().to_owned())
            .unwrap_or_else(|_| "System Default".into())
    }
    /// Return the negotiated sample container size.
    pub fn bits(&self) -> u32 {
        self.config.sample_format().sample_size() as u32 * 8
    }
    /// Build a CPAL stream; the caller activates it only after load-token validation.
    pub(crate) fn build_stream(
        &self,
        source: DecoderSource,
        volume: Arc<AtomicU32>,
        stopped: Arc<AtomicBool>,
    ) -> Result<OutputStream> {
        build_typed_stream_for_format(
            &self.device,
            &self.config,
            source,
            volume,
            stopped,
            Arc::clone(&self.on_failure),
        )
        .with_audio_kind(AudioErrorKind::Device)
    }
}
impl Drop for AudioOutput {
    fn drop(&mut self) {
        debug!(
            generation = self.generation,
            "Releasing Linux output configuration"
        );
    }
}
mod cpal_stream;
mod device;
pub(crate) mod device_watcher;
mod pipewire;
pub(crate) mod playback;
use cpal_stream::build_typed_stream_for_format;
use device::open_device;
pub use device::{default_device_id, default_device_name, list_output_devices};
