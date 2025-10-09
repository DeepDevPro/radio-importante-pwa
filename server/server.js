import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure AWS S3 Client (v3)
const s3Client = new S3Client({
  endpoint: `https://${process.env.DO_SPACES_ENDPOINT}`,
  region: process.env.DO_SPACES_REGION,
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
  },
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Radio Importante Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      playlist: '/api/playlist',
      rollingPlaylist: '/api/rolling-playlist'
    },
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.get('/api/playlist', async (req, res) => {
  try {
    console.log('Fetching playlist from Spaces...');
    console.log('Bucket:', process.env.DO_SPACES_BUCKET);
    console.log('Endpoint:', process.env.DO_SPACES_ENDPOINT);
    console.log('Region:', process.env.DO_SPACES_REGION);
    
    const command = new GetObjectCommand({
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: 'latest-playlist.m3u8'
    });
    
    const response = await s3Client.send(command);
    const data = await response.Body.transformToString();
    
    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(data);
  } catch (error) {
    console.error('Error fetching playlist:', error.message);
    console.error('Error code:', error.Code);
    console.error('Error details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch playlist',
      details: error.message,
      code: error.Code
    });
  }
});

app.get('/api/rolling-playlist', async (req, res) => {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: 'rolling-playlist.m3u8'
    });
    
    const response = await s3Client.send(command);
    const data = await response.Body.transformToString();
    
    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(data);
  } catch (error) {
    console.error('Error fetching rolling playlist:', error);
    res.status(500).json({ error: 'Failed to fetch rolling playlist' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
