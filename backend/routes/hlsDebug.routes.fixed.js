/**
 * R6-9: Debug UI Integration Routes (Fixed)
 * 
 * Endpoints otimizados para Admin/Debug UI com cache em memória
 */

const express = require('express');

// Importações condicionais para evitar erros de carregamento
let debugDataCache, saveAutoLog;

try {
  debugDataCache = require('../hls/debugDataCache').debugDataCache;
} catch (error) {
  console.error('Warning: debugDataCache not loaded:', error.message);
  debugDataCache = {
    getDiagnostics: () => null,
    getHypothesis: () => null,
    updateDiagnostics: () => {},
    updateHypothesis: () => {},
    clear: () => {},
    getStats: () => ({ diagnostics: { available: [] }, hypothesis: { available: [] } })
  };
}

try {
  saveAutoLog = require('../state/hlsState').saveAutoLog;
} catch (error) {
  console.error('Warning: hlsState not loaded:', error.message);
  saveAutoLog = () => {};
}

const router = express.Router();

/**
 * GET /api/hls/debug-status
 * Retorna status do cache e estatísticas
 */
router.get('/debug-status', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const stats = debugDataCache.getStats();
    
    const response = {
      success: true,
      timestamp: Date.now(),
      cache: {
        status: 'active',
        ttl: process.env.DEBUG_CACHE_TTL || 300000
      },
      stats: stats,
      uptime: process.uptime ? process.uptime() : 0,
      duration: Date.now() - startTime
    };
    
    // Log automático
    saveAutoLog('debug-ui', 'debug-status', 'success', `Cache stats retrieved`, {
      diagnosticsCount: stats.diagnostics?.available?.length || 0,
      hypothesisCount: stats.hypothesis?.available?.length || 0
    });
    
    res.json(response);
    
  } catch (error) {
    const errorResponse = {
      success: false,
      error: error.message,
      timestamp: Date.now(),
      duration: Date.now() - startTime
    };
    
    saveAutoLog('debug-ui', 'debug-status', 'error', error.message);
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/hls/last-diagnostics
 * Retorna dados de diagnostics em cache para UI
 */
router.get('/last-diagnostics', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const mode = req.query.mode; // 'latest', 'rolling', ou undefined para todos
    const diagnostics = debugDataCache.getDiagnostics(mode);
    
    if (!diagnostics) {
      return res.status(404).json({
        success: false,
        error: 'No diagnostics data available in cache',
        message: 'Try running /api/hls/latest/diagnostics or /api/hls/rolling/diagnostics first',
        timestamp: Date.now(),
        duration: Date.now() - startTime
      });
    }
    
    const response = {
      success: true,
      timestamp: Date.now(),
      data: diagnostics,
      mode: mode || 'all',
      duration: Date.now() - startTime
    };
    
    saveAutoLog('debug-ui', 'last-diagnostics', 'success', `Retrieved ${mode || 'all'} diagnostics`);
    res.json(response);
    
  } catch (error) {
    const errorResponse = {
      success: false,
      error: error.message,
      timestamp: Date.now(),
      duration: Date.now() - startTime
    };
    
    saveAutoLog('debug-ui', 'last-diagnostics', 'error', error.message);
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/hls/last-hypothesis
 * Retorna dados de hypothesis em cache para UI
 */
router.get('/last-hypothesis', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const type = req.query.type; // 'safari', 'mobile', 'desktop', etc.
    const hypothesis = debugDataCache.getHypothesis(type);
    
    if (!hypothesis) {
      return res.status(404).json({
        success: false,
        error: 'No hypothesis data available in cache',
        message: 'Try running safari-hypothesis endpoint first',
        timestamp: Date.now(),
        duration: Date.now() - startTime
      });
    }
    
    const response = {
      success: true,
      timestamp: Date.now(),
      data: hypothesis,
      type: type || 'all',
      duration: Date.now() - startTime
    };
    
    saveAutoLog('debug-ui', 'last-hypothesis', 'success', `Retrieved ${type || 'all'} hypothesis`);
    res.json(response);
    
  } catch (error) {
    const errorResponse = {
      success: false,
      error: error.message,
      timestamp: Date.now(),
      duration: Date.now() - startTime
    };
    
    saveAutoLog('debug-ui', 'last-hypothesis', 'error', error.message);
    res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/hls/debug-refresh
 * Força refresh dos dados em cache
 */
router.post('/debug-refresh', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { mode } = req.body; // 'diagnostics', 'hypothesis', 'all'
    
    // Aqui podemos implementar refresh forçado se necessário
    // Por enquanto, apenas retornamos status
    
    const response = {
      success: true,
      message: 'Cache refresh requested',
      mode: mode || 'all',
      timestamp: Date.now(),
      duration: Date.now() - startTime
    };
    
    saveAutoLog('debug-ui', 'debug-refresh', 'success', `Cache refresh requested for ${mode || 'all'}`);
    res.json(response);
    
  } catch (error) {
    const errorResponse = {
      success: false,
      error: error.message,
      timestamp: Date.now(),
      duration: Date.now() - startTime
    };
    
    saveAutoLog('debug-ui', 'debug-refresh', 'error', error.message);
    res.status(500).json(errorResponse);
  }
});

/**
 * DELETE /api/hls/debug-cache
 * Limpa cache de debug
 */
router.delete('/debug-cache', async (req, res) => {
  const startTime = Date.now();
  
  try {
    debugDataCache.clear();
    
    const response = {
      success: true,
      message: 'Debug cache cleared successfully',
      timestamp: Date.now(),
      duration: Date.now() - startTime
    };
    
    saveAutoLog('debug-ui', 'debug-cache', 'success', 'Cache cleared');
    res.json(response);
    
  } catch (error) {
    const errorResponse = {
      success: false,
      error: error.message,
      timestamp: Date.now(),
      duration: Date.now() - startTime
    };
    
    saveAutoLog('debug-ui', 'debug-cache', 'error', error.message);
    res.status(500).json(errorResponse);
  }
});

module.exports = router;
