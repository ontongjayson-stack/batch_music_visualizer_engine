export type AudioFormat = 'wav' | 'mp3' | 'flac' | 'm4a' | 'aac' | 'ogg' | 'unknown';

export interface AudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  trackNumber?: number;
  trackTotal?: number;
  year?: number;
  genre?: string[];
  duration: number; // Duration in seconds
  sampleRate?: number;
  channels?: number;
  bitrate?: number;
  format?: AudioFormat | string;
}

export interface AudioFileTrack {
  id: string;
  filePath: string;
  fileName: string;
  extension: string;
  trackNumber: number;
  title: string;
  artist: string;
  album: string;
  duration: number;
  metadata?: AudioMetadata;
}

export interface AlbumBundle {
  albumPath: string;
  albumTitle: string;
  artist: string;
  coverArtPath: string | null;
  tracks: AudioFileTrack[];
  totalTracks: number;
  totalDuration: number; // in seconds
}

export interface FrequencyBands {
  subBass: number;   // 20-60 Hz
  bass: number;      // 60-250 Hz
  lowMids: number;   // 250-500 Hz
  mids: number;      // 500-2000 Hz
  highMids: number;  // 2000-4000 Hz
  presence: number;  // 4000-6000 Hz
  brilliance: number;// 6000-20000 Hz
}

export interface AudioFrameAnalysis {
  frameIndex: number;
  timestamp: number; // in seconds
  rms: number;       // RMS amplitude (0.0 to 1.0)
  peak: number;      // Peak amplitude (0.0 to 1.0)
  fft: number[];     // Binned spectral magnitudes (e.g. 16 or 32 bands, normalized 0.0 to 1.0)
  bands: FrequencyBands;
}

export interface AudioAnalysisResult {
  trackId: string;
  audioPath: string;
  duration: number;
  sampleRate: number;
  fps: number;
  totalFrames: number;
  numBands: number;
  metadata: AudioMetadata;
  frames: AudioFrameAnalysis[];
  cachedAt: string;
  bpm?: number;
  energy?: number;
  bassEnergy?: number;
  spectralCentroid?: number;
  isKickDetected?: boolean;
}

export type JobStatus = 'PENDING' | 'ANALYZING' | 'RENDERING' | 'DONE' | 'FAILED';

export interface RenderOptions {
  preset: string;
  platforms: string[]; // e.g. ['youtube', 'tiktok', 'instagram', 'shorts']
  outputDir: string;
  fps: number;
  force?: boolean;
  concurrency?: number;
}

export interface QueueJob {
  id: string;
  albumPath: string;
  track: AudioFileTrack;
  coverArtPath: string | null;
  options: RenderOptions;
  status: JobStatus;
  progress: number; // 0 to 100
  currentStep?: string;
  attempts: number;
  maxRetries: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
  analysisDataPath?: string;
  outputFiles?: string[];
  videoThumbPath?: string;
  approved?: boolean;
}

export interface QueueState {
  albumPath: string;
  createdAt: string;
  updatedAt: string;
  jobs: QueueJob[];
}

export interface QueueEvents {
  jobAdded: (job: QueueJob) => void;
  jobStarted: (job: QueueJob) => void;
  jobProgress: (job: QueueJob, progress: number, step: string) => void;
  jobCompleted: (job: QueueJob) => void;
  jobFailed: (job: QueueJob, error: Error) => void;
  jobRetrying: (job: QueueJob, attempt: number) => void;
  queueFinished: (completed: number, failed: number) => void;
  statusChanged: (status: 'running' | 'paused' | 'idle') => void;
}

// Metadata & Social Types
export type SocialPlatform = 'youtube' | 'tiktok' | 'instagram' | 'shorts';

export interface AudioAnalysisData {
  bpm?: number;
  energy?: number; // 0.0 to 1.0 or numeric scale
  spectralCentroid?: number;
  bassEnergy?: number;
  midEnergy?: number;
  trebleEnergy?: number;
  rms?: number;
  duration?: number;
  key?: string;
  isKickDetected?: boolean;
}

export type AudioAnalysis = AudioAnalysisData | AudioAnalysisResult;

export interface TrackMetadataInput {
  filename?: string;
  trackNumber?: number;
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  subgenre?: string;
  bpm?: number;
  energy?: string;
  mood?: string;
  visualStyle?: string;
  audioAnalysis?: AudioAnalysis;
  customTags?: string[];
  platform?: SocialPlatform[];
}

export interface TrackMetadata {
  trackNumber: number;
  title: string;
  artist: string;
  album: string;
  genre: string;
  subgenre: string;
  bpm: number;
  energy: string; // e.g. "Low" | "Medium" | "High" | "Extreme"
  energyScore: number; // 0-100
  mood: string;
  visualStyle: string;
  platforms: SocialPlatform[];
  tags: string[];
  key?: string;
}

export interface SocialPlatformMetadata {
  platform: SocialPlatform;
  title: string;
  description: string;
  caption: string;
  hashtags: string[];
  formattedHashtags: string;
  tags: string[];
  targetAspect?: string;
}

export interface SocialMetadataBundle {
  track: TrackMetadata;
  platforms: Record<SocialPlatform, SocialPlatformMetadata>;
  generatedAt: string;
  youtube?: SocialPlatformMetadata;
  tiktok?: SocialPlatformMetadata;
  instagram?: SocialPlatformMetadata;
  shorts?: SocialPlatformMetadata;
}

// Thumbnail Generator Interfaces
export interface ThumbnailThemeOptions {
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  badgeBgColor?: string;
  glowColor?: string;
}

export type ThumbnailTheme = ThumbnailThemeOptions | 'default' | 'dark' | 'vibrant';

export interface ThumbnailOptions {
  title: string;
  artist: string;
  album?: string;
  trackNumber?: number;
  genre?: string;
  subgenre?: string;
  bpm?: number;
  energy?: string;
  artworkPath?: string;
  artworkBuffer?: Buffer;
  outputDir?: string;
  filenamePrefix?: string;
  theme?: ThumbnailTheme;
  width?: number;
  height?: number;
}

export interface ThumbnailResult {
  path16x9: string;
  path9x16: string;
  buffer16x9: Buffer;
  buffer9x16: Buffer;
  outputPath?: string;
  width?: number;
  height?: number;
}

// AI Provider Interfaces
export interface AIProviderConfig {
  provider?: 'pollinations' | 'huggingface' | 'local' | string;
  apiKey?: string;
  endpointUrl?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

export interface TextGenerationResult {
  text: string;
  source?: 'pollinations' | 'huggingface' | 'local' | string;
  tokensUsed?: number;
}

export interface ImageGenerationResult {
  imageBuffer?: Buffer;
  imageUrl?: string;
  mimeType?: string;
  prompt?: string;
  width?: number;
  height?: number;
  source?: 'pollinations' | 'huggingface' | 'local' | string;
}

// Preset Render Interfaces
export interface PresetRenderAudioFrame {
  timestamp?: number;
  rms?: number;
  bass: number;       // 0.0 to 1.0
  mid: number;        // 0.0 to 1.0
  treble: number;     // 0.0 to 1.0
  energy: number;     // 0.0 to 1.0
  isKick: boolean;
  bpm: number;
  fft?: number[];
}

export interface PresetRenderOptions {
  width: number;
  height: number;
  time: number;       // in seconds
  frame: number;      // frame count
  fps: number;        // frames per second (e.g., 30 or 60)
  duration?: number;
  audioData: PresetRenderAudioFrame;
  metadata?: Partial<TrackMetadata>;
}
