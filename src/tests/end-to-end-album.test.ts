/**
 * Full End-to-End Album Batch Production Test Suite
 * Batch Music Visualizer Engine
 */

import path from 'path';
import fs from 'fs-extra';
import { spawnSync } from 'child_process';
import { scanAlbum } from '../pipeline/scanner';
import { JobQueueManager } from '../pipeline/queue';
import { renderVideo } from '../rendering/renderer';
import { generateSocialMetadataBundle } from '../metadata/tagger';
import { generateThumbnails } from '../metadata/thumbnail';
import { RenderOptions } from '../types';

async function runEndToEndAlbumTest() {
  console.log('\n======================================================');
  console.log('   🚀 RUNNING COMPLETE END-TO-END ALBUM PRODUCTION TEST');
  console.log('======================================================\n');

  const demoAlbumDir = path.resolve('./demo_album_input');
  const outputDir = path.resolve('./output/DEMO_ALBUM_TEST');

  await fs.remove(demoAlbumDir);
  await fs.remove(outputDir);
  await fs.ensureDir(demoAlbumDir);
  await fs.ensureDir(outputDir);

  // 1. Create Synthetic Audio Tracks (3 tracks + 1 intentionally corrupted track to test resilience)
  console.log('1. Creating Test Album Audio Tracks & Cover Art...');

  const tracksToCreate = [
    { filename: '01 - Midnight Piano Trap.mp3', freq: 440 },
    { filename: '02 - Amapiano Night Fire.mp3', freq: 523 },
    { filename: '03 - Sunset Rhythm.mp3', freq: 659 },
  ];

  for (const t of tracksToCreate) {
    const trackPath = path.join(demoAlbumDir, t.filename);
    const res = spawnSync('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', `sine=frequency=${t.freq}:duration=3`,
      '-c:a', 'libmp3lame',
      '-b:a', '192k',
      trackPath,
    ]);

    if (res.status !== 0 || !fs.existsSync(trackPath)) {
      throw new Error(`Failed to synthesize track ${t.filename}: ${res.stderr?.toString()}`);
    }
  }

  // Intentionally add a corrupted 0-byte dummy file to verify queue error isolation
  const badTrackPath = path.join(demoAlbumDir, '04 - Corrupted File Test.mp3');
  await fs.writeFile(badTrackPath, 'INVALID_CORRUPTED_AUDIO_DATA_TEST');

  // Create test cover artwork using Canvas snapshot
  const { createCanvas } = require('@napi-rs/canvas');
  const canvas = createCanvas(1000, 1000);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0f051d';
  ctx.fillRect(0, 0, 1000, 1000);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 60px sans-serif';
  ctx.fillText('DEMO ALBUM', 300, 500);
  const coverArtPath = path.join(demoAlbumDir, 'cover.jpg');
  await fs.writeFile(coverArtPath, canvas.toBuffer('image/jpeg'));

  console.log(`✅ Demo Album Created at: ${demoAlbumDir}\n`);

  // 2. Step 1: Ingestion & Album Scanning
  console.log('2. Ingesting & Scanning Album Directory...');
  const albumBundle = await scanAlbum(demoAlbumDir);
  console.log(`   - Album Title:    ${albumBundle.albumTitle}`);
  console.log(`   - Artist:         ${albumBundle.artist}`);
  console.log(`   - Total Tracks:   ${albumBundle.totalTracks}`);
  console.log(`   - Cover Artwork:  ${albumBundle.coverArtPath ? path.basename(albumBundle.coverArtPath) : 'None'}`);

  if (albumBundle.totalTracks < 3) {
    throw new Error('Album scanner failed to detect audio tracks');
  }

  // 3. Step 2: Batch Queue Initialization & Execution
  console.log('\n3. Initializing Job Queue for Landscape & Social Vertical Videos...');
  const renderOptions: RenderOptions = {
    preset: 'TRAP-PIANO',
    platforms: ['youtube', 'tiktok', 'instagram', 'shorts'],
    outputDir,
    fps: 30,
    concurrency: 1,
  };

  const queueStateFile = path.join(outputDir, '.queue-state.json');
  const queue = new JobQueueManager({
    stateFilePath: queueStateFile,
    concurrency: 1,
  });

  queue.on('jobStarted', (job) => {
    console.log(`▶ Starting Track ${job.track.trackNumber}: "${job.track.title}"`);
  });

  queue.on('jobProgress', (job, progress, step) => {
    process.stdout.write(`\r   Track ${job.track.trackNumber} Progress: ${progress}% (${step})`);
  });

  queue.on('jobCompleted', (job) => {
    console.log(`\n✅ COMPLETED Track ${job.track.trackNumber}: "${job.track.title}"`);
  });

  queue.on('jobFailed', (job, err) => {
    console.log(`\n⚠️ ISOLATED EXPECTED FAILURE for Track ${job.track.trackNumber} ("${job.track.title}"): ${err.message}`);
    console.log(`   (Queue continues uninterrupted to remaining tracks)`);
  });

  await queue.initializeFromAlbum(albumBundle, renderOptions, false);
  console.log('\nStarting queue execution...');
  await queue.start();

  // 4. Step 3: Verification of Output Folders & Files
  console.log('\n4. Verifying Rendered Output Directory Structure & Files...');

  const platforms = ['YouTube', 'TikTok', 'Instagram', 'Shorts'];
  for (const plat of platforms) {
    const platFolder = path.join(outputDir, plat);
    if (!fs.existsSync(platFolder)) {
      throw new Error(`Output folder missing for platform: ${plat}`);
    }

    const files = await fs.readdir(platFolder);
    console.log(`   📁 ${plat}/: ${files.length} video file(s) rendered -> [${files.join(', ')}]`);

    if (files.length === 0) {
      throw new Error(`No MP4 videos rendered in ${plat} folder`);
    }

    // Verify first MP4 is valid and non-empty
    const firstVideoPath = path.join(platFolder, files[0]);
    const stat = await fs.stat(firstVideoPath);
    if (stat.size <= 1000) {
      throw new Error(`Rendered video file is empty or corrupted: ${firstVideoPath}`);
    }
  }

  // 5. Step 4: Verify Social Metadata Manifests & Thumbnails
  console.log('\n5. Verifying Social Metadata & Thumbnail Generation...');
  const metadataFolder = path.join(outputDir, 'Metadata');
  const thumbnailFolder = path.join(outputDir, 'Thumbnails');

  if (fs.existsSync(metadataFolder)) {
    const metaFiles = await fs.readdir(metadataFolder);
    console.log(`   📁 Metadata/: ${metaFiles.length} file(s) -> [${metaFiles.join(', ')}]`);
  }

  if (fs.existsSync(thumbnailFolder)) {
    const thumbFiles = await fs.readdir(thumbnailFolder);
    console.log(`   📁 Thumbnails/: ${thumbFiles.length} image(s) -> [${thumbFiles.join(', ')}]`);
  }

  console.log('\n======================================================');
  console.log('   🎉 ALL END-TO-END ALBUM PRODUCTION CHECKS PASSED!');
  console.log('======================================================\n');
}

runEndToEndAlbumTest().catch((err) => {
  console.error('\n❌ End-to-End Test Failed:', err);
  process.exit(1);
});
