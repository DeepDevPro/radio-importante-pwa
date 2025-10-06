/* eslint-env node */
/* eslint-disable no-undef */
// backend/routes/hlsGenerate.routes.js
// R3: Reexpor geração via script existente

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const { saveAutoLog } = require('../state/hlsState');

const router = express.Router();

/**
 * POST /api/generate-hls
 * Executa o script de geração HLS usando scripts/generate-hls.js
 */
router.post('/api/generate-hls', async (req, res) => {
  const startTime = Date.now();
  const { mode = 'latest' } = req.body;
  
  try {
    // Log início
    saveAutoLog(`HLS_GEN: Iniciando geração modo=${mode}`, {
      mode,
      timestamp: new Date().toISOString()
    });

    // Validar modo
    if (!['latest', 'rolling'].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: 'Mode deve ser "latest" ou "rolling"'
      });
    }

    const scriptPath = path.join(__dirname, '../../scripts/generate-hls.js');
    
    // Executar script sem argumentos (por enquanto gera para diretório padrão)
    const result = await executeHLSScript(scriptPath);
    
    const duration = Date.now() - startTime;
    
    // Log fim com sucesso
    saveAutoLog(`HLS_GEN: Concluído modo=${mode} em ${duration}ms`, {
      mode,
      duration,
      success: true,
      outputLines: result.outputLines
    });

    res.json({
      success: true,
      mode,
      duration,
      outputLines: result.outputLines.slice(-10), // Últimas 10 linhas
      message: `HLS ${mode} gerado com sucesso`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Log erro
    saveAutoLog(`HLS_GEN: ERRO modo=${mode} em ${duration}ms: ${error.message}`, {
      mode,
      duration,
      success: false,
      error: error.message,
      stderr: error.stderr
    });

    res.status(500).json({
      success: false,
      mode,
      error: error.message,
      stderr: error.stderr,
      duration
    });
  }
});

/**
 * Executa o script HLS com timeout de segurança
 */
function executeHLSScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const outputLines = [];
    const errorLines = [];
    
    // Executar script sem argumentos (por enquanto)
    const child = spawn('node', [scriptPath], {
      cwd: path.join(__dirname, '../..'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Timeout de segurança (300s)
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Timeout: script excedeu 300s`));
    }, 300000);

    // Capturar stdout
    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      outputLines.push(...lines);
    });

    // Capturar stderr
    child.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      errorLines.push(...lines);
    });

    // Conclusão
    child.on('close', (code) => {
      clearTimeout(timeout);
      
      if (code === 0) {
        resolve({
          outputLines,
          code
        });
      } else {
        reject({
          message: `Script terminou com código ${code}`,
          stderr: errorLines.join('\n'),
          stdout: outputLines.join('\n')
        });
      }
    });

    // Erro na execução
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject({
        message: `Erro ao executar script: ${error.message}`,
        stderr: error.message
      });
    });
  });
}

module.exports = router;
