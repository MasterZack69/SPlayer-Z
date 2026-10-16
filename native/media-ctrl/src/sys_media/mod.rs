use std::sync::OnceLock;

use anyhow::Result;
use napi::{
    Status,
    threadsafe_function::{ThreadsafeFunction, UnknownReturnValue},
};

use crate::model::{MediaEvent, MetadataPayload, PlayModeParam, PlayStateParam, TimelineParam};

pub type MediaThreadsafeFunction =
    ThreadsafeFunction<MediaEvent, UnknownReturnValue, MediaEvent, Status, false>;

static CONTROLS: OnceLock<Box<dyn SystemMediaControls>> = OnceLock::new();

/// 跨平台媒体控制接口
pub trait SystemMediaControls: Send + Sync {
    fn initialize(&self) -> Result<()>;
    fn enable(&self) -> Result<()>;
    fn disable(&self) -> Result<()>;
    fn shutdown(&self) -> Result<()>;
    fn register_event_handler(&self, callback: MediaThreadsafeFunction) -> Result<()>;
    fn update_metadata(&self, payload: MetadataPayload);
    fn update_playback_status(&self, payload: PlayStateParam);
    fn update_playback_rate(&self, rate: f64);
    fn update_volume(&self, volume: f64);
    fn update_timeline(&self, payload: TimelineParam);
    fn update_play_mode(&self, payload: PlayModeParam);
}

pub mod linux;

/// Return the process-wide Linux MPRIS controls.
pub fn get_platform_controls() -> &'static dyn SystemMediaControls {
    CONTROLS
        .get_or_init(|| Box::new(linux::LinuxImpl::new()))
        .as_ref()
}
