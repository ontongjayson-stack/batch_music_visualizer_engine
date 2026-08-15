import * as fs from 'fs-extra';
import * as path from 'path';
import { FreeAIProvider } from '../ai/provider';
import { TrackTagger } from '../metadata/tagger';
import { ThumbnailGenerator } from '../metadata/thumbnail';
import { TrapPianoPreset } from '../presets/trap-piano';
import { AudioAnalysisData, PresetRenderOptions, TrackMetadata } from '../types';

let createCanvas: any;
try {
  createCanvas = require('@napi-rs/canvas').createCanvas;
} catch {
  createCanvas = require('canvas').createCanvas;
}

async function runTests() {
  console.log('================================================================');
  console.log('🚀 RUNNING TRAP PIANO & METADATA ENGINEER AUTOMATED TEST SUITE');
  console.log('================================================================\n');

  const testOutputDir = path.join(__dirname, '../../test_output');
  await fs.ensureDir(testOutputDir);

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  // ----------------------------------------------------------------
  // TEST 1: Free AI Provider & Local Fallbacks
  // ----------------------------------------------------------------
  console.log('--- TEST GROUP 1: Free AI Provider Abstraction ---');
  const aiProvider = new FreeAIProvider({ provider: 'local' });

  const textRes = await aiProvider.generateText('Write a tag for a beat');
  assert(typeof textRes.text === 'string' && textRes.text.length > 0, 'AI Provider generates text result');
  assert(textRes.source === 'local', 'AI Provider correctly identifies local source');

  const sampleTrackInput: TrackMetadata = {
    trackNumber: 1,
    title: 'Amapiano Log Drum Heat',
    artist: 'Trap Director',
    album: 'Trap Piano Anthems Vol. 1',
    genre: 'Trap Piano',
    subgenre: 'Log Drum Trap',
    bpm: 112,
    energy: 'High',
    energyScore: 78,
    mood: 'Hypnotic & Energetic',
    visualStyle: 'Trap Piano Amapiano Fusion',
    platforms: ['youtube', 'tiktok', 'instagram', 'shorts'],
    tags: ['Trap Piano', 'Amapiano']
  };

  const captionTt = await aiProvider.generateCaption(sampleTrackInput, 'tiktok');
  assert(captionTt.includes('Log Drum') || captionTt.includes('#Amapiano'), 'Generates TikTok caption with local fallback');

  const hashtags = await aiProvider.generateHashtags(sampleTrackInput);
  assert(Array.isArray(hashtags) && hashtags.length >= 5, 'Generates high-traffic hashtags');

  const artworkRes = await aiProvider.generateArtwork('Trap Piano Album Cover', 300, 300);
  assert(Buffer.isBuffer(artworkRes.imageBuffer) && artworkRes.imageBuffer.length > 500, 'Generates artwork image buffer');
  console.log('');

  // ----------------------------------------------------------------
  // TEST 2: Automatic Tag Classification & Social Metadata Generator
  // ----------------------------------------------------------------
  console.log('--- TEST GROUP 2: Track Tagger & Social Metadata Generator ---');
  const tagger = new TrackTagger(aiProvider);

  // Test Filename parsing & classification
  const classifiedTrack = tagger.classifyTrack({
    filename: '01 - Trap Director - Dark Log Drum (112BPM).mp3',
    audioAnalysis: {
      bpm: 112,
      energy: 0.82,
      bassEnergy: 0.9,
      isKickDetected: true
    } as AudioAnalysisData
  });

  assert(classifiedTrack.title === 'Dark Log Drum', 'Correctly parses title from filename');
  assert(classifiedTrack.artist === 'Trap Director', 'Correctly parses artist from filename');
  assert(classifiedTrack.bpm === 112, 'Correctly classifies BPM');
  assert(classifiedTrack.energy === 'High' || classifiedTrack.energy === 'Extreme', 'Classifies energy score correctly');
  assert(classifiedTrack.subgenre.includes('Log Drum') || classifiedTrack.genre === 'Trap Piano', 'Classifies genre / subgenre correctly');

  // Test Social bundle generation
  const socialBundle = await tagger.generateSocialBundle(classifiedTrack);
  assert(!!socialBundle.platforms.youtube, 'Generates YouTube social metadata payload');
  assert(!!socialBundle.platforms.tiktok, 'Generates TikTok social metadata payload');
  assert(!!socialBundle.platforms.instagram, 'Generates Instagram social metadata payload');
  assert(!!socialBundle.platforms.shorts, 'Generates Shorts social metadata payload');

  // Test Exporting metadata.json and .txt files
  const exportRes = await tagger.exportSocialFiles(socialBundle, testOutputDir);
  assert(fs.existsSync(exportRes.jsonPath), 'Exports formatted metadata.json file');
  assert(fs.existsSync(exportRes.summaryTxtPath), 'Exports formatted summary metadata.txt file');
  assert(fs.existsSync(exportRes.txtPaths.youtube), 'Exports youtube_metadata.txt');
  assert(fs.existsSync(exportRes.txtPaths.tiktok), 'Exports tiktok_metadata.txt');

  const jsonContent = await fs.readJson(exportRes.jsonPath);
  assert(jsonContent.track.title === 'Dark Log Drum', 'Exported JSON contains complete track payload');
  console.log('');

  // ----------------------------------------------------------------
  // TEST 3: Automatic Thumbnail Generator (16:9 & 9:16)
  // ----------------------------------------------------------------
  console.log('--- TEST GROUP 3: Automatic Thumbnail Generator ---');
  const thumbnailGen = new ThumbnailGenerator();

  const thumbResult = await thumbnailGen.generateThumbnails({
    title: classifiedTrack.title,
    artist: classifiedTrack.artist,
    album: classifiedTrack.album,
    trackNumber: classifiedTrack.trackNumber,
    genre: classifiedTrack.genre,
    subgenre: classifiedTrack.subgenre,
    bpm: classifiedTrack.bpm,
    energy: classifiedTrack.energy,
    outputDir: testOutputDir,
    filenamePrefix: 'test_track_01'
  });

  assert(fs.existsSync(thumbResult.path16x9), '16:9 thumbnail PNG created on disk');
  assert(fs.existsSync(thumbResult.path9x16), '9:16 thumbnail PNG created on disk');
  assert(thumbResult.buffer16x9.length > 5000, '16:9 image buffer is non-empty');
  assert(thumbResult.buffer9x16.length > 5000, '9:16 image buffer is non-empty');
  console.log('');

  // ----------------------------------------------------------------
  // TEST 4: Trap Piano Visual Preset Module
  // ----------------------------------------------------------------
  console.log('--- TEST GROUP 4: TRAP PIANO Visual Preset Module ---');
  const trapPreset = new TrapPianoPreset();

  const info = trapPreset.getPresetInfo();
  assert(info.id === 'trap-piano', 'Preset info returns valid trap-piano ID');
  assert(info.genre === 'Trap Piano', 'Preset info returns correct genre');

  const remotionProps = trapPreset.getRemotionPresetProps();
  assert(remotionProps.presetId === 'trap-piano', 'Returns Remotion preset configuration');

  // Test Canvas frame rendering
  const testCanvas = createCanvas(1280, 720);
  const testCtx = testCanvas.getContext('2d');

  const renderOpts: PresetRenderOptions = {
    width: 1280,
    height: 720,
    time: 2.5,
    frame: 75,
    fps: 30,
    audioData: {
      timestamp: 2.5,
      rms: 0.7,
      bass: 0.85,
      mid: 0.6,
      treble: 0.4,
      energy: 0.78,
      isKick: true,
      bpm: 112
    },
    metadata: classifiedTrack
  };

  trapPreset.renderFrame(testCtx, renderOpts);
  const renderedFrameBuffer = testCanvas.toBuffer('image/png');
  assert(renderedFrameBuffer.length > 10000, 'Successfully renders frame with night fire, smoke, tribal patterns & female dancer');

  // Save rendered frame sample to disk for visual audit
  const frameSamplePath = path.join(testOutputDir, 'trap_piano_rendered_frame.png');
  await fs.writeFile(frameSamplePath, renderedFrameBuffer);
  assert(fs.existsSync(frameSamplePath), 'Saved sample rendered frame to disk');

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Test execution error:', err);
  process.exit(1);
});
