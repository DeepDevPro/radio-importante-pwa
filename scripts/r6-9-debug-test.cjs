#!/usr/bin/env node

/**
 * R6-9: Debug UI Integration Test
 * 
 * Testa os endpoints de debug UI para validar funcionalidade
 */

/* eslint-env node */

const https = require('https');

const CONFIG = {
  baseUrl: process.env.HLS_BASE_URL || 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app',
  timeout: 10000
};

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = `${CONFIG.baseUrl}${path}`;
    const requestOptions = {
      ...options,
      timeout: CONFIG.timeout
    };

    const req = https.request(url, requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.method === 'POST' && options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function testDebugEndpoints() {
  console.log('🔧 R6-9: Testing Debug UI Integration');
  console.log(`📡 Base URL: ${CONFIG.baseUrl}`);
  console.log('');

  const tests = [
    {
      name: 'Debug Status',
      path: '/api/hls/debug-status',
      expectedStatus: 200,
      description: 'Cache status and statistics'
    },
    {
      name: 'Last Diagnostics (all)',
      path: '/api/hls/last-diagnostics',
      expectedStatus: [200, 404], // 404 is OK if no data cached yet
      description: 'Cached diagnostics data'
    },
    {
      name: 'Last Diagnostics (latest)',
      path: '/api/hls/last-diagnostics?mode=latest',
      expectedStatus: [200, 404],
      description: 'Latest mode diagnostics'
    },
    {
      name: 'Last Diagnostics (rolling)',
      path: '/api/hls/last-diagnostics?mode=rolling',
      expectedStatus: [200, 404],
      description: 'Rolling mode diagnostics'
    },
    {
      name: 'Last Hypothesis (all)',
      path: '/api/hls/last-hypothesis',
      expectedStatus: [200, 404], // 404 is OK if no hypothesis yet
      description: 'Cached hypothesis data'
    },
    {
      name: 'Last Hypothesis (safari)',
      path: '/api/hls/last-hypothesis?type=safari',
      expectedStatus: [200, 404],
      description: 'Safari-specific hypothesis'
    },
    {
      name: 'Debug Refresh',
      path: '/api/hls/debug-refresh',
      method: 'POST',
      body: { mode: 'all' },
      expectedStatus: 200,
      description: 'Refresh cache data'
    }
  ];

  const results = [];
  let passed = 0;
  let failed = 0;

  // Step 1: First, populate cache by running diagnostics
  console.log('📊 Step 1: Populating cache with fresh diagnostics...');
  try {
    await makeRequest('/api/hls/latest/diagnostics');
    console.log('✅ Latest diagnostics executed');
  } catch (error) {
    console.log(`⚠️  Latest diagnostics failed: ${error.message}`);
  }

  try {
    await makeRequest('/api/hls/rolling/diagnostics');
    console.log('✅ Rolling diagnostics executed');
  } catch (error) {
    console.log(`⚠️  Rolling diagnostics failed: ${error.message}`);
  }

  console.log('');
  console.log('🧪 Step 2: Testing debug endpoints...');

  // Step 2: Test all debug endpoints
  for (const test of tests) {
    const startTime = Date.now();
    
    try {
      const options = {
        method: test.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'R6-9-Debug-Test/1.0'
        }
      };

      if (test.body) {
        options.body = test.body;
      }

      const response = await makeRequest(test.path, options);
      const duration = Date.now() - startTime;
      
      const expectedStatuses = Array.isArray(test.expectedStatus) ? test.expectedStatus : [test.expectedStatus];
      const statusOk = expectedStatuses.includes(response.statusCode);
      
      if (statusOk) {
        console.log(`✅ ${test.name}: ${response.statusCode} (${duration}ms)`);
        passed++;
        
        // Show relevant data for successful responses
        if (response.statusCode === 200 && typeof response.data === 'object') {
          if (response.data.success) {
            console.log(`   📊 Success: ${response.data.success}`);
            
            if (response.data.data) {
              const dataKeys = Object.keys(response.data.data);
              console.log(`   📋 Data keys: ${dataKeys.join(', ')}`);
            }
            
            if (response.data.stats) {
              const diagnosticsAvailable = response.data.stats.diagnostics?.available?.length || 0;
              const hypothesisAvailable = response.data.stats.hypothesis?.available?.length || 0;
              console.log(`   📈 Cache: ${diagnosticsAvailable} diagnostics, ${hypothesisAvailable} hypothesis`);
            }
          }
        }
      } else {
        console.log(`❌ ${test.name}: Expected ${expectedStatuses.join(' or ')}, got ${response.statusCode} (${duration}ms)`);
        if (response.data && response.data.error) {
          console.log(`   🔍 Error: ${response.data.error}`);
        }
        failed++;
      }
      
      results.push({
        test: test.name,
        status: response.statusCode,
        duration,
        success: statusOk,
        data: response.data
      });
      
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
      failed++;
      
      results.push({
        test: test.name,
        status: 'ERROR',
        duration: Date.now() - startTime,
        success: false,
        error: error.message
      });
    }
  }

  // Step 3: Test cache clearing
  console.log('');
  console.log('🧹 Step 3: Testing cache clearing...');
  
  try {
    const response = await makeRequest('/api/hls/debug-cache', { method: 'DELETE' });
    if (response.statusCode === 200) {
      console.log('✅ Cache clearing: SUCCESS');
      passed++;
    } else {
      console.log(`❌ Cache clearing: ${response.statusCode}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ Cache clearing: ${error.message}`);
    failed++;
  }

  // Summary
  console.log('');
  console.log('📊 R6-9 Debug UI Integration Test Summary:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('');
    console.log('🎉 All tests PASSED! Debug UI Integration is working correctly.');
    console.log('');
    console.log('Available endpoints:');
    console.log('  GET  /api/hls/last-diagnostics       - Cached diagnostics data');
    console.log('  GET  /api/hls/last-hypothesis        - Cached hypothesis data');
    console.log('  GET  /api/hls/debug-status           - Cache status and stats');
    console.log('  POST /api/hls/debug-refresh          - Refresh cache data');
    console.log('  DEL  /api/hls/debug-cache            - Clear cache');
  }
  
  return { passed, failed, results };
}

// Run tests if called directly
if (require.main === module) {
  testDebugEndpoints()
    .then(result => {
      process.exit(result.failed === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { testDebugEndpoints };
