import {
  AIProviderConfig,
  TextGenerationResult,
  ImageGenerationResult,
  TrackMetadata,
  SocialPlatform
} from '../types';

export interface IAIProvider {
  generateText(prompt: string, systemPrompt?: string): Promise<TextGenerationResult>;
  generateCaption(track: TrackMetadata, platform: SocialPlatform): Promise<string>;
  generateHashtags(track: TrackMetadata): Promise<string[]>;
  generateArtwork(prompt: string, width?: number, height?: number): Promise<ImageGenerationResult>;
}

export class FreeAIProvider implements IAIProvider {
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig = {}) {
    this.config = {
      provider: config.provider || 'pollinations',
      apiKey: config.apiKey || '',
      endpointUrl: config.endpointUrl,
      model: config.model,
      timeoutMs: config.timeoutMs || 8000
    };
  }

  /**
   * Generates creative text using Pollinations, HuggingFace, or Local Fallback.
   */
  async generateText(prompt: string, systemPrompt?: string): Promise<TextGenerationResult> {
    const providerName = this.config.provider?.toLowerCase();

    if (providerName === 'pollinations') {
      try {
        const result = await this.fetchPollinationsText(prompt, systemPrompt);
        if (result) {
          return { text: result, source: 'pollinations' };
        }
      } catch (err) {
        // Fall back gracefully
      }
    }

    if (providerName === 'huggingface') {
      try {
        const result = await this.fetchHuggingFaceText(prompt);
        if (result) {
          return { text: result, source: 'huggingface' };
        }
      } catch (err) {
        // Fall back gracefully
      }
    }

    // Local Fallback
    return {
      text: this.generateLocalFallbackText(prompt),
      source: 'local'
    };
  }

  /**
   * Generates social platform captions customized per track & platform.
   */
  async generateCaption(track: TrackMetadata, platform: SocialPlatform): Promise<string> {
    const prompt = `Write an engaging, high-converting social media caption for a ${track.genre} (${track.subgenre}) beat titled "${track.title}" by ${track.artist}. BPM: ${track.bpm}, Mood: ${track.mood}, Energy: ${track.energy}. Platform: ${platform}. Include a strong hook and call-to-action.`;
    const systemPrompt = `You are an elite music marketing director specializing in Amapiano, Trap, and Hip-Hop social media promotion. Keep captions punchy, stylish, and effective.`;

    const res = await this.generateText(prompt, systemPrompt);
    if (res.text && res.text.length > 10) {
      return res.text.trim();
    }

    return this.generateLocalFallbackCaption(track, platform);
  }

  /**
   * Generates targeted hashtags for a track.
   */
  async generateHashtags(track: TrackMetadata): Promise<string[]> {
    const prompt = `Generate 15 trending, high-traffic hashtags for a ${track.genre} / ${track.subgenre} instrumental beat. BPM: ${track.bpm}, Mood: ${track.mood}. Return only space-separated hashtags starting with #.`;

    try {
      const res = await this.generateText(prompt);
      const extracted = res.text.match(/#[a-zA-Z0-9_]+/g);
      if (extracted && extracted.length >= 5) {
        return Array.from(new Set(extracted));
      }
    } catch {
      // Fallback
    }

    return this.generateLocalFallbackHashtags(track);
  }

  /**
   * Generates artwork images via Pollinations or HuggingFace with local procedural fallback.
   */
  async generateArtwork(prompt: string, width: number = 1280, height: number = 720): Promise<ImageGenerationResult> {
    const providerName = this.config.provider?.toLowerCase();

    if (providerName === 'pollinations' || !providerName) {
      try {
        const seed = Math.floor(Math.random() * 1000000);
        const encodedPrompt = encodeURIComponent(`${prompt}, high detail 8k, luxury album cover art, trap piano aesthetic, night fire, ambient moonlight glow`);
        const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;

        const response = await this.fetchWithTimeout(url, { method: 'GET' }, this.config.timeoutMs || 10000);
        if (response && response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          if (buffer.length > 1000) {
            return {
              imageBuffer: buffer,
              mimeType: 'image/jpeg',
              source: 'pollinations'
            };
          }
        }
      } catch (err) {
        // Fall back gracefully
      }
    }

    if (providerName === 'huggingface' && this.config.apiKey) {
      try {
        const modelUrl = this.config.endpointUrl || 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1';
        const response = await this.fetchWithTimeout(
          modelUrl,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inputs: prompt })
          },
          this.config.timeoutMs || 12000
        );

        if (response && response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          return {
            imageBuffer: buffer,
            mimeType: 'image/jpeg',
            source: 'huggingface'
          };
        }
      } catch (err) {
        // Fall back gracefully
      }
    }

    // Local Procedural Artwork Fallback
    const localBuffer = this.generateLocalFallbackArtwork(width, height, prompt);
    return {
      imageBuffer: localBuffer,
      mimeType: 'image/png',
      source: 'local'
    };
  }

  // --- PRIVATE IMPLEMENTATION & LOCAL FALLBACKS ---

  private async fetchPollinationsText(prompt: string, systemPrompt?: string): Promise<string | null> {
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\nUser: ${prompt}` : prompt;
    const encoded = encodeURIComponent(fullPrompt);
    const url = `https://text.pollinations.ai/${encoded}?model=openai`;

    const res = await this.fetchWithTimeout(url, { method: 'GET' }, this.config.timeoutMs);
    if (res && res.ok) {
      const text = await res.text();
      return text.trim();
    }
    return null;
  }

  private async fetchHuggingFaceText(prompt: string): Promise<string | null> {
    if (!this.config.apiKey) return null;
    const url = this.config.endpointUrl || 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2';
    
    const res = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 250 } })
      },
      this.config.timeoutMs
    );

    if (res && res.ok) {
      const data = await res.json() as any;
      if (Array.isArray(data) && data[0]?.generated_text) {
        return data[0].generated_text.trim();
      }
    }
    return null;
  }

  private async fetchWithTimeout(url: string, options: any = {}, timeoutMs: number = 8000): Promise<any> {
    const fetchFn = typeof globalThis.fetch === 'function'
      ? globalThis.fetch
      : require('node-fetch');

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const id = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const response = await fetchFn(url, {
        ...options,
        signal: controller ? controller.signal : undefined
      });
      return response;
    } finally {
      if (id) clearTimeout(id);
    }
  }

  private generateLocalFallbackText(prompt: string): string {
    if (prompt.toLowerCase().includes('caption')) {
      return `🔥 Turn up the bass! Pure Amapiano x Trap fusion vibes. Listen now & feel the energy! #TrapPiano #AmapianoBeats`;
    }
    return `Trap Piano Edition - Heavy Log Drums & Dark Melodic Grand Piano. High Energy Instrumental Track.`;
  }

  public generateLocalFallbackCaption(track: TrackMetadata, platform: SocialPlatform): string {
    const title = track.title;
    const bpm = track.bpm;
    const genre = track.genre || 'Trap Piano';
    const subgenre = track.subgenre || 'Amapiano Trap';

    switch (platform) {
      case 'tiktok':
        return `🔥 That Amapiano log drum hit different when the Trap piano drops! 🎹💥 "${title}" [${bpm} BPM]\n\nWhich vibe is this? Comment below! 👇\n\n#TrapPiano #Amapiano #LogDrum #ProducerTikTok #BeatsForSale #AmapianoBeats`;

      case 'shorts':
        return `🎹 TRAP PIANO FIRE 🔥 "${title}" (${bpm} BPM ${genre})\n\nHit Subscribe for daily heavy Amapiano & Trap fusion beats! #Shorts #TrapPiano #Amapiano #Beats`;

      case 'instagram':
        return `⚡ NEW RELEASE: "${title}" by ${track.artist} ⚡\n\nGenre: ${genre} (${subgenre})\nBPM: ${bpm} | Energy: ${track.energy} | Mood: ${track.mood}\n\nStream now on all platforms or grab the lease link in bio! 🎧🔥\n\nDrop a 🔥 in the comments if you feeling this fusion!`;

      case 'youtube':
      default:
        return `🔥 TRAP PIANO INSTRUMENTAL - "${title}" (${bpm} BPM)\nProduced by ${track.artist}\n\nOfficial ${genre} / ${subgenre} Beat. Blending South African Amapiano log drums, heavy 808 bass, and dark melodic grand piano hooks.\n\n🎧 Stream / Download: Link in description\n🔔 Subscribe to the channel for weekly Amapiano & Trap heat!`;
    }
  }

  public generateLocalFallbackHashtags(track: TrackMetadata): string[] {
    const base = [
      '#TrapPiano',
      '#Amapiano',
      '#LogDrum',
      '#TrapBeats',
      '#AmapianoBeats',
      '#SouthAfricanMusic',
      '#TypeBeat',
      '#ProducerLife',
      '#MusicProducer',
      '#BeatMaker',
      '#PianoTrap',
      '#DarkTrap',
      '#Instrumental'
    ];

    if (track.subgenre) {
      const cleanSub = track.subgenre.replace(/[^a-zA-Z0-9]/g, '');
      if (cleanSub) base.push(`#${cleanSub}`);
    }

    return Array.from(new Set(base));
  }

  private generateLocalFallbackArtwork(width: number, height: number, prompt: string): Buffer {
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="bg" cx="50%" cy="50%" r="75%">
            <stop offset="0%" stop-color="#1ad2ff" stop-opacity="0.3"/>
            <stop offset="40%" stop-color="#ff6b1a" stop-opacity="0.6"/>
            <stop offset="100%" stop-color="#0a0814" stop-opacity="1.0"/>
          </radialGradient>
          <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffea79"/>
            <stop offset="100%" stop-color="#ffb800"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="#0a0814"/>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <circle cx="${width/2}" cy="${height/2}" r="${Math.min(width, height)*0.3}" fill="none" stroke="url(#gold)" stroke-width="6" opacity="0.8"/>
        <text x="50%" y="45%" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="${Math.round(height * 0.08)}">TRAP PIANO</text>
        <text x="50%" y="55%" text-anchor="middle" fill="#ffb800" font-family="sans-serif" font-size="${Math.round(height * 0.04)}">AMAPIANO x TRAP FUSION</text>
      </svg>
    `;
    return Buffer.from(svg, 'utf-8');
  }
}
