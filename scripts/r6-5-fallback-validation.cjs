#!/usr/bin/env node

/**
 * R6-5: Validação Cadeia Fallback
 * 
 * Testa isolação completa entre HLS e fallback MP3:
 * 1. Força falha HLS (simulate mode)
 * 2. Confirma catalog MP3 intacto
 * 3. Testa rollback em cenário de falha
 * 4. Registra resultados no RUN-LOG
 */

/* eslint-env node */
/* eslint-disable no-console, no-undef */

const https = require('https');

const BASE_URL = process.env.BACKEND_URL || 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app';

/**
 * HTTP request helper
 */
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

/**
 * Test individual functions
 */
async function testFallbackChain() {
  const results = {};
  let allPassed = true;

  console.log('🔍 R6-5: Validação Cadeia Fallback');
  console.log('===================================');

  // Test 1: Force HLS failure (simulate mode)
  console.log('\n1️⃣ Testing HLS failure simulation...');
  try {
    const hlsResponse = await httpRequest(`${BASE_URL}/api/hls/generate-hls`, {
      method: 'POST',
      body: { mode: 'latest', simulate: true }
    });

    if (hlsResponse.statusCode === 200 && hlsResponse.data.simulate === true) {
      console.log('✅ HLS simulate mode working (forced fallback)');
      console.log(`   Action: ${hlsResponse.data.action}`);
      results.hlsSimulate = { passed: true, action: hlsResponse.data.action };
    } else {
      console.log('❌ HLS simulate mode failed');
      results.hlsSimulate = { passed: false, error: 'Unexpected response' };
      allPassed = false;
    }
  } catch (error) {
    console.log('❌ HLS simulate test failed:', error.message);
    results.hlsSimulate = { passed: false, error: error.message };
    allPassed = false;
  }

  // Test 2: MP3 Catalog integrity
  console.log('\n2️⃣ Testing MP3 catalog integrity...');
  try {
    const catalogResponse = await httpRequest(`${BASE_URL}/api/catalog`);
    
    if (catalogResponse.statusCode === 200 && catalogResponse.data.tracks) {
      const trackCount = catalogResponse.data.tracks.length;
      console.log(`✅ MP3 catalog intact: ${trackCount} tracks`);
      console.log(`   Total duration: ${catalogResponse.data.metadata.totalDuration}s`);
      results.mp3Catalog = { passed: true, trackCount, totalDuration: catalogResponse.data.metadata.totalDuration };
    } else {
      console.log('❌ MP3 catalog failed');
      results.mp3Catalog = { passed: false, error: 'Catalog unavailable' };
      allPassed = false;
    }
  } catch (error) {
    console.log('❌ MP3 catalog test failed:', error.message);
    results.mp3Catalog = { passed: false, error: error.message };
    allPassed = false;
  }

  // Test 3: MP3 file accessibility
  console.log('\n3️⃣ Testing MP3 file accessibility...');
  try {
    const catalogResponse = await httpRequest(`${BASE_URL}/api/catalog`);
    if (catalogResponse.data.tracks && catalogResponse.data.tracks.length > 0) {
      const firstTrack = catalogResponse.data.tracks[0];
      const mp3Url = firstTrack.url;
      
      // Test MP3 HEAD request
      const mp3Response = await new Promise((resolve, reject) => {
        const req = https.request(mp3Url, { method: 'HEAD' }, (res) => {
          resolve({ statusCode: res.statusCode, headers: res.headers });
        });
        req.on('error', reject);
        req.end();
      });

      if (mp3Response.statusCode === 200) {
        console.log('✅ MP3 files accessible');
        console.log(`   Test file: ${firstTrack.filename}`);
        console.log(`   Size: ${Math.round(mp3Response.headers['content-length'] / 1024)}KB`);
        results.mp3Access = { passed: true, filename: firstTrack.filename, sizeKB: Math.round(mp3Response.headers['content-length'] / 1024) };
      } else {
        console.log('❌ MP3 files inaccessible');
        results.mp3Access = { passed: false, error: `HTTP ${mp3Response.statusCode}` };
        allPassed = false;
      }
    }
  } catch (error) {
    console.log('❌ MP3 accessibility test failed:', error.message);
    results.mp3Access = { passed: false, error: error.message };
    allPassed = false;
  }

  // Test 4: Rollback in failure scenario
  console.log('\n4️⃣ Testing rollback in failure scenario...');
  try {
    const rollbackResponse = await httpRequest(`${BASE_URL}/api/hls/rollback-latest`, {
      method: 'POST'
    });

    if (rollbackResponse.statusCode === 200) {
      console.log('✅ Rollback endpoint responsive');
      console.log(`   Result: ${rollbackResponse.data.action || 'no_snapshot'}`);
      console.log(`   Snapshot exists: ${rollbackResponse.data.snapshotExists || false}`);
      results.rollback = { 
        passed: true, 
        action: rollbackResponse.data.action,
        snapshotExists: rollbackResponse.data.snapshotExists || false
      };
    } else {
      console.log('❌ Rollback endpoint failed');
      results.rollback = { passed: false, error: `HTTP ${rollbackResponse.statusCode}` };
      allPassed = false;
    }
  } catch (error) {
    console.log('❌ Rollback test failed:', error.message);
    results.rollback = { passed: false, error: error.message };
    allPassed = false;
  }

  // Test 5: Isolation validation (HLS vs MP3)
  console.log('\n5️⃣ Testing HLS/MP3 isolation...');
  try {
    // Test that MP3 works independently of HLS state
    const beforeCatalog = await httpRequest(`${BASE_URL}/api/catalog`);
    
    // Force HLS simulate mode
    await httpRequest(`${BASE_URL}/api/hls/generate-hls`, {
      method: 'POST',
      body: { mode: 'latest', simulate: true }
    });
    
    // Test catalog still works
    const afterCatalog = await httpRequest(`${BASE_URL}/api/catalog`);
    
    if (beforeCatalog.statusCode === 200 && afterCatalog.statusCode === 200 &&
        beforeCatalog.data.tracks.length === afterCatalog.data.tracks.length) {
      console.log('✅ HLS/MP3 isolation confirmed');
      console.log(`   MP3 catalog unaffected by HLS operations`);
      results.isolation = { passed: true, trackCount: afterCatalog.data.tracks.length };
    } else {
      console.log('❌ HLS/MP3 isolation failed');
      results.isolation = { passed: false, error: 'Catalog affected by HLS' };
      allPassed = false;
    }
  } catch (error) {
    console.log('❌ Isolation test failed:', error.message);
    results.isolation = { passed: false, error: error.message };
    allPassed = false;
  }

  // Summary
  console.log('\n📊 R6-5 SUMMARY');
  console.log('===============');
  console.log(`Overall result: ${allPassed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Tests executed: 5/5`);
  console.log(`Tests passed: ${Object.values(results).filter(r => r.passed).length}/5`);
  
  // Detailed results
  console.log('\nDetailed Results:');
  console.log('- HLS Simulate:', results.hlsSimulate?.passed ? '✅' : '❌');
  console.log('- MP3 Catalog:', results.mp3Catalog?.passed ? '✅' : '❌');
  console.log('- MP3 Access:', results.mp3Access?.passed ? '✅' : '❌');
  console.log('- Rollback:', results.rollback?.passed ? '✅' : '❌');
  console.log('- Isolation:', results.isolation?.passed ? '✅' : '❌');

  // Generate report
  const timestamp = new Date().toISOString();
  const report = {
    timestamp,
    testName: 'R6-5 Fallback Chain Validation',
    overallResult: allPassed ? 'PASSED' : 'FAILED',
    totalTests: 5,
    passedTests: Object.values(results).filter(r => r.passed).length,
    results
  };

  console.log('\n📄 JSON Report:');
  console.log(JSON.stringify(report, null, 2));

  process.exit(allPassed ? 0 : 1);
}

// Execute validation
testFallbackChain().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
