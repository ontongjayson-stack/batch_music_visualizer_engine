import * as fs from 'fs-extra';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { parseFile } from 'music-metadata';

const execFileAsync = promisify(execFile);

export interface ArtworkData {
  data: Buffer;
  mimeType: string;
  description?: string;
}

export interface ID3Tags {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  year?: number;
  composer?: string;
  publisher?: string;
  comment?: string;
  artwork?: ArtworkData | string | Buffer | null;
  trackNumber?: number;
  trackTotal?: number;
  bpm?: number;
  duration?: number;
}

export interface BatchItem {
  id: string;
  filePath: string;
  tags: ID3Tags;
}

export type CascadingField =
  | 'artist'
  | 'Artist'
  | 'album'
  | 'Album'
  | 'genre'
  | 'Genre'
  | 'year'
  | 'Year'
  | 'composer'
  | 'Composer'
  | 'publisher'
  | 'Publisher'
  | 'comment'
  | 'comments'
  | 'Comment'
  | 'Comments'
  | 'artwork'
  | 'Artwork';

export const CASCADABLE_FIELDS: string[] = [
  'artist',
  'album',
  'genre',
  'year',
  'composer',
  'publisher',
  'comment',
  'artwork'
];

/**
 * Normalizes user-supplied cascading field name to standard lowercase field property.
 */
export function normalizeCascadingField(field: string): string {
  const lower = field.trim().toLowerCase();
  if (lower === 'comments') return 'comment';
  if (CASCADABLE_FIELDS.includes(lower)) {
    return lower;
  }
  throw new Error(`Invalid or non-cascadable field: '${field}'. Title and track numbers cannot be cascaded.`);
}

export class ID3Engine {
  /**
   * Reads ID3 tags from an audio file (.mp3, .wav, .flac, .m4a).
   * Falls back to parsing filename for track title if tags are empty or missing title.
   */
  public async readTags(filePath: string): Promise<ID3Tags> {
    const resolvedPath = path.resolve(filePath);
    if (!(await fs.pathExists(resolvedPath))) {
      throw new Error(`Audio file does not exist: ${resolvedPath}`);
    }

    let parsedTitle: string | undefined;
    let parsedArtist: string | undefined;
    let parsedAlbum: string | undefined;
    let parsedGenre: string | undefined;
    let parsedYear: number | undefined;
    let parsedComposer: string | undefined;
    let parsedPublisher: string | undefined;
    let parsedComment: string | undefined;
    let parsedArtwork: ArtworkData | undefined;
    let parsedTrackNo: number | undefined;
    let parsedTrackTotal: number | undefined;
    let parsedBpm: number | undefined;
    let duration: number | undefined;

    try {
      const metadata = await parseFile(resolvedPath);
      const common = metadata.common;

      parsedTitle = common.title && common.title.trim() ? common.title.trim() : undefined;
      parsedArtist = common.artist && common.artist.trim() ? common.artist.trim() : (common.albumartist && common.albumartist.trim() ? common.albumartist.trim() : undefined);
      parsedAlbum = common.album && common.album.trim() ? common.album.trim() : undefined;

      if (common.genre && common.genre.length > 0) {
        parsedGenre = Array.isArray(common.genre) ? common.genre.join(', ') : String(common.genre);
      }

      parsedYear = common.year;

      if (common.composer && common.composer.length > 0) {
        parsedComposer = Array.isArray(common.composer) ? common.composer.join(', ') : String(common.composer);
      }

      if (common.label && common.label.length > 0) {
        parsedPublisher = Array.isArray(common.label) ? common.label.join(', ') : String(common.label);
      }

      if (common.comment && common.comment.length > 0) {
        parsedComment = Array.isArray(common.comment) ? common.comment.join('\n') : String(common.comment);
      }

      if (common.picture && common.picture.length > 0) {
        const pic = common.picture[0];
        parsedArtwork = {
          data: Buffer.from(pic.data),
          mimeType: pic.format || 'image/jpeg',
          description: pic.description
        };
      }

      if (common.track) {
        parsedTrackNo = common.track.no || undefined;
        parsedTrackTotal = common.track.of || undefined;
      }

      parsedBpm = common.bpm || undefined;
      duration = metadata.format.duration;
    } catch (err) {
      // If parsing fails (e.g. invalid tag format), fallback to filename parsing entirely
    }

    // Fallback to filename parsing if title is empty
    const fallback = this.parseFilenameForFallback(resolvedPath);

    return {
      title: parsedTitle || fallback.title || path.basename(resolvedPath, path.extname(resolvedPath)),
      artist: parsedArtist || fallback.artist || 'Unknown Artist',
      album: parsedAlbum || fallback.album || 'Unknown Album',
      genre: parsedGenre || fallback.genre,
      year: parsedYear || fallback.year,
      composer: parsedComposer || fallback.composer,
      publisher: parsedPublisher || fallback.publisher,
      comment: parsedComment || fallback.comment,
      artwork: parsedArtwork || fallback.artwork || null,
      trackNumber: parsedTrackNo || fallback.trackNumber || 1,
      trackTotal: parsedTrackTotal || fallback.trackTotal,
      bpm: parsedBpm || fallback.bpm,
      duration
    };
  }

  /**
   * Parses filename for fallback values when ID3 tags are missing or incomplete.
   * Format examples:
   *  "01 - Midnight Piano Trap.mp3" -> trackNumber: 1, title: "Midnight Piano Trap"
   *  "02. Amapiano Artist - Night Fire (112 BPM).wav" -> trackNumber: 2, artist: "Amapiano Artist", title: "Night Fire", bpm: 112
   */
  public parseFilenameForFallback(filePath: string): Partial<ID3Tags> {
    const filename = path.basename(filePath);
    const basename = path.basename(filename, path.extname(filename)).trim();

    let trackNumber: number | undefined;
    let bpm: number | undefined;
    let title: string | undefined;
    let artist: string | undefined;

    // Check BPM: e.g. "(112 BPM)", "120bpm", "128_bpm"
    const bpmMatch = basename.match(/[\(\[\s_.-](\d{2,3})\s*bpm[\)\]\s_.-]?/i);
    if (bpmMatch) {
      bpm = parseInt(bpmMatch[1], 10);
    }

    // Clean BPM token out for title parsing
    let cleanName = basename.replace(/[\(\[\s_.-]\d{2,3}\s*bpm[\)\]\s_.-]?/gi, '').trim();

    // Check leading track number: "01 - ", "01. ", "01_", "01 "
    const numMatch = cleanName.match(/^(\d{1,3})[\s._-]+/);
    if (numMatch) {
      trackNumber = parseInt(numMatch[1], 10);
      cleanName = cleanName.replace(/^(\d{1,3})[\s._-]+/, '').trim();
    } else {
      // Standalone track prefix: "Track 01"
      const trackPrefixMatch = cleanName.match(/^track[_\s-]?(\d{1,3})[\s._-]*/i);
      if (trackPrefixMatch) {
        trackNumber = parseInt(trackPrefixMatch[1], 10);
        cleanName = cleanName.replace(/^track[_\s-]?(\d{1,3})[\s._-]*/i, '').trim();
      }
    }

    // Check "Artist - Title" format
    const hyphenParts = cleanName.split(/\s*-\s*/);
    if (hyphenParts.length >= 2) {
      artist = hyphenParts[0].trim();
      title = hyphenParts.slice(1).join(' - ').trim();
    } else {
      title = cleanName.trim();
    }

    // Replace multiple underscores if title looks like "Song_Title_With_Underscores"
    if (title && title.includes('_') && !title.includes(' ')) {
      title = title.replace(/_/g, ' ');
    }

    return {
      title: title || undefined,
      artist: artist || undefined,
      trackNumber,
      bpm
    };
  }

  /**
   * Writes ID3 tags back to an audio file using FFmpeg (lossless stream copy `-c copy`).
   */
  public async writeTagsToAudioFile(filePath: string, tags: ID3Tags, outputPath?: string): Promise<string> {
    const inputPath = path.resolve(filePath);
    if (!(await fs.pathExists(inputPath))) {
      throw new Error(`Source audio file does not exist: ${inputPath}`);
    }

    const targetOutput = outputPath ? path.resolve(outputPath) : inputPath;
    const isSameFile = targetOutput.toLowerCase() === inputPath.toLowerCase();
    const tempOutput = isSameFile
      ? path.join(path.dirname(inputPath), `.id3_temp_${Date.now()}_${path.basename(inputPath)}`)
      : targetOutput;

    let tempCoverPath: string | null = null;

    try {
      const args: string[] = ['-y', '-i', inputPath];

      // Artwork handling for embedding
      let artworkData: ArtworkData | null = null;
      if (tags.artwork) {
        artworkData = await this.normalizeArtwork(tags.artwork);
      }

      if (artworkData) {
        const ext = artworkData.mimeType.includes('png') ? '.png' : '.jpg';
        tempCoverPath = path.join(path.dirname(tempOutput), `.id3_cover_${Date.now()}${ext}`);
        await fs.writeFile(tempCoverPath, artworkData.data);
        args.push('-i', tempCoverPath);
      }

      // Streams mapping
      args.push('-map', '0:a');
      if (artworkData) {
        args.push('-map', '1:0', '-disposition:v:0', 'attached_pic');
      }

      args.push('-c', 'copy');

      // Metadata tags assignment
      if (tags.title) args.push('-metadata', `title=${tags.title}`);
      if (tags.artist) args.push('-metadata', `artist=${tags.artist}`);
      if (tags.album) args.push('-metadata', `album=${tags.album}`);
      if (tags.genre) args.push('-metadata', `genre=${tags.genre}`);
      if (tags.year) args.push('-metadata', `date=${tags.year}`);
      if (tags.composer) args.push('-metadata', `composer=${tags.composer}`);
      if (tags.publisher) args.push('-metadata', `publisher=${tags.publisher}`);
      if (tags.comment) args.push('-metadata', `comment=${tags.comment}`);
      if (tags.trackNumber) {
        const trackStr = tags.trackTotal ? `${tags.trackNumber}/${tags.trackTotal}` : `${tags.trackNumber}`;
        args.push('-metadata', `track=${trackStr}`);
      }

      args.push(tempOutput);

      await execFileAsync('ffmpeg', args);

      if (isSameFile) {
        await fs.move(tempOutput, inputPath, { overwrite: true });
        return inputPath;
      }

      return targetOutput;
    } catch (err: any) {
      if (await fs.pathExists(tempOutput)) {
        await fs.remove(tempOutput).catch(() => {});
      }
      throw new Error(`Failed to write ID3 tags to audio file: ${err.message || err}`);
    } finally {
      if (tempCoverPath && (await fs.pathExists(tempCoverPath))) {
        await fs.remove(tempCoverPath).catch(() => {});
      }
    }
  }

  /**
   * Writes metadata to a JSON sidecar file.
   */
  public async writeMetadataJson(outputPath: string, metadata: ID3Tags | Record<string, any>): Promise<string> {
    const targetPath = path.resolve(outputPath);
    await fs.ensureDir(path.dirname(targetPath));

    // Convert Buffer artwork to base64 if present so JSON serialization is clean
    const serializable = this.prepareForJson(metadata);
    await fs.writeJson(targetPath, serializable, { spaces: 2 });
    return targetPath;
  }

  /**
   * Assigns album artwork to an ID3Tags object or BatchItem from file path, Buffer, or ArtworkData.
   */
  public async assignArtwork(
    target: ID3Tags | BatchItem,
    artworkInput: string | Buffer | ArtworkData
  ): Promise<ArtworkData> {
    const artworkData = await this.normalizeArtwork(artworkInput);
    if ('tags' in target) {
      target.tags.artwork = artworkData;
    } else {
      target.artwork = artworkData;
    }
    return artworkData;
  }

  /**
   * Extracts embedded album artwork from an audio file.
   */
  public async extractArtwork(filePath: string): Promise<ArtworkData | null> {
    const resolvedPath = path.resolve(filePath);
    if (!(await fs.pathExists(resolvedPath))) {
      throw new Error(`Audio file does not exist: ${resolvedPath}`);
    }

    try {
      const metadata = await parseFile(resolvedPath);
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const pic = metadata.common.picture[0];
        return {
          data: Buffer.from(pic.data),
          mimeType: pic.format || 'image/jpeg',
          description: pic.description
        };
      }
    } catch {
      // Return null if no artwork found or parse fails
    }

    return null;
  }

  /**
   * Saves artwork to disk.
   */
  public async saveArtwork(
    artwork: ArtworkData | Buffer | string,
    outputPath: string
  ): Promise<string> {
    const targetPath = path.resolve(outputPath);
    await fs.ensureDir(path.dirname(targetPath));

    const artworkData = await this.normalizeArtwork(artwork);
    await fs.writeFile(targetPath, artworkData.data);
    return targetPath;
  }

  /**
   * Cascades a single target field (Artist, Album, Genre, Year, Composer, Publisher, Comments, Artwork)
   * across all items in a batch while preserving unique track titles.
   */
  public applyToAll<T extends BatchItem | ID3Tags>(
    batch: T[],
    field: CascadingField,
    value: any
  ): T[] {
    const normalizedField = normalizeCascadingField(field);

    for (const item of batch) {
      if (this.isBatchItem(item)) {
        (item.tags as any)[normalizedField] = value;
      } else {
        (item as any)[normalizedField] = value;
      }
    }

    return batch;
  }

  /**
   * Cascades all non-title metadata fields in `sourceMetadata` across a batch while preserving unique track titles.
   */
  public cascadeMetadata<T extends BatchItem | ID3Tags>(
    batch: T[],
    sourceMetadata: Partial<ID3Tags>
  ): T[] {
    for (const field of CASCADABLE_FIELDS) {
      const value = (sourceMetadata as any)[field];
      if (value !== undefined) {
        this.applyToAll(batch, field as CascadingField, value);
      }
    }
    return batch;
  }

  /**
   * Takes non-title metadata from a source item at `sourceIndex` and cascades it across all batch items.
   */
  public cascadeFromSource<T extends BatchItem | ID3Tags>(
    batch: T[],
    sourceIndex: number,
    fields?: CascadingField[]
  ): T[] {
    if (sourceIndex < 0 || sourceIndex >= batch.length) {
      throw new Error(`Source index ${sourceIndex} is out of bounds (batch length: ${batch.length})`);
    }

    const sourceItem = batch[sourceIndex];
    const sourceTags: ID3Tags = this.isBatchItem(sourceItem) ? sourceItem.tags : (sourceItem as ID3Tags);

    const targetFields = fields && fields.length > 0
      ? fields.map(f => normalizeCascadingField(f))
      : CASCADABLE_FIELDS;

    for (const field of targetFields) {
      const value = (sourceTags as any)[field];
      if (value !== undefined) {
        this.applyToAll(batch, field as CascadingField, value);
      }
    }

    return batch;
  }

  /**
   * Reads tags for a batch of audio files.
   */
  public async readBatch(filePaths: string[]): Promise<BatchItem[]> {
    const items: BatchItem[] = [];

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = path.resolve(filePaths[i]);
      const tags = await this.readTags(filePath);
      items.push({
        id: `track-${i + 1}-${path.basename(filePath, path.extname(filePath))}`,
        filePath,
        tags
      });
    }

    return items;
  }

  /**
   * Writes tags for a batch of items (to audio files and/or metadata JSON).
   */
  public async writeBatch(
    batch: BatchItem[],
    options: { writeAudioFiles?: boolean; jsonOutputDir?: string } = {}
  ): Promise<void> {
    for (const item of batch) {
      if (options.writeAudioFiles !== false) {
        await this.writeTagsToAudioFile(item.filePath, item.tags);
      }

      if (options.jsonOutputDir) {
        const trackNoStr = String(item.tags.trackNumber || 1).padStart(2, '0');
        const safeTitle = (item.tags.title || 'track').toLowerCase().replace(/[^a-z0-9]/g, '_');
        const jsonPath = path.join(options.jsonOutputDir, `${trackNoStr}_${safeTitle}_metadata.json`);
        await this.writeMetadataJson(jsonPath, item.tags);
      }
    }
  }

  // --- PRIVATE HELPERS ---

  private isBatchItem(item: any): item is BatchItem {
    return item && typeof item === 'object' && 'tags' in item && 'filePath' in item;
  }

  private async normalizeArtwork(input: string | Buffer | ArtworkData): Promise<ArtworkData> {
    if (typeof input === 'string') {
      // Base64 Data URI check
      if (input.startsWith('data:image/')) {
        const mimeMatch = input.match(/^data:(image\/[a-zA-Z+]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const base64Data = input.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
        return {
          data: Buffer.from(base64Data, 'base64'),
          mimeType
        };
      }

      // File path check
      const imagePath = path.resolve(input);
      if (!(await fs.pathExists(imagePath))) {
        throw new Error(`Artwork file does not exist: ${imagePath}`);
      }

      const data = await fs.readFile(imagePath);
      const ext = path.extname(imagePath).toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';
      else if (ext === '.gif') mimeType = 'image/gif';

      return { data, mimeType };
    }

    if (Buffer.isBuffer(input)) {
      // Detect MIME type from header magic numbers
      let mimeType = 'image/jpeg';
      if (input.length > 4 && input[0] === 0x89 && input[1] === 0x50 && input[2] === 0x4e && input[3] === 0x47) {
        mimeType = 'image/png';
      } else if (input.length > 12 && input.subarray(8, 12).toString('ascii') === 'WEBP') {
        mimeType = 'image/webp';
      }
      return { data: input, mimeType };
    }

    if (input && typeof input === 'object' && Buffer.isBuffer(input.data)) {
      return {
        data: input.data,
        mimeType: input.mimeType || 'image/jpeg',
        description: input.description
      };
    }

    throw new Error('Invalid artwork input provided. Must be a file path string, Base64 Data URI, Buffer, or ArtworkData object.');
  }

  private prepareForJson(obj: any): any {
    if (obj === null || obj === undefined) return obj;

    if (Buffer.isBuffer(obj)) {
      return `data:application/octet-stream;base64,${obj.toString('base64').substring(0, 32)}... (${obj.length} bytes)`;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.prepareForJson(item));
    }

    if (typeof obj === 'object') {
      const result: Record<string, any> = {};
      for (const [key, val] of Object.entries(obj)) {
        if (key === 'artwork' && val) {
          if (typeof val === 'string') {
            result[key] = val;
          } else if (typeof val === 'object' && 'data' in val && Buffer.isBuffer((val as any).data)) {
            const artObj = val as any;
            result[key] = {
              mimeType: artObj.mimeType || 'image/jpeg',
              description: artObj.description,
              dataSize: artObj.data.length,
              base64Data: `data:${artObj.mimeType || 'image/jpeg'};base64,${artObj.data.toString('base64')}`
            };
          } else {
            result[key] = this.prepareForJson(val);
          }
        } else {
          result[key] = this.prepareForJson(val);
        }
      }
      return result;
    }

    return obj;
  }
}

// Standalone function exports for convenience
const defaultEngine = new ID3Engine();

export const readID3Tags = (filePath: string) => defaultEngine.readTags(filePath);
export const parseFilenameForFallback = (filePath: string) => defaultEngine.parseFilenameForFallback(filePath);
export const writeID3Tags = (filePath: string, tags: ID3Tags, outputPath?: string) => defaultEngine.writeTagsToAudioFile(filePath, tags, outputPath);
export const writeMetadataJson = (outputPath: string, metadata: ID3Tags | Record<string, any>) => defaultEngine.writeMetadataJson(outputPath, metadata);
export const assignArtwork = (target: ID3Tags | BatchItem, artworkInput: string | Buffer | ArtworkData) => defaultEngine.assignArtwork(target, artworkInput);
export const extractArtwork = (filePath: string) => defaultEngine.extractArtwork(filePath);
export const saveArtwork = (artwork: ArtworkData | Buffer | string, outputPath: string) => defaultEngine.saveArtwork(artwork, outputPath);
export const applyToAll = <T extends BatchItem | ID3Tags>(batch: T[], field: CascadingField, value: any) => defaultEngine.applyToAll(batch, field, value);
export const cascadeMetadata = <T extends BatchItem | ID3Tags>(batch: T[], sourceMetadata: Partial<ID3Tags>) => defaultEngine.cascadeMetadata(batch, sourceMetadata);
export const cascadeFromSource = <T extends BatchItem | ID3Tags>(batch: T[], sourceIndex: number, fields?: CascadingField[]) => defaultEngine.cascadeFromSource(batch, sourceIndex, fields);
export const readBatch = (filePaths: string[]) => defaultEngine.readBatch(filePaths);
export const writeBatch = (batch: BatchItem[], options?: { writeAudioFiles?: boolean; jsonOutputDir?: string }) => defaultEngine.writeBatch(batch, options);
