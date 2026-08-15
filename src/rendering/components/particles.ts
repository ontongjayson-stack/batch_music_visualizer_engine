/**
 * Particle System Renderer Component
 * Batch Music Visualizer Engine
 */

import { SKRSContext2D } from '@napi-rs/canvas';
import { VisualPreset, Dimensions, AudioAnimationFrame } from '../types.js';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseSize: number;
  alpha: number;
  maxAlpha: number;
  color: string;
  life: number;
  maxLife: number;
  wobbleSpeed: number;
  wobbleAmplitude: number;
  wobblePhase: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  public init(preset: VisualPreset): void {
    this.particles = [];
    for (let i = 0; i < preset.particleCount; i++) {
      this.particles.push(this.createParticle(preset, true));
    }
  }

  private createParticle(preset: VisualPreset, randomStartLife = false): Particle {
    const color =
      preset.colors.particleColors[
        Math.floor(Math.random() * preset.colors.particleColors.length)
      ] || preset.colors.primary;

    const maxLife = 100 + Math.random() * 200;
    const life = randomStartLife ? Math.random() * maxLife : 0;

    let vx = (Math.random() - 0.5) * 0.8;
    let vy = -0.3 - Math.random() * 1.2;
    let baseSize = 2 + Math.random() * 4;
    let maxAlpha = 0.4 + Math.random() * 0.5;

    switch (preset.particleType) {
      case 'sparks':
        vx = (Math.random() - 0.5) * 2.5;
        vy = -1.5 - Math.random() * 3.5;
        baseSize = 1.5 + Math.random() * 3.5;
        maxAlpha = 0.7 + Math.random() * 0.3;
        break;

      case 'fireflies':
        vx = (Math.random() - 0.5) * 0.5;
        vy = (Math.random() - 0.5) * 0.5;
        baseSize = 3.5 + Math.random() * 5.5;
        maxAlpha = 0.5 + Math.random() * 0.4;
        break;

      case 'smoke':
        vx = (Math.random() - 0.5) * 0.4;
        vy = -0.2 - Math.random() * 0.6;
        baseSize = 12 + Math.random() * 25;
        maxAlpha = 0.15 + Math.random() * 0.2;
        break;

      case 'glow':
        vx = (Math.random() - 0.5) * 0.3;
        vy = (Math.random() - 0.5) * 0.3;
        baseSize = 20 + Math.random() * 45;
        maxAlpha = 0.1 + Math.random() * 0.25;
        break;

      case 'dust':
      default:
        vx = (Math.random() - 0.5) * 0.4;
        vy = -0.1 - Math.random() * 0.5;
        baseSize = 1.5 + Math.random() * 3;
        maxAlpha = 0.3 + Math.random() * 0.4;
        break;
    }

    const speedMult = preset.particleSpeedMultiplier || 1.0;

    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: vx * speedMult,
      vy: vy * speedMult,
      size: baseSize,
      baseSize,
      alpha: 0,
      maxAlpha,
      color,
      life,
      maxLife,
      wobbleSpeed: 0.02 + Math.random() * 0.05,
      wobbleAmplitude: 0.5 + Math.random() * 1.5,
      wobblePhase: Math.random() * Math.PI * 2,
    };
  }

  public updateAndDraw(
    ctx: SKRSContext2D,
    preset: VisualPreset,
    audioData: AudioAnimationFrame
  ): void {
    if (this.particles.length === 0) {
      this.init(preset);
    }

    const bassBoost = (audioData.bass || 0) * preset.bassReactivity;

    ctx.save();

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // Update position
      p.life++;
      p.wobblePhase += p.wobbleSpeed;

      const currentVx = p.vx + Math.sin(p.wobblePhase) * p.wobbleAmplitude * 0.2;
      const currentVy = p.vy * (1 + bassBoost * 0.5);

      p.x += currentVx;
      p.y += currentVy;

      // Opacity envelope (fadeIn, sustain, fadeOut)
      const lifeRatio = p.life / p.maxLife;
      if (lifeRatio < 0.2) {
        p.alpha = (lifeRatio / 0.2) * p.maxAlpha;
      } else if (lifeRatio > 0.8) {
        p.alpha = ((1 - lifeRatio) / 0.2) * p.maxAlpha;
      } else {
        p.alpha = p.maxAlpha;
      }

      // Audio reactive size boost
      p.size = p.baseSize * (1 + bassBoost * 0.4);

      // Reset particle if out of bounds or dead
      if (
        p.life >= p.maxLife ||
        p.x < -50 ||
        p.x > this.width + 50 ||
        p.y < -50 ||
        p.y > this.height + 50
      ) {
        this.particles[i] = this.createParticle(preset, false);
        // Respawn at bottom for upward floating particles, or anywhere for fireflies/glow
        if (preset.particleType === 'sparks' || preset.particleType === 'dust' || preset.particleType === 'smoke') {
          this.particles[i].y = this.height + 10;
          this.particles[i].x = Math.random() * this.width;
        }
        continue;
      }

      // Render particle based on style
      ctx.globalAlpha = Math.min(1, Math.max(0, p.alpha * (1 + bassBoost * 0.3)));

      if (preset.particleType === 'glow' || preset.particleType === 'smoke') {
        const radGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        radGrad.addColorStop(0, p.color);
        radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (preset.particleType === 'sparks') {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = preset.glowIntensity * 0.5;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Spark trail
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * 0.6;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
        ctx.stroke();
      } else {
        // Dust / Fireflies
        ctx.fillStyle = p.color;
        if (preset.glowIntensity > 0) {
          ctx.shadowColor = p.color;
          ctx.shadowBlur = preset.glowIntensity * 0.4;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}
