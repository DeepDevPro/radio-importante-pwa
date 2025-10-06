// Estado dos jobs HLS e sistema de logging
// Extraído de app.js para facilitar manutenção
/* eslint-env node */

// Array em memória para logs automaticos (max 100 entradas)
let autoLogs = [];
const MAX_AUTO_LOGS = 100;

function saveAutoLog(param1, param2 = 'info') {
  // R5-0: Robust parameter normalization for saveAutoLog
  // Supports both (message, type) and (type, message) call patterns
  
  let message, type;
  
  // Known type patterns - extend as needed
  const KNOWN_TYPES = ['info', 'error', 'warn', 'debug', 'HLS_GEN', 'HLS_PROXY', 'HLS_DIAG'];
  
  // Normalize parameters based on patterns
  if (KNOWN_TYPES.includes(param1)) {
    // Pattern: saveAutoLog('HLS_GEN', 'message content')
    type = param1;
    message = param2 || 'Unknown message';
  } else if (KNOWN_TYPES.includes(param2)) {
    // Pattern: saveAutoLog('message content', 'HLS_GEN')
    message = param1 || 'Unknown message';
    type = param2;
  } else {
    // Default pattern: saveAutoLog('message content', 'info')
    message = param1 || 'Unknown message';
    type = param2 || 'info';
  }
  
  // Ensure both are strings
  message = String(message);
  type = String(type);
  
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, type, message };
  
  // Adicionar ao array
  autoLogs.unshift(logEntry);
  
  // Manter apenas os últimos 100 logs
  if (autoLogs.length > MAX_AUTO_LOGS) {
    autoLogs = autoLogs.slice(0, MAX_AUTO_LOGS);
  }
  
  // Console também (para logs do servidor)
  try {
    console.log(`[${type.toUpperCase()}] ${message}`);
  } catch (error) {
    // Fallback if type.toUpperCase() fails
    console.log(`[LOG] ${message}`);
  }
}

// Sistema de logs em tempo real para diagnóstico HLS
let hlsLogs = [];
const MAX_LOGS = 100;

function addHLSLog(type, message, data = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type,
    message,
    data,
    id: Date.now() + Math.random()
  };
  
  hlsLogs.unshift(logEntry);
  if (hlsLogs.length > MAX_LOGS) {
    hlsLogs = hlsLogs.slice(0, MAX_LOGS);
  }
  
  console.log(`📊 [HLS-LOG] ${type}: ${message}`, data || '');
}

module.exports = {
  autoLogs,
  saveAutoLog,
  hlsLogs,
  addHLSLog,
  MAX_AUTO_LOGS,
  MAX_LOGS
};
