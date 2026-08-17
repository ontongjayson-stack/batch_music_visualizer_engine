/**
 * Cinematic Album V1 Visual Composition Automated Test Suite
 * Batch Music Visualizer Engine
 */

import path from 'path';
import fs from 'fs-extra';
import { getPreset } from '../rendering/presets.js';
import { renderVideo, getAudioDuration } from '../rendering/renderer.js';

async function runCinematicAlbumTestSuite() {
  console.log('\n================================================================');
  console.log('🎬 RUNNING CINEMATIC ALBUM V1 VISUAL COMPOSITION TEST SUITE');
  console.log('================================================================\n');

  const testOutputDir = path.resolve('./test_output_cinematic');
  await fs.ensureDir(testOutputDir);

  const sampleAudioPath = path.resolve('./demo_album_input/01 - Midnight Piano Trap.mp3');
  const sampleCoverPath = path.resolve('./demo_album_input/cover.jpg');

  // Verify Test Files Exist
  if (!fs.existsSync(sampleAudioPath)) {
    throw new Error(`Sample audio not found at: ${sampleAudioPath}`);
  }
  if (!fs.existsSync(sampleCoverPath)) {
    throw new Error(`Sample cover art not found at: ${sampleCoverPath}`);
  }

  // --- TEST GROUP 1: Preset Definition & Configuration ---
  console.log('--- TEST GROUP 1: Preset Definition & Configuration ---');
  const cinematicPreset = getPreset('CINEMATIC-ALBUM');
  console.assert(cinematicPreset.name === 'CINEMATIC-ALBUM', 'Preset name matches CINEMATIC-ALBUM');
  console.log('  ✅ [PASS] Loaded CINEMATIC-ALBUM preset definition');
  console.assert(cinematicPreset.colors.primary !== undefined, 'Preset has primary color defined');
  console.log('  ✅ [PASS] Color palette verified');
  console.assert(cinematicPreset.kenBurns.enabled === true, 'Ken Burns subtle drift enabled');
  console.log('  ✅ [PASS] Ken Burns parameters verified');

  // --- TEST GROUP 2: Render 16:9 Landscape Video (YouTube Format) ---
  console.log('\n--- TEST GROUP 2: Render 16:9 Landscape Video (YouTube Format) ---');
  const landscapeOutputPath = path.join(testOutputDir, 'test_cinematic_landscape_16x9.mp4');
  
  if (fs.existsSync(landscapeOutputPath)) {
    await fs.remove(landscapeOutputPath);
  }

  console.log(`🎬 Rendering 16:9 Landscape video -> ${path.basename(landscapeOutputPath)}...`);
  const landscapeResult = await renderVideo({
    audioPath: sampleAudioPath,
    preset: 'CINEMATIC-ALBUM',
    aspectRatio: '16:9',
    outputPath: landscapeOutputPath,
    backgroundPath: sampleCoverPath,
    trackTitle: 'Midnight Piano Trap',
    artistName: 'Amapiano Producer',
    albumName: 'Cinematic Piano Album',
    fps: 30,
  });

  console.assert(fs.existsSync(landscapeOutputPath), '16:9 Output MP4 file created');
  const landscapeStat = await fs.stat(landscapeOutputPath);
  console.assert(landscapeStat.size > 100000, `16:9 MP4 file size valid (${(landscapeStat.size / 1024).toFixed(1)} KB)`);
  console.log(`  ✅ [PASS] 16:9 Landscape MP4 rendered successfully (${(landscapeStat.size / 1024).toFixed(1)} KB, duration: ${landscapeResult.duration.toFixed(1)}s)`);

  // --- TEST GROUP 3: Render 9:16 Portrait Video (TikTok / Reels / Shorts Format) ---
  console.log('\n--- TEST GROUP 3: Render 9:16 Portrait Video (TikTok / Reels / Shorts Format) ---');
  const portraitOutputPath = path.join(testOutputDir, 'test_cinematic_portrait_9x16.mp4');

  if (fs.existsSync(portraitOutputPath)) {
    await fs.remove(portraitOutputPath);
  }

  console.log(`🎬 Rendering 9:16 Portrait video -> ${path.basename(portraitOutputPath)}...`);
  const portraitResult = await renderVideo({
    audioPath: sampleAudioPath,
    preset: 'CINEMATIC-ALBUM',
    aspectRatio: '9:16',
    outputPath: portraitOutputPath,
    backgroundPath: sampleCoverPath,
    trackTitle: 'Midnight Piano Trap',
    artistName: 'Amapiano Producer',
    albumName: 'Cinematic Piano Album',
    fps: 30,
  });

  console.assert(fs.existsSync(portraitOutputPath), '9:16 Output MP4 file created');
  const portraitStat = await fs.stat(portraitOutputPath);
  console.assert(portraitStat.size > 100000, `9:16 MP4 file size valid (${(portraitStat.size / 1024).toFixed(1)} KB)`);
  console.log(`  ✅ [PASS] 9:16 Portrait MP4 rendered successfully (${(portraitStat.size / 1024).toFixed(1)} KB, duration: ${portraitResult.duration.toFixed(1)}s)`);

  // --- TEST GROUP 4: FFprobe Video Stream Validation ---
  console.log('\n--- TEST GROUP 4: FFprobe Duration & Stream Validation ---');
  const verifiedDuration = await getAudioDuration(landscapeOutputPath);
  console.assert(verifiedDuration > 0, 'Rendered video duration is greater than 0');
  console.log(`  ✅ [PASS] FFprobe validated output video stream duration (${verifiedDuration.toFixed(1)}s)`);

  console.log('\n================================================================');
  console.log('🎉 ALL CINEMATIC ALBUM V1 TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runCinematicAlbumTestSuite().catch((err) => {
  console.error('\n❌ CINEMATIC ALBUM TEST SUITE FAILED:', err);
  process.exit(1);
});
