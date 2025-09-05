const express = require('express');

console.log('🚀 Iniciando aplicação...');
console.log('📊 Node version:', process.version);
console.log('📊 Platform:', process.platform);
console.log('📊 Arch:', process.arch);

const app = express();

console.log('📦 Express inicializado');

// Health check
app.get('/', (req, res) => {
  console.log('📥 GET / - Health check');
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    node: process.version,
    pid: process.pid
  });
});

app.get('/health', (req, res) => {
  console.log('📥 GET /health');
  res.json({ status: 'healthy' });
});

// API básica
app.get('/api/catalog', (req, res) => {
  console.log('📥 GET /api/catalog');
  res.json({ tracks: [], total: 0 });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

console.log(`🌐 Starting server on ${HOST}:${PORT}`);

const server = app.listen(PORT, HOST, () => {
  console.log(`✅ Server running on http://${HOST}:${PORT}`);
  console.log('🎯 Server ready to accept connections');
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
});

process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received');
  server.close(() => {
    console.log('📴 Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received');
  server.close(() => {
    console.log('📴 Server closed');
    process.exit(0);
  });
});
