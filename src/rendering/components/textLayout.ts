/**
 * Dynamic Text & Branding Layout Component
 * Batch Music Visualizer Engine
 */

import { SKRSContext2D, Image } from '@napi-rs/canvas';
import { VisualPreset, Dimensions, AspectRatioMode, SafeAreaInsets } from '../types.js';

export interface TextLayoutOptions {
  ctx: SKRSContext2D;
  dimensions: Dimensions;
  aspectRatio: AspectRatioMode;
  preset: VisualPreset;
  safeArea: SafeAreaInsets;
  trackTitle?: string;
  artistName?: string;
  albumName?: string;
  watermarkText?: string;
  logoImage?: Image | null;
  centerOffsetY?: number;
}

export function drawTextLayout({
  ctx,
  dimensions,
  aspectRatio,
  preset,
  safeArea,
  trackTitle = 'Untitled Track',
  artistName = 'Unknown Artist',
  albumName,
  watermarkText = 'BATCH MUSIC ENGINE',
  logoImage,
  centerOffsetY = 0,
}: TextLayoutOptions): void {
  const { width, height } = dimensions;
  const isPortrait = aspectRatio === 'PORTRAIT' || aspectRatio === '9:16';

  ctx.save();

  // Typography settings
  const fontFam = preset.fontFamily || 'Inter, sans-serif';

  if (isPortrait) {
    // ----------------------------------------------------
    // PORTRAIT LAYOUT (TikTok / Reels / Shorts: 1080x1920)
    // Safe region constrained, centered vertical stack
    // ----------------------------------------------------
    const contentCenterX = width / 2;
    const textTopY = height * 0.28 + centerOffsetY;

    // 1. Watermark / Top Badge
    if (watermarkText) {
      ctx.font = `600 14px ${fontFam}`;
      ctx.fillStyle = preset.colors.primary;
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.85;
      ctx.fillText(watermarkText.toUpperCase(), contentCenterX, safeArea.top + 30);
    }

    // 2. Track Title
    ctx.font = `800 48px ${fontFam}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (preset.glowIntensity > 0) {
      ctx.shadowColor = preset.colors.glow || preset.colors.primary;
      ctx.shadowBlur = preset.glowIntensity * 0.8;
    }

    ctx.fillStyle = preset.colors.textPrimary;
    ctx.fillText(truncateText(ctx, trackTitle, width - safeArea.left - safeArea.right), contentCenterX, textTopY);

    // 3. Artist Name & Album Name
    ctx.shadowBlur = 0;
    ctx.font = `600 28px ${fontFam}`;
    ctx.fillStyle = preset.colors.textSecondary;
    const subtitle = albumName ? `${artistName} • ${albumName}` : artistName;
    ctx.fillText(truncateText(ctx, subtitle, width - safeArea.left - safeArea.right), contentCenterX, textTopY + 52);

    // 4. Center Logo / Emblem
    if (logoImage) {
      const logoSize = 140;
      const logoX = contentCenterX - logoSize / 2;
      const logoY = height * 0.44 + centerOffsetY;

      ctx.save();
      ctx.beginPath();
      ctx.arc(contentCenterX, logoY + logoSize / 2, logoSize / 2 + 4, 0, Math.PI * 2);
      ctx.strokeStyle = preset.colors.primary;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.clip();
      ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
      ctx.restore();
    }
  } else {
    // ----------------------------------------------------
    // LANDSCAPE LAYOUT (YouTube: 1920x1080)
    // ----------------------------------------------------
    const startX = safeArea.left + 40;
    const textBaseY = height * 0.35 + centerOffsetY;

    // 1. Watermark / Channel Tag (Top Left)
    if (watermarkText) {
      ctx.font = `700 16px ${fontFam}`;
      ctx.fillStyle = preset.colors.primary;
      ctx.textAlign = 'left';
      ctx.globalAlpha = 0.9;
      ctx.fillText(`/// ${watermarkText.toUpperCase()}`, startX, safeArea.top + 40);
    }

    // 2. Track Title
    ctx.font = `800 64px ${fontFam}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    if (preset.glowIntensity > 0) {
      ctx.shadowColor = preset.colors.glow || preset.colors.primary;
      ctx.shadowBlur = preset.glowIntensity;
    }

    ctx.fillStyle = preset.colors.textPrimary;
    ctx.fillText(truncateText(ctx, trackTitle, width * 0.65), startX, textBaseY);

    // 3. Artist Name & Album
    ctx.shadowBlur = 0;
    ctx.font = `600 32px ${fontFam}`;
    ctx.fillStyle = preset.colors.textSecondary;
    const subtitle = albumName ? `${artistName}  —  ${albumName}` : artistName;
    ctx.fillText(truncateText(ctx, subtitle, width * 0.65), startX, textBaseY + 80);

    // 4. Logo / Watermark Badge (Top Right)
    if (logoImage) {
      const logoSize = 90;
      const logoX = width - safeArea.right - logoSize - 20;
      const logoY = safeArea.top + 20;

      ctx.save();
      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.strokeStyle = preset.colors.primary;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.clip();
      ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
      ctx.restore();
    }
  }

  ctx.restore();
}

function truncateText(ctx: SKRSContext2D, text: string, maxWidth: number): string {
  let metrics = ctx.measureText(text);
  if (metrics.width <= maxWidth) return text;

  let truncated = text;
  while (truncated.length > 3 && metrics.width > maxWidth) {
    truncated = truncated.slice(0, -1);
    metrics = ctx.measureText(truncated + '...');
  }
  return truncated + '...';
}
