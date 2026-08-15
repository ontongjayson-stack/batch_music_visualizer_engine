#!/usr/bin/env node

import path from 'node:path';
import { Command } from 'commander';
import { scanAlbum } from '../pipeline/scanner.js';
import { JobQueueManager } from '../pipeline/queue.js';
import type { RenderOptions } from '../types/index.js';

const program = new Command();

program
  .name('generate-album')
  .description('Batch Music Visualizer Engine - Ingestion, Audio Analysis & Render Queue CLI')
  .version('1.0.0')
  .argument('<album-folder>', 'Path to the input album directory containing audio files')
  .option('-p, --preset <name>', 'Visualizer preset style (e.g. default, neon-bars, vinyl, minimalist)', 'default')
  .option(
    '--platforms <platforms>',
    'Target social media platforms (comma-separated: youtube,tiktok,instagram,shorts)',
    'youtube,instagram,tiktok,shorts'
  )
  .option('-o, --output-dir <path>', 'Directory where rendered videos and manifests are saved', './output')
  .option('--fps <number>', 'Frame rate for video rendering and audio analysis', (val) => parseInt(val, 10), 30)
  .option('-f, --force', 'Force re-analysis of audio files, ignoring cached data', false)
  .option('-r, --resume', 'Resume execution from previously saved queue state', true)
  .option('-c, --concurrency <number>', 'Number of concurrent track processing workers', (val) => parseInt(val, 10), 1)
  .action(async (albumFolder: string, options: any) => {
    console.log('\n======================================================');
    console.log('   🎵 BATCH MUSIC VISUALIZER ENGINE - PIPELINE');
    console.log('======================================================\n');

    try {
      const resolvedAlbumPath = path.resolve(albumFolder);
      const outputDir = path.resolve(options.outputDir);
      const platforms = options.platforms.split(',').map((p: string) => p.trim().toLowerCase());

      console.log(`🔍 Scanning Album Directory: ${resolvedAlbumPath}`);
      const albumBundle = await scanAlbum(resolvedAlbumPath);

      console.log(`\n📌 Album Details:`);
      console.log(`   - Title:          ${albumBundle.albumTitle}`);
      console.log(`   - Artist:         ${albumBundle.artist}`);
      console.log(`   - Total Tracks:   ${albumBundle.totalTracks}`);
      console.log(`   - Total Duration: ${(albumBundle.totalDuration / 60).toFixed(1)} mins`);
      console.log(`   - Cover Artwork:  ${albumBundle.coverArtPath ? path.basename(albumBundle.coverArtPath) : 'None found (using placeholder/embedded)'}`);
      console.log(`   - Output Dir:     ${outputDir}`);
      console.log(`   - Preset:         ${options.preset}`);
      console.log(`   - Platforms:      ${platforms.join(', ')}`);
      console.log(`   - FPS / Workers:  ${options.fps} fps / ${options.concurrency} worker(s)\n`);

      console.log(`📋 Tracks Found:`);
      for (const track of albumBundle.tracks) {
        console.log(`   ${track.trackNumber.toString().padStart(2, '0')}. ${track.title} [${track.artist}] (${(track.duration / 60).toFixed(1)}m)`);
      }
      console.log('\n------------------------------------------------------\n');

      const renderOptions: RenderOptions = {
        preset: options.preset,
        platforms,
        outputDir,
        fps: options.fps,
        force: options.force,
        concurrency: options.concurrency,
      };

      const stateFilePath = path.join(outputDir, path.basename(resolvedAlbumPath), '.queue-state.json');
      const queue = new JobQueueManager({
        stateFilePath,
        concurrency: options.concurrency,
      });

      queue.on('jobStarted', (job) => {
        console.log(`▶ [Track ${job.track.trackNumber}/${albumBundle.totalTracks}] Starting: ${job.track.title}`);
      });

      queue.on('jobProgress', (job, progress, step) => {
        console.log(`  ⏳ [Track ${job.track.trackNumber}] ${progress}% - ${step}`);
      });

      queue.on('jobCompleted', (job) => {
        console.log(`✅ [Track ${job.track.trackNumber}] COMPLETED: ${job.track.title}\n`);
      });

      queue.on('jobRetrying', (job, attempt) => {
        console.log(`⚠️ [Track ${job.track.trackNumber}] Attempt ${attempt} failed. Retrying...`);
      });

      queue.on('jobFailed', (job, err) => {
        console.error(`❌ [Track ${job.track.trackNumber}] FAILED: ${job.track.title} - ${err.message}\n`);
      });

      queue.on('queueFinished', (completed, failed) => {
        console.log('======================================================');
        console.log('   🎉 BATCH PROCESSING COMPLETED');
        console.log('======================================================');
        console.log(`   - Successful Tracks: ${completed}`);
        console.log(`   - Failed Tracks:     ${failed}`);
        console.log(`   - Output Path:       ${outputDir}`);
        console.log('======================================================\n');
      });

      await queue.initializeFromAlbum(albumBundle, renderOptions, options.resume);
      
      console.log(`🚀 Queue Initialized. Processing tracks...\n`);
      await queue.start();

    } catch (err: any) {
      console.error(`\n❌ Error processing album: ${err?.message || err}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
