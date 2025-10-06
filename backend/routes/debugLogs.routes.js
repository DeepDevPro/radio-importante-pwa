/* Rotas de Debug Logs extraídas de app.js - Etapa 4.1 */
/* eslint-env node */
const path = require('path');
const fs = require('fs');
const express = require('express');
const { autoLogs } = require('../state/hlsState');

const router = express.Router();

// POST /api/debug-logs - receber logs do dispositivo
router.post('/api/debug-logs', (req, res) => {
  try {
    const { logs, device, userAgent, url, timestamp } = req.body;
    if (!logs) {
      return res.status(400).json({ error: 'Logs são obrigatórios' });
    }
    const logsDir = path.join(__dirname, '..', 'debug-logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const now = new Date();
    const filename = `debug-${device || 'unknown'}-${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}-${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}.txt`;
    const header = `=== LOGS DE DEBUG RADIO IMPORTANTE ===\nDispositivo: ${device || 'Desconhecido'}\nUser Agent: ${userAgent || 'N/A'}\nURL: ${url || 'N/A'}\nTimestamp Client: ${timestamp || 'N/A'}\nTimestamp Server: ${new Date().toISOString()}\nIP: ${req.ip || req.connection?.remoteAddress}\n\n==================== LOGS ====================\n`;
    const fullContent = header + logs;
    fs.writeFileSync(path.join(logsDir, filename), fullContent, 'utf8');
    console.log(`📱 [debug-logs] Logs salvos: ${filename} (${fullContent.length} chars)`);
    res.json({ success: true, message: 'Logs salvos com sucesso!', filename, downloadUrl: `/debug-logs/${filename}` });
  } catch (error) {
    console.error('❌ [debug-logs] Erro ao salvar logs:', error);
    res.status(500).json({ error: 'Erro interno ao salvar logs' });
  }
});

// GET /api/debug-logs - listar logs disponíveis
router.get('/api/debug-logs', (req, res) => {
  try {
    const logsDir = path.join(__dirname, '..', 'debug-logs');
    let files = [];
    if (fs.existsSync(logsDir)) {
      files = fs.readdirSync(logsDir)
        .filter(f => f.endsWith('.txt'))
        .map(f => {
          const fp = path.join(logsDir, f);
            const stats = fs.statSync(fp);
            return { filename: f, size: stats.size, created: stats.birthtime, modified: stats.mtime, downloadUrl: `/debug-logs/${f}` };
        })
        .sort((a, b) => b.created - a.created);
    }
    res.json({ logs: autoLogs, files });
  } catch (error) {
    console.error('❌ [debug-logs] Erro ao listar logs:', error);
    res.status(500).json({ error: 'Erro interno ao listar logs' });
  }
});

// GET /debug-logs/:filename - servir arquivo
router.get('/debug-logs/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '..', 'debug-logs', filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo de log não encontrado' });
    }
    res.set({ 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` });
    res.send(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error('❌ [debug-logs] Erro ao servir log:', error);
    res.status(500).json({ error: 'Erro interno ao servir log' });
  }
});

module.exports = router;
