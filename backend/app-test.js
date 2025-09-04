// Simple test app for Elastic Beanstalk
const express = require('express');
const app = express();

const port = process.env.PORT || 8080;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Backend is working!',
    timestamp: new Date().toISOString(),
    port: port
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Radio Importante Backend - Test Version',
    version: '1.0.0',
    status: 'Running',
    message: 'Test deployment successful!'
  });
});

app.listen(port, () => {
  console.log(`🚀 Test Backend running on port ${port}`);
});
