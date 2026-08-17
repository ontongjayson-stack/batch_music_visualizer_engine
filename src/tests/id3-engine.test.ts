import * as fs from 'fs-extra';
import * as path from 'path';
import {
  ID3Engine,
  ID3Tags,
  BatchItem,
  readID3Tags,
  writeID3Tags,
  writeMetadataJson,
  parseFilenameForFallback,
  assignArtwork,
  saveArtwork,
  applyToAll,
  cascadeMetadata,
  cascadeFromSource,
  readBatch,
  writeBatch
} from '../metadata/id3-engine';

async function runID3EngineTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING ID3 ENGINE & METADATA CASCADING AUTOMATED TEST SUITE');
  console.log('================================================================\n');

  const testOutputDir = path.join(__dirname, '../../test_output/id3_engine_test');
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

  const engine = new ID3Engine();

  // ----------------------------------------------------------------
  // TEST GROUP 1: Filename Parsing & Fallback Logic
  // ----------------------------------------------------------------
  console.log('--- TEST GROUP 1: Filename Parsing & Fallback Logic ---');

  const fb1 = parseFilenameForFallback('01 - Midnight Piano Trap.mp3');
  assert(fb1.trackNumber === 1, 'Parses track number 1 from "01 - Midnight Piano Trap.mp3"');
  assert(fb1.title === 'Midnight Piano Trap', 'Parses title "Midnight Piano Trap"');

  const fb2 = parseFilenameForFallback('02. Amapiano Artist - Night Fire (112 BPM).wav');
  assert(fb2.trackNumber === 2, 'Parses track number 2 from "02. Amapiano Artist - Night Fire (112 BPM).wav"');
  assert(fb2.artist === 'Amapiano Artist', 'Parses artist "Amapiano Artist"');
  assert(fb2.title === 'Night Fire', 'Parses title "Night Fire"');
  assert(fb2.bpm === 112, 'Parses BPM 112');

  const fb3 = parseFilenameForFallback('03_Log_Drum_Trap_Beat.flac');
  assert(fb3.trackNumber === 3, 'Parses track number 3 from underscores');
  assert(fb3.title === 'Log Drum Trap Beat', 'Converts underscores to spaces for title');

  const fb4 = parseFilenameForFallback('Track 04 - Sunset Rhythm.m4a');
  assert(fb4.trackNumber === 4, 'Parses track number 4 from "Track 04"');
  assert(fb4.title === 'Sunset Rhythm', 'Parses title from "Track 04 - Sunset Rhythm.m4a"');

  // Test readTags on demo file with fallback
  const demoAudioPath = path.join(__dirname, '../../demo_album_input/01 - Midnight Piano Trap.mp3');
  if (await fs.pathExists(demoAudioPath)) {
    const demoTags = await readID3Tags(demoAudioPath);
    assert(!!demoTags.title && demoTags.title.includes('Midnight Piano Trap'), 'Reads tags from MP3 file with fallback title');
    assert(demoTags.trackNumber === 1, 'Reads track number 1 from filename fallback');
  }
  console.log('');

  // ----------------------------------------------------------------
  // TEST GROUP 2: ID3 Tag Writing (Audio Files & Metadata JSON)
  // ----------------------------------------------------------------
  console.log('--- TEST GROUP 2: ID3 Tag Writing to Audio & JSON ---');

  if (await fs.pathExists(demoAudioPath)) {
    const testAudioCopy = path.join(testOutputDir, 'test_track_written.mp3');
    await fs.copy(demoAudioPath, testAudioCopy);

    const newTags: ID3Tags = {
      title: 'Custom Trap Heat',
      artist: 'Producer X',
      album: 'Amapiano Anthems',
      genre: 'Trap Piano',
      year: 2026,
      composer: 'Composer Y',
      publisher: 'Visualizer Records',
      comment: 'Special Master Version',
      trackNumber: 5,
      trackTotal: 10,
      bpm: 115
    };

    const writtenPath = await writeID3Tags(testAudioCopy, newTags);
    assert(await fs.pathExists(writtenPath), 'Writes ID3 tags to audio file successfully');

    // Read back written file to verify tags persistence
    const reloadedTags = await readID3Tags(writtenPath);
    assert(reloadedTags.title === 'Custom Trap Heat', 'Reloaded audio file contains written title');
    assert(reloadedTags.artist === 'Producer X', 'Reloaded audio file contains written artist');
    assert(reloadedTags.album === 'Amapiano Anthems', 'Reloaded audio file contains written album');
    assert(reloadedTags.year === 2026, 'Reloaded audio file contains written year');
  }

  // Test writeMetadataJson
  const jsonOutputPath = path.join(testOutputDir, '01_test_track_metadata.json');
  const jsonTags: ID3Tags = {
    title: 'Json Test Track',
    artist: 'Json Artist',
    album: 'Json Album',
    genre: 'Amapiano',
    year: 2026
  };
  const createdJsonPath = await writeMetadataJson(jsonOutputPath, jsonTags);
  assert(await fs.pathExists(createdJsonPath), 'Creates metadata.json file on disk');
  const readJsonData = await fs.readJson(createdJsonPath);
  assert(readJsonData.title === 'Json Test Track', 'Written metadata.json has valid title');
  assert(readJsonData.artist === 'Json Artist', 'Written metadata.json has valid artist');
  console.log('');

  // ----------------------------------------------------------------
  // TEST GROUP 3: Album Artwork Assignment & Processing
  // ----------------------------------------------------------------
  console.log('--- TEST GROUP 3: Album Artwork Assignment & Processing ---');

  const demoCoverPath = path.join(__dirname, '../../demo_album_input/cover.jpg');
  const targetTag: ID3Tags = { title: 'Artwork Test Track' };

  if (await fs.pathExists(demoCoverPath)) {
    const artworkObj = await assignArtwork(targetTag, demoCoverPath);
    assert(!!targetTag.artwork, 'Assigns artwork from image file path');
    assert(artworkObj.mimeType === 'image/jpeg', 'Identifies image/jpeg mimeType from .jpg file');

    const savedArtPath = path.join(testOutputDir, 'extracted_cover.jpg');
    await saveArtwork(artworkObj, savedArtPath);
    assert(await fs.pathExists(savedArtPath), 'Saves artwork buffer to disk file');
  }

  // Test Base64 Data URI artwork assignment
  const dummyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const targetTag2: ID3Tags = { title: 'Base64 Track' };
  const art2 = await assignArtwork(targetTag2, dummyBase64);
  assert(art2.mimeType === 'image/png', 'Parses PNG MIME type from Base64 Data URI');
  assert(Buffer.isBuffer(art2.data) && art2.data.length > 0, 'Decodes Base64 string to image Buffer');
  console.log('');

  // ----------------------------------------------------------------
  // TEST GROUP 4: "Apply to All" Metadata Cascading
  // ----------------------------------------------------------------
  console.log('--- TEST GROUP 4: "Apply to All" Metadata Cascading ---');

  const batch: BatchItem[] = [
    {
      id: 'item-1',
      filePath: '/music/track01.mp3',
      tags: { title: 'Track 1 - Midnight Trap', artist: 'Artist A', album: 'Album A', trackNumber: 1 }
    },
    {
      id: 'item-2',
      filePath: '/music/track02.mp3',
      tags: { title: 'Track 2 - Amapiano Fire', artist: 'Artist B', album: 'Album B', trackNumber: 2 }
    },
    {
      id: 'item-3',
      filePath: '/music/track03.mp3',
      tags: { title: 'Track 3 - Sunset Rhythm', artist: 'Artist C', album: 'Album C', trackNumber: 3 }
    }
  ];

  // 1. Cascade Artist to all
  applyToAll(batch, 'Artist', 'Global Superstar');
  assert(batch[0].tags.artist === 'Global Superstar', 'Applies Artist to item 1');
  assert(batch[1].tags.artist === 'Global Superstar', 'Applies Artist to item 2');
  assert(batch[2].tags.artist === 'Global Superstar', 'Applies Artist to item 3');
  // CRITICAL: Ensure track titles remain unique and untouched!
  assert(batch[0].tags.title === 'Track 1 - Midnight Trap', 'Preserves unique title for item 1');
  assert(batch[1].tags.title === 'Track 2 - Amapiano Fire', 'Preserves unique title for item 2');
  assert(batch[2].tags.title === 'Track 3 - Sunset Rhythm', 'Preserves unique title for item 3');

  // 2. Cascade Album, Genre, Year, Composer, Publisher, Comments, Artwork
  applyToAll(batch, 'Album', 'Cascaded Master Album');
  applyToAll(batch, 'Genre', 'Amapiano Trap');
  applyToAll(batch, 'Year', 2026);
  applyToAll(batch, 'Composer', 'Master Composer');
  applyToAll(batch, 'Publisher', 'Master Records');
  applyToAll(batch, 'Comments', 'Cascaded Comment');

  assert(batch.every(i => i.tags.album === 'Cascaded Master Album'), 'Cascades Album across all items');
  assert(batch.every(i => i.tags.genre === 'Amapiano Trap'), 'Cascades Genre across all items');
  assert(batch.every(i => i.tags.year === 2026), 'Cascades Year across all items');
  assert(batch.every(i => i.tags.composer === 'Master Composer'), 'Cascades Composer across all items');
  assert(batch.every(i => i.tags.publisher === 'Master Records'), 'Cascades Publisher across all items');
  assert(batch.every(i => i.tags.comment === 'Cascaded Comment'), 'Cascades Comments across all items');

  // Verify titles still preserved after multiple field cascades
  assert(batch[0].tags.title === 'Track 1 - Midnight Trap', 'Title 1 unchanged after multi-field cascade');
  assert(batch[1].tags.title === 'Track 2 - Amapiano Fire', 'Title 2 unchanged after multi-field cascade');
  assert(batch[2].tags.title === 'Track 3 - Sunset Rhythm', 'Title 3 unchanged after multi-field cascade');

  // 3. Cascade from source index
  const sourceIndexBatch: BatchItem[] = [
    {
      id: 'item-1',
      filePath: '/music/track01.mp3',
      tags: { title: 'Unique Song 1', artist: 'Star Producer', album: 'Album Deluxe', genre: 'Amapiano Heat', trackNumber: 1 }
    },
    {
      id: 'item-2',
      filePath: '/music/track02.mp3',
      tags: { title: 'Unique Song 2', artist: 'Old Artist', album: 'Old Album', trackNumber: 2 }
    }
  ];

  cascadeFromSource(sourceIndexBatch, 0, ['artist', 'album', 'genre']);
  assert(sourceIndexBatch[1].tags.artist === 'Star Producer', 'Cascades artist from source index 0 to item 1');
  assert(sourceIndexBatch[1].tags.album === 'Album Deluxe', 'Cascades album from source index 0 to item 1');
  assert(sourceIndexBatch[1].tags.genre === 'Amapiano Heat', 'Cascades genre from source index 0 to item 1');
  assert(sourceIndexBatch[1].tags.title === 'Unique Song 2', 'Preserves unique title for item 1 when cascading from source index 0');

  // 4. Test error handling when attempting to cascade 'title'
  let threwErrorOnTitle = false;
  try {
    applyToAll(batch, 'title' as any, 'Overwritten Title');
  } catch (err: any) {
    threwErrorOnTitle = true;
    assert(err.message.includes('Title'), 'Rejects cascading title field to protect unique track titles');
  }
  assert(threwErrorOnTitle, 'Throws explicit error if title field cascading is attempted');
  console.log('');

  // ----------------------------------------------------------------
  // TEST GROUP 5: Batch Operations
  // ----------------------------------------------------------------
  console.log('--- TEST GROUP 5: Batch Operations ---');

  if (await fs.pathExists(demoAudioPath)) {
    const audioFiles = [demoAudioPath];
    const loadedBatch = await readBatch(audioFiles);
    assert(loadedBatch.length === 1, 'readBatch loads array of audio items');
    assert(!!loadedBatch[0].tags.title, 'readBatch item contains tags with parsed title');

    // Test writeBatch with JSON output directory
    const batchOutputDir = path.join(testOutputDir, 'batch_output');
    await writeBatch(loadedBatch, { writeAudioFiles: false, jsonOutputDir: batchOutputDir });
    assert(await fs.pathExists(batchOutputDir), 'writeBatch exports metadata JSON to target directory');
  }

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} ID3 ENGINE TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================\n');
}

runID3EngineTests().catch((err) => {
  console.error('❌ ID3 Engine Test execution error:', err);
  process.exit(1);
});
