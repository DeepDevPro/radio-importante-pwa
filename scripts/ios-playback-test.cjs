#!/usr/bin/env node

/**
 * R6-8: iPhone Playback Metrics Validation
 * 
 * Sistema especializado para validação de playback HLS em iOS:
 * 1. Testa playlist rolling em contextos específicos iOS
 * 2. Simula cenários lockscreen/background
 * 3. Coleta métricas: tFirstAudio, stallCount, longestGap, continuity
 * 4. Correlaciona com dados de diagnostics existentes
 * 5. Gera relatório específico para otimização iOS
 */

/* eslint-env node */
/* eslint-disable no-undef */

const https = require('https');
const fs = require('fs').promises;

// Configuration
const CONFIG = {
  baseUrl: process.env.HLS_BASE_URL || 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app',
  outputDir: process.env.IOS_METRICS_OUTPUT || './devFiles/temps',
  timeoutMs: parseInt(process.env.IOS_TIMEOUT_MS) || 20000,
  stallThresholdMs: parseInt(process.env.IOS_STALL_THRESHOLD) || 500,
  maxGapThresholdMs: parseInt(process.env.IOS_MAX_GAP_THRESHOLD) || 17000,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  reportPrefix: 'ios-playback-metrics'
};

// iOS-specific test scenarios
const IOS_SCENARIOS = {
  foreground: {
    name: 'Foreground Playback',
    description: 'Standard foreground HLS playback',
    timeout: 10000,
    expectedStalls: 0
  },
  background: {
    name: 'Background/Lockscreen',
    description: 'Simulated background/lockscreen scenario',
    timeout: 20000,
    expectedStalls: 1, // iOS may stall when switching to background
    backgroundDelay: 5000
  },
  networkSwitch: {
    name: 'Network Transition',
    description: 'Simulated network quality changes',
    timeout: 15000,
    expectedStalls: 2
  },
  segmentGaps: {
    name: 'Segment Gap Analysis',
    description: 'Analysis of gaps between segments',
    timeout: 12000,
    expectedStalls: 0
  }
};

class iOSPlaybackTester {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      scenarios: {},
      aggregatedMetrics: {},
      diagnosticsCorrelation: null,
      recommendations: []
    };
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  async fetchWithTimeout(url, options = {}, timeout = CONFIG.timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Request timeout: ${timeout}ms`));
      }, timeout);

      const req = https.request(url, {
        ...options,
        headers: {
          'User-Agent': CONFIG.userAgent,
          'Accept': 'application/vnd.apple.mpegurl,audio/mpegurl,application/x-mpegurl,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          ...options.headers
        }
      }, (res) => {
        clearTimeout(timeoutId);
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data,
            timing: {
              response: Date.now()
            }
          });
        });
      });

      req.on('error', (err) => {
        clearTimeout(timeoutId);
        reject(err);
      });

      req.end();
    });
  }

  async parsePlaylist(playlistContent) {
    const lines = playlistContent.split('\n').filter(line => line.trim());
    const segments = [];
    let targetDuration = 0;
    let totalDuration = 0;
    let hasEndlist = false;
    let mediaSequence = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('#EXT-X-TARGETDURATION:')) {
        targetDuration = parseInt(line.split(':')[1]);
      } else if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
        mediaSequence = parseInt(line.split(':')[1]);
      } else if (line.startsWith('#EXT-X-ENDLIST')) {
        hasEndlist = true;
      } else if (line.startsWith('#EXTINF:')) {
        const duration = parseFloat(line.split(':')[1].split(',')[0]);
        const segmentLine = lines[i + 1];
        if (segmentLine && !segmentLine.startsWith('#')) {
          segments.push({
            duration,
            filename: segmentLine.trim(),
            sequence: mediaSequence + segments.length
          });
          totalDuration += duration;
          i++; // Skip the segment line
        }
      }
    }

    return {
      segments,
      targetDuration,
      totalDuration,
      hasEndlist,
      mediaSequence,
      segmentCount: segments.length
    };
  }

  async testScenario(scenarioName, scenario) {
    const startTime = Date.now();
    this.log('info', `Testing scenario: ${scenario.name}`);
    
    const result = {
      scenario: scenarioName,
      name: scenario.name,
      description: scenario.description,
      startTime: startTime,
      endTime: null,
      success: false,
      metrics: {
        tFirstAudio: null,
        stallCount: 0,
        longestGap: 0,
        continuityOk: true,
        playlistLoadTime: 0,
        segmentLoadTimes: [],
        averageSegmentLoad: 0,
        bufferHealth: 'unknown'
      },
      errors: [],
      timeline: []
    };

    try {
      // Step 1: Load rolling playlist
      const playlistStart = Date.now();
      const playlistUrl = `${CONFIG.baseUrl}/hls/rolling/index.m3u8`;
      
      result.timeline.push({
        timestamp: Date.now() - startTime,
        event: 'playlist_request_start',
        url: playlistUrl
      });

      const playlistResponse = await this.fetchWithTimeout(playlistUrl, {}, scenario.timeout);
      const playlistLoadTime = Date.now() - playlistStart;
      result.metrics.playlistLoadTime = playlistLoadTime;

      result.timeline.push({
        timestamp: Date.now() - startTime,
        event: 'playlist_response',
        statusCode: playlistResponse.statusCode,
        loadTime: playlistLoadTime
      });

      if (playlistResponse.statusCode !== 200) {
        throw new Error(`Playlist failed: ${playlistResponse.statusCode}`);
      }

      // Step 2: Parse playlist
      const playlist = await this.parsePlaylist(playlistResponse.data);
      
      result.timeline.push({
        timestamp: Date.now() - startTime,
        event: 'playlist_parsed',
        segmentCount: playlist.segmentCount,
        totalDuration: playlist.totalDuration
      });

      if (playlist.segmentCount === 0) {
        throw new Error('No segments found in playlist');
      }

      // Step 3: Test segment loading with iOS-specific patterns
      const segmentTests = await this.testSegmentLoading(playlist, scenario, startTime, result);
      
      // Step 4: Calculate metrics
      result.metrics = {
        ...result.metrics,
        ...segmentTests.metrics
      };

      // Step 5: Scenario-specific tests
      await this.runScenarioSpecificTests(scenarioName, playlist, result, startTime);

      result.success = result.errors.length === 0 && result.metrics.continuityOk;
      
    } catch (error) {
      result.errors.push({
        timestamp: Date.now() - startTime,
        error: error.message,
        type: 'scenario_failure'
      });
      this.log('error', `Scenario ${scenarioName} failed: ${error.message}`);
    }

    result.endTime = Date.now();
    result.totalDuration = result.endTime - startTime;
    
    this.log('info', `Scenario ${scenarioName} completed: ${result.success ? 'SUCCESS' : 'FAILED'} (${result.totalDuration}ms)`);
    
    return result;
  }

  async testSegmentLoading(playlist, scenario, testStartTime, result) {
    const segmentLoadTimes = [];
    let stallCount = 0;
    let longestGap = 0;
    let tFirstAudio = null;
    let lastSegmentTime = Date.now();

    // Test first 3 segments for initial buffering
    const segmentsToTest = Math.min(3, playlist.segments.length);
    
    for (let i = 0; i < segmentsToTest; i++) {
      const segment = playlist.segments[i];
      const segmentStart = Date.now();
      
      result.timeline.push({
        timestamp: segmentStart - testStartTime,
        event: 'segment_request_start',
        segment: segment.filename,
        sequence: segment.sequence
      });

      try {
        const segmentUrl = `${CONFIG.baseUrl}/hls/rolling/${segment.filename}`;
        const segmentResponse = await this.fetchWithTimeout(segmentUrl, {
          method: 'HEAD' // HEAD request to test availability without full download
        }, 8000);

        const segmentLoadTime = Date.now() - segmentStart;
        segmentLoadTimes.push(segmentLoadTime);

        // Calculate gap between segments
        const gap = segmentStart - lastSegmentTime;
        if (gap > longestGap) {
          longestGap = gap;
        }

        // Check for stalls (long load times)
        if (segmentLoadTime > CONFIG.stallThresholdMs) {
          stallCount++;
          result.timeline.push({
            timestamp: Date.now() - testStartTime,
            event: 'stall_detected',
            segmentLoadTime,
            threshold: CONFIG.stallThresholdMs
          });
        }

        // First audio timing (simulate)
        if (i === 0 && segmentResponse.statusCode === 200) {
          tFirstAudio = segmentLoadTime + (segment.duration * 1000 * 0.1); // Estimate decode time
        }

        result.timeline.push({
          timestamp: Date.now() - testStartTime,
          event: 'segment_response',
          segment: segment.filename,
          statusCode: segmentResponse.statusCode,
          loadTime: segmentLoadTime,
          gap: gap
        });

        lastSegmentTime = Date.now();

      } catch (error) {
        stallCount++;
        result.errors.push({
          timestamp: Date.now() - testStartTime,
          error: `Segment ${segment.filename}: ${error.message}`,
          type: 'segment_failure'
        });
      }
    }

    const averageSegmentLoad = segmentLoadTimes.length > 0 ? 
      segmentLoadTimes.reduce((a, b) => a + b, 0) / segmentLoadTimes.length : 0;

    return {
      metrics: {
        tFirstAudio,
        stallCount,
        longestGap,
        segmentLoadTimes,
        averageSegmentLoad,
        continuityOk: stallCount <= scenario.expectedStalls && longestGap < CONFIG.maxGapThresholdMs
      }
    };
  }

  async runScenarioSpecificTests(scenarioName, playlist, result, startTime) {
    switch (scenarioName) {
      case 'background':
        await this.testBackgroundScenario(playlist, result, startTime);
        break;
      case 'networkSwitch':
        await this.testNetworkSwitchScenario(playlist, result, startTime);
        break;
      case 'segmentGaps':
        await this.testSegmentGapsScenario(playlist, result, startTime);
        break;
      default:
        // Foreground test - already covered in main test
        break;
    }
  }

  async testBackgroundScenario(playlist, result, startTime) {
    // Simulate iOS background behavior
    const backgroundStart = Date.now();
    
    result.timeline.push({
      timestamp: backgroundStart - startTime,
      event: 'background_simulation_start',
      description: 'Simulating iOS background/lockscreen behavior'
    });

    // Wait for background delay
    await new Promise(resolve => setTimeout(resolve, IOS_SCENARIOS.background.backgroundDelay));

    // Test if playlist is still accessible (iOS may pause requests)
    try {
      const playlistUrl = `${CONFIG.baseUrl}/hls/rolling/index.m3u8`;
      const response = await this.fetchWithTimeout(playlistUrl, {}, 5000);
      
      result.timeline.push({
        timestamp: Date.now() - startTime,
        event: 'background_playlist_check',
        statusCode: response.statusCode,
        accessible: response.statusCode === 200
      });

      if (response.statusCode !== 200) {
        result.errors.push({
          timestamp: Date.now() - startTime,
          error: 'Playlist not accessible during background simulation',
          type: 'background_failure'
        });
      }
    } catch (error) {
      result.errors.push({
        timestamp: Date.now() - startTime,
        error: `Background test failed: ${error.message}`,
        type: 'background_failure'
      });
    }
  }

  async testNetworkSwitchScenario(playlist, result, startTime) {
    // Simulate network quality changes by testing with different timeouts
    const networkConditions = [
      { name: 'fast', timeout: 2000 },
      { name: 'slow', timeout: 8000 },
      { name: 'fast', timeout: 2000 }
    ];

    for (let i = 0; i < networkConditions.length && i < playlist.segments.length; i++) {
      const condition = networkConditions[i];
      const segment = playlist.segments[i];
      
      result.timeline.push({
        timestamp: Date.now() - startTime,
        event: 'network_condition_change',
        condition: condition.name,
        timeout: condition.timeout
      });

      try {
        const segmentUrl = `${CONFIG.baseUrl}/hls/rolling/${segment.filename}`;
        const segmentStart = Date.now();
        await this.fetchWithTimeout(segmentUrl, { method: 'HEAD' }, condition.timeout);
        
        const loadTime = Date.now() - segmentStart;
        result.timeline.push({
          timestamp: Date.now() - startTime,
          event: 'network_segment_test',
          condition: condition.name,
          loadTime,
          success: true
        });

      } catch (error) {
        result.timeline.push({
          timestamp: Date.now() - startTime,
          event: 'network_segment_test',
          condition: condition.name,
          error: error.message,
          success: false
        });
      }
    }
  }

  async testSegmentGapsScenario(playlist, result, startTime) {
    // Analyze timing gaps between segments in detail
    let previousRequestTime = Date.now();
    const gaps = [];

    for (let i = 0; i < Math.min(playlist.segments.length, 5); i++) {
      const segment = playlist.segments[i];
      const requestTime = Date.now();
      const gap = requestTime - previousRequestTime;
      gaps.push(gap);

      result.timeline.push({
        timestamp: requestTime - startTime,
        event: 'gap_measurement',
        segment: segment.filename,
        gap,
        expectedDuration: segment.duration * 1000
      });

      // Quick HEAD request
      try {
        const segmentUrl = `${CONFIG.baseUrl}/hls/rolling/${segment.filename}`;
        await this.fetchWithTimeout(segmentUrl, { method: 'HEAD' }, 3000);
      } catch {
        // Gap analysis continues even if segment fails
      }

      previousRequestTime = Date.now();
      
      // Wait for expected segment duration (simulating real playback)
      await new Promise(resolve => setTimeout(resolve, Math.min(segment.duration * 1000, 2000)));
    }

    // Analyze gap patterns
    const averageGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
    const maxGap = gaps.length > 0 ? Math.max(...gaps) : 0;
    
    result.metrics.gapAnalysis = {
      averageGap,
      maxGap,
      gaps,
      gapConsistency: maxGap / averageGap < 3 // Consistent if max is less than 3x average
    };

    result.timeline.push({
      timestamp: Date.now() - startTime,
      event: 'gap_analysis_complete',
      averageGap,
      maxGap,
      consistent: result.metrics.gapAnalysis.gapConsistency
    });
  }

  async fetchDiagnosticsData() {
    try {
      const diagnosticsUrl = `${CONFIG.baseUrl}/api/hls/rolling/diagnostics`;
      this.log('info', 'Fetching diagnostics data for correlation');
      
      const response = await this.fetchWithTimeout(diagnosticsUrl, {}, 10000);
      
      if (response.statusCode === 200) {
        const diagnostics = JSON.parse(response.data);
        this.log('info', 'Diagnostics data fetched successfully');
        return diagnostics;
      } else {
        this.log('warn', `Diagnostics fetch failed: ${response.statusCode}`);
        return null;
      }
    } catch (error) {
      this.log('warn', `Could not fetch diagnostics: ${error.message}`);
      return null;
    }
  }

  calculateAggregatedMetrics() {
    const allScenarios = Object.values(this.results.scenarios);
    const successful = allScenarios.filter(s => s.success);
    
    if (successful.length === 0) {
      return {
        overallSuccess: false,
        errorSummary: 'All scenarios failed'
      };
    }

    // Aggregate metrics across successful scenarios
    const allFirstAudio = successful.map(s => s.metrics.tFirstAudio).filter(t => t !== null);
    const allStallCounts = successful.map(s => s.metrics.stallCount);
    const allLongestGaps = successful.map(s => s.metrics.longestGap);
    const allSegmentLoads = successful.flatMap(s => s.metrics.segmentLoadTimes);

    const avgFirstAudio = allFirstAudio.length > 0 ? 
      allFirstAudio.reduce((a, b) => a + b, 0) / allFirstAudio.length : null;
    
    const totalStalls = allStallCounts.reduce((a, b) => a + b, 0);
    const maxGap = allLongestGaps.length > 0 ? Math.max(...allLongestGaps) : 0;
    const avgSegmentLoad = allSegmentLoads.length > 0 ? 
      allSegmentLoads.reduce((a, b) => a + b, 0) / allSegmentLoads.length : 0;

    return {
      overallSuccess: successful.length === allScenarios.length,
      successRate: (successful.length / allScenarios.length) * 100,
      avgFirstAudio: Math.round(avgFirstAudio || 0),
      totalStalls,
      maxGap: Math.round(maxGap),
      avgSegmentLoad: Math.round(avgSegmentLoad),
      scenarioCount: allScenarios.length,
      successfulScenarios: successful.length,
      iOSCompatibility: this.assessiOSCompatibility(avgFirstAudio, totalStalls, maxGap)
    };
  }

  assessiOSCompatibility(avgFirstAudio, totalStalls, maxGap) {
    const issues = [];
    const recommendations = [];

    // iOS-specific thresholds
    if (avgFirstAudio > 3000) {
      issues.push('Slow first audio (>3s)');
      recommendations.push('Consider reducing segment duration or improving transcoding');
    }

    if (totalStalls > 2) {
      issues.push('Multiple stalls detected');
      recommendations.push('Review network timeout settings and segment availability');
    }

    if (maxGap > CONFIG.maxGapThresholdMs) {
      issues.push(`Long gaps detected (>${CONFIG.maxGapThresholdMs}ms)`);
      recommendations.push('Optimize segment publishing pipeline');
    }

    const compatibility = issues.length === 0 ? 'excellent' : 
                         issues.length <= 1 ? 'good' : 
                         issues.length <= 2 ? 'fair' : 'poor';

    return {
      rating: compatibility,
      issues,
      recommendations
    };
  }

  generateRecommendations() {
    const aggregated = this.results.aggregatedMetrics;
    const diagnostics = this.results.diagnosticsCorrelation;
    const recommendations = [];

    // Based on aggregated metrics
    if (aggregated.avgFirstAudio > 2000) {
      recommendations.push({
        category: 'Performance',
        issue: 'Slow first audio response',
        recommendation: 'Reduce initial segment duration or implement segment pre-loading',
        priority: 'high'
      });
    }

    if (aggregated.totalStalls > 1) {
      recommendations.push({
        category: 'Stability',
        issue: 'Multiple playback stalls',
        recommendation: 'Review segment generation timing and network error handling',
        priority: 'medium'
      });
    }

    // Correlate with diagnostics if available
    if (diagnostics && diagnostics.status === 'ok') {
      if (diagnostics.averageExtinf > 7000) {
        recommendations.push({
          category: 'iOS Optimization',
          issue: 'Long segment duration may cause iOS buffering issues',
          recommendation: 'Consider 6-second segments for better iOS compatibility',
          priority: 'medium'
        });
      }
    }

    if (aggregated.maxGap > 10000) {
      recommendations.push({
        category: 'Real-time Performance',
        issue: 'Large gaps between segment requests',
        recommendation: 'Implement segment pre-fetching or improve rolling update frequency',
        priority: 'high'
      });
    }

    this.results.recommendations = recommendations;
    return recommendations;
  }

  async generateReport() {
    const reportData = {
      metadata: {
        testName: 'R6-8 iPhone Playback Metrics Validation',
        timestamp: this.results.timestamp,
        config: CONFIG,
        userAgent: CONFIG.userAgent
      },
      results: this.results,
      summary: {
        overallSuccess: this.results.aggregatedMetrics.overallSuccess,
        iOSCompatibility: this.results.aggregatedMetrics.iOSCompatibility,
        keyMetrics: {
          avgFirstAudio: this.results.aggregatedMetrics.avgFirstAudio,
          totalStalls: this.results.aggregatedMetrics.totalStalls,
          maxGap: this.results.aggregatedMetrics.maxGap,
          successRate: this.results.aggregatedMetrics.successRate
        }
      }
    };

    // Save JSON report
    const jsonPath = `${CONFIG.outputDir}/${CONFIG.reportPrefix}-${Date.now()}.json`;
    await fs.writeFile(jsonPath, JSON.stringify(reportData, null, 2));

    // Generate markdown report
    const markdownPath = await this.generateMarkdownReport(reportData);

    this.log('info', `Reports generated: ${jsonPath}, ${markdownPath}`);
    
    return { jsonPath, markdownPath, reportData };
  }

  async generateMarkdownReport(reportData) {
    const { results, summary } = reportData;
    const scenarios = Object.values(results.scenarios);
    
    const markdown = `# 📱 R6-8 iPhone Playback Metrics Report

## 📋 Test Summary
- **Test Date**: ${results.timestamp}
- **User Agent**: iOS 17.0 Mobile Safari
- **Scenarios Tested**: ${scenarios.length}
- **Overall Success**: ${summary.overallSuccess ? '✅' : '❌'}

## 🎯 iOS Compatibility: ${summary.iOSCompatibility.rating.toUpperCase()}

### Key Metrics
| Metric | Value | Status |
|--------|-------|--------|
| **Avg First Audio** | ${summary.keyMetrics.avgFirstAudio}ms | ${summary.keyMetrics.avgFirstAudio < 3000 ? '✅' : '⚠️'} |
| **Total Stalls** | ${summary.keyMetrics.totalStalls} | ${summary.keyMetrics.totalStalls <= 2 ? '✅' : '⚠️'} |
| **Max Gap** | ${summary.keyMetrics.maxGap}ms | ${summary.keyMetrics.maxGap < CONFIG.maxGapThresholdMs ? '✅' : '⚠️'} |
| **Success Rate** | ${summary.keyMetrics.successRate.toFixed(1)}% | ${summary.keyMetrics.successRate >= 75 ? '✅' : '⚠️'} |

## 📊 Scenario Results

${scenarios.map(scenario => `
### ${scenario.name}
- **Status**: ${scenario.success ? '✅ PASSED' : '❌ FAILED'}
- **Duration**: ${scenario.totalDuration}ms
- **First Audio**: ${scenario.metrics.tFirstAudio || 'N/A'}ms
- **Stalls**: ${scenario.metrics.stallCount}
- **Longest Gap**: ${scenario.metrics.longestGap}ms
- **Continuity**: ${scenario.metrics.continuityOk ? '✅' : '❌'}
${scenario.errors.length > 0 ? `- **Errors**: ${scenario.errors.length}` : ''}
`).join('\n')}

## 🔍 Diagnostics Correlation
${results.diagnosticsCorrelation ? `
- **Status**: ${results.diagnosticsCorrelation.status}
- **Segment Count**: ${results.diagnosticsCorrelation.declaredCount}
- **Total Duration**: ${results.diagnosticsCorrelation.totalDurationApprox}ms
- **Average EXTINF**: ${results.diagnosticsCorrelation.averageExtinf}ms
` : '⚠️ Diagnostics data not available'}

## 💡 Recommendations

${results.recommendations.map((rec, i) => `
### ${i + 1}. ${rec.category} - ${rec.priority.toUpperCase()} Priority
**Issue**: ${rec.issue}  
**Recommendation**: ${rec.recommendation}
`).join('\n')}

## 📈 Detailed Timeline
${scenarios.length > 0 ? `
### Most Recent Test: ${scenarios[scenarios.length - 1].name}
${scenarios[scenarios.length - 1].timeline.slice(0, 10).map(event => 
  `- **${event.timestamp}ms**: ${event.event}${event.loadTime ? ` (${event.loadTime}ms)` : ''}`
).join('\n')}
` : ''}

## ⚙️ Test Configuration
- **Base URL**: ${CONFIG.baseUrl}
- **Timeout**: ${CONFIG.timeoutMs}ms
- **Stall Threshold**: ${CONFIG.stallThresholdMs}ms
- **Max Gap Threshold**: ${CONFIG.maxGapThresholdMs}ms

---
*Generated at: ${new Date().toISOString()}*  
*R6-8 iPhone Playback Metrics Validation Complete*
`;

    const markdownPath = `${CONFIG.outputDir}/${CONFIG.reportPrefix}-${Date.now()}.md`;
    await fs.writeFile(markdownPath, markdown);
    
    return markdownPath;
  }

  async runAllTests() {
    this.log('info', 'Starting R6-8 iPhone Playback Metrics Validation');
    
    // Ensure output directory exists
    await fs.mkdir(CONFIG.outputDir, { recursive: true });

    // Fetch diagnostics data for correlation
    this.results.diagnosticsCorrelation = await this.fetchDiagnosticsData();

    // Run all scenarios
    for (const [scenarioName, scenario] of Object.entries(IOS_SCENARIOS)) {
      this.results.scenarios[scenarioName] = await this.testScenario(scenarioName, scenario);
      
      // Small delay between scenarios
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Calculate aggregated metrics
    this.results.aggregatedMetrics = this.calculateAggregatedMetrics();

    // Generate recommendations
    this.generateRecommendations();

    // Generate reports
    const report = await this.generateReport();

    // Log summary
    this.log('info', '📊 R6-8 TEST SUMMARY:');
    this.log('info', `Overall Success: ${this.results.aggregatedMetrics.overallSuccess ? '✅' : '❌'}`);
    this.log('info', `iOS Compatibility: ${this.results.aggregatedMetrics.iOSCompatibility.rating}`);
    this.log('info', `Success Rate: ${this.results.aggregatedMetrics.successRate.toFixed(1)}%`);
    this.log('info', `Avg First Audio: ${this.results.aggregatedMetrics.avgFirstAudio}ms`);
    this.log('info', `Total Stalls: ${this.results.aggregatedMetrics.totalStalls}`);
    this.log('info', `Recommendations: ${this.results.recommendations.length}`);

    return {
      success: this.results.aggregatedMetrics.overallSuccess,
      results: this.results,
      report
    };
  }
}

// CLI Interface
async function main() {
  const tester = new iOSPlaybackTester();
  
  try {
    const result = await tester.runAllTests();
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { iOSPlaybackTester, CONFIG, IOS_SCENARIOS };
