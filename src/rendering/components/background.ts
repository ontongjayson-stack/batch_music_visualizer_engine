/**
 * Background & Ken Burns Renderer Component
 * Batch Music Visualizer Engine
 */

import { SKRSContext2D, Image } from '@napi-rs/canvas';
import { VisualPreset, Dimensions, AudioAnimationFrame } from '../types.js';

export interface BackgroundRenderOptions {
  ctx: SKRSContext2D;
  dimensions: Dimensions;
  preset: VisualPreset;
  frameIndex: number;
  totalFrames: number;
  audioData: AudioAnimationFrame;
  bgImage?: Image | null;
}

export function drawBackground({
  ctx,
  dimensions,
  preset,
  frameIndex,
  totalFrames,
  audioData,
  bgImage,
}: BackgroundRenderOptions): void {
  const { width, height } = dimensions;
  const progress = totalFrames > 1 ? frameIndex / (totalFrames - 1) : 0;

  ctx.save();

  // 1. Ken Burns Effect Calculations
  const kb = preset.kenBurns;
  let scale = 1.0;
  let offsetX = 0;
  let offsetY = 0;

  if (kb.enabled) {
    // Smooth sinusoidal motion curve
    const t = Math.sin(progress * Math.PI * kb.speed);
    const zoom = kb.zoomStart + (kb.zoomEnd - kb.zoomStart) * t;
    
    // Subtle bass pulse expansion
    const bassPulse = (audioData.bass || 0) * 0.02 * preset.bassReactivity;
    scale = zoom + bassPulse;

    offsetX = kb.panX * width * t;
    offsetY = kb.panY * height * t;
  }

  ctx.translate(width / 2 + offsetX, height / 2 + offsetY);
  ctx.scale(scale, scale);
  ctx.translate(-width / 2, -height / 2);

  // 2. Draw Image or Procedural Gradient Artwork
  if (bgImage) {
    // Draw background image covering full canvas aspect ratio
    const imgRatio = bgImage.width / bgImage.height;
    const canvasRatio = width / height;
    let renderW = width;
    let renderH = height;
    let renderX = 0;
    let renderY = 0;

    if (imgRatio > canvasRatio) {
      renderW = height * imgRatio;
      renderX = (width - renderW) / 2;
    } else {
      renderH = width / imgRatio;
      renderY = (height - renderH) / 2;
    }

    ctx.drawImage(bgImage, renderX, renderY, renderW, renderH);
  } else {
    // Dynamic procedural studio background
    const bgGradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      50,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.85
    );

    bgGradient.addColorStop(0, preset.colors.secondary);
    bgGradient.addColorStop(0.5, preset.colors.background);
    bgGradient.addColorStop(1, '#000000');

    ctx.fillStyle = bgGradient;
    ctx.fillRect(-100, -100, width + 200, height + 200);

    // Subtle ambient color mesh
    ctx.fillStyle = preset.colors.primary;
    ctx.globalAlpha = 0.08 + (audioData.bass || 0) * 0.05;
    ctx.beginPath();
    ctx.arc(width * 0.3, height * 0.4, width * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = preset.colors.accent;
    ctx.globalAlpha = 0.06;
    ctx.beginPath();
    ctx.arc(width * 0.7, height * 0.6, width * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  ctx.restore();

  // 3. Darkening Overlay Tint
  ctx.save();
  ctx.fillStyle = preset.colors.background;
  ctx.globalAlpha = preset.overlayOpacity;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // 4. Vignette Gradient Effect
  if (preset.vignetteStrength > 0) {
    ctx.save();
    const vignetteGrad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.35,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.75
    );

    vignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignetteGrad.addColorStop(1, `rgba(0, 0, 0, ${preset.vignetteStrength})`);

    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}
