// R5-12: Safari Hypothesis Logger
// Registrar hipótese única no RUN-LOG baseada em análise Safari + correlação

/* eslint-env node */
/* global require, module, __dirname */

const { addHLSLog } = require('../state/hlsState');
const fs = require('fs').promises;
const path = require('path');

/**
 * R5-12: Safari Hypothesis Categories
 * Classificação final das hipóteses Safari baseada em análise + correlação
 */
const SAFARI_HYPOTHESIS_CATEGORIES = {
  MISSING_SEGMENTS: {
    code: 'MISSING_SEGMENTS',
    description: 'Segments declared in playlist but not available (404/timeout)',
    severity: 'HIGH',
    safariImpact: 'Safari stalls waiting for unavailable segments'
  },
  PLAYLIST_STALLED: {
    code: 'PLAYLIST_STALLED',
    description: 'Playlist content insufficient or growth pattern unclear',
    severity: 'HIGH', 
    safariImpact: 'Safari waits indefinitely for more content'
  },
  HEADER_CACHING: {
    code: 'HEADER_CACHING',
    description: 'Caching headers or CDN issues preventing proper playlist refresh',
    severity: 'MEDIUM',
    safariImpact: 'Safari uses stale playlist data'
  },
  PLAYER_STRATEGY_MISMATCH: {
    code: 'PLAYER_STRATEGY_MISMATCH',
    description: 'Safari HLS strategy conflicts with playlist structure',
    severity: 'MEDIUM',
    safariImpact: 'Safari buffering strategy incompatible with content'
  },
  NETWORK_INTERRUPTION: {
    code: 'NETWORK_INTERRUPTION',
    description: 'Network latency or connectivity issues during playback',
    severity: 'MEDIUM',
    safariImpact: 'Safari timeout waiting for slow network responses'
  },
  INSUFFICIENT_DURATION: {
    code: 'INSUFFICIENT_DURATION',
    description: 'Total playlist duration below Safari minimum requirements',
    severity: 'HIGH',
    safariImpact: 'Safari expects more content for stable playback'
  },
  UNKNOWN_PATTERN: {
    code: 'UNKNOWN_PATTERN',
    description: 'Safari issue not matching known patterns',
    severity: 'LOW',
    safariImpact: 'Requires further investigation'
  }
};

/**
 * R5-12: Determina hipótese única baseada em análise Safari + correlação
 * 
 * @param {Object} safariAnalysis - Resultado da análise Safari (R5-10)
 * @param {Object} correlation - Resultado da correlação (R5-11)
 * @returns {Object} Hipótese final consolidada
 */
function determineFinalHypothesis(safariAnalysis, correlation) {
  const hypothesis = {
    timestamp: new Date().toISOString(),
    category: 'UNKNOWN_PATTERN',
    confidence: 'LOW',
    evidence: [],
    recommendations: [],
    safariSpecific: {
      isSafari: safariAnalysis.safariSpecific?.isSafari || false,
      isIOS: safariAnalysis.safariSpecific?.isIOS || false,
      version: safariAnalysis.safariSpecific?.version || 'unknown'
    },
    diagnostics: {
      playlistMode: correlation.playlistMode || 'unknown',
      status: correlation.diagnostics?.status || 'unknown',
      duration: correlation.diagnostics?.totalDurationApprox || 0
    }
  };

  // Análise de evidências para determinar categoria principal
  const evidenceScore = {
    MISSING_SEGMENTS: 0,
    PLAYLIST_STALLED: 0,
    HEADER_CACHING: 0,
    PLAYER_STRATEGY_MISMATCH: 0,
    NETWORK_INTERRUPTION: 0,
    INSUFFICIENT_DURATION: 0
  };

  // Evidência 1: Segmentos ausentes
  const segmentGaps = correlation.correlationFindings?.find(f => f.type === 'SEGMENT_GAPS');
  if (segmentGaps) {
    evidenceScore.MISSING_SEGMENTS += 10;
    if (segmentGaps.values?.missingPercentage > 30) {
      evidenceScore.MISSING_SEGMENTS += 5;
    }
    hypothesis.evidence.push({
      type: 'SEGMENT_GAPS',
      description: segmentGaps.description,
      weight: 'HIGH'
    });
  }

  // Evidência 2: Duração insuficiente
  const durationIssue = correlation.correlationFindings?.find(f => f.type === 'INSUFFICIENT_DURATION');
  if (durationIssue) {
    evidenceScore.INSUFFICIENT_DURATION += 10;
    if (durationIssue.values?.deficit > 10) {
      evidenceScore.INSUFFICIENT_DURATION += 5;
    }
    hypothesis.evidence.push({
      type: 'INSUFFICIENT_DURATION',
      description: durationIssue.description,
      weight: 'HIGH'
    });
  }

  // Evidência 3: ENDLIST ausente em latest
  const endlistIssue = correlation.correlationFindings?.find(f => f.type === 'MISSING_ENDLIST_LATEST');
  if (endlistIssue) {
    evidenceScore.PLAYLIST_STALLED += 8;
    hypothesis.evidence.push({
      type: 'MISSING_ENDLIST',
      description: endlistIssue.description,
      weight: 'HIGH'
    });
  }

  // Evidência 4: Network lento + conteúdo parcial
  const networkIssue = correlation.correlationFindings?.find(f => f.type === 'SLOW_NETWORK_PARTIAL_CONTENT');
  if (networkIssue) {
    evidenceScore.NETWORK_INTERRUPTION += 8;
    evidenceScore.MISSING_SEGMENTS += 3;
    hypothesis.evidence.push({
      type: 'NETWORK_CONTENT_ISSUE',
      description: networkIssue.description,
      weight: 'HIGH'
    });
  }

  // Evidência 5: Safari hipótese prévia
  if (safariAnalysis.hypothesis) {
    switch (safariAnalysis.hypothesis) {
      case 'IOS_NETWORK_INTERRUPTION':
        evidenceScore.NETWORK_INTERRUPTION += 5;
        break;
      case 'HIGH_FAILURE_RATE':
        evidenceScore.MISSING_SEGMENTS += 3;
        break;
      case 'SLOW_NETWORK_RESPONSE':
        evidenceScore.NETWORK_INTERRUPTION += 3;
        break;
      case 'IOS_MOBILE_SAFARI_SPECIFIC':
        evidenceScore.PLAYER_STRATEGY_MISMATCH += 3;
        break;
    }
  }

  // Evidência 6: Anomalias de EXTINF
  const extinfoAnomaly = correlation.correlationFindings?.find(f => f.type === 'EXTINF_DURATION_ANOMALY');
  if (extinfoAnomaly) {
    evidenceScore.PLAYER_STRATEGY_MISMATCH += 6;
    hypothesis.evidence.push({
      type: 'EXTINF_ANOMALY',
      description: extinfoAnomaly.description,
      weight: 'MEDIUM'
    });
  }

  // Evidência 7: Fatores de risco iOS
  const iosRisks = correlation.riskFactors?.filter(r => r.factor.includes('IOS')) || [];
  if (iosRisks.length > 0) {
    evidenceScore.PLAYER_STRATEGY_MISMATCH += iosRisks.length * 2;
  }

  // Determinar categoria final baseada na pontuação
  const maxScore = Math.max(...Object.values(evidenceScore));
  if (maxScore > 0) {
    const winningCategory = Object.keys(evidenceScore).find(
      cat => evidenceScore[cat] === maxScore
    );
    hypothesis.category = winningCategory;
    
    // Determinar confiança baseada na pontuação
    if (maxScore >= 10) {
      hypothesis.confidence = 'HIGH';
    } else if (maxScore >= 5) {
      hypothesis.confidence = 'MEDIUM';
    } else {
      hypothesis.confidence = 'LOW';
    }
  }

  // Adicionar recomendações da categoria
  const categoryInfo = SAFARI_HYPOTHESIS_CATEGORIES[hypothesis.category];
  if (categoryInfo) {
    hypothesis.description = categoryInfo.description;
    hypothesis.severity = categoryInfo.severity;
    hypothesis.safariImpact = categoryInfo.safariImpact;
  }

  // Copiar recomendações da correlação
  hypothesis.recommendations = correlation.recommendedActions || [];

  return hypothesis;
}

/**
 * R5-12: Registra hipótese no RUN-LOG
 */
async function logHypothesisToRunLog(hypothesis) {
  const runLogPath = path.join(__dirname, '../../devFiles/temps/HLS-RUN-LOG.md');
  
  const logEntry = `
## Safari Hypothesis Entry - ${hypothesis.timestamp}

**Category:** ${hypothesis.category}  
**Confidence:** ${hypothesis.confidence}  
**Severity:** ${hypothesis.severity}  

**Description:** ${hypothesis.description}

**Safari Impact:** ${hypothesis.safariImpact}

**Safari Environment:**
- Browser: ${hypothesis.safariSpecific.isSafari ? 'Safari' : 'Non-Safari'}
- iOS: ${hypothesis.safariSpecific.isIOS}
- Version: ${hypothesis.safariSpecific.version}

**Playlist Diagnostics:**
- Mode: ${hypothesis.diagnostics.playlistMode}
- Status: ${hypothesis.diagnostics.status}
- Duration: ${hypothesis.diagnostics.duration}s

**Evidence (${hypothesis.evidence.length} items):**
${hypothesis.evidence.map(e => `- ${e.type}: ${e.description} (${e.weight})`).join('\n')}

**Recommendations (${hypothesis.recommendations.length} items):**
${hypothesis.recommendations.map(r => `- ${r.action}: ${r.description} (${r.priority})`).join('\n')}

---
`;

  try {
    // Append to RUN-LOG
    await fs.appendFile(runLogPath, logEntry, 'utf8');
    
    addHLSLog('SAFARI_HYPOTHESIS', {
      action: 'logged_to_runlog',
      category: hypothesis.category,
      confidence: hypothesis.confidence,
      evidenceCount: hypothesis.evidence.length,
      recommendationsCount: hypothesis.recommendations.length
    });

    return true;
  } catch (error) {
    addHLSLog('SAFARI_HYPOTHESIS', {
      action: 'runlog_error',
      error: error.message
    });
    return false;
  }
}

/**
 * R5-12: Processo completo de determinação e registro de hipótese
 */
async function processAndLogSafariHypothesis(safariAnalysis, correlation) {
  try {
    const startTime = Date.now();

    addHLSLog('SAFARI_HYPOTHESIS', {
      action: 'start_hypothesis_processing',
      safariHypothesis: safariAnalysis.hypothesis,
      correlationFindings: correlation.correlationFindings?.length || 0
    });

    // Determinar hipótese final
    const finalHypothesis = determineFinalHypothesis(safariAnalysis, correlation);

    // Registrar no RUN-LOG
    const logSuccess = await logHypothesisToRunLog(finalHypothesis);

    const durationMs = Date.now() - startTime;

    // Log compacto final
    addHLSLog('SAFARI_HYPOTHESIS_FINAL', {
      category: finalHypothesis.category,
      confidence: finalHypothesis.confidence,
      severity: finalHypothesis.severity,
      evidenceCount: finalHypothesis.evidence.length,
      recommendationsCount: finalHypothesis.recommendations.length,
      loggedToRunLog: logSuccess,
      durationMs
    });

    return {
      success: true,
      hypothesis: finalHypothesis,
      loggedToRunLog: logSuccess,
      durationMs
    };

  } catch (error) {
    addHLSLog('SAFARI_HYPOTHESIS', {
      action: 'processing_error',
      error: error.message
    });

    return {
      success: false,
      error: error.message,
      hypothesis: null
    };
  }
}

/**
 * R5-12: Endpoint para processar hipótese Safari completa
 */
async function handleSafariHypothesisRequest(req, res) {
  try {
    const { safariAnalysis, correlation } = req.body || {};

    if (!safariAnalysis || !correlation) {
      return res.status(400).json({
        error: 'Both safariAnalysis and correlation data are required'
      });
    }

    const result = await processAndLogSafariHypothesis(safariAnalysis, correlation);

    res.json(result);

  } catch (error) {
    addHLSLog('SAFARI_HYPOTHESIS', {
      action: 'endpoint_error',
      error: error.message
    });

    res.status(500).json({
      error: 'Safari hypothesis processing failed',
      details: error.message
    });
  }
}

/**
 * Get available Safari hypothesis categories
 */
function getSafariHypothesisCategories() {
  return SAFARI_HYPOTHESIS_CATEGORIES;
}

module.exports = {
  determineFinalHypothesis,
  logHypothesisToRunLog,
  processAndLogSafariHypothesis,
  handleSafariHypothesisRequest,
  getSafariHypothesisCategories,
  SAFARI_HYPOTHESIS_CATEGORIES
};
