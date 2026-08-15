/**
 * Audio Spectrum & Waveform Renderer Component
 * Batch Music Visualizer Engine
 */

import { SKRSContext2D } from '@napi-rs/canvas';
import { VisualPreset, Dimensions, AudioAnimationFrame, SafeAreaInsets } from '../types.js';

export interface SpectrumRenderOptions {
  ctx: SKRSContext2D;
  dimensions: Dimensions;
  preset: VisualPreset;
  audioData: AudioAnimationFrame;
  safeArea: SafeAreaInsets;
  centerOffsetY?: number;
}

export function drawSpectrum({
  ctx,
  dimensions,
  preset,
  audioData,
  safeArea,
  centerOffsetY = 0,
}: SpectrumRenderOptions): void {
  const { visualizerMode } = preset;

  switch (visualizerMode) {
    case 'CIRCULAR':
      drawCircularSpectrum(ctx, dimensions, preset, audioData, centerOffsetY);
      break;

    case 'WAVE_LINES':
      drawWaveLinesSpectrum(ctx, dimensions, preset, audioData, safeArea, centerOffsetY);
      break;

    case 'DUAL_BARS':
      drawDualBarsSpectrum(ctx, dimensions, preset, audioData, safeArea, centerOffsetY);
      break;

    case 'BARS':
    default:
      drawBarsSpectrum(ctx, dimensions, preset, audioData, safeArea, centerOffsetY);
      break;
  }
}

/**
 * 1. Vertical Frequency Bars Visualizer
 */
function drawBarsSpectrum(
  ctx: SKRSContext2D,
  dimensions: Dimensions,
  preset: VisualPreset,
  audioData: AudioAnimationFrame,
  safeArea: SafeAreaInsets,
  centerOffsetY: number
): void {
  const { width, height } = dimensions;
  const spectrum = audioData.spectrum || [];
  const barCount = Math.min(spectrum.length, preset.barCount || 48);

  const barWidth = preset.barWidth || Math.max(4, Math.floor((width - safeArea.left - safeArea.right) / (barCount * 1.5)));
  const barGap = preset.barGap || Math.max(2, Math.floor(barWidth * 0.4));
  const totalWidth = barCount * (barWidth + barGap) - barGap;
  const startX = (width - totalWidth) / 2;

  // Base Y positioning (placed in lower half, respecting safe areas)
  const baseY = height - safeArea.bottom - 120 + centerOffsetY;
  const maxBarHeight = height * 0.28 * preset.bassReactivity;

  ctx.save();

  if (preset.glowIntensity > 0) {
    ctx.shadowColor = preset.colors.glow || preset.colors.primary;
    ctx.shadowBlur = preset.glowIntensity;
  }

  for (let i = 0; i < barCount; i++) {
    const rawVal = spectrum[i] || 0.05;
    const barHeight = Math.max(6, rawVal * maxBarHeight);

    const x = startX + i * (barWidth + barGap);
    const y = baseY - barHeight;

    // Gradient fill per bar
    const barGrad = ctx.createLinearGradient(x, baseY, x, y);
    barGrad.addColorStop(0, preset.colors.primary);
    barGrad.addColorStop(0.6, preset.colors.secondary);
    barGrad.addColorStop(1, preset.colors.accent);

    ctx.fillStyle = barGrad;

    // Draw rounded top bar
    ctx.beginPath();
    const cornerRadius = Math.min(barWidth / 2, 4);
    ctx.roundRect(x, y, barWidth, barHeight, [cornerRadius, cornerRadius, 0, 0]);
    ctx.fill();

    // Floating cap highlight
    ctx.fillStyle = preset.colors.textPrimary;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(x, y - 4, barWidth, 2);
    ctx.globalAlpha = 1.0;
  }

  ctx.restore();
}

/**
 * 2. Radial Circular Spectrum Visualizer
 */
function drawCircularSpectrum(
  ctx: SKRSContext2D,
  dimensions: Dimensions,
  preset: VisualPreset,
  audioData: AudioAnimationFrame,
  centerOffsetY: number
): void {
  const { width, height } = dimensions;
  const minDim = Math.min(width, height);
  const centerX = width / 2;
  const centerY = height / 2 + centerOffsetY;

  const bassBoost = (audioData.bass || 0) * preset.bassReactivity;
  const baseRadius = minDim * (preset.circularRadiusRatio || 0.22) * (1 + bassBoost * 0.08);

  const spectrum = audioData.spectrum || [];
  const count = Math.min(spectrum.length, preset.barCount || 60);

  ctx.save();

  // Glow setup
  if (preset.glowIntensity > 0) {
    ctx.shadowColor = preset.colors.glow || preset.colors.primary;
    ctx.shadowBlur = preset.glowIntensity;
  }

  // Inner decorative ring
  ctx.strokeStyle = preset.colors.secondary;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(centerX, centerY, baseRadius - 6, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 1.0;

  // Outer radial bars
  const maxBarLength = minDim * 0.22;
  const angleStep = (Math.PI * 2) / count;

  for (let i = 0; i < count; i++) {
    const angle = i * angleStep - Math.PI / 2;
    const rawVal = spectrum[i] || 0.05;
    const barLength = Math.max(8, rawVal * maxBarLength);

    const x1 = centerX + Math.cos(angle) * baseRadius;
    const y1 = centerY + Math.sin(angle) * baseRadius;
    const x2 = centerX + Math.cos(angle) * (baseRadius + barLength);
    const y2 = centerY + Math.sin(angle) * (baseRadius + barLength);

    const barGrad = ctx.createLinearGradient(x1, y1, x2, y2);
    barGrad.addColorStop(0, preset.colors.primary);
    barGrad.addColorStop(0.7, preset.colors.secondary);
    barGrad.addColorStop(1, preset.colors.accent);

    ctx.strokeStyle = barGrad;
    ctx.lineWidth = Math.max(3, (Math.PI * 2 * baseRadius) / count - 3);
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * 3. Smooth Bezier Wave Lines Visualizer
 */
function drawWaveLinesSpectrum(
  ctx: SKRSContext2D,
  dimensions: Dimensions,
  preset: VisualPreset,
  audioData: AudioAnimationFrame,
  safeArea: SafeAreaInsets,
  centerOffsetY: number
): void {
  const { width, height } = dimensions;
  const spectrum = audioData.spectrum || [];
  const baseY = height - safeArea.bottom - 140 + centerOffsetY;

  ctx.save();

  if (preset.glowIntensity > 0) {
    ctx.shadowColor = preset.colors.glow || preset.colors.primary;
    ctx.shadowBlur = preset.glowIntensity;
  }

  const waveLayers = [
    { color: preset.colors.primary, alpha: 0.9, ampMult: 1.0, phase: 0 },
    { color: preset.colors.secondary, alpha: 0.6, ampMult: 0.75, phase: Math.PI / 3 },
    { color: preset.colors.accent, alpha: 0.4, ampMult: 0.5, phase: (Math.PI * 2) / 3 },
  ];

  const pointsCount = Math.min(spectrum.length, 36);
  const stepX = (width - safeArea.left - safeArea.right) / (pointsCount - 1);

  waveLayers.forEach((layer) => {
    ctx.globalAlpha = layer.alpha;
    ctx.strokeStyle = layer.color;
    ctx.lineWidth = 4;
    ctx.beginPath();

    for (let i = 0; i < pointsCount; i++) {
      const x = safeArea.left + i * stepX;
      const freqVal = spectrum[i] || 0.05;
      const amp = freqVal * height * 0.18 * preset.bassReactivity * layer.ampMult;
      const waveOffset = Math.sin(audioData.timestamp * 4 + i * 0.3 + layer.phase) * 15;
      const y = baseY - amp + waveOffset;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = safeArea.left + (i - 1) * stepX;
        const cpX = (prevX + x) / 2;
        ctx.quadraticCurveTo(cpX, baseY - amp * 0.8, x, y);
      }
    }

    ctx.stroke();
  });

  ctx.restore();
}

/**
 * 4. Dual Mirrored Spectrum Bars
 */
function drawDualBarsSpectrum(
  ctx: SKRSContext2D,
  dimensions: Dimensions,
  preset: VisualPreset,
  audioData: AudioAnimationFrame,
  safeArea: SafeAreaInsets,
  centerOffsetY: number
): void {
  const { width, height } = dimensions;
  const spectrum = audioData.spectrum || [];
  const barCount = Math.min(spectrum.length, preset.barCount || 48);

  const barWidth = preset.barWidth || Math.max(5, Math.floor((width - safeArea.left - safeArea.right) / (barCount * 1.5)));
  const barGap = preset.barGap || Math.max(2, Math.floor(barWidth * 0.4));
  const totalWidth = barCount * (barWidth + barGap) - barGap;
  const startX = (width - totalWidth) / 2;
  const centerY = height / 2 + centerOffsetY + 50;

  const maxBarHeight = height * 0.18 * preset.bassReactivity;

  ctx.save();

  if (preset.glowIntensity > 0) {
    ctx.shadowColor = preset.colors.glow || preset.colors.primary;
    ctx.shadowBlur = preset.glowIntensity;
  }

  for (let i = 0; i < barCount; i++) {
    const rawVal = spectrum[i] || 0.05;
    const barHeight = Math.max(4, rawVal * maxBarHeight);
    const x = startX + i * (barWidth + barGap);

    const grad = ctx.createLinearGradient(x, centerY - barHeight, x, centerY + barHeight);
    grad.addColorStop(0, preset.colors.accent);
    grad.addColorStop(0.5, preset.colors.primary);
    grad.addColorStop(1, preset.colors.secondary);

    ctx.fillStyle = grad;

    // Upward bar
    ctx.beginPath();
    ctx.roundRect(x, centerY - barHeight, barWidth, barHeight, [3, 3, 0, 0]);
    ctx.fill();

    // Downward mirrored bar
    ctx.beginPath();
    ctx.roundRect(x, centerY, barWidth, barHeight, [0, 0, 3, 3]);
    ctx.fill();
  }

  ctx.restore();
}
