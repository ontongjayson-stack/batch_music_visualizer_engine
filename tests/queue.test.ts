import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs-extra';
import { scanAlbum } from '../src/pipeline/scanner.js';
import { JobQueueManager } from '../src/pipeline/queue.js';
import type { RenderOptions } from '../src/types/index.js';
import { createMockAlbumDir } from './test-utils.js';

describe('Job Queue Manager Module', () => {
  let tmpDir: string;
  let mockAlbumDir: string;
  let outputDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'batch-vis-queue-test-'));
    mockAlbumDir = await createMockAlbumDir(tmpDir);
    outputDir = path.join(tmpDir, 'output');
  });

  afterAll(async () => {
    await fs.remove(tmpDir);
  });

  it('should initialize queue from scanned AlbumBundle and persist state', async () => {
    const albumBundle = await scanAlbum(mockAlbumDir);
    const renderOptions: RenderOptions = {
      preset: 'neon-bars',
      platforms: ['youtube', 'shorts'],
      outputDir,
      fps: 30,
    };

    const stateFilePath = path.join(tmpDir, 'queue-state.json');
    const queue = new JobQueueManager({ stateFilePath, maxRetries: 2 });
    await queue.initializeFromAlbum(albumBundle, renderOptions);

    const summary = queue.getStateSummary();
    expect(summary.total).toBe(3);
    expect(summary.pending).toBe(3);
    expect(summary.done).toBe(0);

    expect(await fs.pathExists(stateFilePath)).toBe(true);
  });

  it('should process queue jobs sequentially and emit events', async () => {
    const albumBundle = await scanAlbum(mockAlbumDir);
    const renderOptions: RenderOptions = {
      preset: 'default',
      platforms: ['youtube'],
      outputDir,
      fps: 30,
    };

    const stateFilePath = path.join(tmpDir, 'queue-state-process.json');
    const queue = new JobQueueManager({ stateFilePath, concurrency: 1 });

    const startedJobs: string[] = [];
    const completedJobs: string[] = [];
    let queueFinishedCount = -1;

    queue.on('jobStarted', (job) => {
      startedJobs.push(job.id);
    });

    queue.on('jobCompleted', (job) => {
      completedJobs.push(job.id);
    });

    queue.on('queueFinished', (completed) => {
      queueFinishedCount = completed;
    });

    await queue.initializeFromAlbum(albumBundle, renderOptions);
    await queue.start();

    expect(startedJobs.length).toBe(3);
    expect(completedJobs.length).toBe(3);
    expect(queueFinishedCount).toBe(3);

    const finalSummary = queue.getStateSummary();
    expect(finalSummary.done).toBe(3);
    expect(finalSummary.pending).toBe(0);
    expect(finalSummary.failed).toBe(0);
  });

  it('should pause and resume queue execution', async () => {
    const albumBundle = await scanAlbum(mockAlbumDir);
    const renderOptions: RenderOptions = {
      preset: 'default',
      platforms: ['instagram'],
      outputDir,
      fps: 30,
    };

    const stateFilePath = path.join(tmpDir, 'queue-state-pause.json');
    const queue = new JobQueueManager({ stateFilePath, concurrency: 1 });
    await queue.initializeFromAlbum(albumBundle, renderOptions);

    queue.pause();
    expect(queue.getStateSummary().status).toBe('paused');

    await queue.start(); // Should not start processing while paused
    expect(queue.getStateSummary().done).toBe(0);

    await queue.resume(); // Should start processing
    expect(queue.getStateSummary().done).toBe(3);
  });

  it('should retry failed jobs up to maxRetries', async () => {
    const albumBundle = await scanAlbum(mockAlbumDir);
    const renderOptions: RenderOptions = {
      preset: 'default',
      platforms: ['tiktok'],
      outputDir,
      fps: 30,
    };

    let attemptCounter = 0;
    const stateFilePath = path.join(tmpDir, 'queue-state-retry.json');
    
    // Custom processor that fails the first track twice, then succeeds
    const queue = new JobQueueManager({
      stateFilePath,
      concurrency: 1,
      maxRetries: 2,
      processor: async (job) => {
        if (job.track.trackNumber === 1 && attemptCounter < 2) {
          attemptCounter++;
          throw new Error('Simulated transient render error');
        }
        return ['mock_out.mp4'];
      },
    });

    const retryEvents: number[] = [];
    queue.on('jobRetrying', (job, attempt) => {
      retryEvents.push(attempt);
    });

    await queue.initializeFromAlbum(albumBundle, renderOptions);
    await queue.start();

    expect(retryEvents).toEqual([1, 2]);
    expect(queue.getStateSummary().done).toBe(3);
    expect(queue.getStateSummary().failed).toBe(0);
  });
});
