import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { S3Client, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Backend produção e staging separados - v2.2 - teste validação token GitHub Actions
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Path helpers (to locate scripts/generate-audio-remote.js reliably)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..'); // server/.. → repo root
const generateRemoteScript = path.resolve(projectRoot, 'scripts', 'generate-audio-remote.js');

// ---------------- Continuous MP3 Rebuild Scheduler ----------------
const rebuildState = {
  running: false,
  pending: false,
  queuedCount: 0,
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null,
  lastExitCode: null,
  lastReason: null,
  debounceTimer: null,
};

function getSpacesEnvForChild() {
  const bucket = process.env.SPACES_BUCKET || process.env.DO_SPACES_BUCKET;
  const endpointHost = process.env.SPACES_ENDPOINT || (process.env.DO_SPACES_ENDPOINT ? `https://${process.env.DO_SPACES_ENDPOINT}` : undefined);
  const region = process.env.SPACES_REGION || process.env.DO_SPACES_REGION;
  const key = process.env.SPACES_KEY || process.env.DO_SPACES_KEY;
  const secret = process.env.SPACES_SECRET || process.env.DO_SPACES_SECRET;
  const publicBase = process.env.SPACES_PUBLIC_BASE || (process.env.DO_SPACES_BUCKET && process.env.DO_SPACES_ENDPOINT
    ? `https://${process.env.DO_SPACES_BUCKET}.${process.env.DO_SPACES_ENDPOINT}`
    : undefined);
  return { bucket, endpointHost, region, key, secret, publicBase };
}

function triggerContinuousRebuild(reason = 'unspecified') {
  if (rebuildState.running) {
    console.log('⏳ Continuous rebuild already running, skip trigger');
    return;
  }
  rebuildState.running = true;
  rebuildState.pending = false;
  rebuildState.lastRunAt = new Date().toISOString();
  rebuildState.lastReason = reason;
  const nodeBin = process.execPath || 'node';

  // Build args and env for child
  const args = [generateRemoteScript];
  const catalogUrl = process.env.PUBLIC_BASE_URL
    ? `${process.env.PUBLIC_BASE_URL.replace(/\/$/, '')}/api/catalog`
    : (process.env.CATALOG_URL || '');
  if (catalogUrl) {
    args.push('--catalog-url', catalogUrl);
  }

  const { bucket, endpointHost, region, key, secret, publicBase } = getSpacesEnvForChild();
  const childEnv = {
    ...process.env,
    // Normalize SPACES_* env expected by the script
    SPACES_BUCKET: bucket || process.env.SPACES_BUCKET,
    SPACES_ENDPOINT: endpointHost || process.env.SPACES_ENDPOINT,
    SPACES_REGION: region || process.env.SPACES_REGION,
    SPACES_KEY: key || process.env.SPACES_KEY,
    SPACES_SECRET: secret || process.env.SPACES_SECRET,
    SPACES_PUBLIC_BASE: publicBase || process.env.SPACES_PUBLIC_BASE,
  };

  console.log('🎛️ Spawning continuous rebuild process...', { args: args.join(' '), reason });
  const child = spawn(nodeBin, args, { env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });

  // stream child output to parent stdio (no unused buffers)
  child.stdout.on('data', (d) => { process.stdout.write(d); });
  let err = '';
  child.stderr.on('data', (d) => { err += d.toString(); process.stderr.write(d); });

  child.on('close', (code) => {
    rebuildState.running = false;
    rebuildState.lastExitCode = code;
    if (code === 0) {
      rebuildState.lastSuccessAt = new Date().toISOString();
      rebuildState.lastError = null;
      console.log('✅ Continuous rebuild completed successfully');
    } else {
      rebuildState.lastError = (err || 'Unknown error').slice(-1000);
      console.error('❌ Continuous rebuild failed with code', code);
    }
  });

  child.on('error', (e) => {
    rebuildState.running = false;
    rebuildState.lastExitCode = -1;
    rebuildState.lastError = e?.message || String(e);
    console.error('❌ Failed to spawn continuous rebuild:', e);
  });
}

function scheduleContinuousRebuild(reason = 'unspecified', delayMs = Number(process.env.CONTINUOUS_REBUILD_DEBOUNCE_MS || 20000)) {
  if (rebuildState.debounceTimer) clearTimeout(rebuildState.debounceTimer);
  rebuildState.pending = true;
  rebuildState.queuedCount += 1;
  rebuildState.lastReason = reason;
  rebuildState.debounceTimer = setTimeout(() => {
    rebuildState.debounceTimer = null;
    triggerContinuousRebuild(reason);
    // reset queued counter after a run starts
    rebuildState.queuedCount = 0;
  }, delayMs);
  console.log(`🗓️ Scheduled continuous rebuild in ${delayMs}ms (reason: ${reason})`);
}

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware for uploads
app.use('/api/upload', (req, res, next) => {
  console.log(`📤 Upload request received:`, {
    method: req.method,
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Configure multer for file uploads (memory storage)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit per file
    files: 10 // Max 10 files per upload
  },
  fileFilter: (req, file, cb) => {
    // Accept only audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

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
    timestamp: new Date().toISOString(),
    continuous: {
      running: rebuildState.running,
      pending: rebuildState.pending,
      lastRunAt: rebuildState.lastRunAt,
      lastSuccessAt: rebuildState.lastSuccessAt,
      lastError: rebuildState.lastError,
    }
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

// Helper: metadata manifest in Spaces
const MANIFEST_KEY = process.env.CATALOG_MANIFEST_KEY || 'catalog/metadata.json';

async function loadMetadataManifest() {
  try {
    const resp = await s3Client.send(new GetObjectCommand({
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: MANIFEST_KEY
    }));
    const text = await resp.Body.transformToString();
    const json = JSON.parse(text);
    return json && typeof json === 'object' ? json : {};
  } catch (err) {
    console.warn('Manifest not found or unreadable:', err?.message || err);
    return {};
  }
}

async function saveMetadataManifest(manifest) {
  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.DO_SPACES_BUCKET,
    Key: MANIFEST_KEY,
    Body: JSON.stringify(manifest, null, 2),
    ContentType: 'application/json'
  }));
}

// NEW: Dynamic catalog from DigitalOcean Spaces (Option A)
app.get('/api/catalog', async (req, res) => {
  try {
    // First try to get catalog from updateCatalogWithNewTracks format
    try {
      const catalogCommand = new GetObjectCommand({
        Bucket: process.env.DO_SPACES_BUCKET,
        Key: 'catalog/metadata.json'
      });
      const catalogResponse = await s3Client.send(catalogCommand);
      const catalogData = await catalogResponse.Body.transformToString();
      const catalogJson = JSON.parse(catalogData);
      
      if (catalogJson.tracks && Array.isArray(catalogJson.tracks)) {
        console.log(`📋 Using new catalog format with ${catalogJson.tracks.length} tracks`);
        
        // Cross-check that files actually exist in Spaces to prevent 404 during playback
        let listResp;
        try {
          listResp = await s3Client.send(new ListObjectsV2Command({
            Bucket: process.env.DO_SPACES_BUCKET,
            Prefix: 'audio/',
            MaxKeys: 1000
          }));
        } catch (e) {
          console.warn('⚠️ Failed to list audio/ objects for validation:', e?.message || e);
          listResp = { Contents: [] };
        }

        const contents = listResp?.Contents || [];
        const availableSet = new Set(
          contents
            .filter(obj => obj.Key && !obj.Key.endsWith('/') && obj.Size > 0)
            .map(obj => obj.Key.replace(/^audio\//, ''))
        );

        const filteredTracks = catalogJson.tracks.filter((t) => t && t.filename && availableSet.has(t.filename));
        const missingCount = catalogJson.tracks.length - filteredTracks.length;
        if (missingCount > 0) {
          console.log(`🧹 Filtered out ${missingCount} missing tracks from manifest (to avoid 404)`);
        }

        // If after filtering nothing remains, fall back to dynamic listing below
        if (filteredTracks.length > 0) {
          // Sort by LastModified (oldest first) to keep deterministic order
          const sorted = filteredTracks.sort((a, b) => {
            const aObj = contents.find(c => c.Key?.endsWith(a.filename));
            const bObj = contents.find(c => c.Key?.endsWith(b.filename));
            const aTime = aObj?.LastModified ? new Date(aObj.LastModified).getTime() : 0;
            const bTime = bObj?.LastModified ? new Date(bObj.LastModified).getTime() : 0;
            return aTime - bTime;
          });

          const totalDuration = sorted.reduce((sum, t) => sum + (t.duration || 0), 0);
          
          res.set('Cache-Control', 'no-cache');
          return res.json({
            tracks: sorted,
            metadata: {
              totalTracks: sorted.length,
              totalDurationSeconds: totalDuration,
              lastUpdated: catalogJson.lastUpdated
            }
          });
        } else {
          console.log('📉 No valid tracks found in manifest after filtering; falling back to dynamic listing');
        }
      }
    } catch {
      console.log('📋 New catalog format not found, falling back to dynamic listing');
    }

    // Fallback: Dynamic listing with metadata manifest (original implementation)
    const command = new ListObjectsV2Command({
      Bucket: process.env.DO_SPACES_BUCKET,
      Prefix: 'audio/',
      MaxKeys: 1000
    });

    const [listResp, manifest] = await Promise.all([
      s3Client.send(command),
      loadMetadataManifest()
    ]);

    const contents = listResp.Contents || [];

    const tracks = contents
      .filter(obj => obj.Key && !obj.Key.endsWith('/') && obj.Size > 0)
      .filter(obj => !obj.Key.includes('continuous/') && !obj.Key.endsWith('.m3u8'))
      .map(obj => {
        const key = obj.Key;
        const filename = key.replace(/^audio\//, '');
        const ext = (filename.split('.').pop() || '').toLowerCase();
        const titleBase = filename.replace(/\.[^/.]+$/, '');
        const prettyTitle = decodeURIComponent(titleBase).replace(/[_-]+/g, ' ').trim();
        const meta = manifest[filename] || {};
        return {
          id: filename,
          title: (meta.title || prettyTitle || filename),
          artist: (meta.artist || ''),
          filename,
          duration: Number(meta.duration || 0),
          format: ext
        };
      })
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
        totalDurationSeconds: totalDuration
      }
    });
  } catch (error) {
    console.error('❌ Error building catalog:', error);
    res.status(500).json({ error: 'Failed to load catalog' });
  }
});

// NEW: Update track metadata (title/artist/duration) and persist to manifest in Spaces
app.put('/api/tracks/:id/metadata', async (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id || '');
    if (!id) return res.status(400).json({ error: 'Missing track id' });

    const { title, artist, duration } = req.body || {};
    if (title == null && artist == null && duration == null) {
      return res.status(400).json({ error: 'No metadata provided' });
    }

    const manifest = await loadMetadataManifest();
    const entry = manifest[id] || {};

    if (title != null) entry.title = String(title);
    if (artist != null) entry.artist = String(artist);
    if (duration != null && !Number.isNaN(Number(duration))) entry.duration = Number(duration);

    manifest[id] = entry;
    await saveMetadataManifest(manifest);

    // Schedule continuous rebuild (debounced)
    scheduleContinuousRebuild('metadata_update');

    res.json({ success: true, id, metadata: entry });
  } catch (error) {
    console.error('Error updating metadata:', error);
    res.status(500).json({ error: 'Failed to update metadata', details: error.message });
  }
});

// NEW: Delete a track file from Spaces and update manifest
app.delete('/api/delete/:id', async (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id || '');
    if (!id) return res.status(400).json({ error: 'Missing track id' });

    // Delete object in Spaces
    await s3Client.send(new DeleteObjectCommand({
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: `audio/${id}`
    }));

    // Update manifest
    const manifest = await loadMetadataManifest();
    if (manifest[id]) delete manifest[id];
    await saveMetadataManifest(manifest);

    // Schedule continuous rebuild (debounced)
    scheduleContinuousRebuild('delete_track');

    res.json({ success: true, id });
  } catch (error) {
    console.error('Error deleting track:', error);
    res.status(500).json({ error: 'Failed to delete track', details: error.message });
  }
});

// NEW: Proxy single audio files for preview
app.get('/audio/:filename', async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const params = {
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: `audio/${filename}`,
    };
    if (req.headers.range) params.Range = req.headers.range;

    const response = await s3Client.send(new GetObjectCommand(params));

    res.set({
      'Content-Type': response.ContentType || 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600'
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
    console.error('Error proxying audio file:', error);
    res.status(404).json({ error: 'Audio file not found' });
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

// Upload endpoint for audio files
app.post('/api/upload', upload.array('audioFiles'), async (req, res) => {
  try {
    console.log('📤 Upload request received');
    console.log('Files:', req.files?.length || 0);
    console.log('Body keys:', Object.keys(req.body || {}));
    console.log('Body values:', req.body);

    if (!req.files || req.files.length === 0) {
      console.log('❌ No files in request');
      return res.status(400).json({ 
        success: false, 
        error: 'No files uploaded' 
      });
    }

    const uploadResults = [];
    const timestamp = Date.now();

    // Process each uploaded file
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const durationKey = `duration_${i}`;
      const duration = req.body[durationKey] ? parseInt(req.body[durationKey]) : 0;
      
      console.log(`📁 Processing file ${i + 1}/${req.files.length}:`, {
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        durationKey,
        durationValue: req.body[durationKey],
        durationParsed: duration
      });

      console.log(`🔍 DEBUG - File ${i + 1}:`);
      console.log(`  - Original name: ${file.originalname}`);
      console.log(`  - Duration key: ${durationKey}`);
      console.log(`  - Duration value from body: ${req.body[durationKey]}`);
      console.log(`  - Parsed duration: ${duration}`);

      // Generate safe filename
      const fileExtension = file.originalname.split('.').pop();
      const safeFilename = `${timestamp}-${file.originalname.replace(/[^a-zA-Z0-9\-_.]/g, '_')}`;
      const s3Key = `audio/${safeFilename}`;

      console.log(`📁 Processing file ${i + 1}: ${file.originalname} → ${safeFilename}`);

      // Upload to Spaces
      const uploadCommand = new PutObjectCommand({
        Bucket: process.env.DO_SPACES_BUCKET,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
        Metadata: {
          'original-name': file.originalname,
          'upload-timestamp': timestamp.toString(),
          'duration': duration.toString()
        }
      });

      await s3Client.send(uploadCommand);

      uploadResults.push({
        id: `track_${timestamp}_${i}`,
        title: file.originalname.replace(/\.[^/.]+$/, ''), // Remove extension
        artist: 'Artista não definido',
        filename: safeFilename,
        duration: duration,
        format: fileExtension || 'mp3',
        originalName: file.originalname,
        uploadTimestamp: timestamp
      });

      console.log(`🔍 DEBUG uploadResults - Added track with duration: ${duration}`);
      console.log(`  Object created:`, {
        title: file.originalname.replace(/\.[^/.]+$/, ''),
        duration: duration,
        filename: safeFilename
      });

      console.log(`✅ File ${i + 1} uploaded successfully: ${s3Key}`);
    }

    // Update catalog with new tracks
    await updateCatalogWithNewTracks(uploadResults);

    // Schedule continuous rebuild (debounced)
    scheduleContinuousRebuild('upload');

    res.json({
      success: true,
      message: `Successfully uploaded ${uploadResults.length} file(s)`,
      tracks: uploadResults,
      timestamp: timestamp
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Upload failed',
      details: error.message
    });
  }
});

// Helper function to update catalog
async function updateCatalogWithNewTracks(newTracks) {
  try {
    console.log(`🔍 DEBUG updateCatalogWithNewTracks - Received ${newTracks.length} tracks:`);
    newTracks.forEach((track, index) => {
      console.log(`  Track ${index + 1}: ${track.title} - Duration: ${track.duration}`);
    });
    
    // Get existing catalog
    let existingCatalog = { tracks: [] };
    
    try {
      const getCommand = new GetObjectCommand({
        Bucket: process.env.DO_SPACES_BUCKET,
        Key: 'catalog/metadata.json'
      });
      const response = await s3Client.send(getCommand);
      const data = await response.Body.transformToString();
      existingCatalog = JSON.parse(data);
    } catch {
      console.log('📝 No existing catalog found, creating new one');
    }

    // Add new tracks to catalog
    const updatedCatalog = {
      ...existingCatalog,
      tracks: [...(existingCatalog.tracks || []), ...newTracks],
      lastUpdated: new Date().toISOString()
    };

    console.log(`🔍 DEBUG updateCatalogWithNewTracks - About to save catalog with ${updatedCatalog.tracks.length} total tracks`);
    console.log(`  Last ${newTracks.length} tracks durations:`, updatedCatalog.tracks.slice(-newTracks.length).map(t => ({ title: t.title, duration: t.duration })));

    // Save updated catalog
    const putCommand = new PutObjectCommand({
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: 'catalog/metadata.json',
      Body: JSON.stringify(updatedCatalog, null, 2),
      ContentType: 'application/json',
      ACL: 'public-read'
    });

    await s3Client.send(putCommand);
    console.log('📋 Catalog updated with new tracks');

  } catch (error) {
    console.error('❌ Error updating catalog:', error);
    throw error;
  }
}

// NEW: Log ingestion endpoint for frontend observability
app.post('/api/logs/media-session', (req, res) => {
  try {
    const logData = req.body || {};
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, ...logData };
    
    // Just acknowledge the log for now - could store in memory or send to external service
    console.log('📊 Frontend log:', JSON.stringify(logEntry));
    
    res.json({ success: true, logged: timestamp });
  } catch (error) {
    console.error('Error logging frontend data:', error);
    res.status(500).json({ error: 'Failed to log data' });
  }
});

// Manual endpoints to control/status continuous rebuild
app.post('/api/continuous/rebuild', (req, res) => {
  const mode = (req.query.mode || req.body?.mode || '').toString();
  const immediate = mode === 'now' || req.query.now === 'true';
  const reason = (req.query.reason || req.body?.reason || 'manual').toString();
  if (immediate) {
    triggerContinuousRebuild(reason);
  } else {
    scheduleContinuousRebuild(reason);
  }
  res.json({
    success: true,
    scheduled: !immediate,
    running: rebuildState.running,
    pending: rebuildState.pending,
    lastRunAt: rebuildState.lastRunAt,
    lastSuccessAt: rebuildState.lastSuccessAt,
  });
});

app.get('/api/continuous/status', (req, res) => {
  res.json({
    running: rebuildState.running,
    pending: rebuildState.pending,
    queuedCount: rebuildState.queuedCount,
    lastRunAt: rebuildState.lastRunAt,
    lastSuccessAt: rebuildState.lastSuccessAt,
    lastError: rebuildState.lastError,
    lastExitCode: rebuildState.lastExitCode,
    lastReason: rebuildState.lastReason,
    script: path.relative(projectRoot, generateRemoteScript),
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
