import path from 'node:path';
import EventEmitter from 'node:events';
import fs from 'fs-extra';
import { analyzeAudio } from './audio-analyzer';
import { renderVideo } from '../rendering/renderer';
import { generateSocialMetadataBundle } from '../metadata/tagger';
import { generateThumbnails } from '../metadata/thumbnail';
import type {
  AlbumBundle,
  JobStatus,
  QueueEvents,
  QueueJob,
  QueueState,
  RenderOptions,
  SocialPlatform,
} from '../types';

export interface QueueManagerOptions {
  stateFilePath?: string;
  concurrency?: number;
  maxRetries?: number;
  processor?: (job: QueueJob, updateProgress: (progress: number, step: string) => Promise<void>) => Promise<string[]>;
}

export declare interface JobQueueManager {
  on<U extends keyof QueueEvents>(event: U, listener: QueueEvents[U]): this;
  emit<U extends keyof QueueEvents>(event: U, ...args: Parameters<QueueEvents[U]>): boolean;
}

export class JobQueueManager extends EventEmitter {
  private jobs: QueueJob[] = [];
  private stateFilePath: string | null = null;
  private concurrency: number;
  private maxRetries: number;
  private isProcessing = false;
  private isPaused = false;
  private activeWorkers = 0;
  private completionResolver: (() => void) | null = null;
  private completionPromise: Promise<void> | null = null;
  private customProcessor?: (job: QueueJob, updateProgress: (progress: number, step: string) => Promise<void>) => Promise<string[]>;

  constructor(options: QueueManagerOptions = {}) {
    super();
    this.stateFilePath = options.stateFilePath || null;
    this.concurrency = Math.max(1, options.concurrency || 1);
    this.maxRetries = options.maxRetries !== undefined ? options.maxRetries : 2;
    this.customProcessor = options.processor;
  }

  public async initializeFromAlbum(
    album: AlbumBundle,
    options: RenderOptions,
    resumeState = true
  ): Promise<QueueJob[]> {
    if (this.stateFilePath && resumeState && (await fs.pathExists(this.stateFilePath))) {
      try {
        const savedState: QueueState = await fs.readJson(this.stateFilePath);
        if (savedState.albumPath === album.albumPath && Array.isArray(savedState.jobs) && savedState.jobs.length > 0) {
          this.jobs = savedState.jobs.map((j) => {
            if (j.status === 'ANALYZING' || j.status === 'RENDERING') {
              j.status = 'PENDING';
              j.progress = 0;
              j.currentStep = 'Resumed job. Reset to pending.';
            }
            return j;
          });
          return this.jobs;
        }
      } catch (err) {
        console.warn(`[QueueManager] Could not parse saved queue state file. Re-creating queue...`, err);
      }
    }

    const now = new Date().toISOString();
    this.jobs = album.tracks.map((track) => {
      const jobId = `${path.basename(album.albumPath)}_${track.trackNumber.toString().padStart(2, '0')}_${track.id}`;
      return {
        id: jobId,
        albumPath: album.albumPath,
        track,
        coverArtPath: album.coverArtPath,
        options,
        status: 'PENDING',
        progress: 0,
        currentStep: 'Queued for processing',
        attempts: 0,
        maxRetries: this.maxRetries,
        createdAt: now,
        updatedAt: now,
      };
    });

    await this.saveState();
    return this.jobs;
  }

  public addJob(job: QueueJob): QueueJob {
    this.jobs.push(job);
    this.emit('jobAdded', job);
    this.saveState();
    if (this.isProcessing && !this.isPaused) {
      this.processNextJobs();
    }
    return job;
  }

  public start(): Promise<void> {
    if (this.isPaused) {
      return Promise.resolve();
    }

    this.isProcessing = true;
    this.emit('statusChanged', 'running');

    if (!this.completionPromise) {
      this.completionPromise = new Promise<void>((resolve) => {
        this.completionResolver = resolve;
      });
    }

    this.processNextJobs();
    return this.completionPromise;
  }

  public pause(): void {
    this.isPaused = true;
    this.emit('statusChanged', 'paused');
    if (this.completionResolver) {
      const resolve = this.completionResolver;
      this.completionResolver = null;
      this.completionPromise = null;
      resolve();
    }
  }

  public resume(): Promise<void> {
    this.isPaused = false;
    return this.start();
  }

  public getJobs(): QueueJob[] {
    return this.jobs;
  }

  public isRunning(): boolean {
    return this.isProcessing && !this.isPaused;
  }

  private async saveState(): Promise<void> {
    if (!this.stateFilePath || this.jobs.length === 0) return;
    try {
      await fs.ensureDir(path.dirname(this.stateFilePath));
      const albumPath = this.jobs[0]?.albumPath || '';
      const state: QueueState = {
        albumPath,
        createdAt: this.jobs[0]?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        jobs: this.jobs,
      };
      await fs.writeJson(this.stateFilePath, state, { spaces: 2 });
    } catch (err) {
      console.error(`[QueueManager] Error persisting state file:`, err);
    }
  }

  private processNextJobs(): void {
    if (this.isPaused || !this.isProcessing) return;

    while (this.activeWorkers < this.concurrency) {
      const nextJob = this.jobs.find((j) => j.status === 'PENDING');
      if (!nextJob) break;

      this.activeWorkers++;
      this.executeJob(nextJob).finally(() => {
        this.activeWorkers--;
        this.processNextJobs();
      });
    }

    const pendingOrActive = this.jobs.filter((j) => j.status === 'PENDING' || j.status === 'ANALYZING' || j.status === 'RENDERING');
    if (pendingOrActive.length === 0 && this.activeWorkers === 0 && this.isProcessing) {
      this.isProcessing = false;
      this.emit('statusChanged', 'idle');

      const completedCount = this.jobs.filter((j) => j.status === 'DONE').length;
      const failedCount = this.jobs.filter((j) => j.status === 'FAILED').length;

      this.emit('queueFinished', completedCount, failedCount);

      if (this.completionResolver) {
        const resolve = this.completionResolver;
        this.completionResolver = null;
        this.completionPromise = null;
        resolve();
      }
    }
  }

  private async executeJob(job: QueueJob): Promise<void> {
    job.attempts++;
    job.status = 'ANALYZING';
    job.progress = 10;
    job.currentStep = 'Extracting audio metadata and FFT spectral bands';
    job.updatedAt = new Date().toISOString();

    this.emit('jobStarted', job);
    this.emit('jobProgress', job, job.progress, job.currentStep);
    await this.saveState();

    const updateProgress = async (progress: number, step: string) => {
      job.progress = progress;
      job.currentStep = step;
      job.updatedAt = new Date().toISOString();
      this.emit('jobProgress', job, progress, step);
      await this.saveState();
    };

    try {
      // 1. Audio Analysis
      const analysisResult = await analyzeAudio(job.track.filePath, {
        fps: job.options.fps,
        force: job.options.force,
      });

      const cacheDir = path.join(job.options.outputDir || '.cache', '.cache', 'audio_analysis');
      const analysisDataPath = path.join(cacheDir, `${job.track.id}_analysis.json`);
      await fs.ensureDir(path.dirname(analysisDataPath));
      await fs.writeJson(analysisDataPath, analysisResult, { spaces: 2 });
      job.analysisDataPath = analysisDataPath;

      await updateProgress(40, 'Audio analysis complete. Preparing visualizer render...');

      // 2. Render Pipeline
      job.status = 'RENDERING';
      await updateProgress(50, `Rendering video for platforms [${job.options.platforms.join(', ')}]...`);

      const outputFiles: string[] = [];
      const baseOutputDir = job.options.outputDir;

      // Platform Folder Layout Mapping (Section 4 Spec)
      const platformDirMap: Record<string, string> = {
        youtube: 'YouTube',
        tiktok: 'TikTok',
        instagram: 'Instagram',
        shorts: 'Shorts',
      };

      for (const rawPlatform of job.options.platforms) {
        const platformKey = rawPlatform.toLowerCase();
        const folderName = platformDirMap[platformKey] || rawPlatform;
        const targetPlatformDir = path.join(baseOutputDir, folderName);
        await fs.ensureDir(targetPlatformDir);

        const videoFileName = `${job.track.trackNumber.toString().padStart(2, '0')} - ${job.track.title}.mp4`;
        const videoFilePath = path.join(targetPlatformDir, videoFileName);

        const aspectRatio = (platformKey === 'youtube') ? 'LANDSCAPE' : 'PORTRAIT';

        await renderVideo({
          audioPath: job.track.filePath,
          preset: job.options.preset as any,
          aspectRatio,
          outputPath: videoFilePath,
          backgroundPath: job.coverArtPath || undefined,
          trackTitle: job.track.title,
          artistName: job.track.artist,
          albumName: job.track.album,
          fps: job.options.fps,
        });

        outputFiles.push(videoFilePath);
      }

      // 3. Social Metadata & Tags File Exporter
      const metaDir = path.join(baseOutputDir, 'Metadata');
      await fs.ensureDir(metaDir);

      const metadataBundle = generateSocialMetadataBundle({
        title: job.track.title,
        artist: job.track.artist,
        album: job.track.album,
        trackNumber: job.track.trackNumber,
        filename: job.track.fileName,
        visualStyle: job.options.preset,
      });

      const metaFilePath = path.join(metaDir, `${job.track.trackNumber.toString().padStart(2, '0')} - ${job.track.title}_metadata.json`);
      await fs.writeJson(metaFilePath, metadataBundle, { spaces: 2 });
      outputFiles.push(metaFilePath);

      // 4. Thumbnail Generator
      const thumbDir = path.join(baseOutputDir, 'Thumbnails');
      await fs.ensureDir(thumbDir);

      const thumbResult = await generateThumbnails({
        title: job.track.title,
        artist: job.track.artist,
        album: job.track.album,
        trackNumber: job.track.trackNumber,
        artworkPath: job.coverArtPath || undefined,
        outputDir: thumbDir,
        filenamePrefix: `${job.track.trackNumber.toString().padStart(2, '0')} - ${job.track.title}`,
      });

      if (thumbResult?.path16x9) outputFiles.push(thumbResult.path16x9);
      if (thumbResult?.path9x16) outputFiles.push(thumbResult.path9x16);

      job.outputFiles = outputFiles;
      job.status = 'DONE';
      job.progress = 100;
      job.currentStep = 'Render completed successfully';
      job.updatedAt = new Date().toISOString();

      this.emit('jobCompleted', job);
      await this.saveState();
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      job.error = errorMsg;
      job.updatedAt = new Date().toISOString();

      if (job.attempts <= job.maxRetries) {
        job.status = 'PENDING';
        job.currentStep = `Failed attempt ${job.attempts}/${job.maxRetries}. Queued for retry.`;
        this.emit('jobRetrying', job, job.attempts);
      } else {
        job.status = 'FAILED';
        job.currentStep = `Job failed after ${job.attempts} attempts: ${errorMsg}`;
        this.emit('jobFailed', job, err instanceof Error ? err : new Error(errorMsg));
      }
      await this.saveState();
    }
  }
}
