// Estado dos jobs HLS e sistema de logging
// Extraído de app.js para facilitar manutenção
/* eslint-env node */

// Array em memória para logs automaticos (max 100 entradas)
let autoLogs = [];
const MAX_AUTO_LOGS = 100;

function saveAutoLog(message, type = 'info') {
  // Support both orders: (message, type) and (type, message) for backward compatibility
  if (typeof message === 'string' && typeof type === 'string' && 
      message.startsWith('HLS_') && !type.includes(' ')) {
    // Swap if first param looks like a type
    [message, type] = [type, message];
  }
  
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, type, message };
  
  // Adicionar ao array
  autoLogs.unshift(logEntry);
  
  // Manter apenas os últimos 100 logs
  if (autoLogs.length > MAX_AUTO_LOGS) {
    autoLogs = autoLogs.slice(0, MAX_AUTO_LOGS);
  }
  
  // Console também (para logs do servidor)
  console.log(`[${type.toUpperCase()}] ${message}`);
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
