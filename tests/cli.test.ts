import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs-extra';
import { createMockAlbumDir } from './test-utils.js';

describe('CLI generate-album Command', () => {
  let tmpDir: string;
  let mockAlbumDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'batch-vis-cli-test-'));
    mockAlbumDir = await createMockAlbumDir(tmpDir);
  });

  afterAll(async () => {
    await fs.remove(tmpDir);
  });

  it('should run generate-album CLI tool successfully and output manifests', () => {
    const cliPath = path.resolve('src/cli/index.ts');
    const outputDir = path.join(tmpDir, 'cli_output');

    const cmd = `npx tsx "${cliPath}" "${mockAlbumDir}" --preset neon-bars --platforms youtube,tiktok --output-dir "${outputDir}" --fps 30`;
    
    const output = execSync(cmd, {
      cwd: process.cwd(),
      encoding: 'utf-8',
      env: { ...process.env },
    });

    expect(output).toContain('BATCH MUSIC VISUALIZER ENGINE');
    expect(output).toContain('Scanning Album Directory');
    expect(output).toContain('Total Tracks:   3');
    expect(output).toContain('BATCH PROCESSING COMPLETED');

    const albumOutputDir = path.join(outputDir, path.basename(mockAlbumDir));
    expect(fs.existsSync(albumOutputDir)).toBe(true);

    const manifestFiles = fs.readdirSync(albumOutputDir).filter(f => f.endsWith('.json'));
    expect(manifestFiles.length).toBeGreaterThanOrEqual(3);
  }, 30000);
});
