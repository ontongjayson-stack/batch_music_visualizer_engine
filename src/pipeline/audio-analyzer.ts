import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'fs-extra';
import { parseFile } from 'music-metadata';
import FFT from 'fft.js';
import type {
  AudioAnalysisResult,
  AudioFrameAnalysis,
  AudioMetadata,
  FrequencyBands,
} from '../types/index.js';

export interface AnalyzerOptions {
  fps?: number;           // Target frames per second (default: 30)
  numBands?: number;      // Number of FFT output bands for visualizers (default: 16)
  cacheDir?: string;      // Cache output directory
  force?: boolean;        // Force re-analysis ignoring cache
  sampleRate?: number;    // Internal PCM sample rate (default: 44100)
}

/**
 * Calculates Hann window value for a given sample index.
 */
function hannWindow(i: number, length: number): number {
  return 0.5 * (1 - Math.cos((2 * Math.PI * i) / (length - 1)));
}

/**
 * Maps frequency (Hz) to array index in FFT spectrum magnitude array.
 */
function freqToIndex(freq: number, sampleRate: number, fftSize: number): number {
  const nyquist = sampleRate / 2;
  const index = Math.round((freq / nyquist) * (fftSize / 2));
  return Math.min(Math.max(0, index), fftSize / 2 - 1);
}

/**
 * Computes average normalized magnitude in a frequency range [minFreq, maxFreq].
 */
function getAverageMagnitude(
  magnitudes: number[],
  minFreq: number,
  maxFreq: number,
  sampleRate: number,
  fftSize: number
): number {
  const startIndex = freqToIndex(minFreq, sampleRate, fftSize);
  const endIndex = freqToIndex(maxFreq, sampleRate, fftSize);

  if (startIndex >= endIndex) {
    return magnitudes[startIndex] || 0;
  }

  let sum = 0;
  let count = 0;
  for (let i = startIndex; i <= endIndex; i++) {
    sum += magnitudes[i];
    count++;
  }
  return count > 0 ? sum / count : 0;
}

/**
 * Decodes audio file to 16-bit Signed PCM (Mono) via ffmpeg stdout stream.
 */

export function decodeAudioToPCM(
  audioPath: string,
  targetSampleRate: number = 44100
): Promise<{ pcmBuffer: Buffer; duration: number }> {
  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', audioPath,
      '-f', 's16le',
      '-ac', '1',
      '-ar', targetSampleRate.toString(),
      'pipe:1',
    ];

    const child = spawn('ffmpeg', ffmpegArgs, { windowsHide: true });
    const chunks: Buffer[] = [];
    let errorOutput = '';

    child.stdout.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    child.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString();
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to start ffmpeg process for audio analysis: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(
          new Error(`FFmpeg audio decoding failed (exit code ${code}): ${errorOutput}`)
        );
      }
      const pcmBuffer = Buffer.concat(chunks);
      // 16-bit PCM (2 bytes per sample), mono
      const totalSamples = pcmBuffer.length / 2;
      const duration = totalSamples / targetSampleRate;
      resolve({ pcmBuffer, duration });
    });
  });
}

/**
 * Computes unique cache key hash for an audio file and analysis parameters.
 */
export async function computeCacheKey(audioPath: string, fps: number, numBands: number): Promise<string> {
  const stat = await fs.stat(audioPath);
  const data = `${audioPath}:${stat.size}:${stat.mtimeMs}:${fps}:${numBands}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

/**
 * Analyzes audio metadata and generates frame-by-frame RMS and FFT reactivity data.
 */
export async function analyzeAudio(
  audioPath: string,
  options: AnalyzerOptions = {}
): Promise<AudioAnalysisResult> {
  const resolvedPath = path.resolve(audioPath);
  if (!(await fs.pathExists(resolvedPath))) {
    throw new Error(`Audio file does not exist: ${resolvedPath}`);
  }

  const fps = options.fps || 30;
  const numBands = options.numBands || 16;
  const cacheDir = options.cacheDir || path.join(process.cwd(), '.cache', 'audio_analysis');
  const sampleRate = options.sampleRate || 44100;

  // 1. Check cache first unless forced
  const cacheKey = await computeCacheKey(resolvedPath, fps, numBands);
  const cacheFilePath = path.join(cacheDir, `${cacheKey}.json`);

  if (!options.force && (await fs.pathExists(cacheFilePath))) {
    try {
      const cachedContent = await fs.readJson(cacheFilePath);
      return cachedContent as AudioAnalysisResult;
    } catch {
      // If cache read fails, proceed to re-analyze
    }
  }

  // 2. Extract metadata
  let metadata: AudioMetadata = { duration: 0 };
  try {
    const meta = await parseFile(resolvedPath);
    metadata = {
      title: meta.common.title || path.parse(resolvedPath).name,
      artist: meta.common.artist || meta.common.albumartist || 'Unknown Artist',
      album: meta.common.album || 'Unknown Album',
      trackNumber: meta.common.track.no || undefined,
      trackTotal: meta.common.track.of || undefined,
      year: meta.common.year,
      genre: meta.common.genre,
      duration: meta.format.duration || 0,
      sampleRate: meta.format.sampleRate || sampleRate,
      channels: meta.format.numberOfChannels,
      bitrate: meta.format.bitrate,
      format: meta.format.container || path.extname(resolvedPath).replace('.', ''),
    };
  } catch {
    // Basic fallback if metadata parsing fails
    metadata = {
      title: path.parse(resolvedPath).name,
      artist: 'Unknown Artist',
      album: 'Unknown Album',
      duration: 0,
      sampleRate,
      format: path.extname(resolvedPath).replace('.', ''),
    };
  }

  // 3. Decode PCM raw audio
  const { pcmBuffer, duration: pcmDuration } = await decodeAudioToPCM(resolvedPath, sampleRate);
  const totalDuration = metadata.duration || pcmDuration;
  metadata.duration = totalDuration;

  const totalSamples = pcmBuffer.length / 2;
  const samplesPerFrame = Math.round(sampleRate / fps);
  const totalFrames = Math.max(1, Math.ceil(totalSamples / samplesPerFrame));

  // FFT setup
  const fftSize = 1024; // Radix-2 power of 2 for high speed
  const fft = new FFT(fftSize);
  const complexArray = fft.createComplexArray();

  const frames: AudioFrameAnalysis[] = [];

  // Logarithmic band split setup (numBands output bars)
  const minFreq = 20;
  const maxFreq = 20000;
  const bandLogStep = Math.log(maxFreq / minFreq) / numBands;

  for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
    const frameStartSample = frameIdx * samplesPerFrame;
    const timestamp = frameIdx / fps;

    let sumSquare = 0;
    let peakSample = 0;

    // Buffer for FFT windowed samples
    const fftSamples = new Float32Array(fftSize);

    for (let i = 0; i < samplesPerFrame; i++) {
      const sampleIdx = frameStartSample + i;
      let val = 0;
      if (sampleIdx < totalSamples) {
        // Read int16 little endian
        val = pcmBuffer.readInt16LE(sampleIdx * 2) / 32768.0;
      }

      sumSquare += val * val;
      const absVal = Math.abs(val);
      if (absVal > peakSample) {
        peakSample = absVal;
      }

      if (i < fftSize) {
        fftSamples[i] = val * hannWindow(i, fftSize);
      }
    }

    const count = Math.min(samplesPerFrame, Math.max(1, totalSamples - frameStartSample));
    const rms = Math.min(1.0, Math.sqrt(sumSquare / count));
    const peak = Math.min(1.0, peakSample);

    // Compute FFT
    fft.toComplexArray(fftSamples, complexArray);
    const outComplex = fft.createComplexArray();
    fft.transform(outComplex, complexArray);

    // Calculate magnitude spectrum for 0 to Nyquist (fftSize/2)
    const magnitudes: number[] = new Array(fftSize / 2);
    for (let k = 0; k < fftSize / 2; k++) {
      const re = outComplex[2 * k];
      const im = outComplex[2 * k + 1];
      const mag = Math.sqrt(re * re + im * im) / (fftSize / 2);
      magnitudes[k] = mag;
    }

    // Standard audio band grouping
    const subBass = getAverageMagnitude(magnitudes, 20, 60, sampleRate, fftSize);
    const bass = getAverageMagnitude(magnitudes, 60, 250, sampleRate, fftSize);
    const lowMids = getAverageMagnitude(magnitudes, 250, 500, sampleRate, fftSize);
    const mids = getAverageMagnitude(magnitudes, 500, 2000, sampleRate, fftSize);
    const highMids = getAverageMagnitude(magnitudes, 2000, 4000, sampleRate, fftSize);
    const presence = getAverageMagnitude(magnitudes, 4000, 6000, sampleRate, fftSize);
    const brilliance = getAverageMagnitude(magnitudes, 6000, 20000, sampleRate, fftSize);

    const bands: FrequencyBands = {
      subBass: Math.min(1.0, subBass * 4.0),
      bass: Math.min(1.0, bass * 3.5),
      lowMids: Math.min(1.0, lowMids * 3.0),
      mids: Math.min(1.0, mids * 2.5),
      highMids: Math.min(1.0, highMids * 2.5),
      presence: Math.min(1.0, presence * 3.0),
      brilliance: Math.min(1.0, brilliance * 3.5),
    };

    // Binned spectral bars for visualizer render
    const binnedBands: number[] = new Array(numBands);
    for (let b = 0; b < numBands; b++) {
      const bMin = minFreq * Math.exp(b * bandLogStep);
      const bMax = minFreq * Math.exp((b + 1) * bandLogStep);
      const avgMag = getAverageMagnitude(magnitudes, bMin, bMax, sampleRate, fftSize);
      // Scale logarithmic loudness for responsive visualizer movement
      const scaledVal = Math.min(1.0, Math.pow(avgMag * 3.0, 0.8));
      binnedBands[b] = parseFloat(scaledVal.toFixed(4));
    }

    frames.push({
      frameIndex: frameIdx,
      timestamp: parseFloat(timestamp.toFixed(3)),
      rms: parseFloat(rms.toFixed(4)),
      peak: parseFloat(peak.toFixed(4)),
      fft: binnedBands,
      bands: {
        subBass: parseFloat(bands.subBass.toFixed(4)),
        bass: parseFloat(bands.bass.toFixed(4)),
        lowMids: parseFloat(bands.lowMids.toFixed(4)),
        mids: parseFloat(bands.mids.toFixed(4)),
        highMids: parseFloat(bands.highMids.toFixed(4)),
        presence: parseFloat(bands.presence.toFixed(4)),
        brilliance: parseFloat(bands.brilliance.toFixed(4)),
      },
    });
  }

  const trackId = crypto.createHash('md5').update(resolvedPath).digest('hex').substring(0, 10);
  const result: AudioAnalysisResult = {
    trackId,
    audioPath: resolvedPath,
    duration: parseFloat(totalDuration.toFixed(2)),
    sampleRate,
    fps,
    totalFrames,
    numBands,
    metadata,
    frames,
    cachedAt: new Date().toISOString(),
  };

  // Save to cache
  await fs.ensureDir(cacheDir);
  await fs.writeJson(cacheFilePath, result, { spaces: 2 });

  return result;
}
