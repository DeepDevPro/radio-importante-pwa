#!/usr/bin/env node

/* eslint-env node */
/* eslint-disable no-console */

/**
 * HLS Smoke Test Script (R6-2)
 * 
 * Sequência: capabilities → generate latest (simulate:false) → generate rolling → 
 *           diagnostics latest & rolling → safari-hypothesis
 * 
 * Saída: resumida + exit code (0 = sucesso, 1 = falha crítica)
 */

const https = require('https');
const { performance } = require('perf_hooks');

// Configuração
const BASE_URL = process.env.BACKEND_URL || 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app';
const TIMEOUT = 30000; // 30s timeout por request

// Utilitários
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'hls-smoke-test/1.0'
      },
      timeout: TIMEOUT
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (_e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type}] ${message}`);
}

function logResult(step, success, details = '') {
  const status = success ? '✅ PASS' : '❌ FAIL';
  log(`${step}: ${status} ${details}`);
  return success;
}

// Testes individuais
async function testCapabilities() {
  try {
    const start = performance.now();
    const response = await makeRequest('GET', '/api/hls/capabilities');
    const duration = Math.round(performance.now() - start);
    
    if (response.status !== 200) {
      return logResult('CAPABILITIES', false, `HTTP ${response.status}`);
    }
    
    if (!response.data.success || !response.data.capability) {
      return logResult('CAPABILITIES', false, 'Missing capability data');
    }
    
    const { canSpawn, ffmpegVersion } = response.data.capability;
    return logResult('CAPABILITIES', true, `canSpawn=${canSpawn}, version=${ffmpegVersion || 'unknown'} (${duration}ms)`);
  } catch (error) {
    return logResult('CAPABILITIES', false, error.message);
  }
}

async function testGenerateLatest() {
  try {
    const start = performance.now();
    const response = await makeRequest('POST', '/api/hls/generate-hls', {
      mode: 'latest',
      simulate: false
    });
    const duration = Math.round(performance.now() - start);
    
    if (response.status !== 200) {
      return logResult('GENERATE_LATEST', false, `HTTP ${response.status}`);
    }
    
    if (!response.data.success) {
      return logResult('GENERATE_LATEST', false, `success=false, action=${response.data.action || 'unknown'}`);
    }
    
    const { action, segmentCount, totalDurationApprox } = response.data;
    if (action === 'generation_failed') {
      return logResult('GENERATE_LATEST', false, `Generation failed: ${response.data.errorSummary || 'unknown error'}`);
    }
    
    const details = `action=${action}, segments=${segmentCount || 'unknown'}, duration=${totalDurationApprox || 'unknown'}s (${duration}ms)`;
    return logResult('GENERATE_LATEST', true, details);
  } catch (error) {
    return logResult('GENERATE_LATEST', false, error.message);
  }
}

async function testGenerateRolling() {
  try {
    const start = performance.now();
    const response = await makeRequest('POST', '/api/hls/generate-hls', {
      mode: 'rolling'
    });
    const duration = Math.round(performance.now() - start);
    
    if (response.status !== 200) {
      return logResult('GENERATE_ROLLING', false, `HTTP ${response.status}`);
    }
    
    if (!response.data.success) {
      return logResult('GENERATE_ROLLING', false, `success=false, action=${response.data.action || 'unknown'}`);
    }
    
    const { action, segmentCount } = response.data;
    const details = `action=${action}, segments=${segmentCount || 'unknown'} (${duration}ms)`;
    return logResult('GENERATE_ROLLING', true, details);
  } catch (error) {
    return logResult('GENERATE_ROLLING', false, error.message);
  }
}

async function testDiagnostics(mode) {
  try {
    const start = performance.now();
    const response = await makeRequest('GET', `/api/hls/${mode}/diagnostics`);
    const duration = Math.round(performance.now() - start);
    
    if (response.status !== 200) {
      return logResult(`DIAGNOSTICS_${mode.toUpperCase()}`, false, `HTTP ${response.status}`);
    }
    
    if (!response.data.success) {
      return logResult(`DIAGNOSTICS_${mode.toUpperCase()}`, false, 'success=false');
    }
    
    const { status, declaredCount, headOkCount, totalDurationApprox } = response.data;
    const details = `status=${status}, declared=${declaredCount}, probes=${headOkCount}, duration=${totalDurationApprox}s (${duration}ms)`;
    
    // Critério: diagnostics deve ser rápido
    const success = duration < 3000;
    return logResult(`DIAGNOSTICS_${mode.toUpperCase()}`, success, details);
  } catch (error) {
    return logResult(`DIAGNOSTICS_${mode.toUpperCase()}`, false, error.message);
  }
}

async function testSafariHypothesis() {
  try {
    const start = performance.now();
    const response = await makeRequest('POST', '/api/hls/safari-hypothesis', {
      safariAnalysis: {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        networkTiming: { loadStart: 0, loadEnd: 1000 },
        freezeTime: 17000
      },
      correlation: {
        findings: ['INSUFFICIENT_DURATION'],
        riskFactors: ['PLAYER_STRATEGY_MISMATCH'],
        recommendations: ['Verify playlist duration >= 18s']
      }
    });
    const duration = Math.round(performance.now() - start);
    
    if (response.status !== 200) {
      return logResult('SAFARI_HYPOTHESIS', false, `HTTP ${response.status}`);
    }
    
    if (!response.data.success) {
      return logResult('SAFARI_HYPOTHESIS', false, 'success=false');
    }
    
    const { hypothesis, confidence } = response.data;
    const details = `hypothesis=${hypothesis || 'unknown'}, confidence=${confidence || 'unknown'} (${duration}ms)`;
    return logResult('SAFARI_HYPOTHESIS', true, details);
  } catch (error) {
    return logResult('SAFARI_HYPOTHESIS', false, error.message);
  }
}

// Execução principal
async function runSmokeTest() {
  log('=== HLS SMOKE TEST START ===');
  log(`Target: ${BASE_URL}`);
  log(`Timeout: ${TIMEOUT}ms per request`);
  
  const results = [];
  
  // Sequência de testes
  results.push(await testCapabilities());
  results.push(await testGenerateLatest());
  results.push(await testGenerateRolling());
  results.push(await testDiagnostics('latest'));
  results.push(await testDiagnostics('rolling'));
  results.push(await testSafariHypothesis());
  
  // Sumário
  const passed = results.filter(r => r).length;
  const total = results.length;
  const success = passed === total;
  
  log('=== SMOKE TEST SUMMARY ===');
  log(`Tests: ${passed}/${total} passed`);
  
  if (success) {
    log('🎉 ALL TESTS PASSED', 'SUCCESS');
    process.exit(0);
  } else {
    log(`💥 ${total - passed} TESTS FAILED`, 'ERROR');
    process.exit(1);
  }
}

// Tratamento de erros global
process.on('unhandledRejection', (error) => {
  log(`Unhandled rejection: ${error.message}`, 'ERROR');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  log(`Uncaught exception: ${error.message}`, 'ERROR');
  process.exit(1);
});

// Execução
if (require.main === module) {
  runSmokeTest();
}

module.exports = { runSmokeTest };
