/*
  routes/mediaSessionLogs.routes.js
  Recebe logs do frontend (Media Session / track change) e publica no DigitalOcean Spaces.
  Estrutura dos objetos:
  logs/media-session/staging/YYYY-MM-DD/<sessionId>/<timestamp>.json
*/

const express = require('express');
const router = express.Router();

let AWS;
try {
  AWS = require('aws-sdk');
} catch (e) {
  console.warn('⚠️ aws-sdk não encontrado. Instale com: npm install aws-sdk');
}

function getS3Client() {
  if (!AWS) return null;
  const endpoint = process.env.DO_SPACES_ENDPOINT || 'atl1.digitaloceanspaces.com';
  const region = process.env.DO_SPACES_REGION || 'atl1';
  const spacesEndpoint = new AWS.Endpoint(endpoint);
  const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    region,
    accessKeyId: process.env.SPACES_KEY || process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.SPACES_SECRET || process.env.DO_SPACES_SECRET,
    signatureVersion: 'v4',
  });
  return s3;
}

function todayStr() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

router.post('/media-session', async (req, res) => {
  try {
    const s3 = getS3Client();
    if (!s3) {
      return res.status(500).json({ ok: false, error: 'S3 client não disponível' });
    }

    const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
    const env = process.env.NODE_ENV === 'production' ? 'prod' : 'staging';

    const {
      sessionId,
      eventName,
      changeType,
      appTimestamp,
      audioCurrentTime,
      cueIndex,
      cue,
      mediaSession,
      visibility,
      extra,
    } = req.body || {};

    if (!sessionId || !eventName || typeof audioCurrentTime !== 'number') {
      return res.status(400).json({ ok: false, error: 'payload inválido' });
    }

    const ts = new Date().toISOString();
    const key = `logs/media-session/${env}/${todayStr()}/${sessionId}/${Date.now()}.json`;

    const payload = {
      sessionId,
      eventName,
      changeType,
      appTimestamp,
      serverTimestamp: ts,
      userAgent: req.headers['user-agent'],
      audioCurrentTime,
      cueIndex,
      cue,
      mediaSession,
      visibility,
      extra,
    };

    await s3.putObject({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(JSON.stringify(payload)),
      ContentType: 'application/json',
      ACL: 'public-read',
      CacheControl: 'no-cache',
    }).promise();

    const endpoint = process.env.DO_SPACES_ENDPOINT || 'atl1.digitaloceanspaces.com';
    const url = `https://${bucket}.${endpoint}/${key}`;

    res.json({ ok: true, url, key });
  } catch (error) {
    console.error('❌ [media-session logs] erro:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
