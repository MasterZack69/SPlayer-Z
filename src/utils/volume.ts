/** Slider-position step used by the wheel and volume shortcuts. */
export const VOLUME_STEP = 0.05;

/** Main slider range in decibels: each step is 2 dB. */
const VOLUME_RANGE_DB = 40;

/** Taper the lowest tenth to true silence without a gain discontinuity. */
const TAPER_POSITION = 0.1;

/** Gain at the boundary of the linear taper. */
const TAPER_GAIN = 10 ** ((-VOLUME_RANGE_DB * (1 - TAPER_POSITION)) / 20);

/**
 * Clamp a gain or position to the unit interval.
 * @param value - 待限制的数值
 * @returns 限制后的数值
 */
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * Convert a slider position to linear gain, tapering the bottom tenth to silence.
 * @param position - Slider position in the unit interval.
 * @returns Linear audio gain.
 */
export const volumePositionToGain = (position: number): number => {
  const value = clamp01(position);
  if (value < TAPER_POSITION) return (value / TAPER_POSITION) * TAPER_GAIN;
  return 10 ** ((-VOLUME_RANGE_DB * (1 - value)) / 20);
};

/**
 * 将线性增益转换为滑块位置，保证存档增益还原后仍是同一响度
 * @param gain - Linear audio gain.
 * @returns Slider position.
 */
export const volumeGainToPosition = (gain: number): number => {
  const value = clamp01(gain);
  const position =
    value < TAPER_GAIN
      ? (value / TAPER_GAIN) * TAPER_POSITION
      : clamp01(1 + (20 * Math.log10(value)) / VOLUME_RANGE_DB);
  // Avoid a nonzero remainder when stepping down to mute.
  return Math.round(position * 1e6) / 1e6;
};
