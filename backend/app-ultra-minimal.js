const express = require('express');
const app = express();

// Configuração mínima
app.use(express.json({ limit: '1mb' }));

// CORS simples
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Health check essencial para EB
app.get('/', (req, res) => {
  res.json({ status: 'OK', service: 'radio-backend' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// API mínima
app.get('/api/catalog', (req, res) => {
  res.json({ tracks: [], metadata: { totalTracks: 0 } });
});

app.post('/api/upload', (req, res) => {
  res.json({ success: true, message: 'Upload OK' });
});

app.put('/api/tracks/:id/metadata', (req, res) => {
  res.json({ success: true });
});

app.delete('/api/delete/:id', (req, res) => {
  res.json({ success: true });
});

// 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
