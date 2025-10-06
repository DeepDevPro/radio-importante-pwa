/* Rotas de Catálogo extraídas de app.js - Etapa 4.2 */
/* eslint-env node */
const express = require('express');
const path = require('path');
const { catalog, saveCatalog } = require('../state/catalogState');
const storageConfig = require('../storage-config');
let AWS;
let parseNodeStream; // music-metadata dynamic import
try { AWS = require('aws-sdk'); } catch (e) { console.warn('⚠️ aws-sdk não encontrado. Instale se necessário para sync.'); }

const router = express.Router();

// GET /api/catalog
router.get('/api/catalog', async (req, res) => {
  if (catalog.tracks.length === 0) {
    console.log('📖 [catalog] Aviso: catálogo vazio (primeiro deploy?)');
  }
  res.json(catalog);
});

// PUT /api/tracks/:id/metadata
router.put('/api/tracks/:id/metadata', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, artist } = req.body;
    const idx = catalog.tracks.findIndex(t => t.id === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Música não encontrada' });
    }
    if (title !== undefined) catalog.tracks[idx].title = title;
    if (artist !== undefined) catalog.tracks[idx].artist = artist;
    catalog.metadata.totalTracks = catalog.tracks.length;
    catalog.metadata.totalDuration = catalog.tracks.reduce((s, t) => s + (t.duration || 0), 0);
    await saveCatalog();
    res.json({ success: true, message: 'Metadados atualizados com sucesso', track: catalog.tracks[idx] });
  } catch (error) {
    console.error('Erro ao atualizar metadados:', error);
    res.status(500).json({ success: false, message: 'Erro interno ao atualizar metadados' });
  }
});

// DELETE /api/delete/:id
router.delete('/api/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const idx = catalog.tracks.findIndex(t => t.id === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Música não encontrada' });
    }
    const deletedTrack = catalog.tracks[idx];
    if (deletedTrack.filename) {
      const ok = await storageConfig.deleteFile(deletedTrack.filename);
      console.log(ok ? `🗑️ Arquivo removido: ${deletedTrack.filename}` : `⚠️ Falha ao remover arquivo: ${deletedTrack.filename}`);
    }
    catalog.tracks.splice(idx, 1);
    catalog.metadata.totalTracks = catalog.tracks.length;
    catalog.metadata.totalDuration = catalog.tracks.reduce((s, t) => s + (t.duration || 0), 0);
    await saveCatalog();
    res.json({ success: true, message: 'Música deletada com sucesso', deletedTrack });
  } catch (error) {
    console.error('Erro ao deletar:', error);
    res.status(500).json({ success: false, message: 'Erro interno ao deletar música' });
  }
});

// POST /api/regenerate-catalog
router.post('/api/regenerate-catalog', async (req, res) => {
  catalog.metadata.totalTracks = catalog.tracks.length;
  catalog.metadata.totalDuration = catalog.tracks.reduce((s, t) => s + (t.duration || 0), 0);
  await saveCatalog();
  res.json({ success: true, message: 'Catálogo regenerado com sucesso', catalog });
});

// POST /api/sync-catalog
router.post('/api/sync-catalog', async (req, res) => {
  try {
    console.log('🔄 [sync] Iniciando sincronização com DigitalOcean Spaces...');
    const fullMode = req.query.full === 'true' || req.body.full === true;
    console.log(`📊 [sync] Modo: ${fullMode ? 'COMPLETO (metadados)' : 'BÁSICO'}`);
    if (!AWS) throw new Error('AWS SDK não disponível');
    const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT || 'atl1.digitaloceanspaces.com');
    const s3 = new AWS.S3({
      endpoint: spacesEndpoint,
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
      region: process.env.DO_SPACES_REGION || 'atl1'
    });
    const list = await s3.listObjectsV2({ Bucket: process.env.DO_SPACES_BUCKET || 'radio-importante-audio', Prefix: 'audio/', MaxKeys: 100 }).promise();
    console.log(`📁 [sync] Encontrados ${list.Contents?.length || 0} objetos`);
    if (!list.Contents) throw new Error('Nenhum arquivo encontrado no Spaces');
    const audioFiles = list.Contents.filter(o => {
      const k = o.Key || ''; return k.includes('audio/') && (k.endsWith('.mp3')||k.endsWith('.wav')||k.endsWith('.aac')||k.endsWith('.flac')||k.endsWith('.mp4')) && o.Size && o.Size > 1000; });
    console.log(`🎵 [sync] Arquivos de áudio válidos: ${audioFiles.length}`);
    const existingTracks = catalog.tracks || [];
    const existingMap = {}; existingTracks.forEach(t => { if (t.filename) existingMap[t.filename] = t; });
    const newTracks = audioFiles.map((obj, i) => {
      const filename = (obj.Key || '').replace('audio/', '');
      const ext = path.extname(filename).toLowerCase();
      const existing = existingMap[filename];
      const id = existing?.id || `track_${Date.now()}_${i}`;
      let title = path.basename(filename, ext);
      if (title.match(/^[0-9]+-.+/)) title = title.replace(/^[0-9]+-/, '').replace(/_/g, ' ');
      return { id, title: existing?.title || title || 'Título não definido', artist: existing?.artist || 'Artista não definido', filename, duration: existing?.duration || 0, format: ext, needsMetadata: !existing || !existing.duration || existing.duration === 0 || existing.title === 'Título não definido' || existing.artist === 'Artista não definido' };
    });
    const metadataStats = { durationComputed: 0, metadataFilled: 0, errors: 0 };
    if (fullMode) {
      console.log('🏷️ [meta] Enriquecimento de metadados...');
      if (!parseNodeStream) { const musicMetadata = await import('music-metadata'); parseNodeStream = musicMetadata.parseNodeStream; }
      const needing = newTracks.filter(t => t.needsMetadata).slice(0, 20);
      console.log(`📊 [meta] Processando ${needing.length} tracks`);
      for (const t of needing) {
        try {
          const stream = s3.getObject({ Bucket: process.env.DO_SPACES_BUCKET || 'radio-importante-audio', Key: `audio/${t.filename}` }).createReadStream();
          const md = await parseNodeStream(stream);
          if (md.format?.duration && (!t.duration || t.duration === 0)) { t.duration = Math.round(md.format.duration); metadataStats.durationComputed++; }
          if (md.common?.title && t.title === 'Título não definido') { t.title = md.common.title; metadataStats.metadataFilled++; }
          if (md.common?.artist && t.artist === 'Artista não definido') { t.artist = md.common.artist; }
          delete t.needsMetadata;
        } catch (e) {
          console.error(`❌ [meta] Erro ${t.filename}:`, e.message); metadataStats.errors++; delete t.needsMetadata; }
      }
      console.log(`✅ [meta] ${metadataStats.durationComputed} durações, ${metadataStats.metadataFilled} metadados`);
    } else { newTracks.forEach(t => delete t.needsMetadata); }
    catalog.tracks = newTracks;
    catalog.metadata.totalTracks = newTracks.length;
    catalog.metadata.totalDuration = newTracks.reduce((s, t) => s + (t.duration || 0), 0);
    await saveCatalog();
    const response = { success: true, message: `Catálogo sincronizado com sucesso! ${newTracks.length} arquivos encontrados no Spaces.`, tracksFound: newTracks.length, added: newTracks.length - existingTracks.length, removed: Math.max(0, existingTracks.length - newTracks.length), updated: newTracks.length, saved: true };
    if (fullMode) { response.durationComputed = metadataStats.durationComputed; response.metadataFilled = metadataStats.metadataFilled; response.metadataErrors = metadataStats.errors; }
    res.json(response);
  } catch (error) {
    console.error('❌ [sync] Erro na sincronização:', error);
    res.status(500).json({ success: false, message: 'Erro ao sincronizar catálogo', error: error instanceof Error ? error.message : 'Erro desconhecido' });
  }
});

// POST /api/clear-catalog
router.post('/api/clear-catalog', async (req, res) => {
  catalog.tracks = [];
  catalog.metadata.totalTracks = 0;
  catalog.metadata.totalDuration = 0;
  await saveCatalog();
  res.json({ success: true, message: 'Catálogo limpo com sucesso', catalog });
});

module.exports = router;
