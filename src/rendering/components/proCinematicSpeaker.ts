/**
 * Pro Audio-Reactive Dual Subwoofer System Composition
 * Batch Music Visualizer Engine
 */

import { SKRSContext2D, Image, createCanvas } from '@napi-rs/canvas';
import { Dimensions, VisualPreset, AudioAnimationFrame, SafeAreaInsets } from '../types.js';
import { SubwooferPhysics, SubwooferPhysicsState } from '../subwooferPhysics.js';
import { drawProgressBar } from './progress.js';
import { drawTextLayout } from './textLayout.js';

// Offscreen cached blur canvas
let cachedBlurCanvas: any = null;
let cachedBlurSrc: string = '';

// Subwoofer physical instances
const leftWooferPhysics = new SubwooferPhysics();
const rightWooferPhysics = new SubwooferPhysics();

export interface ProCinematicSpeakerParams {
  ctx: SKRSContext2D;
  dimensions: Dimensions;
  preset: VisualPreset;
  frameIndex: number;
  totalFrames: number;
  audioData: AudioAnimationFrame;
  coverImage?: Image | null;
  trackTitle?: string;
  artistName?: string;
  albumName?: string;
  safeArea: SafeAreaInsets;
  showCenterArt?: boolean;
}

export function drawProCinematicSpeakerComposition(params: ProCinematicSpeakerParams): void {
  const {
    ctx,
    dimensions,
    preset,
    frameIndex,
    totalFrames,
    audioData,
    coverImage,
    trackTitle,
    artistName,
    albumName,
    safeArea,
    showCenterArt = true,
  } = params;

  const { width, height } = dimensions;
  const isPortrait = height > width;
  const fps = 30; // standard frame rate

  // Audio signals
  const volume = audioData.volume || 0;
  const bass = audioData.bass || 0;
  const subBass = audioData.subBass !== undefined ? audioData.subBass : bass * 0.9;
  const kickTransient = audioData.kickTransient !== undefined ? audioData.kickTransient : (audioData.isBeat ? 0.85 : 0.1);
  const spectrum = audioData.spectrum || new Array(64).fill(0);

  // Update physical subwoofer cone excursion
  const dt = 1 / fps;
  const leftState = leftWooferPhysics.update(dt, subBass, kickTransient, preset.bassReactivity);
  const rightState = rightWooferPhysics.update(dt, subBass, kickTransient, preset.bassReactivity);

  // ============================================================================
  // LAYER 1: ATMOSPHERIC BACKGROUND
  // ============================================================================
  ctx.fillStyle = preset.colors.background || '#04060a';
  ctx.fillRect(0, 0, width, height);

  if (coverImage) {
    // Render blurred offscreen artwork background with Ken Burns drift
    const offWidth = 320;
    const offHeight = Math.round(offWidth * (height / width));

    if (!cachedBlurCanvas || cachedBlurSrc !== (coverImage as any).src) {
      cachedBlurCanvas = createCanvas(offWidth, offHeight);
      const offCtx = cachedBlurCanvas.getContext('2d');

      const imgAspect = coverImage.width / coverImage.height;
      const targetAspect = offWidth / offHeight;
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
      cachedBlurSrc = (coverImage as any).src || '';
    }

    const kb = preset.kenBurns || { enabled: true, zoomStart: 1.0, zoomEnd: 1.06, speed: 0.6 };
    const progress = totalFrames > 1 ? frameIndex / (totalFrames - 1) : 0;
    const kbZoom = kb.enabled ? kb.zoomStart + (kb.zoomEnd - kb.zoomStart) * Math.sin(progress * Math.PI * kb.speed) : 1.0;
    const kbPanX = kb.enabled ? Math.sin(progress * Math.PI * 0.5) * (kb.panX || 0.02) * width : 0;
    const kbPanY = kb.enabled ? Math.cos(progress * Math.PI * 0.5) * (kb.panY || -0.02) * height : 0;

    const scaledW = width * kbZoom;
    const scaledH = height * kbZoom;
    const destX = (width - scaledW) / 2 + kbPanX;
    const destY = (height - scaledH) / 2 + kbPanY;

    ctx.save();
    ctx.globalAlpha = 0.35 + subBass * 0.1;
    ctx.drawImage(cachedBlurCanvas, destX, destY, scaledW, scaledH);
    ctx.restore();
  }

  // Darkening overlay & Vignette
  ctx.fillStyle = `rgba(4, 6, 10, ${preset.overlayOpacity || 0.55})`;
  ctx.fillRect(0, 0, width, height);

  drawVignette(ctx, width, height, preset.vignetteStrength || 0.75);

  // ============================================================================
  // LAYER 2: AMBIENT LIGHTING & ACOUSTIC DEPTH
  // ============================================================================
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  // Left ambient corner light flare
  const leftGlow = ctx.createRadialGradient(width * 0.2, height * 0.3, 10, width * 0.2, height * 0.3, width * 0.45);
  leftGlow.addColorStop(0, `${preset.colors.primary}${Math.floor((0.25 + subBass * 0.15) * 255).toString(16).padStart(2, '0')}`);
  leftGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = leftGlow;
  ctx.fillRect(0, 0, width, height);

  // Right ambient corner light flare
  const rightGlow = ctx.createRadialGradient(width * 0.8, height * 0.7, 10, width * 0.8, height * 0.7, width * 0.45);
  rightGlow.addColorStop(0, `${preset.colors.secondary}${Math.floor((0.2 + kickTransient * 0.15) * 255).toString(16).padStart(2, '0')}`);
  rightGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = rightGlow;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();

  // ============================================================================
  // LAYOUT GEOMETRY COMPUTATION
  // ============================================================================
  let artCenterX: number;
  let artCenterY: number;
  let artSize: number;
  let woofer1X: number;
  let woofer1Y: number;
  let woofer2X: number;
  let woofer2Y: number;
  let wooferRadius: number;

  if (isPortrait) {
    // 9:16 Vertical Stack: Top Subwoofer -> Center Art -> Bottom Subwoofer
    artSize = Math.min(width * 0.58, height * 0.32);
    artCenterX = width * 0.5;
    artCenterY = height * 0.46;

    wooferRadius = Math.min(width * 0.22, height * 0.12);
    woofer1X = width * 0.5;
    woofer1Y = height * 0.22;
    woofer2X = width * 0.5;
    woofer2Y = height * 0.70;
  } else {
    // 16:9 Horizontal Trio: Left Subwoofer -> Center Art -> Right Subwoofer
    artSize = Math.min(width * 0.32, height * 0.54);
    artCenterX = width * 0.5;
    artCenterY = height * 0.44;

    wooferRadius = Math.min(width * 0.14, height * 0.25);
    woofer1X = width * 0.21;
    woofer1Y = height * 0.44;
    woofer2X = width * 0.79;
    woofer2Y = height * 0.44;
  }

  // ============================================================================
  // LAYER 3: AUDIO-REACTIVE SURROUNDING AURA FIELD
  // ============================================================================
  drawAuraField(ctx, artCenterX, artCenterY, artSize * 0.62, spectrum, subBass, preset.colors);

  // ============================================================================
  // LAYER 4: DUAL SUBWOOFER SYSTEM
  // ============================================================================
  drawSubwooferSpeaker(ctx, woofer1X, woofer1Y, wooferRadius, leftState, preset.colors);
  drawSubwooferSpeaker(ctx, woofer2X, woofer2Y, wooferRadius, rightState, preset.colors);

  // ============================================================================
  // LAYER 5: HERO ALBUM ARTWORK / ACOUSTIC EMBLEM
  // ============================================================================
  drawHeroCenterArtwork({
    ctx,
    centerX: artCenterX,
    centerY: artCenterY,
    size: artSize,
    coverImage,
    subBass,
    kickTransient,
    showCenterArt,
    preset,
  });

  // ============================================================================
  // LAYER 6: PROTECTED UI TEXT OVERLAYS & PROGRESS BAR
  // ============================================================================
  drawTextLayout({
    ctx,
    dimensions,
    aspectRatio: isPortrait ? 'PORTRAIT' : 'LANDSCAPE',
    preset,
    safeArea,
    trackTitle: trackTitle || 'Untitled Track',
    artistName: artistName || 'Unknown Artist',
    albumName: albumName || 'Single Release',
  });

  const totalTimeSec = (totalFrames / fps);

  drawProgressBar({
    ctx,
    dimensions,
    preset,
    audioData,
    durationSeconds: totalTimeSec,
    safeArea,
  });
}

function drawVignette(ctx: SKRSContext2D, width: number, height: number, strength: number): void {
  const radius = Math.max(width, height) * 0.75;
  const grad = ctx.createRadialGradient(width / 2, height / 2, radius * 0.4, width / 2, height / 2, radius);
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Renders an Audio-Reactive Surrounding Aura Field / Radial Spectrum Ring around Artwork
 */
function drawAuraField(
  ctx: SKRSContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  spectrum: number[],
  subBass: number,
  colors: any
): void {
  ctx.save();

  // Sub-bass aura halo
  const haloRadius = radius * (1.1 + subBass * 0.12);
  const haloGlow = ctx.createRadialGradient(centerX, centerY, radius * 0.8, centerX, centerY, haloRadius);
  haloGlow.addColorStop(0, `${colors.primary}40`);
  haloGlow.addColorStop(0.7, `${colors.secondary}20`);
  haloGlow.addColorStop(1, 'transparent');

  ctx.fillStyle = haloGlow;
  ctx.beginPath();
  ctx.arc(centerX, centerY, haloRadius, 0, Math.PI * 2);
  ctx.fill();

  // Orbiting Radial Spectrum Field
  const barCount = 48;
  const angleStep = (Math.PI * 2) / barCount;
  ctx.lineWidth = 3;
  ctx.strokeStyle = colors.primary;

  for (let i = 0; i < barCount; i++) {
    const angle = i * angleStep;
    const specIdx = Math.floor((i / barCount) * spectrum.length);
    const amp = spectrum[specIdx] || 0;

    const innerR = radius * 1.04;
    const outerR = radius * (1.04 + amp * 0.28 + subBass * 0.08);

    const x1 = centerX + Math.cos(angle) * innerR;
    const y1 = centerY + Math.sin(angle) * innerR;
    const x2 = centerX + Math.cos(angle) * outerR;
    const y2 = centerY + Math.sin(angle) * outerR;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Procedurally Renders a High-End Subwoofer Speaker with Physical Cone Excursion
 */
function drawSubwooferSpeaker(
  ctx: SKRSContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  physics: SubwooferPhysicsState,
  colors: any
): void {
  const { displacement, surroundStretch, specularShiftX, specularShiftY } = physics;

  ctx.save();
  ctx.translate(centerX, centerY);

  // 1. Acoustic Cabinet Floor Glow & Shadow
  const cabinetShadow = ctx.createRadialGradient(0, 0, radius * 0.9, 0, 0, radius * 1.25);
  cabinetShadow.addColorStop(0, 'rgba(0,0,0,0.8)');
  cabinetShadow.addColorStop(1, 'transparent');
  ctx.fillStyle = cabinetShadow;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.25, 0, Math.PI * 2);
  ctx.fill();

  // 2. Outer Metallic Mounting Flange & Frame Rim
  const flangeGrad = ctx.createLinearGradient(-radius, -radius, radius, radius);
  flangeGrad.addColorStop(0, '#334155');
  flangeGrad.addColorStop(0.5, '#0f172a');
  flangeGrad.addColorStop(1, '#1e293b');
  ctx.fillStyle = flangeGrad;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#475569';
  ctx.stroke();

  // Hex Mounting Screws (6 Screws)
  ctx.fillStyle = '#64748b';
  const screwRadius = radius * 0.93;
  for (let s = 0; s < 6; s++) {
    const sAngle = (s * Math.PI) / 3;
    const sx = Math.cos(sAngle) * screwRadius;
    const sy = Math.sin(sAngle) * screwRadius;
    ctx.beginPath();
    ctx.arc(sx, sy, radius * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Flexible Rubber Surround (Torus roll stretching with excursion)
  const surroundRadius = radius * 0.86;
  const surroundGrad = ctx.createRadialGradient(0, 0, surroundRadius * 0.7, 0, 0, surroundRadius);
  surroundGrad.addColorStop(0, '#090d16');
  surroundGrad.addColorStop(0.6, '#1e293b');
  surroundGrad.addColorStop(1, '#020617');

  ctx.fillStyle = surroundGrad;
  ctx.beginPath();
  ctx.arc(0, 0, surroundRadius * surroundStretch, 0, Math.PI * 2);
  ctx.fill();

  // 4. Polypropylene Cone (Perspective shadow shift on physical excursion)
  const coneRadius = radius * 0.72;
  const coneExcursionRadius = coneRadius * (1.0 + displacement * 0.06);

  const coneGrad = ctx.createRadialGradient(specularShiftX, specularShiftY, coneRadius * 0.1, 0, 0, coneExcursionRadius);
  coneGrad.addColorStop(0, '#1e293b');
  coneGrad.addColorStop(0.7, '#0f172a');
  coneGrad.addColorStop(1, '#020617');

  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.arc(0, 0, coneExcursionRadius, 0, Math.PI * 2);
  ctx.fill();

  // Accent Ring on Cone
  ctx.lineWidth = 2;
  ctx.strokeStyle = `${colors.primary}${Math.floor((0.3 + displacement * 0.5) * 255).toString(16).padStart(2, '0')}`;
  ctx.beginPath();
  ctx.arc(0, 0, coneExcursionRadius * 0.75, 0, Math.PI * 2);
  ctx.stroke();

  // 5. Center Dust Cap (Dynamic Specular Highlight moving with physics)
  const capRadius = radius * 0.32 * (1.0 + displacement * 0.08);
  const capGrad = ctx.createRadialGradient(
    specularShiftX * 0.6,
    specularShiftY * 0.6,
    capRadius * 0.15,
    0,
    0,
    capRadius
  );
  capGrad.addColorStop(0, `${colors.primary}`);
  capGrad.addColorStop(0.4, '#1e293b');
  capGrad.addColorStop(1, '#090d16');

  ctx.fillStyle = capGrad;
  ctx.beginPath();
  ctx.arc(0, 0, capRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#475569';
  ctx.stroke();

  ctx.restore();
}

/**
 * Renders Hero Center Album Artwork (or Acoustic Emblem when showCenterArt is false)
 */
function drawHeroCenterArtwork(params: {
  ctx: SKRSContext2D;
  centerX: number;
  centerY: number;
  size: number;
  coverImage?: Image | null;
  subBass: number;
  kickTransient: number;
  showCenterArt: boolean;
  preset: VisualPreset;
}): void {
  const { ctx, centerX, centerY, size, coverImage, subBass, kickTransient, showCenterArt, preset } = params;

  ctx.save();
  ctx.translate(centerX, centerY);

  // Controlled organic scale breathing (1.000 to 1.025 on sub-bass / kick punch)
  const scaleBreathing = 1.0 + subBass * 0.018 + kickTransient * 0.012;
  ctx.scale(scaleBreathing, scaleBreathing);

  const halfSize = size / 2;
  const cornerRadius = 14;

  // 1. Multi-Stage Drop Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = 32 + subBass * 16;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 12;

  if (showCenterArt && coverImage) {
    // 2. Render Hero 1:1 Square Album Artwork
    ctx.beginPath();
    ctx.roundRect(-halfSize, -halfSize, size, size, cornerRadius);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    ctx.save();
    ctx.clip();

    const imgAspect = coverImage.width / coverImage.height;
    let drawW = size;
    let drawH = size;
    let drawX = -halfSize;
    let drawY = -halfSize;

    if (imgAspect > 1) {
      drawW = size * imgAspect;
      drawX = -drawW / 2;
    } else {
      drawH = size / imgAspect;
      drawY = -drawH / 2;
    }

    ctx.drawImage(coverImage, drawX, drawY, drawW, drawH);
    ctx.restore();

    // Subtle edge highlight ring
    ctx.lineWidth = 2;
    ctx.strokeStyle = `${preset.colors.primary}60`;
    ctx.beginPath();
    ctx.roundRect(-halfSize, -halfSize, size, size, cornerRadius);
    ctx.stroke();
  } else {
    // Renders Sleek Acoustic Emblem when showCenterArt is false
    ctx.beginPath();
    ctx.roundRect(-halfSize, -halfSize, size, size, cornerRadius);
    ctx.fillStyle = '#0b0f19';
    ctx.fill();

    // Emblem concentric acoustic rings
    ctx.lineWidth = 3;
    ctx.strokeStyle = preset.colors.primary;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = preset.colors.secondary;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = preset.colors.accent;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
