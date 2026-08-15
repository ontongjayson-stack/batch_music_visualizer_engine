import path from 'node:path';
import { execSync } from 'node:child_process';
import fs from 'fs-extra';
import { createCanvas } from 'canvas';

export async function createMockAlbumDir(targetDir: string): Promise<string> {
  const albumDir = path.join(targetDir, 'Test Artist - Futuristic Beats');
  await fs.ensureDir(albumDir);

  // Generate 3 synthetic audio files using ffmpeg lavfi
  const track1 = path.join(albumDir, '01 - Intro.wav');
  const track2 = path.join(albumDir, '02 - Cyber Pulse.mp3');
  const track3 = path.join(albumDir, '03 - Neon Night.flac');

  execSync(`ffmpeg -f lavfi -i "sine=frequency=440:duration=1.5" -metadata title="Intro" -metadata artist="Test Artist" -metadata album="Futuristic Beats" -metadata track="1" "${track1}" -y`, { stdio: 'ignore' });
  execSync(`ffmpeg -f lavfi -i "sine=frequency=880:duration=1.2" -metadata title="Cyber Pulse" -metadata artist="Test Artist" -metadata album="Futuristic Beats" -metadata track="2" "${track2}" -y`, { stdio: 'ignore' });
  execSync(`ffmpeg -f lavfi -i "sine=frequency=220:duration=1.0" -metadata title="Neon Night" -metadata artist="Test Artist" -metadata album="Futuristic Beats" -metadata track="3" "${track3}" -y`, { stdio: 'ignore' });

  // Generate dummy cover.jpg using canvas
  const canvas = createCanvas(400, 400);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1e1e2f';
  ctx.fillRect(0, 0, 400, 400);
  ctx.fillStyle = '#00ffcc';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('FUTURISTIC BEATS', 40, 200);

  const coverPath = path.join(albumDir, 'cover.jpg');
  const buffer = canvas.toBuffer('image/jpeg');
  await fs.writeFile(coverPath, buffer);

  return albumDir;
}
