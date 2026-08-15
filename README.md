# 🎵 Batch Music Visualizer & Social Content Production Engine

An automated, high-throughput music video production pipeline that converts an entire music album directory into publishable visualizer videos for **YouTube (16:9 1920x1080)**, **TikTok (9:16 1080x1920)**, **Instagram Reels (9:16 1080x1920)**, and **YouTube Shorts (9:16 1080x1920)**, along with platform social metadata manifests and high-resolution thumbnail image cards.

---

## ⚡ Quick Start

### Option 1: Double-Click Executable Launcher (Windows)
Double-click either of the following files in the project root:
- **`Start-Visualizer.bat`**: Windows batch executable launcher.
- **`Start-Visualizer.vbs`**: Silent VBScript launcher.

Your web browser will automatically open to **`http://localhost:3000`**.

### Option 2: Command-Line Interface (CLI)
```bash
npx tsx src/cli/index.ts generate-album "D:\Music\MyAlbum" --preset TRAP-PIANO --platforms youtube,tiktok,instagram,shorts
```

---

## 🎨 Visualizer Presets

Supported visual style presets:
1. **`TRAP-PIANO`** — Specialized Amapiano + Trap fusion visual identity (night fire, smoke, dust particles on bass kicks, tribal geometry, rhythmic female vector silhouette dance cycle).
2. **`DARK-CINEMATIC`** — Obsidian background, amber embers, smooth multi-layered wave lines.
3. **`AMAPIANO`** — Sunburst gold & warm orange tones, pulsing circular spectrum, firefly particles.
4. **`TRAP`** — Neon cyan & hot magenta trap aesthetic, dual mirrored bars, high-speed sparks.
5. **`DEEP-HOUSE`** — Oceanic deep blue/teal gradients, floating glow blooms, smooth wave lines.
6. **`MINIMAL`** — Monochromatic dark slate layout with precise thin frequency bars.
7. **`ABSTRACT`** — Ethereal color-shifting palette, expanding smoke clouds, radial pulse.
8. **`DEFAULT`** — Studio blue/cyan aesthetic with vertical frequency bars.

---

## 📁 Output Directory Hierarchy

```
OUTPUT/
    YOUR_ALBUM_NAME/
        ├── YouTube/         # 16:9 (1920x1080) MP4 Videos
        ├── TikTok/          # 9:16 (1080x1920) MP4 Videos
        ├── Instagram/       # 9:16 (1080x1920) MP4 Videos
        ├── Shorts/          # 9:16 (1080x1920) MP4 Videos
        ├── Thumbnails/      # 16:9 (1280x720) & 9:16 (1080x1920) PNG Cards
        └── Metadata/        # Platform titles, captions, descriptions & hashtags (.json)
```

---

## 🧪 Testing

Run the comprehensive end-to-end album batch production test suite:
```bash
npm test
```

---

## 🛡️ License

MIT License - Personal & Production Use.
