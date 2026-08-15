import * as fs from 'fs-extra';
import * as path from 'path';
import { ThumbnailOptions, ThumbnailResult, ThumbnailThemeOptions } from '../types';

let createCanvas: any;
let loadImage: any;

try {
  const napiCanvas = require('@napi-rs/canvas');
  createCanvas = napiCanvas.createCanvas;
  loadImage = napiCanvas.loadImage;
} catch {
  const nodeCanvas = require('canvas');
  createCanvas = nodeCanvas.createCanvas;
  loadImage = nodeCanvas.loadImage;
}

export async function generateThumbnails(options: ThumbnailOptions): Promise<ThumbnailResult> {
  const generator = new ThumbnailGenerator();
  return generator.generateThumbnails(options);
}

export class ThumbnailGenerator {
  private defaultTheme: Required<ThumbnailThemeOptions> = {
    primaryColor: '#ff6b1a',      // Warm Fire Orange
    accentColor: '#1ad2ff',       // Moonlight Cyan / Gold Accent
    backgroundColor: '#0a0814',   // Dark Amapiano Night
    textColor: '#ffffff',
    badgeBgColor: '#ffb800',      // Gold Badge
    glowColor: 'rgba(255, 107, 26, 0.4)'
  };

  /**
   * Generates both 16:9 (1280x720) and 9:16 (1080x1920) high-resolution thumbnail cards.
   */
  public async generateThumbnails(options: ThumbnailOptions): Promise<ThumbnailResult> {
    const outputDir = options.outputDir || '.';
    await fs.ensureDir(outputDir);

    let userThemeObj: ThumbnailThemeOptions = {};
    if (typeof options.theme === 'object' && options.theme !== null) {
      userThemeObj = options.theme as ThumbnailThemeOptions;
    } else if (options.theme === 'dark') {
      userThemeObj = { backgroundColor: '#05040a', primaryColor: '#e11d48' };
    } else if (options.theme === 'vibrant') {
      userThemeObj = { primaryColor: '#ff007f', accentColor: '#00f0ff' };
    }

    const theme: Required<ThumbnailThemeOptions> = {
      ...this.defaultTheme,
      ...userThemeObj
    };

    const trackNumPadded = options.trackNumber ? String(options.trackNumber).padStart(2, '0') : '01';
    const safeTitle = options.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const prefix = options.filenamePrefix || `${trackNumPadded}_${safeTitle}`;

    // Load artwork if provided
    let loadedImage: any = null;
    if (options.artworkBuffer) {
      try {
        loadedImage = await loadImage(options.artworkBuffer);
      } catch (err) {
        // Fallback to procedural
      }
    } else if (options.artworkPath && fs.existsSync(options.artworkPath)) {
      try {
        loadedImage = await loadImage(options.artworkPath);
      } catch (err) {
        // Fallback to procedural
      }
    }

    const width16x9 = options.width || 1280;
    const height16x9 = options.height || 720;

    // 1. Generate 16:9 (1280x720)
    const canvas16x9 = createCanvas(width16x9, height16x9);
    const ctx16x9 = canvas16x9.getContext('2d');
    this.renderThumbnail16x9(ctx16x9, width16x9, height16x9, options, theme, loadedImage);
    const buffer16x9 = canvas16x9.toBuffer('image/png');
    const path16x9 = path.join(outputDir, `${prefix}_thumbnail_16x9.png`);
    await fs.writeFile(path16x9, buffer16x9);

    // 2. Generate 9:16 (1080x1920)
    const canvas9x16 = createCanvas(1080, 1920);
    const ctx9x16 = canvas9x16.getContext('2d');
    this.renderThumbnail9x16(ctx9x16, 1080, 1920, options, theme, loadedImage);
    const buffer9x16 = canvas9x16.toBuffer('image/png');
    const path9x16 = path.join(outputDir, `${prefix}_thumbnail_9x16.png`);
    await fs.writeFile(path9x16, buffer9x16);

    return {
      path16x9,
      path9x16,
      buffer16x9,
      buffer9x16,
      outputPath: path16x9,
      width: width16x9,
      height: height16x9
    };
  }

  /**
   * Renders 16:9 Thumbnail Layout (1280x720)
   */
  private renderThumbnail16x9(
    ctx: any,
    w: number,
    h: number,
    options: ThumbnailOptions,
    theme: Required<ThumbnailThemeOptions>,
    artworkImg: any
  ) {
    // 1. Background Fill & Gradients
    ctx.fillStyle = theme.backgroundColor;
    ctx.fillRect(0, 0, w, h);

    if (artworkImg) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.drawImage(artworkImg, -100, -100, w + 200, h + 200);
      ctx.restore();
    }

    // Moonlight Radial Glow (Top Right)
    const moonGrad = ctx.createRadialGradient(w * 0.85, h * 0.2, 10, w * 0.85, h * 0.2, 400);
    moonGrad.addColorStop(0, 'rgba(26, 210, 255, 0.45)');
    moonGrad.addColorStop(0.5, 'rgba(255, 107, 26, 0.2)');
    moonGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = moonGrad;
    ctx.fillRect(0, 0, w, h);

    // Fire Ambient Bottom Glow
    const fireGrad = ctx.createLinearGradient(0, h, 0, h * 0.4);
    fireGrad.addColorStop(0, 'rgba(255, 107, 26, 0.35)');
    fireGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = fireGrad;
    ctx.fillRect(0, 0, w, h);

    // Tribal Geometric Pattern Accents (Borders)
    this.drawTribalBorder(ctx, w, h, theme.badgeBgColor);

    // 2. Artwork Card Frame (Left Side)
    const cardSize = 460;
    const cardX = 70;
    const cardY = (h - cardSize) / 2;

    // Card Glow / Shadow
    ctx.save();
    ctx.shadowColor = theme.primaryColor;
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#120d24';
    this.drawRoundedRect(ctx, cardX, cardY, cardSize, cardSize, 24);
    ctx.fill();
    ctx.restore();

    if (artworkImg) {
      ctx.save();
      this.drawRoundedRect(ctx, cardX, cardY, cardSize, cardSize, 24);
      ctx.clip();
      ctx.drawImage(artworkImg, cardX, cardY, cardSize, cardSize);
      ctx.restore();
    } else {
      // Procedural Inner Art
      this.drawProceduralArtwork(ctx, cardX, cardY, cardSize, cardSize, options);
    }

    // Card Gold Border
    ctx.strokeStyle = theme.badgeBgColor;
    ctx.lineWidth = 4;
    this.drawRoundedRect(ctx, cardX, cardY, cardSize, cardSize, 24);
    ctx.stroke();

    // 3. Right Content Column (Typography & Badges)
    const contentX = cardX + cardSize + 60;
    let currY = 160;

    // Badges Row (Genre & BPM)
    ctx.save();
    const genreText = (options.genre || 'TRAP PIANO').toUpperCase();
    const bpmText = `${options.bpm || 112} BPM`;
    const energyText = (options.energy || 'HIGH').toUpperCase();

    // Genre Badge Pill
    ctx.fillStyle = theme.primaryColor;
    this.drawRoundedRect(ctx, contentX, currY, 190, 42, 12);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(genreText, contentX + 18, currY + 27);

    // BPM Badge Pill
    const bpmX = contentX + 205;
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(26, 210, 255, 0.15)';
    this.drawRoundedRect(ctx, bpmX, currY, 110, 42, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = theme.accentColor;
    ctx.fillText(bpmText, bpmX + 16, currY + 27);

    // Energy Badge Pill
    const energyX = bpmX + 125;
    ctx.fillStyle = theme.badgeBgColor;
    this.drawRoundedRect(ctx, energyX, currY, 130, 42, 12);
    ctx.fill();
    ctx.fillStyle = '#0a0814';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(energyText, energyX + 14, currY + 27);
    ctx.restore();

    currY += 95;

    // Track Title
    ctx.save();
    ctx.font = 'bold 54px sans-serif';
    const titleGrad = ctx.createLinearGradient(contentX, currY, contentX + 400, currY);
    titleGrad.addColorStop(0, '#ffffff');
    titleGrad.addColorStop(1, '#ffea79');
    ctx.fillStyle = titleGrad;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 12;

    // Wrap long titles
    const titleLines = this.wrapText(ctx, options.title, 560);
    for (const line of titleLines.slice(0, 2)) {
      ctx.fillText(line, contentX, currY);
      currY += 60;
    }
    ctx.restore();

    currY += 10;

    // Artist Name
    ctx.save();
    ctx.font = '28px sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`PROD. BY ${options.artist.toUpperCase()}`, contentX, currY);
    ctx.restore();

    currY += 45;

    // Subgenre / Album info
    ctx.save();
    ctx.font = '20px sans-serif';
    ctx.fillStyle = theme.accentColor;
    const subText = options.subgenre || 'AMAPIANO LOG DRUM x TRAP FUSION';
    ctx.fillText(`❖ ${subText}`, contentX, currY);
    ctx.restore();

    // Bottom Decorative Wave Preview
    this.drawWaveformPreview(ctx, contentX, currY + 30, 560, 50, theme.primaryColor);
  }

  /**
   * Renders 9:16 Thumbnail Layout (1080x1920) for Shorts / TikTok / Reels
   */
  private renderThumbnail9x16(
    ctx: any,
    w: number,
    h: number,
    options: ThumbnailOptions,
    theme: Required<ThumbnailThemeOptions>,
    artworkImg: any
  ) {
    // Fill Background
    ctx.fillStyle = theme.backgroundColor;
    ctx.fillRect(0, 0, w, h);

    if (artworkImg) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.drawImage(artworkImg, -200, -200, w + 400, h + 400);
      ctx.restore();
    }

    // Top Moonlight & Bottom Fire Glow
    const moonGrad = ctx.createRadialGradient(w / 2, 200, 20, w / 2, 200, 600);
    moonGrad.addColorStop(0, 'rgba(26, 210, 255, 0.5)');
    moonGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = moonGrad;
    ctx.fillRect(0, 0, w, h);

    const fireGrad = ctx.createLinearGradient(0, h, 0, h - 700);
    fireGrad.addColorStop(0, 'rgba(255, 107, 26, 0.45)');
    fireGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = fireGrad;
    ctx.fillRect(0, 0, w, h);

    // Tribal Border
    this.drawTribalBorder(ctx, w, h, theme.badgeBgColor);

    // Centered Framed Artwork
    const cardSize = 780;
    const cardX = (w - cardSize) / 2;
    const cardY = 380;

    ctx.save();
    ctx.shadowColor = theme.primaryColor;
    ctx.shadowBlur = 40;
    ctx.fillStyle = '#120d24';
    this.drawRoundedRect(ctx, cardX, cardY, cardSize, cardSize, 36);
    ctx.fill();
    ctx.restore();

    if (artworkImg) {
      ctx.save();
      this.drawRoundedRect(ctx, cardX, cardY, cardSize, cardSize, 36);
      ctx.clip();
      ctx.drawImage(artworkImg, cardX, cardY, cardSize, cardSize);
      ctx.restore();
    } else {
      this.drawProceduralArtwork(ctx, cardX, cardY, cardSize, cardSize, options);
    }

    ctx.strokeStyle = theme.badgeBgColor;
    ctx.lineWidth = 6;
    this.drawRoundedRect(ctx, cardX, cardY, cardSize, cardSize, 36);
    ctx.stroke();

    // Top Header Badge
    let currY = 220;
    ctx.save();
    ctx.fillStyle = theme.primaryColor;
    this.drawRoundedRect(ctx, (w - 380) / 2, currY, 380, 64, 20);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TRAP PIANO FUSION', w / 2, currY + 42);
    ctx.restore();

    // Below Artwork Text Block
    currY = cardY + cardSize + 100;

    // Badges Row (BPM + Energy)
    ctx.save();
    ctx.textAlign = 'center';

    const bpmStr = `🎹 ${options.bpm || 112} BPM`;
    const energyStr = `⚡ ${(options.energy || 'HIGH').toUpperCase()}`;

    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = theme.accentColor;
    ctx.fillText(`${bpmStr}  •  ${energyStr}`, w / 2, currY);
    ctx.restore();

    currY += 90;

    // Track Title
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 68px sans-serif';
    const titleGrad = ctx.createLinearGradient(0, currY, 0, currY + 120);
    titleGrad.addColorStop(0, '#ffffff');
    titleGrad.addColorStop(1, '#ffea79');
    ctx.fillStyle = titleGrad;

    const titleLines = this.wrapText(ctx, options.title, 900);
    for (const line of titleLines.slice(0, 2)) {
      ctx.fillText(line, w / 2, currY);
      currY += 80;
    }
    ctx.restore();

    currY += 20;

    // Artist Name
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '36px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`PROD. BY ${options.artist.toUpperCase()}`, w / 2, currY);
    ctx.restore();

    // Bottom Wave Visualizer preview
    this.drawWaveformPreview(ctx, (w - 780) / 2, h - 220, 780, 80, theme.accentColor);
  }

  // --- DRAWING HELPERS ---

  private drawRoundedRect(
    ctx: any,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private drawTribalBorder(ctx: any, w: number, h: number, color: string) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.4;

    // Top Left Corner Chevron
    ctx.beginPath();
    ctx.moveTo(30, 60);
    ctx.lineTo(60, 30);
    ctx.lineTo(90, 60);
    ctx.stroke();

    // Top Right Corner Chevron
    ctx.beginPath();
    ctx.moveTo(w - 90, 60);
    ctx.lineTo(w - 60, 30);
    ctx.lineTo(w - 30, 60);
    ctx.stroke();

    // Bottom Left Corner Chevron
    ctx.beginPath();
    ctx.moveTo(30, h - 60);
    ctx.lineTo(60, h - 30);
    ctx.lineTo(90, h - 60);
    ctx.stroke();

    // Bottom Right Corner Chevron
    ctx.beginPath();
    ctx.moveTo(w - 90, h - 60);
    ctx.lineTo(w - 60, h - 30);
    ctx.lineTo(w - 30, h - 60);
    ctx.stroke();

    ctx.restore();
  }

  private drawProceduralArtwork(
    ctx: any,
    x: number,
    y: number,
    w: number,
    h: number,
    options: ThumbnailOptions
  ) {
    ctx.save();
    this.drawRoundedRect(ctx, x, y, w, h, 24);
    ctx.clip();

    // Dark Gradient Background
    const bgGrad = ctx.createRadialGradient(x + w / 2, y + h / 2, 20, x + w / 2, y + h / 2, w * 0.7);
    bgGrad.addColorStop(0, '#ff6b1a');
    bgGrad.addColorStop(0.5, '#1ad2ff');
    bgGrad.addColorStop(1, '#0a0814');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(x, y, w, h);

    // Tribal Concentric Ring Motifs
    ctx.strokeStyle = 'rgba(255, 234, 121, 0.5)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, w * 0.3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(26, 210, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, w * 0.38, 0, Math.PI * 2);
    ctx.stroke();

    // Piano Keyboard Stylized Vectors
    const keys = 8;
    const keyW = w / keys;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let i = 0; i < keys; i++) {
      ctx.fillRect(x + i * keyW + 2, y + h - 90, keyW - 4, 90);
    }
    ctx.fillStyle = '#0a0814';
    for (let i = 0; i < keys - 1; i++) {
      if (i % 7 !== 2 && i % 7 !== 6) {
        ctx.fillRect(x + (i + 1) * keyW - keyW * 0.3, y + h - 90, keyW * 0.6, 55);
      }
    }

    ctx.restore();
  }

  private drawWaveformPreview(
    ctx: any,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string
  ) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7;

    const bars = 32;
    const barW = (w / bars) * 0.6;
    const gap = (w / bars) * 0.4;

    for (let i = 0; i < bars; i++) {
      const bh = Math.sin(i * 0.35) * (h * 0.4) + h * 0.5;
      const bx = x + i * (barW + gap);
      const by = y + (h - bh) / 2;
      ctx.fillRect(bx, by, barW, bh);
    }

    ctx.restore();
  }

  private wrapText(ctx: any, text: string, maxWidth: number): string[] {
    const words = (text || '').split(' ');
    if (words.length === 0 || words[0] === '') return [''];
    const lines: string[] = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + ' ' + word).width;
      if (width < maxWidth) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  }
}
