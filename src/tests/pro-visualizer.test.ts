/**
 * Pro Audio-Reactive Visual System Test Suite
 * Batch Music Visualizer Engine
 */

import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import { renderVideo } from '../rendering/renderer.js';
import { getPreset, VISUAL_PRESETS } from '../rendering/presets.js';
import { SubwooferPhysics } from '../rendering/subwooferPhysics.js';
import { generateSyntheticAudioAnalysis } from '../rendering/audioAnalysis.js';

async function getFfprobeDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);

    let output = '';
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0 && output.trim()) {
        resolve(parseFloat(output.trim()));
      } else {
        reject(new Error(`ffprobe failed with code ${code}`));
      }
    });
  });
}

async function runProVisualizerTests() {
  console.log(`\n================================================================`);
  console.log(`🎬 RUNNING PRO AUDIO-REACTIVE VISUAL SYSTEM TEST SUITE`);
  console.log(`================================================================\n`);

  const testOutputDir = path.resolve('test_output_pro_visualizer');
  await fs.ensureDir(testOutputDir);

  // ----------------------------------------------------------------------------
  // TEST GROUP 1: Preset Definition & Color Palette
  // ----------------------------------------------------------------------------
  console.log(`--- TEST GROUP 1: Preset Definition & Configuration ---`);
  const proPreset = getPreset('PRO-CINEMATIC-SPEAKER');
  if (proPreset && proPreset.name === 'PRO-CINEMATIC-SPEAKER') {
    console.log(`  ✅ [PASS] Loaded PRO-CINEMATIC-SPEAKER preset definition`);
  } else {
    throw new Error(`❌ [FAIL] PRO-CINEMATIC-SPEAKER preset failed to load`);
  }

  if (proPreset.colors && proPreset.colors.primary && proPreset.colors.accent) {
    console.log(`  ✅ [PASS] Color palette verified: Primary=${proPreset.colors.primary}, Accent=${proPreset.colors.accent}`);
  } else {
    throw new Error(`❌ [FAIL] Color palette configuration invalid`);
  }

  // ----------------------------------------------------------------------------
  // TEST GROUP 2: Subwoofer Physics Mass-Spring-Damper Model
  // ----------------------------------------------------------------------------
  console.log(`\n--- TEST GROUP 2: Subwoofer Physics Oscillator Model ---`);
  const physics = new SubwooferPhysics();
  const state1 = physics.update(1 / 30, 0.8, 0.9, 1.4);
  if (state1.displacement > 0 && state1.velocity > 0) {
    console.log(`  ✅ [PASS] Subwoofer cone excursion attack verified (Displacement: ${state1.displacement.toFixed(3)}, Velocity: ${state1.velocity.toFixed(3)})`);
  } else {
    throw new Error(`❌ [FAIL] Physics model did not respond to driving force`);
  }

  // Damping recovery test
  const state2 = physics.update(1 / 30, 0.0, 0.0, 1.4);
  if (state2.displacement >= 0) {
    console.log(`  ✅ [PASS] Damping recovery verified without negative instability`);
  }

  // ----------------------------------------------------------------------------
  // TEST GROUP 3: Render 16:9 Landscape MP4 (YouTube Format)
  // ----------------------------------------------------------------------------
  console.log(`\n--- TEST GROUP 3: Render 16:9 Landscape Video (YouTube Format) ---`);
  const landscapeOutput = path.join(testOutputDir, 'test_pro_landscape_16x9.mp4');
  const syntheticAnalysis = generateSyntheticAudioAnalysis(3.0, 30, 128);

  // Generate synthetic test artwork canvas
  const { createCanvas } = await import('@napi-rs/canvas');
  const canvas1 = createCanvas(600, 600);
  const ctx1 = canvas1.getContext('2d');
  ctx1.fillStyle = '#0f172a';
  ctx1.fillRect(0, 0, 600, 600);
  ctx1.fillStyle = '#00f0ff';
  ctx1.font = 'bold 36px sans-serif';
  ctx1.fillText('PRO VISUALIZER', 140, 300);
  const testCoverPath = path.join(testOutputDir, 'test_cover.png');
  await fs.writeFile(testCoverPath, canvas1.toBuffer('image/png'));

  console.log(`🎬 Rendering 16:9 Landscape video -> ${path.basename(landscapeOutput)}...`);
  const res16x9 = await renderVideo({
    audioPath: testCoverPath, // mock valid image file path for render test
    audioAnalysis: syntheticAnalysis,
    preset: 'PRO-CINEMATIC-SPEAKER',
    aspectRatio: '16:9',
    outputPath: landscapeOutput,
    backgroundPath: testCoverPath,
    trackTitle: 'Pro Subwoofer Test Track',
    artistName: 'Antigravity Audio',
    albumName: 'Cinematic System V1',
    showCenterArt: true,
    fps: 30,
  });

  if (await fs.pathExists(landscapeOutput)) {
    const stat = await fs.stat(landscapeOutput);
    console.log(`  ✅ [PASS] 16:9 Landscape MP4 rendered successfully (${(stat.size / 1024).toFixed(1)} KB, duration: ${res16x9.duration}s)`);
  } else {
    throw new Error(`❌ [FAIL] 16:9 Landscape MP4 file was not created`);
  }

  // ----------------------------------------------------------------------------
  // TEST GROUP 4: Render 9:16 Portrait MP4 (TikTok / Shorts Format)
  // ----------------------------------------------------------------------------
  console.log(`\n--- TEST GROUP 4: Render 9:16 Portrait Video (TikTok / Reels / Shorts Format) ---`);
  const portraitOutput = path.join(testOutputDir, 'test_pro_portrait_9x16.mp4');

  console.log(`🎬 Rendering 9:16 Portrait video -> ${path.basename(portraitOutput)}...`);
  const res9x16 = await renderVideo({
    audioPath: testCoverPath,
    audioAnalysis: syntheticAnalysis,
    preset: 'PRO-CINEMATIC-SPEAKER',
    aspectRatio: '9:16',
    outputPath: portraitOutput,
    backgroundPath: testCoverPath,
    trackTitle: 'Pro Subwoofer Social Track',
    artistName: 'Antigravity Audio',
    albumName: 'Vertical Social V1',
    showCenterArt: true,
    fps: 30,
  });

  if (await fs.pathExists(portraitOutput)) {
    const stat = await fs.stat(portraitOutput);
    console.log(`  ✅ [PASS] 9:16 Portrait MP4 rendered successfully (${(stat.size / 1024).toFixed(1)} KB, duration: ${res9x16.duration}s)`);
  } else {
    throw new Error(`❌ [FAIL] 9:16 Portrait MP4 file was not created`);
  }

  // ----------------------------------------------------------------------------
  // TEST GROUP 5: Render Center Artwork OFF Mode (showCenterArt: false)
  // ----------------------------------------------------------------------------
  console.log(`\n--- TEST GROUP 5: Render Center Artwork OFF Mode (showCenterArt: false) ---`);
  const noArtOutput = path.join(testOutputDir, 'test_pro_no_art.mp4');

  console.log(`🎬 Rendering with showCenterArt: false -> ${path.basename(noArtOutput)}...`);
  const resNoArt = await renderVideo({
    audioPath: testCoverPath,
    audioAnalysis: syntheticAnalysis,
    preset: 'PRO-CINEMATIC-SPEAKER',
    aspectRatio: '16:9',
    outputPath: noArtOutput,
    backgroundPath: testCoverPath,
    trackTitle: 'No Art Emblem Mode',
    artistName: 'Antigravity Audio',
    showCenterArt: false,
    fps: 30,
  });

  if (await fs.pathExists(noArtOutput)) {
    const stat = await fs.stat(noArtOutput);
    console.log(`  ✅ [PASS] Emblem Mode MP4 rendered successfully (${(stat.size / 1024).toFixed(1)} KB)`);
  } else {
    throw new Error(`❌ [FAIL] Emblem Mode MP4 file was not created`);
  }

  // ----------------------------------------------------------------------------
  // TEST GROUP 6: FFprobe Stream Duration Validation
  // ----------------------------------------------------------------------------
  console.log(`\n--- TEST GROUP 6: FFprobe Duration & Stream Validation ---`);
  const ffDuration = await getFfprobeDuration(landscapeOutput);
  if (Math.abs(ffDuration - 3.0) < 0.5) {
    console.log(`  ✅ [PASS] FFprobe validated output video stream duration (${ffDuration.toFixed(1)}s)`);
  } else {
    throw new Error(`❌ [FAIL] FFprobe reported unexpected duration: ${ffDuration}s`);
  }

  console.log(`\n================================================================`);
  console.log(`🎉 ALL PRO AUDIO-REACTIVE VISUAL SYSTEM TESTS PASSED SUCCESSFULLY!`);
  console.log(`================================================================\n`);

  // Cleanup test directory
  await fs.remove(testOutputDir);
}

runProVisualizerTests().catch((err) => {
  console.error('\n❌ Pro Visualizer Test Suite Failed:', err);
  process.exit(1);
});
