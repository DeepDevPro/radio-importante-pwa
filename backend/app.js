// Backend do Radio Importante - F1 Support (music-metadata)
// Updated: 2025-10-01 - Added metadata enrichment support
/* eslint-env node */
// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const storageConfig = require('./storage-config');
const { execSync } = require('child_process');
const os = require('os');
const https = require('https');
// music-metadata será importado dinamicamente (ESM)
let parseNodeStream;
let AWS;
try {
  AWS = require('aws-sdk');
} catch (e) {
  console.warn('⚠️ aws-sdk não encontrado. Instale com: npm install aws-sdk');
}

const app = express();

// Import middlewares
const corsMiddleware = require('./middleware/cors');
const errorHandler = require('./middleware/errorHandler');
const notFoundHandler = require('./middleware/notFound');

// Import state modules
const { catalog, initializeCatalog, saveCatalog } = require('./state/catalogState');
const { autoLogs, saveAutoLog, hlsLogs, addHLSLog } = require('./state/hlsState');

// Configuração básica
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use(corsMiddleware);

// Health check endpoints
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK',
    message: 'Radio Importante Backend',
    version: '2.2.4',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'radio-importante-backend',
    version: '2.2.4',
    timestamp: new Date().toISOString()
  });
});

// ========== DEBUG LOGS ENDPOINTS ==========
// Etapa 4.1: Rotas de debug logs extraídas para routes/debugLogs.routes.js
app.use('/', require('./routes/debugLogs.routes'));

// ========== HLS PROXY ROUTES ==========
// R1: Rotas de proxy para HLS (latest e rolling)
app.use('/', require('./routes/hlsProxy.routes'));

// ========== HLS DEBUG UI ROUTES ==========
// R6-9: Rotas de debug para Admin/Debug UI (registradas ANTES das rotas gerais para precedência)
app.use('/api/hls', require('./routes/hlsDebug.routes'));

// ========== HLS GENERATION ROUTES ==========
// R3: Rota para geração de HLS via script + capabilities
app.use('/api/hls', require('./routes/hlsGenerate.routes'));

// Rota para servir track-cues.json (necessário para iPhone PWA)
app.get('/audio/hls/track-cues.json', async (req, res) => {
  try {
    console.log('🍎 [iPhone PWA] Solicitação de track-cues.json');
    
    // Construir URL do arquivo no Spaces
    const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
    const endpoint = process.env.DO_SPACES_ENDPOINT || 'atl1.digitaloceanspaces.com';
    const spacesUrl = `https://${bucket}.${endpoint}/generated/hls/latest/index.m3u8`;
    
    console.log(`🎯 [track-cues] Proxy request: ${spacesUrl}`);
    
    // Fazer proxy para o Spaces
    const https = require('https');
    const request = https.get(spacesUrl, (spacesRes) => {
      res.set({
        'Content-Type': 'application/json',
        'Content-Length': spacesRes.headers['content-length'],
        'Cache-Control': 'public, max-age=300'
      });
      
      res.status(spacesRes.statusCode);
      spacesRes.pipe(res);
    });
    
    request.on('error', (error) => {
      console.error(`❌ [track-cues] Erro ao acessar Spaces: ${error.message}`);
      res.status(404).json({ error: 'Track cues não encontrado' });
    });
    
  } catch (error) {
    console.error('❌ [track-cues] Erro na rota:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });  
  }
});

// Rota para servir arquivo contínuo AAC (necessário para iPhone PWA)
app.get('/audio/radio-importante-continuous.aac', async (req, res) => {
  try {
    console.log('📻 [continuous] Servindo arquivo contínuo MP3...');
    
    // Servir diretamente do DigitalOcean Spaces com proxy
    const bucket = process.env.DO_SPACES_BUCKET;
    const endpoint = process.env.DO_SPACES_ENDPOINT;
    const spacesUrl = `https://${bucket}.${endpoint}/radio-importante-continuous.aac`;
    
    // Fazer proxy para o Spaces
    const https = require('https');
    const request = https.get(spacesUrl, (spacesRes) => {
      // Configurar headers para AAC (compatível com MP3 no iOS)
      res.set({
        'Content-Type': 'audio/aac',
        'Content-Length': spacesRes.headers['content-length'],
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600'
      });
      
      res.status(spacesRes.statusCode);
      spacesRes.pipe(res);
    });
    
    request.on('error', (error) => {
      console.error(`❌ [continuous] Erro ao acessar arquivo contínuo: ${error.message}`);
      res.status(404).json({ error: 'Arquivo contínuo não encontrado' });
    });
    
  } catch (error) {
    console.error('❌ [continuous] Erro na rota do arquivo contínuo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para servir arquivo contínuo MP3 (CRÍTICO: iPhone PWA só funciona com MP3)
app.get('/audio/radio-importante-continuous.mp3', async (req, res) => {
  try {
    console.log('🍎 [iPhone PWA] Servindo arquivo contínuo MP3...');
    
    // Servir diretamente do DigitalOcean Spaces com proxy
    const bucket = process.env.DO_SPACES_BUCKET;
    const endpoint = process.env.DO_SPACES_ENDPOINT;
    const spacesUrl = `https://${bucket}.${endpoint}/radio-importante-continuous.mp3`;
    
    // Fazer proxy para o Spaces
    const https = require('https');
    const request = https.get(spacesUrl, (spacesRes) => {
      // Configurar headers para MP3
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': spacesRes.headers['content-length'],
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600'
      });
      
      res.status(spacesRes.statusCode);
      spacesRes.pipe(res);
    });
    
    request.on('error', (error) => {
      console.error(`❌ [iPhone PWA] Erro ao acessar arquivo MP3: ${error.message}`);
      res.status(404).json({ error: 'Arquivo MP3 contínuo não encontrado' });
    });
    
  } catch (error) {
    console.error('❌ [iPhone PWA] Erro na rota do arquivo MP3:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para servir arquivos de áudio do DigitalOcean Spaces
app.get('/audio/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    
    // Construir URL do arquivo no Spaces
    const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
    const endpoint = process.env.DO_SPACES_ENDPOINT || 'atl1.digitaloceanspaces.com';
    const spacesUrl = `https://${bucket}.${endpoint}/audio/${filename}`;
    
    console.log(`🎵 [audio] Proxy request: ${filename} -> ${spacesUrl}`);
    
    // Fazer proxy para o Spaces
    const https = require('https');
    const request = https.get(spacesUrl, (spacesRes) => {
      // Repassar headers relevantes
      res.set({
        'Content-Type': spacesRes.headers['content-type'] || 'audio/mpeg',
        'Content-Length': spacesRes.headers['content-length'],
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600'
      });
      
      res.status(spacesRes.statusCode);
      spacesRes.pipe(res);
    });
    
    request.on('error', (error) => {
      console.error(`❌ [audio] Erro ao acessar Spaces: ${error.message}`);
      res.status(404).json({ error: 'Arquivo não encontrado' });
    });
    
  } catch (error) {
    console.error('❌ [audio] Erro na rota de áudio:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Configuração do multer para upload usando storage persistente
const upload = multer({ 
  storage: storageConfig.storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Inicializar aplicação

// API Routes (catalog routes extraídas para routes/catalog.routes.js)
app.use('/', require('./routes/catalog.routes'));

// Endpoint para gerar arquivo contínuo para iPhone PWA
app.post('/api/generate-continuous', async (req, res) => {
  try {
    console.log('🍎 [iPhone PWA] Iniciando geração de arquivo contínuo...');
    
    if (catalog.tracks.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhuma faixa disponível para gerar arquivo contínuo'
      });
    }
    
    // TODO(Etapa5): implementar generateContinuousFile via serviço
    const result = { success: true, message: 'generateContinuousFile será implementado na Etapa 5' };
    
    res.json({
      success: true,
      message: 'Arquivo contínuo gerado com sucesso',
      ...result
    });
    
  } catch (error) {
    console.error('❌ [continuous] Erro ao gerar arquivo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao gerar arquivo contínuo',
      error: error.message
    });
  }
});

// ========== F0 VERIFICATION ENDPOINT (temporário) ==========

// Endpoint temporário para verificação F0 - estrutura de pastas no Spaces
app.get('/api/verify-spaces-structure', async (req, res) => {
  try {
    console.log('🔍 [F0] Iniciando verificação da estrutura do Spaces');
    
    if (!AWS) {
      return res.status(500).json({ 
        error: 'AWS SDK não disponível',
        details: 'Instale aws-sdk: npm install aws-sdk'
      });
    }
    
    // Configurar acesso ao Spaces
    const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT || 'atl1.digitaloceanspaces.com');
    const s3 = new AWS.S3({
      endpoint: spacesEndpoint,
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
      region: process.env.DO_SPACES_REGION || 'nyc3'
    });
    
    const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
    console.log(`🔍 [F0] Verificando estrutura do bucket: ${bucket}`);
    
    // Verificar prefixos existentes
    const prefixesToCheck = [
      'audio/',
      'data/',
      'generated/',
      'generated/mixes/',
      'generated/status/',
      'generated/hls/',
      'generated/hls/latest/',
      'generated/hls/rolling/'
    ];
    
    const results = {};
    
    for (const prefix of prefixesToCheck) {
      try {
        const params = {
          Bucket: bucket,
          Prefix: prefix,
          MaxKeys: 5
        };
        
        const data = await s3.listObjectsV2(params).promise();
        results[prefix] = {
          exists: data.Contents && data.Contents.length > 0,
          count: data.Contents ? data.Contents.length : 0,
          files: data.Contents ? data.Contents.map(obj => obj.Key).slice(0, 3) : []
        };
        
        console.log(`📁 [F0] ${prefix}: ${results[prefix].exists ? '✅' : '❌'} (${results[prefix].count} arquivos)`);
        
      } catch (error) {
        results[prefix] = {
          exists: false,
          error: error.message
        };
        console.log(`📁 [F0] ${prefix}: ❌ Error: ${error.message}`);
      }
    }
    
    // Verificar MIME types suportados (checklist F0)
    const mimeTypes = {
      '.json': 'application/json',
      '.m3u8': 'application/vnd.apple.mpegurl',
      '.ts': 'video/MP2T',
      '.m4s': 'video/iso.segment',
      '.mp3': 'audio/mpeg'
    };
    
    const summary = {
      bucket: bucket,
      endpoint: process.env.DO_SPACES_ENDPOINT || 'atl1.digitaloceanspaces.com',
      structure: results,
      mimeTypes: mimeTypes,
      recommendations: {
        existingPaths: Object.keys(results).filter(path => results[path].exists),
        missingPaths: Object.keys(results).filter(path => !results[path].exists),
        readyForHLS: results['audio/'] && results['audio/'].exists
      }
    };
    
    console.log('✅ [F0] Verificação concluída');
    
    res.json({
      success: true,
      message: 'Verificação da estrutura do Spaces concluída',
      timestamp: new Date().toISOString(),
      data: summary
    });
    
  } catch (error) {
    console.error('❌ [F0] Erro na verificação:', error);
    res.status(500).json({ 
      error: 'Erro na verificação da estrutura',
      details: error.message 
    });
  }
});

// ===========================================================
// (REMOVIDO: bloco duplicado de catálogo e fragmento órfão de generateContinuousFile - extraído para state/catalogState.js e será refeito na Etapa 5)
// ===========================================================

// Start server (Micropasso 3.2: garantir initializeCatalog antes do listen)
const PORT = process.env.PORT || 8080;
(async () => {
  try {
    await initializeCatalog();
    app.listen(PORT, () => {
      console.log(`🎵 Radio Importante Backend v2.2.4 running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`📁 Catalog tracks: ${catalog.tracks.length}`);
      console.log('🔍 Storage Configuration Diagnostics:');
      console.log(`  DO_SPACES_KEY: ${process.env.DO_SPACES_KEY ? 'SET' : 'NOT SET'}`);
      console.log(`  DO_SPACES_SECRET: ${process.env.DO_SPACES_SECRET ? 'SET' : 'NOT SET'}`);
      console.log(`  DO_SPACES_BUCKET: ${process.env.DO_SPACES_BUCKET || 'NOT SET'}`);
      console.log(`  DO_SPACES_ENDPOINT: ${process.env.DO_SPACES_ENDPOINT || 'NOT SET'}`);
      console.log(`  DO_SPACES_REGION: ${process.env.DO_SPACES_REGION || 'NOT SET'}`);
      if (process.env.DO_SPACES_KEY && process.env.DO_SPACES_SECRET) {
        console.log(`🌊 Using Digital Ocean Spaces: ${process.env.DO_SPACES_BUCKET}.${process.env.DO_SPACES_ENDPOINT}`);
      }
    });
  } catch (err) {
    console.error('❌ Falha ao inicializar catálogo antes do start do servidor:', err);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received, shutting down gracefully');  
  process.exit(0);
});
