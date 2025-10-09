import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import AWS from 'aws-sdk';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure AWS
const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT);
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
  region: process.env.DO_SPACES_REGION
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.get('/api/playlist', async (req, res) => {
  try {
    const params = {
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: 'latest-playlist.m3u8'
    };
    
    const data = await s3.getObject(params).promise();
    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(data.Body.toString());
  } catch (error) {
    console.error('Error fetching playlist:', error);
    res.status(500).json({ error: 'Failed to fetch playlist' });
  }
});

app.get('/api/rolling-playlist', async (req, res) => {
  try {
    const params = {
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: 'rolling-playlist.m3u8'
    };
    
    const data = await s3.getObject(params).promise();
    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(data.Body.toString());
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
