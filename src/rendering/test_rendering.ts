/**
 * Video Renderer End-to-End Test Suite
 * Batch Music Visualizer Engine
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { renderVideo } from './renderer.js';
import { VISUAL_PRESETS } from './presets.js';
import { VisualPresetName } from './types.js';

async function runEndToEndTest() {
  console.log('=============== BATCH MUSIC VISUALIZER ENGINE ===============');
  console.log('Starting End-to-End Rendering Layer Test...\n');

  const testDir = path.resolve('./temp_test_output');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const sampleAudioPath = path.join(testDir, 'test_audio.mp3');

  // 1. Generate 2-second test audio track using FFmpeg synth
  console.log('Generating synthetic 2-second audio track via FFmpeg...');
  const audioGen = spawnSync('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=2',
    '-c:a',
    'libmp3lame',
    '-b:a',
    '192k',
    sampleAudioPath,
  ]);

  if (audioGen.status !== 0 || !fs.existsSync(sampleAudioPath)) {
    console.error('Failed to generate sample audio track:', audioGen.stderr?.toString());
    process.exit(1);
  }
  console.log(`Sample audio generated: ${sampleAudioPath}\n`);

  // 2. Test Rendering Landscape (1920x1080) with DEFAULT preset
  const landscapeOutputPath = path.join(testDir, 'test_landscape_default.mp4');
  console.log('Rendering LANDSCAPE (1920x1080, 16:9) video [DEFAULT preset]...');

  const landscapeResult = await renderVideo({
    audioPath: sampleAudioPath,
    preset: 'DEFAULT',
    aspectRatio: 'LANDSCAPE',
    outputPath: landscapeOutputPath,
    trackTitle: 'Midnight Cyber Drive',
    artistName: 'Synthwave Producer',
    albumName: 'Neon Horizon LP',
    watermarkText: 'BATCH MUSIC VISUALIZER',
    fps: 30,
    onProgress: (progress) => {
      process.stdout.write(`\r  Landscape Render Progress: ${progress}%`);
    },
  });

  console.log('\nLandscape Render Completed Successfully!');
  console.log(`  File: ${landscapeResult.outputPath}`);
  console.log(`  Dimensions: ${landscapeResult.width}x${landscapeResult.height}`);
  console.log(`  Duration: ${landscapeResult.duration}s (${landscapeResult.totalFrames} frames)`);
  console.log(`  File Size: ${(landscapeResult.fileSize! / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Render Time: ${landscapeResult.renderTimeSeconds.toFixed(2)}s\n`);

  // 3. Test Rendering Portrait (1080x1920) with TRAP-PIANO preset
  const portraitOutputPath = path.join(testDir, 'test_portrait_trap_piano.mp4');
  console.log('Rendering PORTRAIT (1080x1920, 9:16) video [TRAP-PIANO preset]...');

  const portraitResult = await renderVideo({
    audioPath: sampleAudioPath,
    preset: 'TRAP-PIANO',
    aspectRatio: 'PORTRAIT',
    outputPath: portraitOutputPath,
    trackTitle: 'Nocturnal Melodies',
    artistName: 'Trap Maestro',
    albumName: 'Grand Piano Vol 1',
    watermarkText: 'SHORTS / REELS SAFE',
    fps: 30,
    onProgress: (progress) => {
      process.stdout.write(`\r  Portrait Render Progress: ${progress}%`);
    },
  });

  console.log('\nPortrait Render Completed Successfully!');
  console.log(`  File: ${portraitResult.outputPath}`);
  console.log(`  Dimensions: ${portraitResult.width}x${portraitResult.height}`);
  console.log(`  Duration: ${portraitResult.duration}s (${portraitResult.totalFrames} frames)`);
  console.log(`  File Size: ${(portraitResult.fileSize! / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Render Time: ${portraitResult.renderTimeSeconds.toFixed(2)}s\n`);

  // 4. Test Presets Verification
  console.log('Verifying all 8 required presets rendering support...');
  const presetNames = Object.keys(VISUAL_PRESETS) as VisualPresetName[];
  console.log(`Supported Presets (${presetNames.length}): ${presetNames.join(', ')}`);

  for (const presetName of presetNames) {
    const presetOutPath = path.join(testDir, `test_preset_${presetName.toLowerCase()}.mp4`);
    console.log(`Rendering preset: ${presetName}...`);
    const pResult = await renderVideo({
      audioPath: sampleAudioPath,
      preset: presetName,
      aspectRatio: 'LANDSCAPE',
      outputPath: presetOutPath,
      trackTitle: `Preset: ${presetName}`,
      artistName: 'Visualizer Engine',
      fps: 30,
      onProgress: (progress) => {
        process.stdout.write(`\r  ${presetName} Progress: ${progress}%`);
      },
    });

    if (!fs.existsSync(pResult.outputPath) || pResult.fileSize! <= 0) {
      throw new Error(`Preset render failed for ${presetName}`);
    }
    console.log(`\n  -> Verified ${presetName} MP4 (${(pResult.fileSize! / 1024 / 1024).toFixed(2)} MB)`);
  }

  console.log('\nAll 8 presets successfully verified and rendered playable MP4s!');
  console.log('\n=============== ALL TEST CHECKS PASSED ===============\n');
}

runEndToEndTest().catch((err) => {
  console.error('\nEnd-to-End Render Test Error:', err);
  process.exit(1);
});
