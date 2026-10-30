use super::*;

/// 按样本格式分发到类型化构建
pub(super) fn build_typed_stream_for_format(
    device: &cpal::Device,
    config: &SupportedStreamConfig,
    source: DecoderSource,
    volume: Arc<AtomicU32>,
    stopped: Arc<AtomicBool>,
    on_failure: OutputFailureCallback,
) -> Result<cpal::Stream> {
    let sample_format = config.sample_format();
    let config: StreamConfig = config.config();
    macro_rules! build {
        ($sample:ty) => {
            build_typed_stream::<$sample>(device, config, source, volume, stopped, on_failure)
        };
    }
    match sample_format {
        SampleFormat::I8 => build!(i8),
        SampleFormat::I16 => build!(i16),
        SampleFormat::I24 => build!(cpal::I24),
        SampleFormat::I32 => build!(i32),
        SampleFormat::I64 => build!(i64),
        SampleFormat::U8 => build!(u8),
        SampleFormat::U16 => build!(u16),
        SampleFormat::U32 => build!(u32),
        SampleFormat::U64 => build!(u64),
        SampleFormat::F32 => build!(f32),
        SampleFormat::F64 => build!(f64),
        _ => Err(anyhow!("不支持的输出样本格式: {sample_format}")),
    }
}

fn build_typed_stream<T>(
    device: &cpal::Device,
    config: StreamConfig,
    mut source: DecoderSource,
    volume: Arc<AtomicU32>,
    stopped: Arc<AtomicBool>,
    on_failure: OutputFailureCallback,
) -> Result<cpal::Stream>
where
    T: SizedSample + Sample + FromSample<f32>,
{
    let mut xruns = 0_u64;
    let mut current_gain: Option<f32> = None;
    let channels = usize::from(config.channels).max(1);
    let stream = {
        let _props_guard =
            super::pipewire::pipewire_props::Guard::set_stream_props(config.sample_rate);

        device.build_output_stream(
            config,
            move |data: &mut [T], _| {
                source.begin_callback();
                if stopped.load(Ordering::Acquire) {
                    data.fill(T::EQUILIBRIUM);
                    current_gain = None;
                    return;
                }
                // New streams start at the requested gain; only live changes need a ramp.
                let target = f32::from_bits(volume.load(Ordering::Relaxed));
                let from = current_gain.unwrap_or(target);
                let step = (target - from) / data.len().div_ceil(channels).max(1) as f32;
                let mut gain = from;
                for frame in data.chunks_mut(channels) {
                    gain += step;
                    for output in frame {
                        *output = T::from_sample(source.next().unwrap_or(0.0) * gain);
                    }
                }
                current_gain = Some(target);
            },
            move |error| {
                if !output_error_requires_rebuild(error.kind()) {
                    if error.kind() == cpal::ErrorKind::Xrun {
                        xruns += 1;
                        if xruns.is_power_of_two() {
                            warn!(xruns, "音频后端欠载，保持当前输出流");
                        }
                    }
                    if error.kind() == cpal::ErrorKind::RealtimeDenied {
                        warn!(%error, "音频实时调度不可用，保持当前输出流");
                    }
                    return;
                }
                let err_msg = error.to_string();
                // An invalidated Linux endpoint needs a fresh output stream.
                let invalidated = err_msg.contains("no longer valid");
                if invalidated {
                    info!("音频输出流因设备切换失效，准备重建");
                } else {
                    warn!(%error, "音频输出流失败");
                }
                on_failure();
            },
            None,
        )?
    };
    Ok(stream)
}

/// CPAL 的欠载、调度权限和自动路由通知不表示输出流失效。
fn output_error_requires_rebuild(kind: cpal::ErrorKind) -> bool {
    !matches!(
        kind,
        cpal::ErrorKind::Xrun | cpal::ErrorKind::RealtimeDenied | cpal::ErrorKind::DeviceChanged
    )
}

#[cfg(test)]
#[path = "tests/cpal_stream.rs"]
mod tests;
