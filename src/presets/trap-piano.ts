import { PresetRenderOptions, PresetRenderAudioFrame, TrackMetadata } from '../types';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: string;
  type: 'ember' | 'smoke' | 'spark' | 'ring';
}

export interface VectorKeypoint {
  x: number;
  y: number;
}

export interface DancePose {
  head: VectorKeypoint;
  neck: VectorKeypoint;
  shoulderL: VectorKeypoint;
  shoulderR: VectorKeypoint;
  elbowL: VectorKeypoint;
  elbowR: VectorKeypoint;
  handL: VectorKeypoint;
  handR: VectorKeypoint;
  hipL: VectorKeypoint;
  hipR: VectorKeypoint;
  kneeL: VectorKeypoint;
  kneeR: VectorKeypoint;
  footL: VectorKeypoint;
  footR: VectorKeypoint;
}

export class TrapPianoPreset {
  private particles: Particle[] = [];
  private maxParticles: number = 180;

  // Normalized Base Poses (Centered around 0,0, scaled to torso size ~ 200px)
  private dancePoses: DancePose[] = [
    // Pose 0: Amapiano Hip Sway (Arms Raised)
    {
      head: { x: 0, y: -130 },
      neck: { x: 0, y: -105 },
      shoulderL: { x: -35, y: -95 }, shoulderR: { x: 35, y: -95 },
      elbowL: { x: -65, y: -135 }, elbowR: { x: 65, y: -135 },
      handL: { x: -50, y: -180 }, handR: { x: 50, y: -180 },
      hipL: { x: -28, y: -10 }, hipR: { x: 22, y: -10 },
      kneeL: { x: -38, y: 55 }, kneeR: { x: 25, y: 55 },
      footL: { x: -45, y: 120 }, footR: { x: 30, y: 120 }
    },
    // Pose 1: Log Drum Deep Dip (Arms bent down)
    {
      head: { x: 0, y: -100 },
      neck: { x: 0, y: -80 },
      shoulderL: { x: -40, y: -70 }, shoulderR: { x: 40, y: -70 },
      elbowL: { x: -70, y: -40 }, elbowR: { x: 70, y: -40 },
      handL: { x: -55, y: 0 }, handR: { x: 55, y: 0 },
      hipL: { x: -35, y: 10 }, hipR: { x: 35, y: 10 },
      kneeL: { x: -55, y: 70 }, kneeR: { x: 55, y: 70 },
      footL: { x: -60, y: 130 }, footR: { x: 60, y: 130 }
    },
    // Pose 2: Side Step & Waist Twist
    {
      head: { x: 10, y: -125 },
      neck: { x: 5, y: -100 },
      shoulderL: { x: -30, y: -90 }, shoulderR: { x: 40, y: -90 },
      elbowL: { x: -45, y: -50 }, elbowR: { x: 75, y: -110 },
      handL: { x: -30, y: 0 }, handR: { x: 95, y: -130 },
      hipL: { x: -15, y: -10 }, hipR: { x: 35, y: -10 },
      kneeL: { x: -10, y: 55 }, kneeR: { x: 45, y: 55 },
      footL: { x: -15, y: 120 }, footR: { x: 60, y: 120 }
    },
    // Pose 3: High Energy Bass Kick Drop
    {
      head: { x: -5, y: -140 },
      neck: { x: -5, y: -115 },
      shoulderL: { x: -45, y: -105 }, shoulderR: { x: 35, y: -105 },
      elbowL: { x: -85, y: -150 }, elbowR: { x: 50, y: -60 },
      handL: { x: -100, y: -195 }, handR: { x: 70, y: -20 },
      hipL: { x: -30, y: -15 }, hipR: { x: 25, y: -15 },
      kneeL: { x: -45, y: 45 }, kneeR: { x: 35, y: 55 },
      footL: { x: -55, y: 110 }, footR: { x: 45, y: 125 }
    }
  ];

  /**
   * Main Frame Renderer for Canvas 2D
   */
  public renderFrame(ctx: any, options: PresetRenderOptions): void {
    const { width, height, time, audioData } = options;

    // 1. Render Night Environment & Moonlight
    this.renderEnvironment(ctx, width, height, time, audioData);

    // 2. Render Particle System (Fire embers, smoke bursts on kick)
    this.updateAndRenderParticles(ctx, width, height, audioData);

    // 3. Render African Geometric Tribal Patterns & Pulsing Mandala
    this.renderTribalPatterns(ctx, width, height, time, audioData);

    // 4. Render Rhythmic Female Silhouette Dancer
    this.renderFemaleDancer(ctx, width, height, time, audioData);

    // 5. Render Foreground Audio Visualizer Equalizer Bar Accent
    this.renderEqualizerBars(ctx, width, height, audioData);
  }

  /**
   * 1. Night Fire & Moonlight Environment
   */
  private renderEnvironment(
    ctx: any,
    w: number,
    h: number,
    time: number,
    audio: PresetRenderAudioFrame
  ): void {
    // Base Deep Indigo Fill
    ctx.fillStyle = '#0a0814';
    ctx.fillRect(0, 0, w, h);

    // Top Center Moonlight Sphere & Atmosphere Glow
    const moonX = w / 2;
    const moonY = h * 0.22;
    const moonRadius = 90 + audio.bass * 20;

    const moonGrad = ctx.createRadialGradient(moonX, moonY, 10, moonX, moonY, moonRadius * 4);
    moonGrad.addColorStop(0, `rgba(225, 245, 255, ${0.9 + audio.bass * 0.1})`);
    moonGrad.addColorStop(0.2, `rgba(26, 210, 255, ${0.6 + audio.mid * 0.2})`);
    moonGrad.addColorStop(0.5, 'rgba(255, 107, 26, 0.25)');
    moonGrad.addColorStop(1, 'transparent');

    ctx.fillStyle = moonGrad;
    ctx.fillRect(0, 0, w, h);

    // Moon Core Disk
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#1ad2ff';
    ctx.shadowBlur = 40 + audio.bass * 30;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Bottom Night Fire Warm Glow
    const fireGrad = ctx.createLinearGradient(0, h, 0, h * 0.45);
    const fireAlpha = 0.4 + audio.bass * 0.35;
    fireGrad.addColorStop(0, `rgba(255, 107, 26, ${fireAlpha})`);
    fireGrad.addColorStop(0.4, `rgba(255, 60, 0, ${fireAlpha * 0.6})`);
    fireGrad.addColorStop(1, 'transparent');

    ctx.fillStyle = fireGrad;
    ctx.fillRect(0, 0, w, h);
  }

  /**
   * 2. Particle System (Embers & Smoke Kick Bursts)
   */
  private updateAndRenderParticles(
    ctx: any,
    w: number,
    h: number,
    audio: PresetRenderAudioFrame
  ): void {
    // Spawn ambient embers continuously
    if (Math.random() < 0.6 + audio.mid * 0.4 && this.particles.length < this.maxParticles) {
      this.particles.push({
        x: Math.random() * w,
        y: h + 10,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 2.5 - 1.5 - audio.bass * 2,
        size: Math.random() * 4 + 2,
        alpha: 1.0,
        life: 0,
        maxLife: Math.random() * 80 + 40,
        color: Math.random() > 0.3 ? '#ff6b1a' : '#ffea79',
        type: 'ember'
      });
    }

    // Trigger explosive smoke & dust bursts on bass kick
    if (audio.isKick || audio.bass > 0.72) {
      const burstCount = Math.floor(12 + audio.bass * 16);
      const centerX = w / 2;
      const centerY = h * 0.68;

      // Smoke puff rings
      this.particles.push({
        x: centerX,
        y: centerY,
        vx: 0,
        vy: 0,
        size: 30 + audio.bass * 40,
        alpha: 0.8,
        life: 0,
        maxLife: 35,
        color: 'rgba(255, 107, 26, 0.4)',
        type: 'ring'
      });

      for (let i = 0; i < burstCount; i++) {
        if (this.particles.length >= this.maxParticles) break;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 6 + 3 + audio.bass * 8;
        this.particles.push({
          x: centerX,
          y: centerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5,
          size: Math.random() * 8 + 4,
          alpha: 0.9,
          life: 0,
          maxLife: Math.random() * 45 + 25,
          color: Math.random() > 0.4 ? '#1ad2ff' : '#ffea79',
          type: 'smoke'
        });
      }
    }

    // Render & update particles
    ctx.save();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life++;
      p.x += p.vx;
      p.y += p.vy;
      const progress = p.life / p.maxLife;
      p.alpha = Math.max(0, 1.0 - progress);

      if (p.type === 'ring') {
        p.size += 8;
        ctx.strokeStyle = `rgba(255, 107, 26, ${p.alpha * 0.6})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - progress * 0.3), 0, Math.PI * 2);
        ctx.fill();
      }

      if (p.life >= p.maxLife || p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
    ctx.restore();
  }

  /**
   * 3. African-Inspired Geometric Patterns & Tribal Accents
   */
  private renderTribalPatterns(
    ctx: any,
    w: number,
    h: number,
    time: number,
    audio: PresetRenderAudioFrame
  ): void {
    ctx.save();

    const centerX = w / 2;
    const centerY = h * 0.55;
    const baseRadius = Math.min(w, h) * 0.28 + audio.bass * 35;
    const rotationSpeed = time * 0.4;

    // Outer Rotating Tribal Mandala Ring
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationSpeed);

    ctx.strokeStyle = `rgba(255, 234, 121, ${0.45 + audio.energy * 0.4})`;
    ctx.lineWidth = 3 + audio.bass * 3;
    ctx.shadowColor = '#ffb800';
    ctx.shadowBlur = 15;

    const points = 16;
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const r = i % 2 === 0 ? baseRadius : baseRadius * 0.85;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    // Inner Cyan Counter-Rotating Geometric Ring
    ctx.rotate(-rotationSpeed * 2);
    ctx.strokeStyle = `rgba(26, 210, 255, ${0.4 + audio.mid * 0.4})`;
    ctx.lineWidth = 2;
    const innerPoints = 12;
    ctx.beginPath();
    for (let i = 0; i <= innerPoints; i++) {
      const angle = (i / innerPoints) * Math.PI * 2;
      const r = baseRadius * 0.65 + (i % 2 === 0 ? 15 : -15);
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 4. Rhythmic Stylized Adult Female Silhouette Vector Dance Animation
   */
  private renderFemaleDancer(
    ctx: any,
    w: number,
    h: number,
    time: number,
    audio: PresetRenderAudioFrame
  ): void {
    ctx.save();

    // Dancer Center Pivot (Waist position on screen)
    const dancerX = w / 2;
    const dancerY = h * 0.58;

    // Calculate pose index and interpolation phase based on BPM (beats per second)
    const bps = (audio.bpm || 112) / 60;
    const beatProgress = (time * bps) % 4; // 4-beat bar sequence
    const currentPoseIndex = Math.floor(beatProgress) % this.dancePoses.length;
    const nextPoseIndex = (currentPoseIndex + 1) % this.dancePoses.length;
    const blendFactor = beatProgress - Math.floor(beatProgress);

    // Smooth step curve for realistic body bounce
    const smoothBlend = this.easeInOutQuad(blendFactor);

    // Interpolate keypoints between current pose and next pose
    const poseA = this.dancePoses[currentPoseIndex];
    const poseB = this.dancePoses[nextPoseIndex];
    const interpolatedPose = this.interpolatePoses(poseA, poseB, smoothBlend);

    // Audio-driven dynamic scaling & bounce
    const bounceY = Math.abs(Math.sin(time * bps * Math.PI)) * 18 * (audio.bass + 0.3);
    const dancerScale = 1.6 + audio.bass * 0.25;

    ctx.translate(dancerX, dancerY + bounceY);
    ctx.scale(dancerScale, dancerScale);

    // Render Silhouette Backlight Aura
    ctx.save();
    ctx.shadowColor = audio.isKick ? '#ff6b1a' : '#1ad2ff';
    ctx.shadowBlur = 35 + audio.bass * 25;
    ctx.fillStyle = '#0a0814';
    this.drawFemaleSilhouetteBody(ctx, interpolatedPose);
    ctx.fill();
    ctx.restore();

    // Render Main Silhouette Fill
    ctx.fillStyle = '#0f0a1c';
    this.drawFemaleSilhouetteBody(ctx, interpolatedPose);
    ctx.fill();

    // Render Gold & Cyan Metallic/Tribal Accent Overlay Lines
    ctx.strokeStyle = audio.isKick ? '#ffea79' : '#1ad2ff';
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.8;
    this.drawTribalBodyAccents(ctx, interpolatedPose);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 5. Equalizer Audio Visualizer Accent (Foreground Bottom)
   */
  private renderEqualizerBars(
    ctx: any,
    w: number,
    h: number,
    audio: PresetRenderAudioFrame
  ): void {
    ctx.save();
    const bars = 48;
    const barWidth = (w / bars) * 0.55;
    const gap = (w / bars) * 0.45;
    const startX = (w - (bars * (barWidth + gap))) / 2;
    const maxBarHeight = 90;

    for (let i = 0; i < bars; i++) {
      // Mirrored center visualizer shape
      const normIndex = Math.abs(i - bars / 2) / (bars / 2);
      const freqMultiplier = Math.sin((1 - normIndex) * Math.PI);
      const barHeight = Math.max(8, (audio.bass * 0.6 + audio.energy * 0.4) * maxBarHeight * freqMultiplier * (0.5 + Math.sin(i * 0.4 + audio.bpm) * 0.5));

      const x = startX + i * (barWidth + gap);
      const y = h - 40 - barHeight;

      const grad = ctx.createLinearGradient(0, y + barHeight, 0, y);
      grad.addColorStop(0, '#ff6b1a');
      grad.addColorStop(0.7, '#ffb800');
      grad.addColorStop(1, '#1ad2ff');

      ctx.fillStyle = grad;
      ctx.shadowColor = '#ff6b1a';
      ctx.shadowBlur = 10;

      this.drawRoundedRect(ctx, x, y, barWidth, barHeight, 4);
      ctx.fill();
    }
    ctx.restore();
  }

  // --- SILHOUETTE VECTOR MATH HELPERS ---

  private interpolatePoses(pA: DancePose, pB: DancePose, t: number): DancePose {
    const lerp = (v1: VectorKeypoint, v2: VectorKeypoint): VectorKeypoint => ({
      x: v1.x + (v2.x - v1.x) * t,
      y: v1.y + (v2.y - v1.y) * t
    });

    return {
      head: lerp(pA.head, pB.head),
      neck: lerp(pA.neck, pB.neck),
      shoulderL: lerp(pA.shoulderL, pB.shoulderL),
      shoulderR: lerp(pA.shoulderR, pB.shoulderR),
      elbowL: lerp(pA.elbowL, pB.elbowL),
      elbowR: lerp(pA.elbowR, pB.elbowR),
      handL: lerp(pA.handL, pB.handL),
      handR: lerp(pA.handR, pB.handR),
      hipL: lerp(pA.hipL, pB.hipL),
      hipR: lerp(pA.hipR, pB.hipR),
      kneeL: lerp(pA.kneeL, pB.kneeL),
      kneeR: lerp(pA.kneeR, pB.kneeR),
      footL: lerp(pA.footL, pB.footL),
      footR: lerp(pA.footR, pB.footR)
    };
  }

  private drawFemaleSilhouetteBody(ctx: any, pose: DancePose): void {
    ctx.beginPath();

    // Head (Circle)
    ctx.arc(pose.head.x, pose.head.y, 22, 0, Math.PI * 2);

    // Torso / Hourglass Silhouette Path
    ctx.moveTo(pose.neck.x, pose.neck.y);
    ctx.lineTo(pose.shoulderL.x, pose.shoulderL.y);
    ctx.lineTo(pose.hipL.x - 5, pose.hipL.y);
    ctx.lineTo(pose.hipR.x + 5, pose.hipR.y);
    ctx.lineTo(pose.shoulderR.x, pose.shoulderR.y);
    ctx.closePath();

    // Arms
    this.drawLimb(ctx, pose.shoulderL, pose.elbowL, pose.handL, 12, 8);
    this.drawLimb(ctx, pose.shoulderR, pose.elbowR, pose.handR, 12, 8);

    // Legs
    this.drawLimb(ctx, pose.hipL, pose.kneeL, pose.footL, 18, 10);
    this.drawLimb(ctx, pose.hipR, pose.kneeR, pose.footR, 18, 10);
  }

  private drawLimb(
    ctx: any,
    start: VectorKeypoint,
    mid: VectorKeypoint,
    end: VectorKeypoint,
    w1: number,
    w2: number
  ): void {
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(mid.x, mid.y);
    ctx.lineTo(end.x, end.y);
    ctx.lineWidth = w1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  private drawTribalBodyAccents(ctx: any, pose: DancePose): void {
    ctx.beginPath();
    // Waist/Hip Belt Line Accent
    ctx.moveTo(pose.hipL.x - 8, pose.hipL.y);
    ctx.lineTo(pose.hipR.x + 8, pose.hipR.y);

    // Chest / Shoulder Cross Accent
    ctx.moveTo(pose.shoulderL.x, pose.shoulderL.y);
    ctx.lineTo(pose.hipR.x, pose.hipR.y);
    ctx.moveTo(pose.shoulderR.x, pose.shoulderR.y);
    ctx.lineTo(pose.hipL.x, pose.hipL.y);
  }

  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

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

  /**
   * Export Remotion preset props for video generation pipeline integration
   */
  public getRemotionPresetProps(options?: Partial<PresetRenderOptions>): Record<string, any> {
    return {
      presetId: 'trap-piano',
      presetName: 'Trap Piano Amapiano Fusion',
      colors: {
        background: '#0a0814',
        moonlight: '#1ad2ff',
        firePrimary: '#ff6b1a',
        fireSecondary: '#ff3c00',
        goldAccent: '#ffb800'
      },
      particlesEnabled: true,
      femaleDancerEnabled: true,
      tribalMandalaEnabled: true,
      defaultBpm: options?.audioData?.bpm || 112
    };
  }

  /**
   * Export metadata summary for preset catalog
   */
  public getPresetInfo() {
    return {
      id: 'trap-piano',
      name: 'Trap Piano (Amapiano + Trap Fusion)',
      genre: 'Trap Piano',
      subgenres: ['Amapiano Trap Fusion', 'Log Drum Trap', 'Dark Amapiano', 'Piano Drill'],
      description: 'Night fire environment, moonlight glow, smoke/dust particle bursts on bass kicks, African tribal geometric patterns, and audio-synchronized female vector dancer silhouette.',
      recommendedBpmRange: [100, 135]
    };
  }
}

// Standalone function export for backward/alternative rendering pipelines
const defaultPresetInstance = new TrapPianoPreset();
export function drawTrapPianoVisual(ctx: any, options: PresetRenderOptions): void {
  defaultPresetInstance.renderFrame(ctx, options);
}
