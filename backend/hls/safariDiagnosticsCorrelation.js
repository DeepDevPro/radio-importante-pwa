// R5-11: Safari Diagnostics Correlation
// Correlacionar análise Safari com dados de diagnóstico HLS

/* eslint-env node */
/* eslint-disable no-unused-vars */
/* global require, module */

const { addHLSLog } = require('../state/hlsState');
const { diagnoseHlsPlaylist } = require('./hlsDiagnostics');

/**
 * R5-11: Correlaciona análise Safari com diagnósticos HLS
 * 
 * Identifica padrões específicos que podem causar freeze Safari:
 * - totalDurationApprox < 18s (duração insuficiente)
 * - Lacunas em EXTINF (segmentos ausentes)
 * - Problemas de network timing vs disponibilidade de segmentos
 * - Correlação entre User-Agent Safari e falhas específicas
 * 
 * @param {Object} safariAnalysis - Resultado da análise Safari
 * @param {string} playlistMode - Modo da playlist ('latest' ou 'rolling')
 * @returns {Object} Correlação Safari-Diagnostics
 */
async function correlateSafariDiagnostics(safariAnalysis, playlistMode = 'latest') {
  const correlation = {
    timestamp: new Date().toISOString(),
    playlistMode,
    safariAnalysis: {
      isSafari: safariAnalysis.safariSpecific?.isSafari || false,
      isIOS: safariAnalysis.safariSpecific?.isIOS || false,
      hypothesis: safariAnalysis.hypothesis || 'UNKNOWN',
      freezeDetected: safariAnalysis.freezeDetected || false,
      avgResponseTime: safariAnalysis.requestPattern?.averageResponseTime || 0
    },
    diagnostics: null,
    correlationFindings: [],
    riskFactors: [],
    safariSpecificIssues: [],
    recommendedActions: []
  };

  try {
    addHLSLog('SAFARI_CORRELATION', {
      action: 'start_correlation',
      playlistMode,
      safariHypothesis: safariAnalysis.hypothesis
    });

    // Executar diagnóstico HLS para obter dados técnicos
    const diagnosticsResult = await diagnoseHlsPlaylist(playlistMode, {
      timeout: 3000,
      cacheBust: true,
      probeSegments: true
    });

    correlation.diagnostics = {
      status: diagnosticsResult.status,
      declaredCount: diagnosticsResult.declaredCount,
      headOkCount: diagnosticsResult.headOkCount,
      totalDurationApprox: diagnosticsResult.totalDurationApprox,
      averageExtinf: diagnosticsResult.averageExtinf,
      hasEndlist: diagnosticsResult.hasEndlist
    };

    // Análise de correlação específica
    analyzeCorrelationPatterns(correlation);

    // Identificar fatores de risco Safari-específicos
    identifySafariRiskFactors(correlation);

    // Gerar recomendações baseadas nos achados
    generateSafariRecommendations(correlation);

    addHLSLog('SAFARI_CORRELATION', {
      action: 'correlation_complete',
      playlistMode,
      findingsCount: correlation.correlationFindings.length,
      riskFactorsCount: correlation.riskFactors.length,
      diagnosticsStatus: correlation.diagnostics.status
    });

    return correlation;

  } catch (error) {
    addHLSLog('SAFARI_CORRELATION', {
      action: 'correlation_error',
      error: error.message,
      playlistMode
    });

    correlation.error = error.message;
    correlation.correlationFindings.push({
      type: 'DIAGNOSTICS_FAILURE',
      severity: 'HIGH',
      description: `Failed to obtain diagnostics data: ${error.message}`,
      safariImpact: 'Cannot determine playlist health for Safari analysis'
    });

    return correlation;
  }
}

/**
 * Analisa padrões de correlação entre Safari e diagnósticos
 */
function analyzeCorrelationPatterns(correlation) {
  const { safariAnalysis, diagnostics } = correlation;

  // Padrão 1: Duração insuficiente (< 18s)
  if (diagnostics.totalDurationApprox && diagnostics.totalDurationApprox < 18) {
    correlation.correlationFindings.push({
      type: 'INSUFFICIENT_DURATION',
      severity: 'HIGH',
      description: `Playlist duration ${diagnostics.totalDurationApprox.toFixed(1)}s < 18s Safari minimum`,
      safariImpact: 'Safari may freeze waiting for more content',
      values: {
        actualDuration: diagnostics.totalDurationApprox,
        safariMinimum: 18,
        deficit: 18 - diagnostics.totalDurationApprox
      }
    });
  }

  // Padrão 2: Lacunas de segmentos
  if (diagnostics.declaredCount > 0 && diagnostics.headOkCount < diagnostics.declaredCount) {
    const missingSegments = diagnostics.declaredCount - diagnostics.headOkCount;
    const missingPercentage = (missingSegments / diagnostics.declaredCount) * 100;

    correlation.correlationFindings.push({
      type: 'SEGMENT_GAPS',
      severity: missingPercentage > 30 ? 'HIGH' : 'MEDIUM',
      description: `${missingSegments}/${diagnostics.declaredCount} segments missing (${missingPercentage.toFixed(1)}%)`,
      safariImpact: 'Safari may stall on missing segments',
      values: {
        declaredCount: diagnostics.declaredCount,
        availableCount: diagnostics.headOkCount,
        missingCount: missingSegments,
        missingPercentage
      }
    });
  }

  // Padrão 3: Inconsistência de duração EXTINF
  if (diagnostics.averageExtinf && (diagnostics.averageExtinf < 2 || diagnostics.averageExtinf > 15)) {
    correlation.correlationFindings.push({
      type: 'EXTINF_DURATION_ANOMALY',
      severity: 'MEDIUM',
      description: `Average EXTINF ${diagnostics.averageExtinf.toFixed(1)}s outside normal range (2-15s)`,
      safariImpact: 'Safari may have buffering strategy conflicts',
      values: {
        averageExtinf: diagnostics.averageExtinf,
        normalRange: [2, 15]
      }
    });
  }

  // Padrão 4: Playlist sem ENDLIST em modo latest
  if (correlation.playlistMode === 'latest' && !diagnostics.hasEndlist) {
    correlation.correlationFindings.push({
      type: 'MISSING_ENDLIST_LATEST',
      severity: 'HIGH',
      description: 'Latest playlist missing #EXT-X-ENDLIST tag',
      safariImpact: 'Safari may wait indefinitely for new segments',
      values: {
        hasEndlist: diagnostics.hasEndlist,
        expectedForMode: true
      }
    });
  }

  // Padrão 5: Network timing vs content availability
  if (safariAnalysis.avgResponseTime > 2000 && diagnostics.status === 'partial') {
    correlation.correlationFindings.push({
      type: 'SLOW_NETWORK_PARTIAL_CONTENT',
      severity: 'HIGH',
      description: `Slow network (${safariAnalysis.avgResponseTime}ms) + partial content availability`,
      safariImpact: 'Double penalty: slow loading + missing segments',
      values: {
        networkLatency: safariAnalysis.avgResponseTime,
        contentStatus: diagnostics.status
      }
    });
  }
}

/**
 * Identifica fatores de risco específicos do Safari
 */
function identifySafariRiskFactors(correlation) {
  const { safariAnalysis, diagnostics } = correlation;

  // Fator 1: iOS Safari com conteúdo limitado
  if (safariAnalysis.isIOS && diagnostics.totalDurationApprox < 30) {
    correlation.riskFactors.push({
      factor: 'IOS_LIMITED_CONTENT',
      description: 'iOS Safari with content < 30s may exhibit aggressive buffering',
      riskLevel: 'HIGH'
    });
  }

  // Fator 2: Mobile Safari com segmentos ausentes
  if (safariAnalysis.isIOS && diagnostics.status === 'partial') {
    correlation.riskFactors.push({
      factor: 'MOBILE_PARTIAL_CONTENT',
      description: 'Mobile Safari very sensitive to missing segments',
      riskLevel: 'HIGH'
    });
  }

  // Fator 3: Safari desktop com duração irregular
  if (safariAnalysis.isSafari && !safariAnalysis.isIOS && diagnostics.averageExtinf > 10) {
    correlation.riskFactors.push({
      factor: 'DESKTOP_SAFARI_LONG_SEGMENTS',
      description: 'Desktop Safari may have issues with segments > 10s',
      riskLevel: 'MEDIUM'
    });
  }

  // Fator 4: Hipótese Safari prévia correlacionada
  if (safariAnalysis.hypothesis === 'IOS_NETWORK_INTERRUPTION' && diagnostics.status !== 'ok') {
    correlation.riskFactors.push({
      factor: 'CONFIRMED_IOS_NETWORK_ISSUE',
      description: 'iOS network issues confirmed by diagnostics',
      riskLevel: 'HIGH'
    });
  }
}

/**
 * Gera recomendações baseadas na correlação
 */
function generateSafariRecommendations(correlation) {
  const { correlationFindings, riskFactors, diagnostics } = correlation;

  // Recomendação baseada em duração insuficiente
  const durationIssue = correlationFindings.find(f => f.type === 'INSUFFICIENT_DURATION');
  if (durationIssue) {
    correlation.recommendedActions.push({
      action: 'EXTEND_PLAYLIST_DURATION',
      priority: 'HIGH',
      description: 'Add more segments to reach minimum 18s for Safari compatibility',
      implementation: 'Increase segment count in VOD generation or rolling window size'
    });
  }

  // Recomendação baseada em segmentos ausentes
  const segmentGaps = correlationFindings.find(f => f.type === 'SEGMENT_GAPS');
  if (segmentGaps && segmentGaps.values.missingPercentage > 20) {
    correlation.recommendedActions.push({
      action: 'FIX_SEGMENT_AVAILABILITY',
      priority: 'HIGH',
      description: 'Resolve missing segments to prevent Safari stalls',
      implementation: 'Check FFmpeg generation process and upload atomicity'
    });
  }

  // Recomendação baseada em ENDLIST ausente
  const endlistIssue = correlationFindings.find(f => f.type === 'MISSING_ENDLIST_LATEST');
  if (endlistIssue) {
    correlation.recommendedActions.push({
      action: 'ADD_ENDLIST_TAG',
      priority: 'HIGH',
      description: 'Add #EXT-X-ENDLIST to latest playlist',
      implementation: 'Ensure VOD generation includes proper ENDLIST tag'
    });
  }

  // Recomendação para iOS específico
  const iosRisk = riskFactors.find(r => r.factor.includes('IOS'));
  if (iosRisk) {
    correlation.recommendedActions.push({
      action: 'IOS_SAFARI_OPTIMIZATION',
      priority: 'MEDIUM',
      description: 'Optimize for iOS Safari specific requirements',
      implementation: 'Consider shorter segments (4-6s) and ensure AAC audio codec'
    });
  }

  // Recomendação geral se múltiplos problemas
  if (correlationFindings.length >= 3) {
    correlation.recommendedActions.push({
      action: 'COMPREHENSIVE_HLS_AUDIT',
      priority: 'HIGH',
      description: 'Multiple issues detected - comprehensive HLS review needed',
      implementation: 'Review entire HLS generation pipeline and Safari testing'
    });
  }
}

/**
 * R5-11: Endpoint para correlação Safari-Diagnostics
 */
async function handleSafariCorrelationRequest(req, res) {
  try {
    const { 
      playlistMode = 'latest',
      safariAnalysis,
      userAgent = req.headers['user-agent'] || 'Unknown'
    } = req.body || {};

    if (!safariAnalysis) {
      return res.status(400).json({
        error: 'safariAnalysis data is required for correlation'
      });
    }

    const startTime = Date.now();

    const correlation = await correlateSafariDiagnostics(safariAnalysis, playlistMode);

    const durationMs = Date.now() - startTime;

    // Log compacto para RUN-LOG
    addHLSLog('SAFARI_CORRELATION_SUMMARY', {
      playlistMode,
      findingsCount: correlation.correlationFindings.length,
      riskFactorsCount: correlation.riskFactors.length,
      recommendationsCount: correlation.recommendedActions.length,
      diagnosticsStatus: correlation.diagnostics?.status || 'unknown',
      durationMs
    });

    res.json({
      success: true,
      correlation,
      durationMs
    });

  } catch (error) {
    addHLSLog('SAFARI_CORRELATION', {
      action: 'endpoint_error',
      error: error.message
    });

    res.status(500).json({
      error: 'Safari correlation failed',
      details: error.message
    });
  }
}

module.exports = {
  correlateSafariDiagnostics,
  analyzeCorrelationPatterns,
  identifySafariRiskFactors,
  generateSafariRecommendations,
  handleSafariCorrelationRequest
};
