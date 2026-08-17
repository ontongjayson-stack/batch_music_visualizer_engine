/**
 * Audio Analysis & Spectrum Synthesis Module
 * Batch Music Visualizer Engine
 */

import { AudioAnalysisData, AudioAnimationFrame } from './types.js';

/**
 * Creates synthetic or interpolated audio frame data for rendering when raw FFT analysis is partially or fully generated.
 */
export function generateSyntheticAudioAnalysis(
  durationSeconds: number = 30,
  fps: number = 30,
  bpm: number = 120
): AudioAnalysisData {
  const totalFrames = Math.max(1, Math.ceil(durationSeconds * fps));
  const frames: AudioAnimationFrame[] = [];
  const binCount = 64;

  const secondsPerBeat = 60 / bpm;
  const framesPerBeat = secondsPerBeat * fps;

  for (let i = 0; i < totalFrames; i++) {
    const timestamp = i / fps;
    const beatPhase = (i % framesPerBeat) / framesPerBeat;
    
    // Simulating rhythmic beat drops and energy dynamics
    const beatPulse = Math.pow(Math.max(0, 1 - beatPhase * 2.2), 3);
    const wave1 = Math.sin(timestamp * 1.5) * 0.2 + 0.5;
    const wave2 = Math.cos(timestamp * 0.7) * 0.25;

    const bass = Math.min(1, Math.max(0.1, beatPulse * 0.7 + wave1 * 0.3));
    const mids = Math.min(1, Math.max(0.15, (1 - beatPulse * 0.3) * 0.4 + wave2 + 0.3));
    const treble = Math.min(1, Math.max(0.08, Math.sin(timestamp * 4) * 0.3 + 0.3));
    const volume = Math.min(1, bass * 0.5 + mids * 0.35 + treble * 0.15);

    const spectrum: number[] = new Array(binCount);
    for (let b = 0; b < binCount; b++) {
      const freqRatio = b / binCount;
      let val = 0;

      if (freqRatio < 0.2) {
        // Low frequencies (Bass)
        val = bass * (1 - freqRatio * 3) + Math.sin(timestamp * 8 + b) * 0.1;
      } else if (freqRatio < 0.6) {
        // Mid frequencies
        val = mids * (1 - (freqRatio - 0.2) * 2) + Math.cos(timestamp * 12 + b * 0.5) * 0.15;
      } else {
        // High frequencies (Treble)
        val = treble * (1 - (freqRatio - 0.6) * 2.5) + Math.sin(timestamp * 20 + b) * 0.1;
      }

      spectrum[b] = Math.min(1, Math.max(0.02, val));
    }

    const subBass = Math.min(1, Math.max(0.08, beatPulse * 0.85 + wave1 * 0.15));
    const kickTransient = beatPulse > 0.65 ? Math.min(1, beatPulse * 1.2) : 0.05;

    frames.push({
      frameIndex: i,
      timestamp,
      volume,
      bass,
      subBass,
      kickTransient,
      mids,
      treble,
      spectrum,
      isBeat: beatPulse > 0.65,
    });
  }

  return {
    duration: durationSeconds,
    fps,
    totalFrames,
    bpm,
    frames,
  };
}

/**
 * Retrieves the smoothed AudioAnimationFrame for a given frame index.
 */
export function getFrameAudioData(
  analysis: AudioAnalysisData | undefined,
  frameIndex: number,
  fps: number = 30
): AudioAnimationFrame {
  if (analysis && analysis.frames && analysis.frames.length > 0) {
    const clampedIndex = Math.min(Math.max(0, frameIndex), analysis.frames.length - 1);
    const frame = analysis.frames[clampedIndex];
    const prevFrame = clampedIndex > 0 ? analysis.frames[clampedIndex - 1] : frame;

    const bassVal = frame.bass || 0;
    const prevBass = prevFrame.bass || 0;
    const bassOnset = Math.max(0, bassVal - prevBass);

    const subBass = frame.subBass !== undefined ? frame.subBass : Math.min(1, bassVal * 1.15);
    const kickTransient = frame.kickTransient !== undefined ? frame.kickTransient : Math.min(1, bassOnset * 3.0 + (frame.isBeat ? 0.7 : 0.05));

    return {
      ...frame,
      subBass,
      kickTransient,
    };
  }

  // Fallback synthetic frame generation
  const timestamp = frameIndex / fps;
  const beatPulse = Math.pow(Math.max(0, 1 - ((frameIndex % (fps / 2)) / (fps / 2)) * 2), 2);
  const bass = 0.3 + beatPulse * 0.5;
  const subBass = Math.min(1, bass * 1.2);
  const kickTransient = beatPulse > 0.6 ? 0.9 : 0.05;
  const mids = 0.4 + Math.sin(timestamp * 2) * 0.2;
  const treble = 0.25 + Math.cos(timestamp * 5) * 0.15;
  const volume = (bass + mids + treble) / 3;

  const binCount = 64;
  const spectrum = new Array(binCount).fill(0).map((_, idx) => {
    const r = idx / binCount;
    return Math.min(1, Math.max(0.05, (1 - r) * volume * 0.8 + Math.sin(timestamp * 6 + idx) * 0.15));
  });

  return {
    frameIndex,
    timestamp,
    volume,
    bass,
    subBass,
    kickTransient,
    mids,
    treble,
    spectrum,
    isBeat: beatPulse > 0.6,
  };
}
