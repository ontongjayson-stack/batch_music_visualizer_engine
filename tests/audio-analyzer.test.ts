import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs-extra';
import { analyzeAudio, decodeAudioToPCM } from '../src/pipeline/audio-analyzer.js';
import { createMockAlbumDir } from './test-utils.js';

describe('Audio Analyzer Module', () => {
  let tmpDir: string;
  let mockAlbumDir: string;
  let sampleTrackPath: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'batch-vis-analyzer-test-'));
    mockAlbumDir = await createMockAlbumDir(tmpDir);
    sampleTrackPath = path.join(mockAlbumDir, '01 - Intro.wav');
  });

  afterAll(async () => {
    await fs.remove(tmpDir);
  });

  it('should decode audio file to 16-bit PCM buffer via ffmpeg', async () => {
    const { pcmBuffer, duration } = await decodeAudioToPCM(sampleTrackPath, 44100);
    expect(pcmBuffer).toBeInstanceOf(Buffer);
    expect(pcmBuffer.length).toBeGreaterThan(0);
    expect(duration).toBeCloseTo(1.5, 0.5);
  });

  it('should analyze audio file and return RMS + FFT spectral frames', async () => {
    const cacheDir = path.join(tmpDir, '.cache', 'audio_analysis');
    const result = await analyzeAudio(sampleTrackPath, {
      fps: 30,
      numBands: 16,
      cacheDir,
    });

    expect(result.trackId).toBeDefined();
    expect(result.audioPath).toBe(path.resolve(sampleTrackPath));
    expect(result.duration).toBeGreaterThan(0.5);
    expect(result.fps).toBe(30);
    expect(result.numBands).toBe(16);
    expect(result.frames.length).toBeGreaterThan(10);

    const firstFrame = result.frames[0];
    expect(firstFrame.frameIndex).toBe(0);
    expect(firstFrame.timestamp).toBe(0);
    expect(firstFrame.rms).toBeGreaterThanOrEqual(0);
    expect(firstFrame.rms).toBeLessThanOrEqual(1.0);
    expect(firstFrame.peak).toBeGreaterThanOrEqual(0);
    expect(firstFrame.peak).toBeLessThanOrEqual(1.0);

    expect(firstFrame.fft.length).toBe(16);
    expect(firstFrame.bands).toHaveProperty('subBass');
    expect(firstFrame.bands).toHaveProperty('bass');
    expect(firstFrame.bands).toHaveProperty('mids');
    expect(firstFrame.bands).toHaveProperty('highMids');
  });

  it('should save and reuse disk JSON cache on subsequent analysis calls', async () => {
    const cacheDir = path.join(tmpDir, '.cache', 'audio_analysis_cache_test');
    
    // First analysis (computes and caches)
    const result1 = await analyzeAudio(sampleTrackPath, {
      fps: 30,
      numBands: 16,
      cacheDir,
    });

    // Second analysis (loads from cache)
    const result2 = await analyzeAudio(sampleTrackPath, {
      fps: 30,
      numBands: 16,
      cacheDir,
    });

    expect(result2.cachedAt).toBe(result1.cachedAt);
    expect(result2.frames.length).toBe(result1.frames.length);

    // Force analysis (overwrites cache)
    const result3 = await analyzeAudio(sampleTrackPath, {
      fps: 30,
      numBands: 16,
      cacheDir,
      force: true,
    });

    expect(result3.frames.length).toBe(result1.frames.length);
  });
});
