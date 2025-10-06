#!/usr/bin/env node

/**
 * R6-7: Estabilidade 24h + Smoke Automation
 * 
 * Sistema de monitoramento contínuo que:
 * 1. Executa smoke test em intervalos (default: 30min)
 * 2. Agrega métricas: runs, passes, falhas, p95 diagnostics
 * 3. Gera relatórios JSON e Markdown
 * 4. Critério: <5% falhas em 48 execuções (24h)
 * 5. Alertas baseados em thresholds configuráveis
 */

/* eslint-env node */
/* eslint-disable no-undef */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
  intervalMinutes: parseInt(process.env.SMOKE_INTERVAL_MINUTES) || 30,
  maxDurationHours: parseInt(process.env.SMOKE_DURATION_HOURS) || 24,
  failureThresholdPercent: parseFloat(process.env.SMOKE_FAILURE_THRESHOLD) || 5.0,
  diagnosticsP95ThresholdMs: parseInt(process.env.DIAGNOSTICS_P95_THRESHOLD) || 3000,
  outputDir: process.env.SMOKE_OUTPUT_DIR || './devFiles/temps',
  smokeScript: process.env.SMOKE_SCRIPT || './scripts/hls-smoke.cjs',
  reportPrefix: 'smoke-24h-report',
  logLevel: process.env.SMOKE_LOG_LEVEL || 'info' // debug, info, warn, error
};

// State management
class SmokeAutomation {
  constructor() {
    this.runs = [];
    this.startTime = Date.now();
    this.isRunning = false;
    this.intervalId = null;
    this.currentRun = 0;
    this.maxRuns = Math.ceil((CONFIG.maxDurationHours * 60) / CONFIG.intervalMinutes);
  }

  log(level, message, data = null) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = levels[CONFIG.logLevel] || 1;
    
    if (levels[level] < configLevel) return;
    
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    console.log(logEntry);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  async executeSmokeTest() {
    const runId = `run-${this.currentRun + 1}`;
    const startTime = Date.now();
    
    this.log('info', `Executing smoke test ${runId} (${this.currentRun + 1}/${this.maxRuns})`);
    
    try {
      const result = await this.runSmokeScript();
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const runData = {
        runId,
        timestamp: new Date(startTime).toISOString(),
        startTime,
        endTime,
        durationMs: duration,
        success: result.success,
        exitCode: result.exitCode,
        output: result.output,
        error: result.error,
        metrics: this.parseMetrics(result.output),
        diagnostics: this.parseDiagnostics(result.output)
      };
      
      this.runs.push(runData);
      this.currentRun++;
      
      if (runData.success) {
        this.log('info', `Smoke test ${runId} PASSED (${duration}ms)`);
      } else {
        this.log('warn', `Smoke test ${runId} FAILED (${duration}ms)`, {
          exitCode: result.exitCode,
          error: result.error
        });
      }
      
      // Generate progress report
      await this.generateProgressReport();
      
      // Check if we should continue
      if (this.currentRun >= this.maxRuns) {
        this.log('info', 'Maximum runs reached, stopping automation');
        await this.stop();
      } else {
        const nextRunTime = new Date(Date.now() + (CONFIG.intervalMinutes * 60 * 1000));
        this.log('info', `Next run scheduled for: ${nextRunTime.toISOString()}`);
      }
      
    } catch (error) {
      this.log('error', `Smoke test execution failed: ${error.message}`, error);
      
      const runData = {
        runId,
        timestamp: new Date(startTime).toISOString(),
        startTime,
        endTime: Date.now(),
        durationMs: Date.now() - startTime,
        success: false,
        exitCode: -1,
        error: error.message,
        metrics: null,
        diagnostics: null
      };
      
      this.runs.push(runData);
      this.currentRun++;
    }
  }

  async runSmokeScript() {
    return new Promise((resolve) => {
      let output = '';
      let error = '';
      
      const child = spawn('node', [CONFIG.smokeScript], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: process.cwd()
      });
      
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      child.on('close', (code) => {
        resolve({
          success: code === 0,
          exitCode: code,
          output,
          error: error || null
        });
      });
      
      child.on('error', (err) => {
        resolve({
          success: false,
          exitCode: -1,
          output,
          error: err.message
        });
      });
      
      // Timeout after 10 minutes
      setTimeout(() => {
        child.kill('SIGTERM');
        resolve({
          success: false,
          exitCode: -2,
          output,
          error: 'Smoke test timeout (10 minutes)'
        });
      }, 10 * 60 * 1000);
    });
  }

  parseMetrics(output) {
    try {
      // Look for smoke test metrics in output
      const metricsMatch = output.match(/Total Duration: (\d+)ms/);
      const stagesMatch = output.match(/(\d+)\/(\d+) stages passed/);
      
      if (metricsMatch && stagesMatch) {
        return {
          totalDurationMs: parseInt(metricsMatch[1]),
          stagesPassed: parseInt(stagesMatch[1]),
          totalStages: parseInt(stagesMatch[2]),
          successRate: (parseInt(stagesMatch[1]) / parseInt(stagesMatch[2])) * 100
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  parseDiagnostics(output) {
    try {
      // Look for diagnostics timing in output
      const diagnosticsMatch = output.match(/Diagnostics.*?(\d+)ms/g);
      if (diagnosticsMatch) {
        const timings = diagnosticsMatch.map(match => {
          const timeMatch = match.match(/(\d+)ms/);
          return timeMatch ? parseInt(timeMatch[1]) : 0;
        }).filter(t => t > 0);
        
        if (timings.length > 0) {
          timings.sort((a, b) => a - b);
          const p95Index = Math.floor(timings.length * 0.95);
          return {
            count: timings.length,
            min: timings[0],
            max: timings[timings.length - 1],
            avg: Math.round(timings.reduce((a, b) => a + b, 0) / timings.length),
            p95: timings[p95Index] || timings[timings.length - 1]
          };
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  calculateStatistics() {
    const totalRuns = this.runs.length;
    const successfulRuns = this.runs.filter(r => r.success).length;
    const failedRuns = totalRuns - successfulRuns;
    const failureRate = totalRuns > 0 ? (failedRuns / totalRuns) * 100 : 0;
    
    const durations = this.runs.map(r => r.durationMs).filter(d => d > 0);
    const diagnostics = this.runs.map(r => r.diagnostics).filter(d => d !== null);
    
    // Duration statistics
    durations.sort((a, b) => a - b);
    const durationStats = durations.length > 0 ? {
      count: durations.length,
      min: durations[0],
      max: durations[durations.length - 1],
      avg: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      p95: durations[Math.floor(durations.length * 0.95)] || durations[durations.length - 1]
    } : null;
    
    // Diagnostics P95 aggregation
    const allDiagnosticsP95 = diagnostics.map(d => d.p95).filter(p => p > 0);
    allDiagnosticsP95.sort((a, b) => a - b);
    const overallDiagnosticsP95 = allDiagnosticsP95.length > 0 ? 
      allDiagnosticsP95[Math.floor(allDiagnosticsP95.length * 0.95)] || allDiagnosticsP95[allDiagnosticsP95.length - 1] : 0;
    
    return {
      totalRuns,
      successfulRuns,
      failedRuns,
      failureRate: Math.round(failureRate * 100) / 100,
      durationStats,
      diagnosticsP95: overallDiagnosticsP95,
      lastRuns: this.runs.slice(-10).map(r => ({
        runId: r.runId,
        timestamp: r.timestamp,
        success: r.success,
        durationMs: r.durationMs
      }))
    };
  }

  async generateProgressReport() {
    const stats = this.calculateStatistics();
    const elapsedHours = (Date.now() - this.startTime) / (1000 * 60 * 60);
    const progress = Math.min((this.currentRun / this.maxRuns) * 100, 100);
    
    const report = {
      metadata: {
        startTime: new Date(this.startTime).toISOString(),
        currentTime: new Date().toISOString(),
        elapsedHours: Math.round(elapsedHours * 100) / 100,
        progress: Math.round(progress * 100) / 100,
        remainingRuns: Math.max(0, this.maxRuns - this.currentRun),
        configuration: CONFIG
      },
      statistics: stats,
      criteria: {
        failureThresholdMet: stats.failureRate <= CONFIG.failureThresholdPercent,
        diagnosticsThresholdMet: stats.diagnosticsP95 <= CONFIG.diagnosticsP95ThresholdMs,
        minimumRunsCompleted: this.currentRun >= 10 // At least 10 runs for meaningful statistics
      },
      runs: this.runs
    };
    
    // Save JSON report
    const jsonPath = path.join(CONFIG.outputDir, `${CONFIG.reportPrefix}-progress.json`);
    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
    
    // Generate markdown summary
    await this.generateMarkdownSummary(report);
    
    // Log current status
    this.log('info', `Progress: ${progress.toFixed(1)}% | Runs: ${this.currentRun}/${this.maxRuns} | Failure Rate: ${stats.failureRate}% | Diagnostics P95: ${stats.diagnosticsP95}ms`);
    
    // Check thresholds and alert if needed
    if (stats.failureRate > CONFIG.failureThresholdPercent && this.currentRun >= 10) {
      this.log('warn', `⚠️  THRESHOLD EXCEEDED: Failure rate ${stats.failureRate}% > ${CONFIG.failureThresholdPercent}%`);
    }
    
    if (stats.diagnosticsP95 > CONFIG.diagnosticsP95ThresholdMs) {
      this.log('warn', `⚠️  THRESHOLD EXCEEDED: Diagnostics P95 ${stats.diagnosticsP95}ms > ${CONFIG.diagnosticsP95ThresholdMs}ms`);
    }
  }

  async generateMarkdownSummary(report) {
    const { metadata, statistics, criteria } = report;
    
    const markdown = `# Smoke Test 24h Automation Report

## 📊 Overview
- **Start Time**: ${metadata.startTime}
- **Current Time**: ${metadata.currentTime}
- **Elapsed**: ${metadata.elapsedHours}h
- **Progress**: ${metadata.progress}%
- **Runs Completed**: ${statistics.totalRuns}/${metadata.configuration.maxDurationHours * 2}

## ✅ Success Metrics
- **Total Runs**: ${statistics.totalRuns}
- **Successful**: ${statistics.successfulRuns}
- **Failed**: ${statistics.failedRuns}
- **Failure Rate**: ${statistics.failureRate}%
- **Diagnostics P95**: ${statistics.diagnosticsP95}ms

## 🎯 Criteria Status
- **Failure Rate < ${CONFIG.failureThresholdPercent}%**: ${criteria.failureThresholdMet ? '✅' : '❌'} (${statistics.failureRate}%)
- **Diagnostics P95 < ${CONFIG.diagnosticsP95ThresholdMs}ms**: ${criteria.diagnosticsThresholdMet ? '✅' : '❌'} (${statistics.diagnosticsP95}ms)
- **Minimum Runs**: ${criteria.minimumRunsCompleted ? '✅' : '❌'} (${statistics.totalRuns}/10)

## 📈 Performance Stats
${statistics.durationStats ? `
- **Avg Duration**: ${statistics.durationStats.avg}ms
- **Min Duration**: ${statistics.durationStats.min}ms
- **Max Duration**: ${statistics.durationStats.max}ms
- **P95 Duration**: ${statistics.durationStats.p95}ms
` : 'No duration data available'}

## 🕐 Recent Runs
${statistics.lastRuns.map(run => 
  `- **${run.runId}** (${run.timestamp}): ${run.success ? '✅' : '❌'} - ${run.durationMs}ms`
).join('\n')}

## ⚙️ Configuration
- **Interval**: ${metadata.configuration.intervalMinutes} minutes
- **Max Duration**: ${metadata.configuration.maxDurationHours} hours
- **Failure Threshold**: ${metadata.configuration.failureThresholdPercent}%
- **Diagnostics Threshold**: ${metadata.configuration.diagnosticsP95ThresholdMs}ms

---
*Generated at: ${metadata.currentTime}*
`;

    const markdownPath = path.join(CONFIG.outputDir, `${CONFIG.reportPrefix}-summary.md`);
    await fs.writeFile(markdownPath, markdown);
  }

  async start() {
    if (this.isRunning) {
      this.log('warn', 'Automation is already running');
      return;
    }

    this.isRunning = true;
    this.log('info', `Starting smoke automation: ${CONFIG.intervalMinutes}min intervals for ${CONFIG.maxDurationHours}h`);
    this.log('info', `Configuration: ${this.maxRuns} total runs, <${CONFIG.failureThresholdPercent}% failure threshold`);
    
    // Ensure output directory exists
    await fs.mkdir(CONFIG.outputDir, { recursive: true });
    
    // Run first test immediately
    await this.executeSmokeTest();
    
    // Schedule subsequent tests
    if (this.currentRun < this.maxRuns) {
      this.intervalId = setInterval(async () => {
        if (this.currentRun < this.maxRuns) {
          await this.executeSmokeTest();
        }
      }, CONFIG.intervalMinutes * 60 * 1000);
    }
  }

  async stop() {
    if (!this.isRunning) {
      this.log('warn', 'Automation is not running');
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.log('info', 'Stopping smoke automation...');
    
    // Generate final report
    await this.generateFinalReport();
    
    this.log('info', 'Smoke automation stopped');
    process.exit(0);
  }

  async generateFinalReport() {
    const stats = this.calculateStatistics();
    const totalDuration = Date.now() - this.startTime;
    
    const finalReport = {
      metadata: {
        testName: 'R6-7 Smoke Test 24h Automation',
        startTime: new Date(this.startTime).toISOString(),
        endTime: new Date().toISOString(),
        totalDurationMs: totalDuration,
        totalDurationHours: Math.round((totalDuration / (1000 * 60 * 60)) * 100) / 100,
        configuration: CONFIG,
        completed: this.currentRun >= this.maxRuns
      },
      results: {
        overallSuccess: stats.failureRate <= CONFIG.failureThresholdPercent,
        statistics: stats,
        criteria: {
          failureRateThresholdMet: stats.failureRate <= CONFIG.failureThresholdPercent,
          diagnosticsThresholdMet: stats.diagnosticsP95 <= CONFIG.diagnosticsP95ThresholdMs,
          minimumRunsCompleted: this.currentRun >= this.maxRuns * 0.9 // 90% completion threshold
        }
      },
      summary: {
        totalRuns: stats.totalRuns,
        successRate: Math.round((stats.successfulRuns / stats.totalRuns) * 10000) / 100,
        avgDuration: stats.durationStats?.avg || 0,
        diagnosticsP95: stats.diagnosticsP95
      },
      runs: this.runs
    };

    // Save final JSON report
    const finalJsonPath = path.join(CONFIG.outputDir, `${CONFIG.reportPrefix}-final-${Date.now()}.json`);
    await fs.writeFile(finalJsonPath, JSON.stringify(finalReport, null, 2));
    
    // Generate final markdown
    await this.generateFinalMarkdown(finalReport);
    
    this.log('info', `Final report saved: ${finalJsonPath}`);
    
    // Log summary
    this.log('info', '📊 FINAL RESULTS SUMMARY:');
    this.log('info', `Total Runs: ${finalReport.results.statistics.totalRuns}`);
    this.log('info', `Success Rate: ${finalReport.summary.successRate}%`);
    this.log('info', `Failure Rate: ${finalReport.results.statistics.failureRate}%`);
    this.log('info', `Diagnostics P95: ${finalReport.summary.diagnosticsP95}ms`);
    this.log('info', `Overall Success: ${finalReport.results.overallSuccess ? '✅' : '❌'}`);
  }

  async generateFinalMarkdown(report) {
    const markdown = `# 🏁 R6-7 Smoke Test 24h Automation - FINAL REPORT

## 📋 Test Summary
- **Test Name**: ${report.metadata.testName}
- **Duration**: ${report.metadata.totalDurationHours}h (${report.metadata.totalDurationMs}ms)
- **Start**: ${report.metadata.startTime}
- **End**: ${report.metadata.endTime}
- **Completion**: ${report.metadata.completed ? 'Complete' : 'Partial'}

## 🎯 Overall Result: ${report.results.overallSuccess ? '✅ PASSED' : '❌ FAILED'}

## 📊 Key Metrics
- **Total Runs**: ${report.summary.totalRuns}
- **Success Rate**: ${report.summary.successRate}%
- **Failure Rate**: ${report.results.statistics.failureRate}%
- **Average Duration**: ${report.summary.avgDuration}ms
- **Diagnostics P95**: ${report.summary.diagnosticsP95}ms

## ✅ Criteria Evaluation
| Criterion | Threshold | Actual | Status |
|-----------|-----------|--------|--------|
| Failure Rate | <${CONFIG.failureThresholdPercent}% | ${report.results.statistics.failureRate}% | ${report.results.criteria.failureRateThresholdMet ? '✅' : '❌'} |
| Diagnostics P95 | <${CONFIG.diagnosticsP95ThresholdMs}ms | ${report.summary.diagnosticsP95}ms | ${report.results.criteria.diagnosticsThresholdMet ? '✅' : '❌'} |
| Minimum Runs | 90% completion | ${((report.summary.totalRuns / CONFIG.maxDurationHours / 2) * 100).toFixed(1)}% | ${report.results.criteria.minimumRunsCompleted ? '✅' : '❌'} |

## 📈 Performance Analysis
${report.results.statistics.durationStats ? `
### Duration Statistics
- **Minimum**: ${report.results.statistics.durationStats.min}ms
- **Maximum**: ${report.results.statistics.durationStats.max}ms
- **Average**: ${report.results.statistics.durationStats.avg}ms
- **P95**: ${report.results.statistics.durationStats.p95}ms
- **Count**: ${report.results.statistics.durationStats.count} runs
` : ''}

### Reliability Metrics
- **Successful Runs**: ${report.results.statistics.successfulRuns}/${report.summary.totalRuns}
- **Failed Runs**: ${report.results.statistics.failedRuns}
- **Uptime**: ${report.summary.successRate}%

## 🔍 Detailed Results
${report.runs.slice(-20).map((run, i) => 
  `${i + 1}. **${run.runId}** (${new Date(run.timestamp).toLocaleString()}): ${run.success ? '✅' : '❌'} - ${run.durationMs}ms`
).join('\n')}

## ⚙️ Test Configuration
- **Interval**: ${report.metadata.configuration.intervalMinutes} minutes
- **Target Duration**: ${report.metadata.configuration.maxDurationHours} hours
- **Expected Runs**: ${CONFIG.maxDurationHours * 2}
- **Failure Threshold**: ${report.metadata.configuration.failureThresholdPercent}%
- **Diagnostics Threshold**: ${report.metadata.configuration.diagnosticsP95ThresholdMs}ms

## 📝 Conclusion
${report.results.overallSuccess ? 
  `✅ **SUCCESS**: System demonstrates excellent stability with ${report.summary.successRate}% success rate over ${report.metadata.totalDurationHours}h of continuous testing.` :
  `❌ **FAILURE**: System stability concerns detected. Review failed runs and performance metrics above.`}

---
*Final report generated at: ${report.metadata.endTime}*
*R6-7 Estabilidade 24h + Smoke Automation - Complete*
`;

    const finalMarkdownPath = path.join(CONFIG.outputDir, `${CONFIG.reportPrefix}-final-${Date.now()}.md`);
    await fs.writeFile(finalMarkdownPath, markdown);
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';
  
  const automation = new SmokeAutomation();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, stopping automation gracefully...');
    await automation.stop();
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, stopping automation gracefully...');
    await automation.stop();
  });
  
  switch (command) {
    case 'start':
      await automation.start();
      break;
    case 'stop':
      await automation.stop();
      break;
    case 'config':
      console.log('Configuration:');
      console.log(JSON.stringify(CONFIG, null, 2));
      break;
    default:
      console.log('Usage: node smoke-automation.cjs [start|stop|config]');
      console.log('Environment variables:');
      console.log('  SMOKE_INTERVAL_MINUTES=30');
      console.log('  SMOKE_DURATION_HOURS=24');
      console.log('  SMOKE_FAILURE_THRESHOLD=5.0');
      console.log('  DIAGNOSTICS_P95_THRESHOLD=3000');
      console.log('  SMOKE_OUTPUT_DIR=./devFiles/temps');
      console.log('  SMOKE_LOG_LEVEL=info');
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { SmokeAutomation, CONFIG };
