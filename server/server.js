import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

// Backend produção e staging separados - v2.2 - teste validação token GitHub Actions
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

// Debug endpoint - List files in Spaces
app.get('/api/debug/files', async (req, res) => {
  try {
    console.log('Listing files in Spaces bucket...');
    
    const command = new ListObjectsV2Command({
      Bucket: process.env.DO_SPACES_BUCKET,
      MaxKeys: 100,
      Prefix: req.query.prefix || ''
    });
    
    const response = await s3Client.send(command);
    
    const files = response.Contents?.map(obj => ({
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified
    })) || [];
    
    res.json({
      bucket: process.env.DO_SPACES_BUCKET,
      fileCount: files.length,
      prefix: req.query.prefix || '',
      files: files
    });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ 
      error: 'Failed to list files',
      details: error.message 
    });
  }
});

// Test endpoint - Try to access a simple audio file we know exists
app.get('/api/test/audio', async (req, res) => {
  try {
    console.log('Testing access to known audio file...');
    
    const command = new GetObjectCommand({
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: 'audio/1759353027049-01_Ancestors.mp3'
    });
    
    const response = await s3Client.send(command);
    
    res.json({
      success: true,
      message: 'Audio file access successful',
      size: response.ContentLength,
      contentType: response.ContentType,
      lastModified: response.LastModified
    });
  } catch (error) {
    console.error('Error accessing audio file:', error);
    res.status(500).json({ 
      error: 'Failed to access audio file',
      details: error.message,
      code: error.Code
    });
  }
});

// HLS-specific debug endpoint
app.get('/api/debug/hls', async (req, res) => {
  try {
    console.log('Listing HLS files specifically...');
    
    const command = new ListObjectsV2Command({
      Bucket: process.env.DO_SPACES_BUCKET,
      Prefix: 'generated/hls/',
      MaxKeys: 50
    });
    
    const response = await s3Client.send(command);
    
    const files = response.Contents?.map(obj => ({
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified
    })) || [];
    
    res.json({
      bucket: process.env.DO_SPACES_BUCKET,
      prefix: 'generated/hls/',
      fileCount: files.length,
      files: files
    });
  } catch (error) {
    console.error('Error listing HLS files:', error);
    res.status(500).json({ 
      error: 'Failed to list HLS files',
      details: error.message 
    });
  }
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
      Key: 'generated/hls/latest/index.m3u8'
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

// NEW: Dynamic catalog from DigitalOcean Spaces (Option A)
app.get('/api/catalog', async (req, res) => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.DO_SPACES_BUCKET,
      Prefix: 'audio/',
      MaxKeys: 1000
    });

    const response = await s3Client.send(command);
    const contents = response.Contents || [];

    const tracks = contents
      .filter(obj => obj.Key && !obj.Key.endsWith('/') && obj.Size > 0)
      .filter(obj => !obj.Key.includes('continuous/') && !obj.Key.endsWith('.m3u8'))
      .map(obj => {
        const key = obj.Key;
        const filename = key.replace(/^audio\//, '');
        const ext = (filename.split('.').pop() || '').toLowerCase();
        const titleBase = filename.replace(/\.[^/.]+$/, '');
        const prettyTitle = decodeURIComponent(titleBase).replace(/[_-]+/g, ' ').trim();
        return {
          id: filename, // stable id based on filename
          title: prettyTitle || filename,
          artist: '',
          filename,
          duration: 0,
          format: ext
        };
      })
      // sort by lastModified ascending (older first)
      .sort((a, b) => {
        const aObj = contents.find(c => c.Key?.endsWith(a.filename));
        const bObj = contents.find(c => c.Key?.endsWith(b.filename));
        const aTime = aObj?.LastModified ? new Date(aObj.LastModified).getTime() : 0;
        const bTime = bObj?.LastModified ? new Date(bObj.LastModified).getTime() : 0;
        return aTime - bTime;
      });

    const totalDuration = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);

    res.set('Cache-Control', 'no-cache');
    return res.json({
      tracks,
      metadata: {
        totalTracks: tracks.length,
        totalDuration,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error building catalog from Spaces:', error);
    return res.status(500).json({
      error: 'Failed to build catalog',
      details: error.message
    });
  }
});

// Continuous MP3 routes for iOS PWA
app.get('/audio/continuous/radio-importante-continuous.mp3', async (req, res) => {
  try {
    console.log('Proxying continuous MP3 from Spaces...');

    const key = 'continuous/radio-importante-continuous.mp3';
    const params = {
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: key,
    };

    // Suporte a Range (S3 devolve ContentRange/ContentLength quando Range é usado)
    if (req.headers.range) {
      params.Range = req.headers.range;
    }

    const command = new GetObjectCommand(params);
    const response = await s3Client.send(command);

    // Headers base
    res.set({
      'Content-Type': response.ContentType || 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
    });

    if (req.headers.range && response.ContentRange) {
      res.status(206);
      res.set({ 'Content-Range': response.ContentRange });
    }

    if (response.ContentLength != null) {
      res.set('Content-Length', String(response.ContentLength));
    }

    response.Body.pipe(res);
  } catch (error) {
    console.error('Error proxying continuous MP3:', error);
    res.status(500).json({ 
      error: 'Failed to fetch continuous MP3',
      details: error.message
    });
  }
});

app.get('/audio/continuous/track-cues.json', async (req, res) => {
  try {
    console.log('Proxying track cues from Spaces...');

    const key = 'continuous/track-cues.json';
    const command = new GetObjectCommand({
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: key,
    });

    const response = await s3Client.send(command);
    const data = await response.Body.transformToString();

    res.set({
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    });
    res.send(data);
  } catch (error) {
    console.error('Error proxying track cues:', error);
    res.status(500).json({ 
      error: 'Failed to fetch track cues',
      details: error.message
    });
  }
});

app.get('/api/rolling-playlist', async (req, res) => {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: 'generated/hls/rolling/index.m3u8'
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
