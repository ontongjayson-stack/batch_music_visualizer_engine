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
import { RenderOptions } from '../types';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let activeQueueManager: JobQueueManager | null = null;
let currentAlbumStats: any = null;

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
    activeQueueManager.start().catch((err) => {
      console.error('[Web Queue Error]:', err);
    });

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
