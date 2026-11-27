import type { Track } from "./player";

/** Bounded, measured audio data returned from the native analyzer. */
export interface AudioAnalysis {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  bitRate: number;
  codec: string;
  durationMs: number;
  peakDb: number;
  rmsDb: number;
  crestDb: number;
  clippedSamples: number;
  upperBandHz?: number;
  verdict: string;
  cutoffHz?: number;
  verdictConfidence: number;
  sectionsJudged: number;
  sectionsAgreeing: number;
  columns: number;
  bins: number;
  spectrogram: Uint8Array;
}

/** Renderer access to independent track analysis. */
export interface AnalysisApi {
  analyze: (track: Track) => Promise<AudioAnalysis>;
  cancel: () => Promise<void>;
}
