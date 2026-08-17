/**
 * Video Renderer Engine
 * Batch Music Visualizer Engine
 * 
 * Uses @napi-rs/canvas + FFmpeg rawvideo pipe for high-performance H.264/AAC video encoding.
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { createCanvas, loadImage, SKRSContext2D, Image } from '@napi-rs/canvas';

import {
  RenderOptions,
  RenderResult,
  VisualPreset,
  VisualPresetName,
  AspectRatioMode,
  Dimensions,
  AudioAnalysisData,
} from './types.js';
import { getPreset, getDimensions, getSafeAreaInsets } from './presets.js';
import { generateSyntheticAudioAnalysis, getFrameAudioData } from './audioAnalysis.js';
import { drawBackground } from './components/background.js';
import { ParticleSystem } from './components/particles.js';
import { drawSpectrum } from './components/spectrum.js';
import { drawProgressBar } from './components/progress.js';
import { drawTextLayout } from './components/textLayout.js';
import { drawCinematicAlbumComposition } from './components/cinematicAlbum.js';

/**
 * Gets exact duration of an audio file in seconds using ffprobe/ffmpeg.
 */
export async function getAudioDuration(audioPath: string): Promise<number> {
  return new Promise((resolve) => {
    const ffprobe = spawn('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      audioPath,
    ]);

    let output = '';
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.on('close', (code) => {
      const parsed = parseFloat(output.trim());
      if (code === 0 && !isNaN(parsed) && parsed > 0) {
        resolve(parsed);
      } else {
        // Fallback default duration if ffprobe cannot read file metadata
        resolve(30);
      }
    });

    ffprobe.on('error', () => {
      resolve(30);
    });
  });
}

/**
 * Main Video Renderer Function
 */
export async function renderVideo(options: RenderOptions): Promise<RenderResult> {
  const startTime = Date.now();

  const {
    audioPath,
    audioAnalysis: inputAnalysis,
    preset: presetName = 'DEFAULT',
    aspectRatio: aspectInput = 'LANDSCAPE',
    outputPath,
    backgroundPath,
    logoPath,
    trackTitle = 'Untitled Track',
    artistName = 'Unknown Artist',
    albumName,
    watermarkText = 'BATCH MUSIC ENGINE',
    fps = 30,
    onProgress,
  } = options;

  // 1. Validate Audio File
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found at path: ${audioPath}`);
  }

  // 2. Setup Dimensions & Presets
  const dimensions: Dimensions = getDimensions(aspectInput);
  const { width, height } = dimensions;
  const safeArea = getSafeAreaInsets(aspectInput);

  let preset: VisualPreset = getPreset(presetName as VisualPresetName);
  if (options.visualConfig?.customPreset) {
    preset = { ...preset, ...options.visualConfig.customPreset };
  }

  // 3. Ensure Output Directory Exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 4. Resolve Audio Duration & Analysis Data
  let duration = inputAnalysis?.duration;
  if (!duration || duration <= 0) {
    duration = await getAudioDuration(audioPath);
  }

  const audioAnalysis: AudioAnalysisData =
    inputAnalysis || generateSyntheticAudioAnalysis(duration, fps);

  const totalFrames = Math.max(1, Math.ceil(duration * fps));

  // 5. Preload Background & Logo Assets (if provided)
  let bgImage: Image | null = null;
  let logoImage: Image | null = null;

  if (backgroundPath && fs.existsSync(backgroundPath)) {
    try {
      bgImage = await loadImage(backgroundPath);
    } catch (err) {
      console.warn(`[Renderer] Could not load background image: ${backgroundPath}`, err);
    }
  }

  if (logoPath && fs.existsSync(logoPath)) {
    try {
      logoImage = await loadImage(logoPath);
    } catch (err) {
      console.warn(`[Renderer] Could not load logo image: ${logoPath}`, err);
    }
  }

  // 6. Initialize Canvas & Particle System
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d') as SKRSContext2D;

  const particleSystem = new ParticleSystem(width, height);
  particleSystem.init(preset);

  // 7. Spawn FFmpeg Process for H.264/AAC rawvideo pipe encoding
  const ffmpegArgs = [
    '-y',
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgba',
    '-s',
    `${width}x${height}`,
    '-r',
    `${fps}`,
    '-i',
    'pipe:0',
    '-i',
    audioPath,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-preset',
    'fast',
    '-crf',
    '18',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-shortest',
    outputPath,
  ];

  const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
    stdio: ['pipe', 'ignore', 'pipe'],
  });

  let ffmpegErrLogs = '';
  ffmpeg.stderr?.on('data', (data) => {
    ffmpegErrLogs += data.toString();
  });

  // Handle FFmpeg Stdin Pipe Error
  ffmpeg.stdin.on('error', (err) => {
    console.error('[Renderer] FFmpeg stdin pipe error:', err);
  });

  // 8. Render Frame-by-Frame Pipeline
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      // Clear canvas frame
      ctx.clearRect(0, 0, width, height);

      // Get current audio frame parameters
      const audioData = getFrameAudioData(audioAnalysis, frameIndex, fps);

      if (preset.name === 'CINEMATIC-ALBUM') {
        // Render 6-Layer Cinematic Album V1 Visual Composition
        drawCinematicAlbumComposition({
          ctx,
          dimensions,
          preset,
          frameIndex,
          totalFrames,
          audioData,
          coverImage: bgImage,
          trackTitle,
          artistName,
          albumName,
          safeArea,
        });
      } else {
        // Standard Visual Presets Sequence
        drawBackground({
          ctx,
          dimensions,
          preset,
          frameIndex,
          totalFrames,
          audioData,
          bgImage,
        });

        particleSystem.updateAndDraw(ctx, preset, audioData);

        drawSpectrum({
          ctx,
          dimensions,
          preset,
          audioData,
          safeArea,
        });

        drawTextLayout({
          ctx,
          dimensions,
          aspectRatio: aspectInput,
          preset,
          safeArea,
          trackTitle,
          artistName,
          albumName,
          watermarkText,
          logoImage,
        });
      }

    // e. Render Progress Bar & Duration Counter
    drawProgressBar({
      ctx,
      dimensions,
      preset,
      audioData,
      durationSeconds: duration,
      safeArea,
    });

    // Extract raw RGBA frame buffer and write directly to FFmpeg stdin
    const rawBuffer = (canvas as any).data
      ? Buffer.from((canvas as any).data())
      : Buffer.from((ctx as any).getImageData(0, 0, width, height).data.buffer);
    const drained = ffmpeg.stdin.write(rawBuffer);

    // Backpressure handling if stream buffer fills up
    if (!drained) {
      await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve));
    }

    if (onProgress && frameIndex % 5 === 0) {
      const progressPercent = Math.round(((frameIndex + 1) / totalFrames) * 100);
      onProgress(progressPercent, frameIndex + 1, totalFrames);
    }
  }

  // Close FFmpeg stdin to signify stream completion
  ffmpeg.stdin.end();

  // Wait for FFmpeg process to close
  await new Promise<void>((resolve, reject) => {
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with error code ${code}. Logs:\n${ffmpegErrLogs}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`Failed to spawn FFmpeg process: ${err.message}`));
    });
  });

  const renderTimeSeconds = (Date.now() - startTime) / 1000;
  let fileSize: number | undefined;

  if (fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath);
    fileSize = stats.size;
  }

  return {
    outputPath,
    duration,
    totalFrames,
    width,
    height,
    fps,
    fileSize,
    renderTimeSeconds,
  };
}
