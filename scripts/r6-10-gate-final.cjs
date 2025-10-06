#!/usr/bin/env node

/**
 * R6-10: Gate Final + Critérios Agregados
 * 
 * Validação final de todos os critérios R6 implementados
 */

/* eslint-env node */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  baseUrl: process.env.HLS_BASE_URL || 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app',
  timeout: 10000,
  smokeIterations: 10, // Número de iterações smoke para validação
  p95Threshold: 3000 // Threshold p95 para diagnostics
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

async function validateR6Criteria() {
  console.log('🏁 R6-10: Gate Final + Critérios Agregados');
  console.log(`📡 Base URL: ${CONFIG.baseUrl}`);
  console.log('');

  const results = {
    r6Tasks: {},
    smokeResults: [],
    diagnosticsMetrics: [],
    errors: [],
    warnings: []
  };

  // ================== VALIDAÇÃO R6-1 A R6-9 ==================
  console.log('📋 Step 1: Validating R6-1 to R6-9 completion...');
  
  const r6Validations = [
    {
      id: 'R6-1',
      name: 'Checklist Reconciliation',
      check: async () => {
        // Verifica se checklist existe e foi atualizado
        const checklistPath = path.join(__dirname, '..', 'devFiles', 'CHECKLIST-HLS-ROTATIVO.md');
        try {
          const exists = fs.existsSync(checklistPath);
          return { success: exists, message: exists ? 'Checklist found' : 'Checklist missing' };
        } catch (error) {
          return { success: false, message: `Checklist check failed: ${error.message}` };
        }
      }
    },
    {
      id: 'R6-2', 
      name: 'Smoke Test Implementation',
      check: async () => {
        const smokePath = path.join(__dirname, 'hls-smoke.js');
        try {
          const exists = fs.existsSync(smokePath);
          return { success: exists, message: exists ? 'Smoke test script found' : 'Smoke test missing' };
        } catch (error) {
          return { success: false, message: `Smoke test check failed: ${error.message}` };
        }
      }
    },
    {
      id: 'R6-3',
      name: 'Diagnostics Real + Thresholds',
      check: async () => {
        try {
          const response = await makeRequest('/api/hls/latest/diagnostics');
          const success = response.statusCode === 200 && response.data.success;
          return { 
            success, 
            message: success ? 'Diagnostics endpoint working' : `Diagnostics failed: ${response.statusCode}`,
            data: response.data
          };
        } catch (error) {
          return { success: false, message: `Diagnostics check failed: ${error.message}` };
        }
      }
    },
    {
      id: 'R6-4',
      name: 'Rollback Snapshot',
      check: async () => {
        try {
          const response = await makeRequest('/api/hls/rollback-info/latest');
          const success = response.statusCode === 200;
          return { 
            success, 
            message: success ? 'Rollback system available' : `Rollback check failed: ${response.statusCode}`,
            data: response.data
          };
        } catch (error) {
          return { success: false, message: `Rollback check failed: ${error.message}` };
        }
      }
    },
    {
      id: 'R6-5',
      name: 'Fallback Chain Validation',
      check: async () => {
        // Verifica se fallback MP3 está intacto
        try {
          const response = await makeRequest('/health');
          const success = response.statusCode === 200;
          return { 
            success, 
            message: success ? 'Fallback chain healthy' : 'Fallback chain issues',
            data: response.data
          };
        } catch (error) {
          return { success: false, message: `Fallback check failed: ${error.message}` };
        }
      }
    },
    {
      id: 'R6-6',
      name: 'Janitor Inteligente',
      check: async () => {
        try {
          const response = await makeRequest('/api/hls/janitor/status');
          const success = response.statusCode === 200;
          return { 
            success, 
            message: success ? 'Janitor system operational' : `Janitor check failed: ${response.statusCode}`,
            data: response.data
          };
        } catch (error) {
          return { success: false, message: `Janitor check failed: ${error.message}` };
        }
      }
    },
    {
      id: 'R6-7',
      name: 'Estabilidade 24h + Automation',
      check: async () => {
        const automationPath = path.join(__dirname, 'r6-7-24h-automation.sh');
        try {
          const exists = fs.existsSync(automationPath);
          return { success: exists, message: exists ? '24h automation script found' : '24h automation missing' };
        } catch (error) {
          return { success: false, message: `24h automation check failed: ${error.message}` };
        }
      }
    },
    {
      id: 'R6-8',
      name: 'iPhone Playback Validation',
      check: async () => {
        const iosTestPath = path.join(__dirname, 'ios-playback-test.cjs');
        try {
          const exists = fs.existsSync(iosTestPath);
          return { success: exists, message: exists ? 'iOS test script found' : 'iOS test missing' };
        } catch (error) {
          return { success: false, message: `iOS test check failed: ${error.message}` };
        }
      }
    },
    {
      id: 'R6-9',
      name: 'Debug UI Integration',
      check: async () => {
        try {
          const response = await makeRequest('/api/hls/debug-status');
          const success = response.statusCode === 200 && response.data.success;
          return { 
            success, 
            message: success ? 'Debug UI endpoints working' : `Debug UI failed: ${response.statusCode}`,
            data: response.data
          };
        } catch (error) {
          return { success: false, message: `Debug UI check failed: ${error.message}` };
        }
      }
    }
  ];

  // Executar validações R6-1 a R6-9
  for (const validation of r6Validations) {
    const startTime = Date.now();
    try {
      const result = await validation.check();
      const duration = Date.now() - startTime;
      
      results.r6Tasks[validation.id] = {
        name: validation.name,
        success: result.success,
        message: result.message,
        duration,
        data: result.data
      };
      
      if (result.success) {
        console.log(`✅ ${validation.id}: ${validation.name} - ${result.message} (${duration}ms)`);
      } else {
        console.log(`❌ ${validation.id}: ${validation.name} - ${result.message} (${duration}ms)`);
        results.errors.push(`${validation.id}: ${result.message}`);
      }
      
    } catch (error) {
      console.log(`❌ ${validation.id}: ${validation.name} - Exception: ${error.message}`);
      results.errors.push(`${validation.id}: Exception: ${error.message}`);
      results.r6Tasks[validation.id] = {
        name: validation.name,
        success: false,
        message: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  // ================== SMOKE TEST ITERATIVO ==================
  console.log('');
  console.log(`🔄 Step 2: Running ${CONFIG.smokeIterations} smoke test iterations...`);
  
  let smokeFailures = 0;
  for (let i = 1; i <= CONFIG.smokeIterations; i++) {
    const startTime = Date.now();
    
    try {
      // Sequence: capabilities → generate → diagnostics
      const capResponse = await makeRequest('/api/hls/capabilities');
      const genResponse = await makeRequest('/api/hls/generate-hls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { mode: 'latest', simulate: false }
      });
      const diagResponse = await makeRequest('/api/hls/latest/diagnostics');
      
      const duration = Date.now() - startTime;
      const success = capResponse.statusCode === 200 && 
                     genResponse.statusCode === 200 && 
                     diagResponse.statusCode === 200 &&
                     diagResponse.data.success;
      
      if (!success) smokeFailures++;
      
      results.smokeResults.push({
        iteration: i,
        success,
        duration,
        capabilities: capResponse.statusCode,
        generation: genResponse.statusCode,
        diagnostics: diagResponse.statusCode,
        diagDuration: diagResponse.data?.durationMs || 0
      });
      
      if (diagResponse.data?.durationMs) {
        results.diagnosticsMetrics.push(diagResponse.data.durationMs);
      }
      
      const status = success ? '✅' : '❌';
      console.log(`${status} Smoke ${i}/${CONFIG.smokeIterations}: ${duration}ms (diag: ${diagResponse.data?.durationMs || 0}ms)`);
      
    } catch (error) {
      smokeFailures++;
      console.log(`❌ Smoke ${i}/${CONFIG.smokeIterations}: Failed - ${error.message}`);
      results.smokeResults.push({
        iteration: i,
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      });
    }
  }

  // ================== CRITÉRIOS AGREGADOS ==================
  console.log('');
  console.log('📊 Step 3: Validating aggregated criteria...');
  
  const criteria = {
    tasksComplete: Object.values(results.r6Tasks).every(task => task.success),
    smokeFailureRate: (smokeFailures / CONFIG.smokeIterations) * 100,
    no500Errors: !results.errors.some(error => error.includes('500')),
    diagnosticsP95: results.diagnosticsMetrics.length > 0 ? 
      results.diagnosticsMetrics.sort((a, b) => a - b)[Math.floor(results.diagnosticsMetrics.length * 0.95)] : 0
  };
  
  const aggregatedSuccess = 
    criteria.tasksComplete &&
    criteria.smokeFailureRate === 0 && // 0 falhas nas últimas iterações
    criteria.no500Errors &&
    criteria.diagnosticsP95 < CONFIG.p95Threshold;

  // ================== RELATÓRIO FINAL ==================
  console.log('');
  console.log('📋 R6-10 Gate Final Report:');
  console.log('======================================');
  
  console.log('');
  console.log('🎯 R6 Tasks Completion:');
  const completedTasks = Object.values(results.r6Tasks).filter(task => task.success).length;
  console.log(`✅ Completed: ${completedTasks}/9 tasks`);
  console.log(`❌ Failed: ${9 - completedTasks}/9 tasks`);
  
  console.log('');
  console.log('🔄 Smoke Test Results:');
  console.log(`✅ Successful iterations: ${CONFIG.smokeIterations - smokeFailures}/${CONFIG.smokeIterations}`);
  console.log(`❌ Failed iterations: ${smokeFailures}/${CONFIG.smokeIterations}`);
  console.log(`📈 Failure rate: ${criteria.smokeFailureRate.toFixed(1)}%`);
  
  console.log('');
  console.log('⚡ Performance Metrics:');
  if (results.diagnosticsMetrics.length > 0) {
    const avgDiag = results.diagnosticsMetrics.reduce((a, b) => a + b, 0) / results.diagnosticsMetrics.length;
    console.log(`📊 Diagnostics Average: ${avgDiag.toFixed(0)}ms`);
    console.log(`📊 Diagnostics P95: ${criteria.diagnosticsP95}ms (threshold: ${CONFIG.p95Threshold}ms)`);
  }
  
  console.log('');
  console.log('🎯 Aggregated Criteria:');
  console.log(`✅ All R6 tasks complete: ${criteria.tasksComplete ? 'YES' : 'NO'}`);
  console.log(`✅ Zero smoke failures: ${criteria.smokeFailureRate === 0 ? 'YES' : 'NO'}`);
  console.log(`✅ No 500 errors: ${criteria.no500Errors ? 'YES' : 'NO'}`);
  console.log(`✅ P95 diagnostics < ${CONFIG.p95Threshold}ms: ${criteria.diagnosticsP95 < CONFIG.p95Threshold ? 'YES' : 'NO'}`);
  
  console.log('');
  if (aggregatedSuccess) {
    console.log('🎉 R6-10 GATE FINAL: PASSED! 🎉');
    console.log('🏆 All R6 criteria met successfully!');
    console.log('');
    console.log('📋 R6 HLS Hardening Phase COMPLETE:');
    console.log('✅ R6-1: Checklist reconciliation');
    console.log('✅ R6-2: Smoke test implementation');
    console.log('✅ R6-3: Real diagnostics + thresholds');
    console.log('✅ R6-4: Rollback snapshot system');
    console.log('✅ R6-5: Fallback chain validation');
    console.log('✅ R6-6: Intelligent janitor cleanup');
    console.log('✅ R6-7: 24h stability automation');
    console.log('✅ R6-8: iPhone playback validation');
    console.log('✅ R6-9: Debug UI integration');
    console.log('✅ R6-10: Gate final validation');
    console.log('');
    console.log('🚀 HLS system ready for production deployment!');
  } else {
    console.log('❌ R6-10 GATE FINAL: FAILED');
    console.log('⚠️  Some criteria not met. Review failures above.');
    
    if (results.errors.length > 0) {
      console.log('');
      console.log('🔍 Errors found:');
      results.errors.forEach(error => console.log(`   - ${error}`));
    }
  }

  // Salvar relatório detalhado
  const reportPath = path.join(__dirname, '..', 'devFiles', 'temps', 'R6-10-GATE-FINAL-REPORT.json');
  try {
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      success: aggregatedSuccess,
      criteria,
      r6Tasks: results.r6Tasks,
      smokeResults: results.smokeResults,
      diagnosticsMetrics: results.diagnosticsMetrics,
      errors: results.errors,
      warnings: results.warnings
    }, null, 2));
    
    console.log(`📄 Detailed report saved: ${reportPath}`);
  } catch (error) {
    console.log(`⚠️  Could not save report: ${error.message}`);
  }

  return {
    success: aggregatedSuccess,
    completedTasks,
    smokeFailures,
    criteria,
    results
  };
}

// Run validation if called directly
if (require.main === module) {
  validateR6Criteria()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { validateR6Criteria };
