/** Slider-position step used by the wheel and volume shortcuts. */
export const VOLUME_STEP = 0.05;

/** Approximate perceived loudness; the midpoint is about -10 dB. */
const LOUDNESS_EXPONENT = 1.66;

/**
 * Map slider position to gain with a perceptual power curve.
 * @param position - Slider position in the unit interval.
 * @returns Linear audio gain.
 */
export const volumePositionToGain = (position: number): number =>
  // Round to whole percentages so accumulated step errors reach true silence.
  (Math.round(Math.max(0, Math.min(1, position)) * 100) / 100) ** LOUDNESS_EXPONENT;

/**
 * Map saved gain to slider position without changing playback volume.
 * @param gain - Linear audio gain.
 * @returns Slider position in the unit interval.
 */
export const volumeGainToPosition = (gain: number): number =>
  Math.max(0, Math.min(1, gain)) ** (1 / LOUDNESS_EXPONENT);
