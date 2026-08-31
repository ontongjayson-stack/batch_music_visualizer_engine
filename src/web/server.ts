/**
 * Express Local Web Dashboard Server
 * Batch Music Visualizer Engine
 */

import path from 'path';
import express from 'express';
import fs from 'fs-extra';
import { exec } from 'child_process';
import { scanAlbum } from '../pipeline/scanner';
import { JobQueueManager } from '../pipeline/queue';
import { RenderOptions, SocialPlatform } from '../types';
import { SocialPublisher, OAuthToken, PublishRequest } from '../publishing/social-publisher';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let activeQueueManager: JobQueueManager | null = null;
let currentAlbumStats: any = null;

export const socialPublisher = new SocialPublisher({
  stateFilePath: path.resolve('./output/.publishing-queue-state.json'),
  tokensFilePath: path.resolve('./output/.social-tokens.json')
});

// API: Scan Album Folder
app.post('/api/scan', async (req, res) => {
  try {
    const { folderPath } = req.body;
    if (!folderPath) {
      return res.status(400).json({ error: 'Album folder path is required' });
    }

    const resolvedPath = path.resolve(folderPath);
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: `Path does not exist: ${resolvedPath}` });
    }

    const bundle = await scanAlbum(resolvedPath);
    currentAlbumStats = bundle;
    res.json({ success: true, album: bundle });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to scan album directory' });
  }
});

// API: Start Batch Render Queue
app.post('/api/generate', async (req, res) => {
  try {
    const { albumPath, preset, platforms, outputDir, fps, concurrency } = req.body;
    if (!albumPath) {
      return res.status(400).json({ error: 'albumPath is required' });
    }

    const resolvedAlbumPath = path.resolve(albumPath);
    const resolvedOutputDir = path.resolve(outputDir || './output');

    const bundle = await scanAlbum(resolvedAlbumPath);

    const renderOptions: RenderOptions = {
      preset: preset || 'TRAP-PIANO',
      platforms: platforms || ['youtube', 'tiktok', 'instagram', 'shorts'],
      outputDir: resolvedOutputDir,
      fps: fps || 30,
      concurrency: concurrency || 1,
    };

    const stateFilePath = path.join(resolvedOutputDir, path.basename(resolvedAlbumPath), '.queue-state.json');

    activeQueueManager = new JobQueueManager({
      stateFilePath,
      concurrency: renderOptions.concurrency,
    });

    await activeQueueManager.initializeFromAlbum(bundle, renderOptions, true);

    // Asynchronously trigger queue processing
    const startPromise = activeQueueManager.start();
    if (startPromise && typeof startPromise.catch === 'function') {
      startPromise.catch((err) => {
        console.error('[Web Queue Error]:', err);
      });
    }

    res.json({ success: true, message: 'Batch queue initialized & started' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to initialize batch queue' });
  }
});

// API: Get Live Queue Status
app.get('/api/status', (req, res) => {
  if (!activeQueueManager) {
    return res.json({ status: 'idle', jobs: [] });
  }

  const jobs = activeQueueManager.getJobs();
  res.json({
    status: activeQueueManager.isRunning() ? 'rendering' : 'idle',
    jobs,
    albumStats: currentAlbumStats,
  });
});

// ============================================================================
// PUBLISHING ENGINE API ENDPOINTS
// ============================================================================

// API: Enqueue & Trigger Direct Video Publishing across YouTube, TikTok, Instagram
app.post('/api/publishing/publish', async (req: express.Request, res: express.Response) => {
  try {
    const { filePath, platforms, title, description, hashtags, tags, privacy, coverImagePath, scheduledAt, tokens, async: isAsync } = req.body;

    if (!filePath || !title) {
      return res.status(400).json({ error: 'filePath and title are required fields' });
    }

    // Register optional tokens passed in request
    if (tokens && typeof tokens === 'object') {
      for (const [platformKey, tokenObj] of Object.entries(tokens)) {
        socialPublisher.setToken(platformKey, tokenObj as OAuthToken);
      }
    }

    const targetPlatforms: SocialPlatform[] = Array.isArray(platforms) && platforms.length > 0 
      ? platforms 
      : ['youtube', 'tiktok', 'instagram'];

    const requests: PublishRequest[] = targetPlatforms.map((platform) => ({
      filePath,
      platform,
      title,
      description: description || '',
      hashtags: hashtags || [],
      tags: tags || [],
      privacy: privacy || 'public',
      coverImagePath,
      scheduledAt
    }));

    const jobs = socialPublisher.enqueue(requests);

    if (isAsync !== false) {
      // Asynchronously trigger queue processing
      const processPromise = socialPublisher.processQueue();
      if (processPromise && typeof processPromise.catch === 'function') {
        processPromise.catch((err) => {
          console.error('[Publishing Queue Async Error]:', err);
        });
      }

      return res.json({
        success: true,
        message: 'Publishing jobs enqueued and processing started',
        count: jobs.length,
        jobs
      });
    } else {
      const updatedJobs = await socialPublisher.processQueue();
      return res.json({
        success: true,
        message: 'Publishing completed',
        count: updatedJobs.length,
        jobs: updatedJobs
      });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to publish video' });
  }
});

// API: Get Live Publishing Queue & Job Status
app.get('/api/publishing/status', (req: express.Request, res: express.Response) => {
  try {
    const { jobId, status, platform } = req.query;

    if (jobId && typeof jobId === 'string') {
      const job = socialPublisher.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: `Publish job not found: ${jobId}` });
      }
      return res.json({ success: true, job });
    }

    const summary = socialPublisher.getQueueStatus();
    let filteredJobs = summary.jobs;

    if (status && typeof status === 'string') {
      filteredJobs = filteredJobs.filter(j => j.status === status.toUpperCase());
    }
    if (platform && typeof platform === 'string') {
      filteredJobs = filteredJobs.filter(j => j.platform === platform.toLowerCase());
    }

    const tokensStatus: Record<string, boolean> = {
      youtube: socialPublisher.hasValidToken('youtube'),
      tiktok: socialPublisher.hasValidToken('tiktok'),
      instagram: socialPublisher.hasValidToken('instagram')
    };

    return res.json({
      success: true,
      queue: {
        total: filteredJobs.length,
        pending: filteredJobs.filter(j => j.status === 'PENDING').length,
        uploading: filteredJobs.filter(j => j.status === 'UPLOADING').length,
        published: filteredJobs.filter(j => j.status === 'PUBLISHED').length,
        failed: filteredJobs.filter(j => j.status === 'FAILED').length
      },
      jobs: filteredJobs,
      tokensStatus
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch publishing status' });
  }
});

// API: Retry Failed Publishing Job(s)
app.post('/api/publishing/retry', async (req: express.Request, res: express.Response) => {
  try {
    const { jobId } = req.body;
    if (jobId && typeof jobId === 'string') {
      const retriedJob = await socialPublisher.retryJob(jobId);
      return res.json({ success: true, job: retriedJob });
    }

    const retriedJobs = await socialPublisher.retryFailed();
    return res.json({ success: true, jobs: retriedJobs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to retry publishing job' });
  }
});
// API: Read ID3 Tags for Audio Track
app.post('/api/id3/read', async (req: express.Request, res: express.Response) => {
  try {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: 'filePath is required' });
    const { readID3Tags } = await import('../metadata/id3-engine.js');
    const tags = await readID3Tags(filePath);
    return res.json({ success: true, tags });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to read ID3 tags' });
  }
});

// API: Serve Local Image Files (Album Art & Frame Thumbnails)
app.get('/api/image', (req: express.Request, res: express.Response) => {
  const filePath = req.query.path as string;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).send('Image file not found');
  }
  res.sendFile(path.resolve(filePath));
});

// API: Render Live Preview Canvas Frame On-the-Fly
app.post('/api/preview-frame', async (req: express.Request, res: express.Response) => {
  try {
    const {
      preset = 'PRO-CINEMATIC-SPEAKER',
      aspectRatio = '16:9',
      spectrumStyle = 'RADIAL_ORBIT',
      heroShape = 'SQUARE_ROUNDED',
      customColors,
      trackTitle = 'Midnight Piano Trap',
      artistName = 'Antigravity Studio',
      albumName = 'Cinematic Album V1',
      coverArtPath
    } = req.body;

    const { createCanvas, loadImage } = await import('@napi-rs/canvas');
    const { getPreset, getDimensions, getSafeAreaInsets } = await import('../rendering/presets.js');
    const { drawProCinematicSpeakerComposition } = await import('../rendering/components/proCinematicSpeaker.js');
    const { drawCinematicAlbumComposition } = await import('../rendering/components/cinematicAlbum.js');

    const basePreset = getPreset(preset as any) || getPreset('PRO-CINEMATIC-SPEAKER');
    const mergedPreset = {
      ...basePreset,
      colors: {
        ...basePreset.colors,
        ...(customColors || {})
      }
    };

    const isPortrait = aspectRatio === '9:16' || aspectRatio === 'PORTRAIT';
    const dimensions = isPortrait ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
    const safeArea = getSafeAreaInsets(isPortrait ? '9:16' : '16:9');

    const canvas = createCanvas(dimensions.width, dimensions.height);
    const ctx = canvas.getContext('2d');

    let loadedCover = null;
    if (coverArtPath && fs.existsSync(coverArtPath)) {
      try {
        loadedCover = await loadImage(coverArtPath);
      } catch (e) {
        // Fallback
      }
    }

    // Synthetic audio animation frame for realistic preview
    const audioData = {
      frameIndex: 15,
      timestamp: 0.5,
      volume: 0.65,
      bass: 0.8,
      subBass: 0.85,
      kickTransient: 0.75,
      mids: 0.45,
      treble: 0.35,
      spectrum: new Array(64).fill(0).map((_, i) => Math.sin(i * 0.2 + 1) * 0.4 + 0.35),
      isBeat: true
    };

    if (preset === 'CINEMATIC-ALBUM') {
      drawCinematicAlbumComposition({
        ctx,
        dimensions,
        preset: mergedPreset,
        frameIndex: 15,
        totalFrames: 90,
        audioData,
        coverImage: loadedCover,
        trackTitle,
        artistName,
        albumName,
        safeArea
      });
    } else {
      drawProCinematicSpeakerComposition({
        ctx,
        dimensions,
        preset: mergedPreset,
        frameIndex: 15,
        totalFrames: 90,
        audioData,
        coverImage: loadedCover,
        trackTitle,
        artistName,
        albumName,
        safeArea,
        showCenterArt: true
      });
    }

    const pngBuffer = canvas.toBuffer('image/png');
    res.setHeader('Content-Type', 'image/png');
    return res.send(pngBuffer);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to render preview frame' });
  }
});

// API: Stream Rendered MP4 Videos with Range Header Support
app.get('/api/video/stream', (req: express.Request, res: express.Response) => {
  const filePath = req.query.path as string;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).send('Video file not found');
  }

  const resolvedPath = path.resolve(filePath);
  const stat = fs.statSync(resolvedPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(resolvedPath, { start, end });

    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(resolvedPath).pipe(res);
  }
});


app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n======================================================`);
  console.log(`   🎵 BATCH MUSIC VISUALIZER WEB ENGINE RUNNING`);
  console.log(`   👉 Open Dashboard: ${url}`);
  console.log(`======================================================\n`);

  // Auto open browser on launch
  if (process.env.AUTO_OPEN !== 'false') {
    const openCmd = process.platform === 'win32' ? `start ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
    exec(openCmd, (err) => {
      if (err) console.log(`[Notice] Could not auto-open browser. Please manually navigate to ${url}`);
    });
  }
});
