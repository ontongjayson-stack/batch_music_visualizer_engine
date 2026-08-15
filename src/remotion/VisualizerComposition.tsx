/**
 * Remotion Visualizer React Composition
 * Batch Music Visualizer Engine
 */

import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, Audio } from 'remotion';
import { VISUAL_PRESETS, getSafeAreaInsets } from '../rendering/presets.js';
import { VisualPresetName, AspectRatioMode, AudioAnalysisData } from '../rendering/types.js';

export interface VisualizerCompositionProps {
  audioPath: string;
  presetName?: VisualPresetName;
  aspectRatio?: AspectRatioMode;
  trackTitle?: string;
  artistName?: string;
  albumName?: string;
  watermarkText?: string;
  backgroundUrl?: string;
  audioAnalysis?: AudioAnalysisData;
}

export const VisualizerComposition: React.FC<VisualizerCompositionProps> = ({
  audioPath,
  presetName = 'DEFAULT',
  aspectRatio = 'LANDSCAPE',
  trackTitle = 'Track Title',
  artistName = 'Artist Name',
  albumName = 'Album Name',
  watermarkText = 'BATCH MUSIC ENGINE',
  backgroundUrl,
  audioAnalysis,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();

  const preset = useMemo(() => VISUAL_PRESETS[presetName] || VISUAL_PRESETS.DEFAULT, [presetName]);
  const safeArea = useMemo(() => getSafeAreaInsets(aspectRatio), [aspectRatio]);

  const progress = durationInFrames > 1 ? frame / durationInFrames : 0;
  const currentTime = frame / fps;
  const totalDuration = durationInFrames / fps;

  // Ken Burns zoom scale calculation
  const kb = preset.kenBurns;
  const t = Math.sin(progress * Math.PI * (kb.speed || 1.0));
  const zoomScale = kb.enabled ? kb.zoomStart + (kb.zoomEnd - kb.zoomStart) * t : 1.0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: preset.colors.background,
        overflow: 'hidden',
        fontFamily: preset.fontFamily,
      }}
    >
      {/* 1. Audio Source */}
      {audioPath && <Audio src={audioPath} />}

      {/* 2. Ken Burns Background Container */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${zoomScale}) translate(${kb.panX * 20 * t}px, ${kb.panY * 20 * t}px)`,
          transition: 'transform 0.1s ease-out',
          backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {!backgroundUrl && (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: `radial-gradient(circle at center, ${preset.colors.secondary} 0%, ${preset.colors.background} 70%, #000 100%)`,
            }}
          />
        )}
      </div>

      {/* 3. Dark Overlay & Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: preset.colors.background,
          opacity: preset.overlayOpacity,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at center, transparent 40%, rgba(0,0,0,${preset.vignetteStrength}) 100%)`,
        }}
      />

      {/* 4. Text & Branding Header */}
      <div
        style={{
          position: 'absolute',
          top: safeArea.top,
          left: safeArea.left,
          right: safeArea.right,
          color: preset.colors.textPrimary,
          textAlign: aspectRatio === 'PORTRAIT' ? 'center' : 'left',
        }}
      >
        {watermarkText && (
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: preset.colors.primary,
              letterSpacing: 2,
              marginBottom: 8,
            }}
          >
            /// {watermarkText.toUpperCase()}
          </div>
        )}
        <h1
          style={{
            fontSize: aspectRatio === 'PORTRAIT' ? 44 : 58,
            fontWeight: 800,
            margin: 0,
            color: preset.colors.textPrimary,
            textShadow: `0 0 ${preset.glowIntensity}px ${preset.colors.glow}`,
          }}
        >
          {trackTitle}
        </h1>
        <h2
          style={{
            fontSize: aspectRatio === 'PORTRAIT' ? 24 : 28,
            fontWeight: 600,
            margin: '8px 0 0 0',
            color: preset.colors.textSecondary,
          }}
        >
          {artistName} {albumName ? `— ${albumName}` : ''}
        </h2>
      </div>

      {/* 5. Progress Bar & Duration Counter */}
      <div
        style={{
          position: 'absolute',
          bottom: safeArea.bottom,
          left: safeArea.left,
          right: safeArea.right,
        }}
      >
        <div
          style={{
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
            color: preset.colors.textSecondary,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <span>Progress</span>
          <span>
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </span>
        </div>
        <div
          style={{
            width: '100%',
            height: 6,
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${preset.colors.secondary}, ${preset.colors.primary})`,
              boxShadow: `0 0 10px ${preset.colors.glow}`,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
