import * as fs from 'fs-extra';
import * as path from 'path';
import { SocialPublisher, OAuthToken, PublishRequest, PublishJob } from '../publishing/social-publisher';

async function runSocialPublisherTests() {
  console.log('================================================================');
  console.log('🚀 RUNNING SOCIAL PUBLISHER & API AUTOMATED TEST SUITE');
  console.log('================================================================\n');

  const testOutputDir = path.join(__dirname, '../../test_output/publishing');
  await fs.ensureDir(testOutputDir);

  const stateFilePath = path.join(testOutputDir, '.test-queue-state.json');
  const tokensFilePath = path.join(testOutputDir, '.test-tokens.json');

  // Ensure clean test environment
  await fs.remove(stateFilePath).catch(() => {});
  await fs.remove(tokensFilePath).catch(() => {});

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

  // Instantiate SocialPublisher in offline simulation mode
  const publisher = new SocialPublisher({
    stateFilePath,
    tokensFilePath,
    simulateOffline: true
  });

  // ----------------------------------------------------------------
  // TEST GROUP 1: OAuth Token Management
  // ----------------------------------------------------------------
  console.log('--- TEST GROUP 1: OAuth Token Management ---');

  const mockYtToken: OAuthToken = {
    accessToken: 'mock_yt_access_token_123',
    refreshToken: 'mock_yt_refresh_token_abc',
    expiresAt: Date.now() + 3600 * 1000,
    scope: 'https://www.googleapis.com/auth/youtube.upload'
  };

  const mockTtToken: OAuthToken = {
    accessToken: 'mock_tt_access_token_456',
    refreshToken: 'mock_tt_refresh_token_def',
    expiresAt: Date.now() + 7200 * 1000
  };

  const mockIgToken: OAuthToken = {
    accessToken: 'mock_ig_access_token_789',
    expiresAt: Date.now() + 86400 * 1000
  };

  publisher.setToken('youtube', mockYtToken);
  publisher.setToken('tiktok', mockTtToken);
  publisher.setToken('instagram', mockIgToken);

  assert(publisher.hasValidToken('youtube'), 'YouTube token is stored and valid');
  assert(publisher.hasValidToken('tiktok'), 'TikTok token is stored and valid');
  assert(publisher.hasValidToken('instagram'), 'Instagram token is stored and valid');

  const retrievedToken = publisher.getToken('youtube');
  assert(retrievedToken?.accessToken === mockYtToken.accessToken, 'Retrieved YouTube token matches stored payload');

  const refreshedToken = await publisher.refreshToken('youtube');
  assert(refreshedToken.accessToken.startsWith('refreshed_'), 'Token refreshed successfully with extended expiry');
  console.log('');

  // ----------------------------------------------------------------
  // TEST GROUP 2: Direct Video Posting (YouTube, TikTok, Instagram)
  // ----------------------------------------------------------------
  console.log('--- TEST GROUP 2: Direct Video Posting Handlers ---');

  const sampleVideoPath = path.join(testOutputDir, 'sample_render.mp4');
  await fs.writeFile(sampleVideoPath, Buffer.from('mock video content stream'));

  const dummyJob: PublishJob = {
    id: 'job_direct_test_01',
    filePath: sampleVideoPath,
    platform: 'youtube',
    title: 'Trap Piano - Night Heat Beat',
    description: 'Official Trap Piano Visualizer',
    hashtags: ['#TrapPiano', '#Amapiano', '#Beats'],
    tags: ['Trap', 'Piano', 'Visualizer'],
    privacy: 'public',
    status: 'PENDING',
    progress: 0,
    attempts: 0,
    maxRetries: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // YouTube posting
  const ytRes = await publisher.postToYouTube(dummyJob);
  assert(ytRes.success && ytRes.publishedUrl!.includes('youtube.com'), 'Direct post to YouTube returns valid video URL');
  assert(!!ytRes.platformPostId, 'YouTube post returns platform post ID');

  // TikTok posting
  dummyJob.platform = 'tiktok';
  const ttRes = await publisher.postToTikTok(dummyJob);
  assert(ttRes.success && ttRes.publishedUrl!.includes('tiktok.com'), 'Direct post to TikTok returns valid share URL');

  // Instagram Reels posting
  dummyJob.platform = 'instagram';
  const igRes = await publisher.postToInstagram(dummyJob);
  assert(igRes.success && igRes.publishedUrl!.includes('instagram.com/reel/'), 'Direct post to Instagram Reels returns valid reel URL');
  console.log('');

  // ----------------------------------------------------------------
  // TEST GROUP 3: Asynchronous Publishing Queue & Status Tracking
  // ----------------------------------------------------------------
  console.log('--- TEST GROUP 3: Queue Management & Status Tracking ---');

  const requests: PublishRequest[] = [
    {
      filePath: sampleVideoPath,
      platform: 'youtube',
      title: 'Album Track 01 - YouTube Full Visualizer',
      description: 'Official HD Visualizer',
      hashtags: ['#TrapPiano', '#NewMusic']
    },
    {
      filePath: sampleVideoPath,
      platform: 'tiktok',
      title: 'Album Track 01 - TikTok Clip',
      description: 'Listen on all platforms',
      hashtags: ['#TikTokMusic', '#Trap']
    },
    {
      filePath: sampleVideoPath,
      platform: 'instagram',
      title: 'Album Track 01 - Instagram Reel',
      description: 'Out Now!',
      hashtags: ['#Reels', '#Visualizer']
    }
  ];

  const enqueuedJobs = publisher.enqueue(requests);
  assert(enqueuedJobs.length === 3, 'Enqueues 3 publishing jobs');

  const pendingStatus = publisher.getQueueStatus();
  assert(pendingStatus.pending === 3, 'Queue summary reports 3 PENDING jobs');
  assert(pendingStatus.published === 0, 'Queue summary reports 0 PUBLISHED jobs before execution');

  // Process the queue
  const finishedJobs = await publisher.processQueue();
  assert(finishedJobs.length >= 3, 'Processes queue and returns updated job list');

  const completedStatus = publisher.getQueueStatus();
  assert(completedStatus.published === 3, 'Queue summary reports all 3 jobs PUBLISHED');
  assert(completedStatus.pending === 0, 'Queue summary reports 0 PENDING jobs after completion');

  const singleJob = publisher.getJob(enqueuedJobs[0].id);
  assert(singleJob?.status === 'PUBLISHED' && singleJob.progress === 100, 'Individual job status updated to PUBLISHED with 100% progress');
  console.log('');

  // ----------------------------------------------------------------
  // TEST GROUP 4: Retry Endpoints & Error Fallbacks
  // ----------------------------------------------------------------
  console.log('--- TEST GROUP 4: Retry Endpoints & Error Fallbacks ---');

  // Add a failing request with invalid platform to test failure handling
  const failRequest: PublishRequest = {
    filePath: sampleVideoPath,
    platform: 'invalid_platform' as any,
    title: 'Faulty Job Test',
    maxRetries: 1
  };

  const [failedJob] = publisher.enqueue(failRequest);
  const failPublishRes = await publisher.publishJob(failedJob.id);

  assert(!failPublishRes.success, 'Publishing job with invalid platform fails gracefully');
  const postFailJob = publisher.getJob(failedJob.id);
  assert(postFailJob?.status === 'FAILED', 'Failed job status updated to FAILED');
  assert(typeof postFailJob?.error === 'string', 'Error message recorded on failed job');

  // Test retryJob with updated parameters
  const retriedJob = await publisher.retryJob(failedJob.id, { platform: 'youtube' });
  assert(retriedJob.status === 'PUBLISHED', 'Retried job succeeds and updates status to PUBLISHED');
  console.log('');

  // ----------------------------------------------------------------
  // TEST GROUP 5: Persistence Audit
  // ----------------------------------------------------------------
  console.log('--- TEST GROUP 5: State & Token File Persistence ---');
  assert(await fs.pathExists(stateFilePath), 'Queue state saved to JSON disk file');
  assert(await fs.pathExists(tokensFilePath), 'OAuth tokens saved to JSON disk file');

  const newPublisherInstance = new SocialPublisher({
    stateFilePath,
    tokensFilePath,
    simulateOffline: true
  });

  const reloadedStatus = newPublisherInstance.getQueueStatus();
  assert(reloadedStatus.total >= 4, 'New publisher instance loads existing jobs from state file');
  assert(newPublisherInstance.hasValidToken('tiktok'), 'New publisher instance loads valid tokens from token file');
  console.log('');

  console.log('================================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} SOCIAL PUBLISHER TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================\n');
}

runSocialPublisherTests().catch((err) => {
  console.error('❌ Social Publisher test failure:', err);
  process.exit(1);
});
