/**
 * R6-9: Debug UI Integration Routes (Simplified)
 * 
 * Versão simplificada para testar importação
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/hls/debug-status
 * Status básico para teste
 */
router.get('/debug-status', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Debug UI routes are working',
      timestamp: Date.now(),
      version: '1.0.0'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/hls/debug-test
 * Endpoint de teste simples
 */
router.get('/debug-test', async (req, res) => {
  res.json({
    success: true,
    message: 'Debug test endpoint working',
    timestamp: Date.now()
  });
});

module.exports = router;
