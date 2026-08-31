/**
 * Video Rendering & Visual Systems Types
 * Batch Music Visualizer Engine
 */

export type AspectRatioMode = 'LANDSCAPE' | 'PORTRAIT' | '16:9' | '9:16';

export interface Dimensions {
  width: number;
  height: number;
}

export type VisualizerMode = 'BARS' | 'CIRCULAR' | 'WAVE_LINES' | 'DUAL_BARS';

export type ParticleType = 'sparks' | 'dust' | 'fireflies' | 'smoke' | 'glow';

export type VisualPresetName =
  | 'DEFAULT'
  | 'CINEMATIC-ALBUM'
  | 'PRO-CINEMATIC-SPEAKER'
  | 'TRAP-PIANO'
  | 'DARK-CINEMATIC'
  | 'AMAPIANO'
  | 'TRAP'
  | 'DEEP-HOUSE'
  | 'MINIMAL'
  | 'ABSTRACT';

export interface VisualColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  textPrimary: string;
  textSecondary: string;
  glow: string;
  particleColors: string[];
}

export interface KenBurnsConfig {
  enabled: boolean;
  zoomStart: number;
  zoomEnd: number;
  panX: number; // -1 to 1
  panY: number; // -1 to 1
  speed: number;
}

export interface VisualPreset {
  name: VisualPresetName;
  description: string;
  colors: VisualColorPalette;
  visualizerMode: VisualizerMode;
  particleType: ParticleType;
  particleCount: number;
  particleSpeedMultiplier: number;
  kenBurns: KenBurnsConfig;
  glowIntensity: number;
  barCount: number;
  barWidth?: number;
  barGap?: number;
  bassReactivity: number;
  fontFamily: string;
  overlayOpacity: number;
  vignetteStrength: number;
  mirrorSpectrum: boolean;
  circularRadiusRatio: number; // 0 to 1 relative to min dimension
}

export interface VisualConfig {
  preset: VisualPresetName;
  aspectRatio: AspectRatioMode;
  fps: number;
  customPreset?: Partial<VisualPreset>;
  trackTitle?: string;
  artistName?: string;
  albumName?: string;
  watermarkText?: string;
  logoPath?: string;
  backgroundPath?: string;
  customColors?: Partial<VisualColorPalette>;
  showCenterArt?: boolean;
  spectrumStyle?: 'BARS' | 'RADIAL_ORBIT' | 'WAVE_LINE' | 'DUAL_WAVEFORM' | 'PARTICLES' | 'MIRROR';
  heroShape?: 'SQUARE_ROUNDED' | 'VINYL_SPIN' | 'CIRCULAR_EMBLEM' | 'SUBWOOFER_CONE';
  fxToggles?: {
    kenBurns?: boolean;
    vignetteStrength?: number;
    transientFlares?: boolean;
    particleDensity?: number;
  };
}

export interface AudioAnimationFrame {
  frameIndex: number;
  timestamp: number; // in seconds
  volume: number; // 0 to 1 overall amplitude
  bass: number; // 0 to 1 low-end energy (20-250Hz)
  subBass?: number; // 0 to 1 sub-bass energy (20-120Hz)
  kickTransient?: number; // 0 to 1 kick punch transient derivative
  mids: number; // 0 to 1 mid-range energy (250-4000Hz)
  treble: number; // 0 to 1 high-end energy (4000-20000Hz)
  spectrum: number[]; // normalized frequencies (0 to 1)
  isBeat?: boolean;
}

export interface AudioAnalysisData {
  duration: number; // seconds
  sampleRate?: number;
  fps: number;
  totalFrames: number;
  bpm?: number;
  frames: AudioAnimationFrame[];
}

export interface RenderOptions {
  audioPath: string;
  audioAnalysis?: AudioAnalysisData;
  visualConfig?: Partial<VisualConfig>;
  preset?: VisualPresetName;
  aspectRatio?: AspectRatioMode;
  outputPath: string;
  backgroundPath?: string;
  logoPath?: string;
  trackTitle?: string;
  artistName?: string;
  albumName?: string;
  watermarkText?: string;
  showCenterArt?: boolean;
  spectrumStyle?: 'BARS' | 'RADIAL_ORBIT' | 'WAVE_LINE' | 'DUAL_WAVEFORM' | 'PARTICLES' | 'MIRROR';
  heroShape?: 'SQUARE_ROUNDED' | 'VINYL_SPIN' | 'CIRCULAR_EMBLEM' | 'SUBWOOFER_CONE';
  customColors?: Partial<VisualColorPalette>;
  fps?: number;
  onProgress?: (progress: number, currentFrame: number, totalFrames: number) => void;
}

export interface RenderResult {
  outputPath: string;
  duration: number;
  totalFrames: number;
  width: number;
  height: number;
  fps: number;
  fileSize?: number;
  renderTimeSeconds: number;
}

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}
