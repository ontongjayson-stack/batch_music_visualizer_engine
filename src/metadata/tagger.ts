import * as fs from 'fs-extra';
import * as path from 'path';
import {
  AudioAnalysis,
  AudioAnalysisData,
  TrackMetadataInput,
  TrackMetadata,
  SocialPlatform,
  SocialPlatformMetadata,
  SocialMetadataBundle
} from '../types';
import { FreeAIProvider, IAIProvider } from '../ai/provider';

export class TrackTagger {
  private aiProvider: IAIProvider;

  constructor(aiProvider?: IAIProvider) {
    this.aiProvider = aiProvider || new FreeAIProvider({ provider: 'local' });
  }

  /**
   * Classifies track metadata based on filename keywords, audio analysis, or provided options.
   */
  public classifyTrack(input: TrackMetadataInput): TrackMetadata {
    const filename = input.filename || '';
    const audio = (input.audioAnalysis || {}) as AudioAnalysisData;

    // 1. Title & Artist extraction from filename if not provided
    const parsedFilename = this.parseFilename(filename);
    const title = input.title || parsedFilename.title || 'Trap Piano Heat';
    const artist = input.artist || parsedFilename.artist || 'Amapiano Trap Director';
    const album = input.album || 'Trap Piano Anthems Vol. 1';
    const trackNumber = input.trackNumber || parsedFilename.trackNumber || 1;

    // 2. BPM classification
    const extractedBpm = parsedFilename.bpm || audio.bpm;
    const bpm = input.bpm || (extractedBpm && extractedBpm > 0 ? Math.round(extractedBpm) : 112);

    // 3. Energy Score (0-100) & Energy Label
    let energyScore = 65; // default medium-high
    if (audio.energy !== undefined) {
      energyScore = Math.round(Math.min(1.0, Math.max(0.0, audio.energy)) * 100);
    } else if (audio.bassEnergy !== undefined) {
      energyScore = Math.round(Math.min(1.0, Math.max(0.0, audio.bassEnergy)) * 100);
    } else if (parsedFilename.keywords.includes('dark') || parsedFilename.keywords.includes('hard')) {
      energyScore = 85;
    }

    let energyLabel = input.energy;
    if (!energyLabel) {
      if (energyScore < 40) energyLabel = 'Low';
      else if (energyScore < 65) energyLabel = 'Medium';
      else if (energyScore < 85) energyLabel = 'High';
      else energyLabel = 'Extreme';
    }

    // 4. Genre & Subgenre classification
    const lowerFilename = filename.toLowerCase();
    let genre = input.genre || 'Trap Piano';
    let subgenre = input.subgenre || 'Amapiano Trap Fusion';

    if (lowerFilename.includes('amapiano') && lowerFilename.includes('log')) {
      subgenre = 'Log Drum Trap';
    } else if (lowerFilename.includes('drill')) {
      subgenre = 'Piano Drill';
    } else if (lowerFilename.includes('soulful')) {
      subgenre = 'Soulful Amapiano Trap';
    } else if (lowerFilename.includes('dark') || lowerFilename.includes('hard')) {
      subgenre = 'Dark Amapiano Trap';
    }

    // 5. Mood Classification
    let mood = input.mood;
    if (!mood) {
      if (energyScore >= 80) {
        mood = 'Heavy & Aggressive';
      } else if (energyScore >= 60) {
        mood = 'Hypnotic & Energetic';
      } else if (lowerFilename.includes('chill') || lowerFilename.includes('soul')) {
        mood = 'Melodic & Relaxed';
      } else {
        mood = 'Dark & Soulful';
      }
    }

    // 6. Visual Style
    const visualStyle = input.visualStyle || 'Trap Piano Amapiano Fusion';

    // 7. Platforms
    const platforms: SocialPlatform[] = input.platform && input.platform.length > 0
      ? input.platform
      : ['youtube', 'tiktok', 'instagram', 'shorts'];

    // 8. Tags generation
    const tags = Array.from(new Set([
      'Trap Piano',
      'Amapiano',
      'Log Drum',
      'Amapiano Trap',
      'Trap Beats',
      'Type Beat',
      'Piano Beats',
      'South African Amapiano',
      'Instrumental Beat',
      title,
      artist,
      ...(input.customTags || [])
    ]));

    return {
      trackNumber,
      title,
      artist,
      album,
      genre,
      subgenre,
      bpm,
      energy: energyLabel,
      energyScore,
      mood,
      visualStyle,
      platforms,
      tags
    };
  }

  /**
   * Generates formatted social metadata bundle for all platforms.
   */
  public async generateSocialBundle(
    track: TrackMetadata,
    customCaptions?: Partial<Record<SocialPlatform, string>>
  ): Promise<SocialMetadataBundle> {
    const platformsMetadata: Partial<Record<SocialPlatform, SocialPlatformMetadata>> = {};

    for (const platform of track.platforms) {
      let caption = customCaptions?.[platform];
      if (!caption) {
        caption = await this.aiProvider.generateCaption(track, platform);
      }

      const hashtags = await this.aiProvider.generateHashtags(track);
      const formattedHashtags = hashtags.join(' ');

      let title = track.title;
      let description = '';

      if (platform === 'youtube') {
        title = `[TRAP PIANO] ${track.artist} - ${track.title} (${track.subgenre} Beat ${track.bpm} BPM)`;
        description = this.buildYouTubeDescription(track, caption, formattedHashtags);
      } else if (platform === 'shorts') {
        title = `🔥 ${track.title} - Trap Piano Log Drum Beat (${track.bpm} BPM) #Shorts`;
        description = `${caption}\n\n${formattedHashtags}`;
      } else if (platform === 'tiktok') {
        title = `${track.title} - ${track.subgenre}`;
        description = `${caption}\n\n${formattedHashtags}`;
      } else if (platform === 'instagram') {
        title = `${track.artist} - ${track.title}`;
        description = `${caption}\n\n${formattedHashtags}`;
      }

      platformsMetadata[platform] = {
        platform,
        title,
        description,
        caption,
        hashtags,
        formattedHashtags,
        tags: track.tags
      };
    }

    return {
      track,
      platforms: platformsMetadata as Record<SocialPlatform, SocialPlatformMetadata>,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Exports formatted metadata.json and .txt files to output directory.
   */
  public async exportSocialFiles(
    bundle: SocialMetadataBundle,
    outputDir: string
  ): Promise<{ jsonPath: string; txtPaths: Record<SocialPlatform, string>; summaryTxtPath: string }> {
    await fs.ensureDir(outputDir);

    const trackNumberPadded = String(bundle.track.trackNumber).padStart(2, '0');
    const safeTitle = bundle.track.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const prefix = `${trackNumberPadded}_${safeTitle}`;

    // 1. metadata.json
    const jsonPath = path.join(outputDir, `${prefix}_metadata.json`);
    await fs.writeJson(jsonPath, bundle, { spaces: 2 });

    // 2. Individual <platform>_metadata.txt files
    const txtPaths: Partial<Record<SocialPlatform, string>> = {};
    for (const [platform, meta] of Object.entries(bundle.platforms)) {
      const p = platform as SocialPlatform;
      const filePath = path.join(outputDir, `${prefix}_${p}_metadata.txt`);
      const content = `==================================================
PLATFORM: ${meta.platform.toUpperCase()}
TITLE: ${meta.title}
==================================================

CAPTION:
${meta.caption}

HASHTAGS:
${meta.formattedHashtags}

${meta.description ? `FULL DESCRIPTION:\n${meta.description}` : ''}
==================================================
`;
      await fs.writeFile(filePath, content, 'utf-8');
      txtPaths[p] = filePath;
    }

    // 3. Consolidated summary metadata.txt
    const summaryTxtPath = path.join(outputDir, `${prefix}_metadata.txt`);
    const summaryContent = this.buildSummaryTxtContent(bundle);
    await fs.writeFile(summaryTxtPath, summaryContent, 'utf-8');

    return {
      jsonPath,
      txtPaths: txtPaths as Record<SocialPlatform, string>,
      summaryTxtPath
    };
  }

  // --- PRIVATE HELPERS ---

  private parseFilename(filename: string): { title?: string; artist?: string; trackNumber?: number; bpm?: number; keywords: string[] } {
    if (!filename) return { keywords: [] };

    const basename = path.basename(filename, path.extname(filename));
    const keywords = basename.toLowerCase().split(/[-_ \s]+/);

    let trackNumber: number | undefined;
    let bpm: number | undefined;
    let title: string | undefined;
    let artist: string | undefined;

    // Check leading track number, e.g. "01 - " or "1. "
    const numMatch = basename.match(/^(\d+)[\s._-]+/);
    if (numMatch) {
      trackNumber = parseInt(numMatch[1], 10);
    }

    // Check BPM, e.g., "112BPM" or "112 bpm"
    const bpmMatch = basename.match(/(\d{2,3})\s*bpm/i);
    if (bpmMatch) {
      bpm = parseInt(bpmMatch[1], 10);
    }

    // Check "Artist - Title" format
    const parts = basename.replace(/^\d+[\s._-]+/, '').split(/\s*-\s*/);
    if (parts.length >= 2) {
      artist = parts[0].trim();
      title = parts[1].replace(/\(\d+\s*bpm\)/i, '').replace(/\[.*\]/, '').trim();
    } else if (parts.length === 1) {
      title = parts[0].replace(/\(\d+\s*bpm\)/i, '').replace(/\[.*\]/, '').trim();
    }

    return { title, artist, trackNumber, bpm, keywords };
  }

  private buildYouTubeDescription(track: TrackMetadata, caption: string, hashtags: string): string {
    return `🔥 ${track.title} - ${track.genre} (${track.subgenre})
Produced by ${track.artist}

${caption}

--- TRACK DETAILS ---
🎵 Title: ${track.title}
🎙️ Artist: ${track.artist}
💿 Album: ${track.album}
🥁 Genre: ${track.genre} / ${track.subgenre}
⚡ BPM: ${track.bpm} | Energy: ${track.energy} (${track.energyScore}/100)
✨ Mood: ${track.mood}
🎨 Visual Preset: ${track.visualStyle}

--- TIMESTAMPS ---
0:00 - Intro (Moonlight Glow)
0:15 - Log Drum Trap Drop (Bass Kick Particle Bursts)
1:00 - Piano Melody Bridge
1:30 - Main Drop (Tribal Silhouette Dance)
2:15 - Outro

--- TAGS & HASHTAGS ---
${hashtags}
SEO Tags: ${track.tags.join(', ')}

© ${new Date().getFullYear()} ${track.artist}. All rights reserved.`;
  }

  private buildSummaryTxtContent(bundle: SocialMetadataBundle): string {
    const t = bundle.track;
    let content = `================================================================================
TRACK METADATA SUMMARY
================================================================================
Track #: ${t.trackNumber}
Title: ${t.title}
Artist: ${t.artist}
Album: ${t.album}
Genre: ${t.genre}
Subgenre: ${t.subgenre}
BPM: ${t.bpm}
Energy: ${t.energy} (Score: ${t.energyScore}/100)
Mood: ${t.mood}
Visual Style: ${t.visualStyle}
Generated At: ${bundle.generatedAt}
================================================================================
SOCIAL MEDIA PLATFORM PAYLOADS
================================================================================
`;

    for (const [platform, meta] of Object.entries(bundle.platforms)) {
      content += `\n--- [ ${platform.toUpperCase()} ] ---\n`;
      content += `Title: ${meta.title}\n`;
      content += `Caption:\n${meta.caption}\n\n`;
      content += `Hashtags:\n${meta.formattedHashtags}\n`;
      content += `--------------------------------------------------------------------------------\n`;
    }

    return content;
  }
}

const defaultTagger = new TrackTagger();

export function generateSocialMetadataBundle(input: TrackMetadataInput): SocialMetadataBundle {
  const track = defaultTagger.classifyTrack(input);
  const platforms: Record<SocialPlatform, SocialPlatformMetadata> = {} as any;
  const platformList: SocialPlatform[] = ['youtube', 'tiktok', 'instagram', 'shorts'];
  const hashtagsStr = (track.tags || []).map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' ');

  for (const plat of platformList) {
    let title = `${track.artist} - ${track.title}`;
    if (plat === 'youtube') title += ` (Official Visualizer) | ${track.subgenre || track.genre}`;
    else if (plat === 'tiktok' || plat === 'shorts') title += ` 🎹 #trappiano`;

    platforms[plat] = {
      platform: plat,
      title: title.slice(0, 100),
      description: plat === 'youtube' ? `${track.title} by ${track.artist}.\nAlbum: ${track.album}\nGenre: ${track.genre}\nVisualizer: ${track.visualStyle}\n\n${hashtagsStr}` : `${track.artist} - ${track.title} ${hashtagsStr}`,
      caption: `${track.artist} - ${track.title} 🎹🔥 ${hashtagsStr}`,
      hashtags: track.tags || [],
      tags: track.tags || [],
      formattedHashtags: hashtagsStr,
      targetAspect: plat === 'youtube' ? '16:9' : '9:16'
    };
  }

  return {
    track,
    platforms,
    generatedAt: new Date().toISOString()
  };
}
