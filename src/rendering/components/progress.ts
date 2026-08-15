/**
 * Track Progress Bar & Timestamp Renderer Component
 * Batch Music Visualizer Engine
 */

import { SKRSContext2D } from '@napi-rs/canvas';
import { VisualPreset, Dimensions, AudioAnimationFrame, SafeAreaInsets } from '../types.js';

export interface ProgressRenderOptions {
  ctx: SKRSContext2D;
  dimensions: Dimensions;
  preset: VisualPreset;
  audioData: AudioAnimationFrame;
  durationSeconds: number;
  safeArea: SafeAreaInsets;
  centerOffsetY?: number;
}

export function drawProgressBar({
  ctx,
  dimensions,
  preset,
  audioData,
  durationSeconds,
  safeArea,
  centerOffsetY = 0,
}: ProgressRenderOptions): void {
  const { width, height } = dimensions;
  const currentTime = Math.min(audioData.timestamp, durationSeconds);
  const progressRatio = durationSeconds > 0 ? Math.min(1, Math.max(0, currentTime / durationSeconds)) : 0;

  // Track Dimensions
  const barWidth = Math.min(width - safeArea.left - safeArea.right - 100, 1200);
  const barHeight = 6;
  const x = (width - barWidth) / 2;
  const y = height - safeArea.bottom - 45 + centerOffsetY;

  ctx.save();

  // 1. Background Track
  ctx.fillStyle = preset.colors.textSecondary;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.roundRect(x, y, barWidth, barHeight, 3);
  ctx.fill();

  // 2. Active Progress Fill
  if (progressRatio > 0) {
    const activeWidth = Math.max(barHeight, barWidth * progressRatio);

    const fillGrad = ctx.createLinearGradient(x, y, x + activeWidth, y);
    fillGrad.addColorStop(0, preset.colors.secondary);
    fillGrad.addColorStop(1, preset.colors.primary);

    ctx.fillStyle = fillGrad;
    ctx.globalAlpha = 1.0;

    if (preset.glowIntensity > 0) {
      ctx.shadowColor = preset.colors.glow || preset.colors.primary;
      ctx.shadowBlur = preset.glowIntensity * 0.7;
    }

    ctx.beginPath();
    ctx.roundRect(x, y, activeWidth, barHeight, 3);
    ctx.fill();

    // Progress Handle Head Dot
    const headX = x + activeWidth;
    ctx.fillStyle = preset.colors.textPrimary;
    ctx.beginPath();
    ctx.arc(headX, y + barHeight / 2, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Time Display Text (Current / Total)
  ctx.restore();
  ctx.save();

  const formattedCurrent = formatTime(currentTime);
  const formattedTotal = formatTime(durationSeconds);
  const timeText = `${formattedCurrent} / ${formattedTotal}`;

  ctx.font = `600 16px ${preset.fontFamily || 'Inter, monospace'}`;
  ctx.fillStyle = preset.colors.textSecondary;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  // Position time text on right side of progress bar
  ctx.fillText(timeText, x + barWidth, y - 18);

  ctx.restore();
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const padMin = String(mins).padStart(2, '0');
  const padSec = String(secs).padStart(2, '0');
  return `${padMin}:${padSec}`;
}
