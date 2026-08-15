import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import { parseFile } from 'music-metadata';
import type { AlbumBundle, AudioFileTrack, AudioMetadata } from '../types/index.js';

const SUPPORTED_AUDIO_EXTENSIONS = new Set([
  '.wav',
  '.mp3',
  '.flac',
  '.m4a',
  '.aac',
  '.ogg',
]);

const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
]);

const PRIORITY_COVER_NAMES = [
  'cover.jpg',
  'cover.png',
  'folder.jpg',
  'folder.png',
  'front.jpg',
  'front.png',
  'art.jpg',
  'art.png',
  'album.jpg',
  'album.png',
  'artwork.jpg',
  'artwork.png',
];

export interface ScannerOptions {
  cacheDir?: string;
  extractEmbeddedCover?: boolean;
}

/**
 * Parses track number from filename if not found in metadata.
 * E.g., "01 - Song.mp3" -> 1, "Track_02.flac" -> 2
 */
export function parseTrackNumberFromFilename(fileName: string): number | null {
  const cleanName = path.parse(fileName).name;
  
  // Match "01 - ...", "01. ...", "01_...", "01 "
  const prefixMatch = cleanName.match(/^(\d{1,3})\s*[\.\-_\s]/);
  if (prefixMatch) {
    return parseInt(prefixMatch[1], 10);
  }

  // Match "Track 01", "track_01", "track01"
  const trackMatch = cleanName.match(/track[_\s-]?(\d{1,3})/i);
  if (trackMatch) {
    return parseInt(trackMatch[1], 10);
  }

  // Match standalone number at start
  const standaloneMatch = cleanName.match(/^(\d{1,3})$/);
  if (standaloneMatch) {
    return parseInt(standaloneMatch[1], 10);
  }

  return null;
}

/**
 * Recursively find all audio files in directory.
 */
export async function findAudioFiles(dirPath: string): Promise<string[]> {
  const audioFiles: string[] = [];

  async function scan(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_AUDIO_EXTENSIONS.has(ext)) {
          audioFiles.push(fullPath);
        }
      }
    }
  }

  await scan(dirPath);
  return audioFiles;
}

/**
 * Finds cover artwork image in the directory or extracts embedded artwork from audio tags.
 */
export async function findCoverArtwork(
  dirPath: string,
  audioFiles: string[],
  options: ScannerOptions = {}
): Promise<string | null> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const imageFiles: string[] = [];

  for (const entry of entries) {
    if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_IMAGE_EXTENSIONS.has(ext)) {
        imageFiles.push(entry.name);
      }
    }
  }

  // 1. Check priority filenames first
  for (const priorityName of PRIORITY_COVER_NAMES) {
    const matched = imageFiles.find(img => img.toLowerCase() === priorityName);
    if (matched) {
      return path.join(dirPath, matched);
    }
  }

  // 2. Fallback to any image file found in album root
  if (imageFiles.length > 0) {
    return path.join(dirPath, imageFiles[0]);
  }

  // 3. Try to extract embedded artwork if requested and audio files exist
  if (options.extractEmbeddedCover !== false && audioFiles.length > 0) {
    const cacheDir = options.cacheDir || path.join(process.cwd(), '.cache');
    const coversDir = path.join(cacheDir, 'embedded_covers');

    for (const audioPath of audioFiles) {
      try {
        const metadata = await parseFile(audioPath);
        const picture = metadata.common.picture?.[0];
        if (picture && picture.data && picture.data.length > 0) {
          await fs.ensureDir(coversDir);
          const hash = crypto.createHash('md5').update(picture.data).digest('hex').substring(0, 12);
          const ext = picture.format?.includes('png') ? '.png' : '.jpg';
          const coverPath = path.join(coversDir, `embedded_${hash}${ext}`);
          if (!(await fs.pathExists(coverPath))) {
            await fs.writeFile(coverPath, picture.data);
          }
          return coverPath;
        }
      } catch {
        // Continue to next track if metadata read fails
      }
    }
  }

  return null;
}

/**
 * Scans an album folder and returns a structured AlbumBundle.
 */
export async function scanAlbum(
  albumPath: string,
  options: ScannerOptions = {}
): Promise<AlbumBundle> {
  const resolvedPath = path.resolve(albumPath);
  if (!(await fs.pathExists(resolvedPath))) {
    throw new Error(`Album directory does not exist: ${resolvedPath}`);
  }

  const stat = await fs.stat(resolvedPath);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${resolvedPath}`);
  }

  // Find all audio files recursively
  const rawAudioPaths = await findAudioFiles(resolvedPath);
  if (rawAudioPaths.length === 0) {
    throw new Error(`No supported audio files (.wav, .mp3, .flac, .m4a, .aac, .ogg) found in ${resolvedPath}`);
  }

  // Find cover artwork
  const coverArtPath = await findCoverArtwork(resolvedPath, rawAudioPaths, options);

  // Extract metadata and prepare track list
  const trackPromises = rawAudioPaths.map(async (filePath, idx): Promise<AudioFileTrack> => {
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName).toLowerCase().replace('.', '');

    let title = path.parse(fileName).name;
    let artist = 'Unknown Artist';
    let album = path.basename(resolvedPath);
    let trackNo: number | null = null;
    let duration = 0;
    let parsedMetadata: AudioMetadata | undefined;

    try {
      const meta = await parseFile(filePath);
      duration = meta.format.duration || 0;
      title = meta.common.title || title;
      artist = meta.common.artist || meta.common.albumartist || artist;
      album = meta.common.album || album;
      trackNo = meta.common.track.no;

      parsedMetadata = {
        title,
        artist,
        album,
        trackNumber: trackNo || undefined,
        trackTotal: meta.common.track.of || undefined,
        year: meta.common.year,
        genre: meta.common.genre,
        duration,
        sampleRate: meta.format.sampleRate,
        channels: meta.format.numberOfChannels,
        bitrate: meta.format.bitrate,
        format: ext,
      };
    } catch {
      // Fallback if metadata fails to parse
    }

    // Fallback track number from filename if missing from tags
    if (trackNo === null || trackNo === undefined || isNaN(trackNo)) {
      trackNo = parseTrackNumberFromFilename(fileName) ?? (idx + 1);
    }

    const trackId = crypto.createHash('md5').update(`${filePath}:${idx}`).digest('hex').substring(0, 10);

    return {
      id: trackId,
      filePath,
      fileName,
      extension: ext,
      trackNumber: trackNo,
      title,
      artist,
      album,
      duration,
      metadata: parsedMetadata,
    };
  });

  const rawTracks = await Promise.all(trackPromises);

  // Sort tracks by track number, then filename
  const sortedTracks = rawTracks.sort((a, b) => {
    if (a.trackNumber !== b.trackNumber) {
      return a.trackNumber - b.trackNumber;
    }
    return a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: 'base' });
  });

  // Most common album title and artist from tracks
  const albumCounts: Record<string, number> = {};
  const artistCounts: Record<string, number> = {};

  for (const track of sortedTracks) {
    if (track.album && track.album !== path.basename(resolvedPath)) {
      albumCounts[track.album] = (albumCounts[track.album] || 0) + 1;
    }
    if (track.artist && track.artist !== 'Unknown Artist') {
      artistCounts[track.artist] = (artistCounts[track.artist] || 0) + 1;
    }
  }

  const albumTitle = Object.keys(albumCounts).reduce((a, b) => (albumCounts[a] > albumCounts[b] ? a : b), path.basename(resolvedPath));
  const mainArtist = Object.keys(artistCounts).reduce((a, b) => (artistCounts[a] > artistCounts[b] ? a : b), 'Various Artists');
  const totalDuration = sortedTracks.reduce((sum, t) => sum + t.duration, 0);

  return {
    albumPath: resolvedPath,
    albumTitle,
    artist: mainArtist,
    coverArtPath,
    tracks: sortedTracks,
    totalTracks: sortedTracks.length,
    totalDuration,
  };
}
