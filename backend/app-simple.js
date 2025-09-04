// Ultra-simple Express app para debug EB
const express = require('express');
const app = express();

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Radio Importante Backend API - WORKING!',
    status: 'running'
  });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});
