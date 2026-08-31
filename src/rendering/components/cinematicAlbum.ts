/**
 * Cinematic Album V1 Visual Composition Renderer
 * Batch Music Visualizer Engine
 * 
 * 6-Layer Professional Visual Architecture:
 * - Layer 1: Atmospheric Background (Enlarged Artwork, Blur, Darkening, Vignette, Subtle Ken Burns Drift)
 * - Layer 2: Hero Album Artwork (Sharp, Rounded Corners, Multi-Stage Shadow, Organic Scale Breathing)
 * - Layer 3: Audio-Reactive Radial Spectrum & Glow Ring (Positioned Behind Artwork)
 * - Layer 4: Ambient Lighting & Depth (Corner Radial Glow Blobs)
 * - Layer 5: Clean Modern Typography (Title, Artist, Album)
 * - Layer 6: Thin Progress Bar & Timestamp
 */

import { SKRSContext2D, Image, createCanvas } from '@napi-rs/canvas';
import { Dimensions, VisualPreset, AudioAnimationFrame, SafeAreaInsets } from '../types.js';

export interface CinematicAlbumDrawOptions {
  ctx: SKRSContext2D;
  dimensions: Dimensions;
  preset: VisualPreset;
  frameIndex: number;
  totalFrames: number;
  audioData: AudioAnimationFrame;
  coverImage: Image | null;
  bgImage?: Image | null;
  blurRadius?: number;
  trackTitle: string;
  artistName: string;
  albumName?: string;
  safeArea: SafeAreaInsets;
}

// Offscreen blur cache map to eliminate per-frame CPU/GPU blur calculations
const blurredCanvasCache = new Map<string, any>();

function getBlurredBackgroundCanvas(coverImage: Image, targetWidth: number, targetHeight: number, blurRadius: number = 28): any {
  const cacheKey = `${(coverImage as any).src || 'img'}_${coverImage.width}x${coverImage.height}_blur${blurRadius}_to_${targetWidth}x${targetHeight}`;
  if (blurredCanvasCache.has(cacheKey)) {
    return blurredCanvasCache.get(cacheKey);
  }

  // Pre-render blurred image onto an offscreen canvas at 0.5x resolution for speed & smooth Skia blur
  const scale = 0.5;
  const offWidth = Math.ceil(targetWidth * scale);
  const offHeight = Math.ceil(targetHeight * scale);
  const offCanvas = createCanvas(offWidth, offHeight);
  const offCtx = offCanvas.getContext('2d');

  // Draw scaled artwork covering canvas
  const imgAspect = coverImage.width / coverImage.height;
  const targetAspect = targetWidth / targetHeight;
  let drawW = offWidth;
  let drawH = offHeight;
  let drawX = 0;
  let drawY = 0;

  if (imgAspect > targetAspect) {
    drawW = offHeight * imgAspect;
    drawX = (offWidth - drawW) / 2;
  } else {
    drawH = offWidth / imgAspect;
    drawY = (offHeight - drawH) / 2;
  }

  offCtx.drawImage(coverImage, drawX, drawY, drawW, drawH);

  // Apply Skia blur filter
  if (blurRadius > 0) {
    try {
      offCtx.filter = `blur(${Math.round(blurRadius * scale)}px)`;
      offCtx.drawImage(offCanvas, 0, 0, offWidth, offHeight);
      offCtx.filter = 'none';
    } catch (err) {
      // Fallback if filter is unsupported
    }
  }

  blurredCanvasCache.set(cacheKey, offCanvas);
  return offCanvas;
}

export function drawCinematicAlbumComposition(options: CinematicAlbumDrawOptions): void {
  const {
    ctx,
    dimensions,
    preset,
    frameIndex,
    totalFrames,
    audioData,
    coverImage,
    bgImage,
    blurRadius = 28,
    trackTitle,
    artistName,
    albumName,
  } = options;

  const { width, height } = dimensions;
  const progressRatio = Math.min(1.0, Math.max(0.0, frameIndex / Math.max(1, totalFrames)));
  const isPortrait = height > width;

  // Normalized Audio Inputs
  const bassEnergy = Math.min(1.0, (audioData.bass || 0) * (preset.bassReactivity || 1.4));
  const midEnergy = Math.min(1.0, audioData.mids || 0);
  const highEnergy = Math.min(1.0, audioData.treble || 0);
  const overallEnergy = Math.min(1.0, (audioData.volume || 0) * 1.5);

  // Colors
  const primaryColor = preset.colors.primary || '#38bdf8';
  const secondaryColor = preset.colors.secondary || '#818cf8';
  const accentColor = preset.colors.accent || '#c084fc';
  const bgColor = preset.colors.background || '#07090e';

  // =========================================================================
  // LAYER 1: ATMOSPHERIC BACKGROUND (BLURRED ARTWORK + VIGNETTE + DRIFT)
  // =========================================================================
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  const backgroundSrcImage = bgImage || coverImage;

  if (backgroundSrcImage) {
    const blurredCanvas = getBlurredBackgroundCanvas(backgroundSrcImage, width, height, blurRadius);
    
    // Slow Ken Burns drift (zoom 1.05 -> 1.12)
    const kenZoom = 1.05 + Math.sin((frameIndex / totalFrames) * Math.PI) * 0.07;
    const panX = Math.cos(frameIndex * 0.002) * (width * 0.02);
    const panY = Math.sin(frameIndex * 0.002) * (height * 0.02);

    ctx.save();
    ctx.translate(width / 2 + panX, height / 2 + panY);
    ctx.scale(kenZoom, kenZoom);
    ctx.drawImage(blurredCanvas, -width / 2, -height / 2, width, height);
    ctx.restore();

    // Darkening Overlay
    ctx.fillStyle = `rgba(7, 9, 14, ${preset.overlayOpacity || 0.55})`;
    ctx.fillRect(0, 0, width, height);
  }

  // Deep Radial Vignette
  const vignetteGrad = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.25,
    width / 2, height / 2, Math.max(width, height) * 0.75
  );
  vignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0.0)');
  vignetteGrad.addColorStop(0.7, 'rgba(4, 6, 10, 0.45)');
  vignetteGrad.addColorStop(1, `rgba(2, 3, 5, ${preset.vignetteStrength || 0.75})`);
  ctx.fillStyle = vignetteGrad;
  ctx.fillRect(0, 0, width, height);

  // =========================================================================
  // LAYER 4 (PRE): 2.5D DEPTH-PLANE LIGHTING & TRANSIENT EXPOSURE FLARES
  // =========================================================================
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  
  // Top-Left Light Blob
  const blob1Grad = ctx.createRadialGradient(0, 0, 10, 0, 0, width * 0.5);
  blob1Grad.addColorStop(0, `${primaryColor}${Math.floor((0.25 + bassEnergy * 0.2) * 255).toString(16).padStart(2, '0')}`);
  blob1Grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = blob1Grad;
  ctx.fillRect(0, 0, width * 0.6, height * 0.6);

  // Bottom-Right Light Blob
  const blob2Grad = ctx.createRadialGradient(width, height, 10, width, height, width * 0.5);
  blob2Grad.addColorStop(0, `${accentColor}${Math.floor((0.2 + midEnergy * 0.2) * 255).toString(16).padStart(2, '0')}`);
  blob2Grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = blob2Grad;
  ctx.fillRect(width * 0.4, height * 0.4, width * 0.6, height * 0.6);

  // Transient-Driven Exposure Flare (Lightning / Beam Glow on Peak Kick Transients)
  const isKickPeak = (audioData.kickTransient !== undefined ? audioData.kickTransient > 0.6 : (audioData.isBeat && bassEnergy > 0.65));
  if (isKickPeak) {
    const flareIntensity = (audioData.kickTransient || bassEnergy) * 0.35;
    const flareGrad = ctx.createRadialGradient(
      width * 0.5, height * 0.44, 20,
      width * 0.5, height * 0.44, Math.max(width, height) * 0.6
    );
    flareGrad.addColorStop(0, `rgba(255, 255, 255, ${flareIntensity})`);
    flareGrad.addColorStop(0.3, `${primaryColor}${Math.floor(flareIntensity * 200).toString(16).padStart(2, '0')}`);
    flareGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = flareGrad;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();

  // =========================================================================
  // CALCULATE HERO ARTWORK & TYPOGRAPHY LAYOUT POSITIONS
  // =========================================================================
  let artSize: number;
  let artCenterX: number;
  let artCenterY: number;

  if (isPortrait) {
    // 9:16 Vertical Layout (TikTok / Reels / Shorts)
    artSize = Math.min(width * 0.68, 680);
    artCenterX = width / 2;
    artCenterY = height * 0.42;
  } else {
    // 16:9 Horizontal Layout (YouTube)
    artSize = Math.min(height * 0.52, 540);
    artCenterX = width / 2;
    artCenterY = height * 0.44;
  }

  const radius = artSize / 2;

  // Organic Scale Breathing on Bass Kick (1.000 -> 1.018 to 1.025 max)
  const breathScale = 1.0 + (bassEnergy * 0.022);
  const currentArtSize = artSize * breathScale;
  const currentRadius = currentArtSize / 2;

  // =========================================================================
  // LAYER 3: AUDIO-REACTIVE RADIAL SPECTRUM & GLOW RING (BEHIND ARTWORK)
  // =========================================================================
  ctx.save();
  ctx.translate(artCenterX, artCenterY);

  // Ambient Glow Ring
  const ringGlowGrad = ctx.createRadialGradient(
    0, 0, currentRadius * 0.85,
    0, 0, currentRadius * 1.35
  );
  ringGlowGrad.addColorStop(0, `${primaryColor}${Math.floor((0.3 + bassEnergy * 0.4) * 255).toString(16).padStart(2, '0')}`);
  ringGlowGrad.addColorStop(0.5, `${secondaryColor}${Math.floor((0.15 + midEnergy * 0.25) * 255).toString(16).padStart(2, '0')}`);
  ringGlowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ringGlowGrad;
  ctx.beginPath();
  ctx.arc(0, 0, currentRadius * 1.35, 0, Math.PI * 2);
  ctx.fill();

  // Radial Frequency Spectrum Bars
  const numBars = preset.barCount || 64;
  const spectrumData = audioData.spectrum || [];
  const baseOuterRadius = currentRadius + 6;
  const maxBarLength = currentRadius * 0.35;

  ctx.lineWidth = preset.barWidth || 4;
  ctx.lineCap = 'round';

  for (let i = 0; i < numBars; i++) {
    const angle = (i / numBars) * Math.PI * 2 - Math.PI / 2;
    
    // Logarithmic frequency binning for audio-reactivity
    const specIdx = Math.floor(Math.pow(i / numBars, 1.5) * Math.min(spectrumData.length, 64));
    const val = spectrumData[specIdx] || (0.15 + Math.sin(frameIndex * 0.1 + i) * 0.1);
    const barLen = Math.max(6, val * maxBarLength * (preset.bassReactivity || 1.4));

    const x1 = Math.cos(angle) * baseOuterRadius;
    const y1 = Math.sin(angle) * baseOuterRadius;
    const x2 = Math.cos(angle) * (baseOuterRadius + barLen);
    const y2 = Math.sin(angle) * (baseOuterRadius + barLen);

    const barGrad = ctx.createLinearGradient(x1, y1, x2, y2);
    barGrad.addColorStop(0, primaryColor);
    barGrad.addColorStop(0.6, secondaryColor);
    barGrad.addColorStop(1, accentColor);

    ctx.strokeStyle = barGrad;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.restore();

  // =========================================================================
  // LAYER 2: HERO ALBUM ARTWORK (SHARP, ROUNDED CORNERS, DROP SHADOW)
  // =========================================================================
  ctx.save();
  ctx.translate(artCenterX, artCenterY);
  ctx.scale(breathScale, breathScale);

  const cornerRadius = 18;
  const halfSize = artSize / 2;

  // Multi-Stage Drop Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 16;

  // Outer Rounded Rectangle Path
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(-halfSize, -halfSize, artSize, artSize, cornerRadius);
  } else {
    ctx.rect(-halfSize, -halfSize, artSize, artSize);
  }
  ctx.fillStyle = '#0b0f19';
  ctx.fill();

  // Reset shadow for crisp image clipping
  ctx.shadowColor = 'transparent';

  // Draw Clipped Artwork
  ctx.clip();
  if (coverImage) {
    ctx.drawImage(coverImage, -halfSize, -halfSize, artSize, artSize);
  } else {
    // Elegant Fallback Graphic if cover artwork is absent
    const placeholderGrad = ctx.createLinearGradient(-halfSize, -halfSize, halfSize, halfSize);
    placeholderGrad.addColorStop(0, '#1e293b');
    placeholderGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = placeholderGrad;
    ctx.fillRect(-halfSize, -halfSize, artSize, artSize);

    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, halfSize * 0.4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Edge Highlight Frame Ring
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();

  // =========================================================================
  // LAYER 5: CLEAN MODERN TYPOGRAPHY (TITLE, ARTIST, ALBUM)
  // =========================================================================
  ctx.save();
  ctx.textAlign = 'center';

  let titleY: number;
  let artistY: number;
  let albumY: number;
  let titleFontSize: number;
  let artistFontSize: number;

  if (isPortrait) {
    titleY = artCenterY + currentRadius + 75;
    artistY = titleY + 44;
    albumY = artistY + 34;
    titleFontSize = Math.min(Math.floor(width * 0.052), 46);
    artistFontSize = Math.min(Math.floor(width * 0.038), 32);
  } else {
    titleY = artCenterY + currentRadius + 55;
    artistY = titleY + 36;
    albumY = artistY + 28;
    titleFontSize = Math.min(Math.floor(height * 0.046), 40);
    artistFontSize = Math.min(Math.floor(height * 0.032), 26);
  }

  // Track Title (Bold, High Contrast)
  ctx.font = `700 ${titleFontSize}px ${preset.fontFamily || 'Inter, sans-serif'}`;
  ctx.fillStyle = preset.colors.textPrimary || '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 2;

  // Title Text Truncation Safety
  const maxTextWidth = width * (isPortrait ? 0.85 : 0.75);
  let displayTitle = trackTitle;
  if (ctx.measureText(displayTitle).width > maxTextWidth) {
    while (displayTitle.length > 3 && ctx.measureText(displayTitle + '...').width > maxTextWidth) {
      displayTitle = displayTitle.slice(0, -1);
    }
    displayTitle += '...';
  }
  ctx.fillText(displayTitle, width / 2, titleY);

  // Artist Name (Medium Weight, Accent Color)
  ctx.font = `500 ${artistFontSize}px ${preset.fontFamily || 'Inter, sans-serif'}`;
  ctx.fillStyle = primaryColor;
  ctx.shadowBlur = 8;
  
  let displayArtist = artistName;
  if (ctx.measureText(displayArtist).width > maxTextWidth) {
    while (displayArtist.length > 3 && ctx.measureText(displayArtist + '...').width > maxTextWidth) {
      displayArtist = displayArtist.slice(0, -1);
    }
    displayArtist += '...';
  }
  ctx.fillText(displayArtist, width / 2, artistY);

  // Album Name (Subtle Badge Text)
  if (albumName) {
    ctx.font = `400 ${Math.floor(artistFontSize * 0.8)}px ${preset.fontFamily || 'Inter, sans-serif'}`;
    ctx.fillStyle = preset.colors.textSecondary || '#94a3b8';
    ctx.shadowBlur = 4;
    ctx.fillText(`Album: ${albumName}`, width / 2, albumY);
  }

  ctx.restore();

  // =========================================================================
  // LAYER 6: THIN PROGRESS BAR & TIMESTAMPS
  // =========================================================================
  ctx.save();

  const durationSec = Math.max(1, Math.ceil(totalFrames / 30));
  const currentSec = Math.floor((frameIndex / totalFrames) * durationSec);

  const formatTime = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const timeStr = `${formatTime(currentSec)} / ${formatTime(durationSec)}`;

  let barWidth: number;
  let barX: number;
  let barY: number;
  const barHeight = isPortrait ? 5 : 4;

  if (isPortrait) {
    barWidth = width * 0.82;
    barX = (width - barWidth) / 2;
    barY = height - 130;
  } else {
    barWidth = width * 0.75;
    barX = (width - barWidth) / 2;
    barY = height - 60;
  }

  // Track Background Line
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(barX, barY, barWidth, barHeight, barHeight / 2);
  } else {
    ctx.rect(barX, barY, barWidth, barHeight);
  }
  ctx.fill();

  // Filled Progress Line
  const fillWidth = Math.max(barHeight, barWidth * progressRatio);
  const fillGrad = ctx.createLinearGradient(barX, barY, barX + fillWidth, barY);
  fillGrad.addColorStop(0, primaryColor);
  fillGrad.addColorStop(1, accentColor);

  ctx.fillStyle = fillGrad;
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(barX, barY, fillWidth, barHeight, barHeight / 2);
  } else {
    ctx.rect(barX, barY, fillWidth, barHeight);
  }
  ctx.fill();

  // Glowing Handle Head Dot
  const headX = barX + fillWidth;
  ctx.shadowColor = primaryColor;
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(headX, barY + barHeight / 2, barHeight * 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Right-Aligned Timestamp Display
  ctx.shadowBlur = 0;
  ctx.font = `500 ${Math.floor(barHeight * 2.8)}px ${preset.fontFamily || 'Inter, sans-serif'}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.textAlign = 'right';
  ctx.fillText(timeStr, barX + barWidth, barY - 10);

  ctx.restore();
}
