import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs-extra';
import {
  scanAlbum,
  parseTrackNumberFromFilename,
  findAudioFiles,
  findCoverArtwork,
} from '../src/pipeline/scanner.js';
import { createMockAlbumDir } from './test-utils.js';

describe('Scanner Pipeline Module', () => {
  let tmpDir: string;
  let mockAlbumDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'batch-vis-scanner-test-'));
    mockAlbumDir = await createMockAlbumDir(tmpDir);
  });

  afterAll(async () => {
    await fs.remove(tmpDir);
  });

  it('should parse track numbers from filenames correctly', () => {
    expect(parseTrackNumberFromFilename('01 - Song Title.mp3')).toBe(1);
    expect(parseTrackNumberFromFilename('02. Track Name.flac')).toBe(2);
    expect(parseTrackNumberFromFilename('Track_03_Remix.wav')).toBe(3);
    expect(parseTrackNumberFromFilename('14 - Deep Dive.m4a')).toBe(14);
    expect(parseTrackNumberFromFilename('NoNumber.ogg')).toBeNull();
  });

  it('should find all supported audio files recursively', async () => {
    const audioFiles = await findAudioFiles(mockAlbumDir);
    expect(audioFiles.length).toBe(3);
    expect(audioFiles.some((f) => f.endsWith('.wav'))).toBe(true);
    expect(audioFiles.some((f) => f.endsWith('.mp3'))).toBe(true);
    expect(audioFiles.some((f) => f.endsWith('.flac'))).toBe(true);
  });

  it('should locate cover artwork image in album directory', async () => {
    const audioFiles = await findAudioFiles(mockAlbumDir);
    const coverPath = await findCoverArtwork(mockAlbumDir, audioFiles);
    expect(coverPath).not.toBeNull();
    expect(path.basename(coverPath!)).toBe('cover.jpg');
  });

  it('should scan album folder and return structured AlbumBundle sorted by track number', async () => {
    const bundle = await scanAlbum(mockAlbumDir);

    expect(bundle.albumPath).toBe(path.resolve(mockAlbumDir));
    expect(bundle.totalTracks).toBe(3);
    expect(bundle.coverArtPath).not.toBeNull();
    expect(bundle.tracks.length).toBe(3);

    // Verify track order (1 -> 2 -> 3)
    expect(bundle.tracks[0].trackNumber).toBe(1);
    expect(bundle.tracks[0].title).toBe('Intro');

    expect(bundle.tracks[1].trackNumber).toBe(2);
    expect(bundle.tracks[1].title).toBe('Cyber Pulse');

    expect(bundle.tracks[2].trackNumber).toBe(3);
    expect(bundle.tracks[2].title).toBe('Neon Night');

    expect(bundle.totalDuration).toBeGreaterThan(3.0);
  });

  it('should throw an error for non-existent album path', async () => {
    await expect(scanAlbum(path.join(tmpDir, 'does-not-exist'))).rejects.toThrow(
      'Album directory does not exist'
    );
  });
});
