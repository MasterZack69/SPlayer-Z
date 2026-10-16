use anyhow::Result;

mod linux;

use linux::Backend as SelectedBackend;

/// 回调参数：true 表示默认输出设备切换，false 表示设备列表变化
/// Linux PipeWire 后端的默认设备名恒为哨兵值，调用方只能靠这个信号区分两种事件
pub(super) type DeviceChangedCallback = Box<dyn Fn(bool) + Send + 'static>;

trait PlatformBackend: Sized {
    const SUPPORTED: bool;

    fn new(callback: DeviceChangedCallback) -> Result<Self>;
    fn stop(&mut self);
}

pub struct DeviceWatcher {
    backend: SelectedBackend,
}

impl DeviceWatcher {
    pub fn new(callback: DeviceChangedCallback) -> Result<Self> {
        Ok(Self {
            backend: SelectedBackend::new(callback)?,
        })
    }

    pub fn stop(&mut self) {
        self.backend.stop();
    }
}

impl Drop for DeviceWatcher {
    fn drop(&mut self) {
        self.stop();
    }
}

pub fn is_supported() -> bool {
    SelectedBackend::SUPPORTED
}

#[cfg(test)]
#[path = "tests/mod.rs"]
mod tests;
