const express = require('express');
const app = express();

// Health check básico
app.get('/', (req, res) => {
  res.json({ status: 'OK' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// API stub
app.get('/api/catalog', (req, res) => {
  res.json({ tracks: [] });
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server on port ${PORT}`);
});
