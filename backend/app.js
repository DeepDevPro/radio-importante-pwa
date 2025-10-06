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

// Endpoint para receber logs de debug do iPhone
app.post('/api/debug-logs', (req, res) => {
  try {
    const { logs, device, userAgent, url, timestamp } = req.body;
    
    if (!logs) {
      return res.status(400).json({ error: 'Logs são obrigatórios' });
    }
    
    // Criar diretório de logs se não existir
    const logsDir = path.join(__dirname, 'debug-logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Gerar nome do arquivo com timestamp
    const now = new Date();
    const filename = `debug-${device || 'unknown'}-${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}-${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}.txt`;
    
    // Cabeçalho do arquivo de log
    const header = `=== LOGS DE DEBUG RADIO IMPORTANTE ===
Dispositivo: ${device || 'Desconhecido'}
User Agent: ${userAgent || 'N/A'}
URL: ${url || 'N/A'}
Timestamp Client: ${timestamp || 'N/A'}
Timestamp Server: ${new Date().toISOString()}
IP: ${req.ip || req.connection.remoteAddress}

==================== LOGS ====================
`;
    
    const fullContent = header + logs;
    const filePath = path.join(logsDir, filename);
    
    // Salvar arquivo
    fs.writeFileSync(filePath, fullContent, 'utf8');
    
    console.log(`📱 [debug-logs] Logs salvos: ${filename} (${fullContent.length} chars)`);
    
    res.json({ 
      success: true, 
      message: 'Logs salvos com sucesso!',
      filename: filename,
      downloadUrl: `/debug-logs/${filename}`
    });
    
  } catch (error) {
    console.error('❌ [debug-logs] Erro ao salvar logs:', error);
    res.status(500).json({ error: 'Erro interno ao salvar logs' });
  }
});

// Endpoint para listar logs disponíveis
app.get('/api/debug-logs', (req, res) => {
  try {
    const logsDir = path.join(__dirname, 'debug-logs');
    
    let files = [];
    if (fs.existsSync(logsDir)) {
      files = fs.readdirSync(logsDir)
        .filter(file => file.endsWith('.txt'))
        .map(file => {
          const filePath = path.join(logsDir, file);
          const stats = fs.statSync(filePath);
          return {
            filename: file,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            downloadUrl: `/debug-logs/${file}`
          };
        })
        .sort((a, b) => b.created - a.created); // Mais recentes primeiro
    }
    
    // Retornar logs automáticos + arquivos salvos
    res.json({ 
      logs: autoLogs, // Logs em tempo real
      files: files    // Arquivos salvos
    });
    
  } catch (error) {
    console.error('❌ [debug-logs] Erro ao listar logs:', error);
    res.status(500).json({ error: 'Erro interno ao listar logs' });
  }
});

// Servir arquivos de log para download
app.get('/debug-logs/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'debug-logs', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo de log não encontrado' });
    }
    
    // Definir headers para download
    res.set({
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    });
    
    const content = fs.readFileSync(filePath, 'utf8');
    res.send(content);
    
  } catch (error) {
    console.error('❌ [debug-logs] Erro ao servir log:', error);
    res.status(500).json({ error: 'Erro interno ao servir log' });
  }
});

// Rota para servir track-cues.json (necessário para iPhone PWA)
app.get('/audio/hls/track-cues.json', async (req, res) => {
  try {
    console.log('🍎 [iPhone PWA] Solicitação de track-cues.json');
    
    // Construir URL do arquivo no Spaces
    const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
    const endpoint = process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com';
    const spacesUrl = `https://${bucket}.${endpoint}/hls/track-cues.json`;
    
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
    const endpoint = process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com';
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

// API Routes
app.get('/api/catalog', async (req, res) => {
  // Se o catálogo estiver vazio, tentar recarregar do Spaces
  if (catalog.tracks.length === 0) {
    console.log('📖 [catalog] Catálogo vazio, tentando recarregar do Spaces...');
    await loadCatalogFromSpaces();
  }
  
  res.json(catalog);
});

// Middleware flexível para upload que aceita múltiplos nomes de campo
const flexibleUpload = (req, res, next) => {
  console.log('🛰️ [flexibleUpload] Iniciando middleware');
  console.log('🛰️ [flexibleUpload] Headers:', req.headers['content-type']);
  console.log('🛰️ [flexibleUpload] Query:', req.query);

  // Snapshot inicial de body (pode estar vazio antes do multer)
  if (Object.keys(req.body || {}).length > 0) {
    console.log('🛰️ [flexibleUpload] Body inicial (antes do parse):', req.body);
  }

  // Tenta primeiro 'audioFiles'
  upload.array('audioFiles')(req, res, (err) => {
    if (err) {
      console.log('⚠️ [flexibleUpload] Tentativa com campo "audioFiles" falhou:', err.code, err.message);
    } else if (req.files && req.files.length > 0) {
      console.log(`✅ [flexibleUpload] Sucesso com campo "audioFiles" (${req.files.length} arquivo[s])`);
    }

    if (err && err.code === 'LIMIT_UNEXPECTED_FILE') {
      // Se falhou com 'audioFiles', tenta 'file'
      upload.array('file')(req, res, (err2) => {
        if (err2) {
          console.log('⚠️ [flexibleUpload] Tentativa com campo "file" (array) falhou:', err2.code, err2.message);
        } else if (req.files && req.files.length > 0) {
          console.log(`✅ [flexibleUpload] Sucesso com campo "file" (array) (${req.files.length} arquivo[s])`);
        }

        if (err2 && err2.code === 'LIMIT_UNEXPECTED_FILE') {
          // Se ambos falharam, tenta upload single 'file'
          upload.single('file')(req, res, (err3) => {
            if (err3) {
              console.log('❌ [flexibleUpload] Tentativa com campo "file" (single) falhou:', err3.code, err3.message);
              return res.status(400).json({
                success: false,
                message: 'Campo de arquivo não reconhecido. Use "audioFiles" ou "file"',
                expectedFields: ['audioFiles', 'file'],
                error: err3.message
              });
            }
            if (req.file) {
              console.log('✅ [flexibleUpload] Sucesso com campo "file" (single) 1 arquivo');
              req.files = [req.file];
            }
            next();
          });
        } else if (err2) {
          return res.status(400).json({ success: false, message: err2.message });
        } else {
          next();
        }
      });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    } else {
      next();
    }
  });
};

app.post('/api/upload', flexibleUpload, async (req, res) => {
  console.log('📥 [upload] Rota /api/upload chamada');
  console.log('📥 [upload] Campos do body após multer:', Object.keys(req.body || {}));
  if (req.files) {
    console.log(`📥 [upload] Arquivos recebidos: ${req.files.length}`);
    req.files.forEach((f, i) => {
      console.log(`   • [${i}] originalname=${f.originalname} size=${f.size} mimetype=${f.mimetype}`);
    });
  } else {
    console.log('📥 [upload] Nenhum arquivo em req.files');
  }
  try {
    if (!req.files || req.files.length === 0) {
      console.log('⚠️ [upload] Nenhum arquivo após middleware');
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo enviado'
      });
    }

    const newTracks = [];
    
    req.files.forEach((file, index) => {
      const duration = req.body[`duration_${index}`];
      const track = {
        id: `track_${Date.now()}_${index}`,
        title: path.parse(file.originalname).name,
        artist: 'Artista não definido',
        // CORREÇÃO: Para DigitalOcean Spaces, extrair apenas o nome do arquivo sem o prefixo "audio/"
        filename: file.key ? file.key.replace(/^audio\//, '') : file.filename,
        duration: duration ? parseFloat(duration) : 0,
        format: path.extname(file.originalname).toLowerCase(),
        // Prefer file.location (from multer-s3) over manually constructed URL
        url: file.location || storageConfig.getFileUrl(file.key || file.filename)
      };
      newTracks.push(track);
      catalog.tracks.push(track);
    });

    catalog.metadata.totalTracks = catalog.tracks.length;
    catalog.metadata.totalDuration = catalog.tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
    await saveCatalog();

    console.log(`✅ [upload] ${newTracks.length} arquivo(s) processado(s) com sucesso`);
    
    // Gerar arquivo contínuo para iPhone PWA automaticamente
    console.log('🔄 [continuous] Iniciando geração automática após upload...');
    try {
      await generateContinuousFile();
      console.log('✅ [continuous] Arquivo contínuo atualizado automaticamente');
    } catch (error) {
      console.warn('⚠️ [continuous] Erro na geração automática:', error.message);
    }

    res.json({
      success: true,
      message: `${newTracks.length} arquivo(s) processado(s) com sucesso`,
      tracks: newTracks,
      catalog: catalog
    });

  } catch (error) {
    console.error('❌ [upload] Erro no upload:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno no upload',
      error: error.message
    });
  }
});

app.put('/api/tracks/:id/metadata', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, artist } = req.body;
    
    const trackIndex = catalog.tracks.findIndex(track => track.id === id);
    if (trackIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Música não encontrada'
      });
    }

    // Atualizar metadados
    if (title !== undefined) catalog.tracks[trackIndex].title = title;
    if (artist !== undefined) catalog.tracks[trackIndex].artist = artist;
    
    catalog.metadata.totalTracks = catalog.tracks.length;
    catalog.metadata.totalDuration = catalog.tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
    await saveCatalog();

    res.json({
      success: true,
      message: 'Metadados atualizados com sucesso',
      track: catalog.tracks[trackIndex]
    });

  } catch (error) {
    console.error('Erro ao atualizar metadados:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao atualizar metadados'
    });
  }
});

app.delete('/api/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const trackIndex = catalog.tracks.findIndex(track => track.id === id);
    if (trackIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Música não encontrada'
      });
    }

    const deletedTrack = catalog.tracks[trackIndex];
    
    // Remover arquivo físico usando o storage config
    if (deletedTrack.filename) {
      const deleteSuccess = await storageConfig.deleteFile(deletedTrack.filename);
      if (deleteSuccess) {
        console.log(`🗑️ Arquivo removido: ${deletedTrack.filename}`);
      } else {
        console.log(`⚠️ Falha ao remover arquivo: ${deletedTrack.filename}`);
      }
    }
    
    // Remover do catálogo
    catalog.tracks.splice(trackIndex, 1);
    catalog.metadata.totalTracks = catalog.tracks.length;
    catalog.metadata.totalDuration = catalog.tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
    
    await saveCatalog();

    res.json({
      success: true,
      message: 'Música deletada com sucesso',
      deletedTrack: deletedTrack
    });

  } catch (error) {
    console.error('Erro ao deletar:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao deletar música'
    });
  }
});

app.post('/api/regenerate-catalog', async (req, res) => {
  catalog.metadata.totalTracks = catalog.tracks.length;
  catalog.metadata.totalDuration = catalog.tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
  await saveCatalog();
  
  res.json({
    success: true,
    message: 'Catálogo regenerado com sucesso',
    catalog: catalog
  });
});

// Sincronizar catálogo com arquivos reais do Spaces
app.post('/api/sync-catalog', async (req, res) => {
  try {
    console.log('🔄 [sync] Iniciando sincronização com DigitalOcean Spaces...');
    
    // Detectar se é modo completo (com enriquecimento de metadados)
    const fullMode = req.query.full === 'true' || req.body.full === true;
    console.log(`📊 [sync] Modo: ${fullMode ? 'COMPLETO (com metadados)' : 'BÁSICO'}`);
    
    if (!AWS) {
      throw new Error('AWS SDK não disponível');
    }
    
    const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT || 'atl1.digitaloceanspaces.com');
    const s3 = new AWS.S3({
      endpoint: spacesEndpoint,
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
      region: process.env.DO_SPACES_REGION || 'atl1'
    });
    
    const params = {
      Bucket: process.env.DO_SPACES_BUCKET || 'radio-importante-audio',
      Prefix: 'audio/',
      MaxKeys: 100
    };
    
    const data = await s3.listObjectsV2(params).promise();
    console.log(`📁 [sync] Encontrados ${data.Contents?.length || 0} objetos no Spaces`);
    
    if (!data.Contents) {
      throw new Error('Nenhum arquivo encontrado no Spaces');
    }
    
    // Filtrar apenas arquivos de áudio
    const audioFiles = data.Contents.filter(obj => {
      const key = obj.Key || '';
      return key.includes('audio/') && 
             (key.endsWith('.mp3') || key.endsWith('.wav') || key.endsWith('.aac') || key.endsWith('.flac') || key.endsWith('.mp4')) &&
             obj.Size && obj.Size > 1000; // Arquivos maiores que 1KB
    });
    
    console.log(`🎵 [sync] Arquivos de áudio válidos: ${audioFiles.length}`);
    
    // Carregar catálogo atual (se existir)
    let existingTracks = [];
    try {
      existingTracks = catalog.tracks || [];
    } catch (e) {
      console.log('📋 [sync] Nenhum catálogo existente encontrado, criando novo');
    }
    
    // Criar mapa de tracks existentes por filename para preservar metadados
    const existingTrackMap = {};
    existingTracks.forEach(track => {
      if (track.filename) {
        existingTrackMap[track.filename] = track;
      }
    });
    
    // Criar novo catálogo baseado nos arquivos reais
    const newTracks = audioFiles.map((obj, index) => {
      const filename = (obj.Key || '').replace('audio/', '');
      const fileExtension = path.extname(filename).toLowerCase();
      
      // Verificar se track já existe para preservar metadados
      const existingTrack = existingTrackMap[filename];
      
      // Gerar ID único baseado no timestamp e filename
      const trackId = existingTrack?.id || `track_${Date.now()}_${index}`;
      
      // Extrair título do filename (remover extensão e limpar)
      let title = path.basename(filename, fileExtension);
      
      // Se o filename tem padrão timestamp, tentar extrair título real
      if (title.match(/^\d+-.+/)) {
        title = title.replace(/^\d+-/, '').replace(/_/g, ' ');
      }
      
      return {
        id: trackId,
        title: existingTrack?.title || title || 'Título não definido',
        artist: existingTrack?.artist || 'Artista não definido',
        filename: filename,
        duration: existingTrack?.duration || 0, // Preservar duração existente
        format: fileExtension,
        needsMetadata: !existingTrack || !existingTrack.duration || existingTrack.duration === 0 || 
                      existingTrack.title === 'Título não definido' || existingTrack.artist === 'Artista não definido'
      };
    });
    
    let metadataStats = {
      durationComputed: 0,
      metadataFilled: 0,
      errors: 0
    };
    
    // [NOVO] Enriquecimento de metadados (apenas se fullMode=true)
    if (fullMode) {
      console.log('🏷️ [meta] Iniciando enriquecimento de metadados...');
      
      // Importar music-metadata dinamicamente (ESM)
      if (!parseNodeStream) {
        const musicMetadata = await import('music-metadata');
        parseNodeStream = musicMetadata.parseNodeStream;
      }
      
      // Limitar processamento para performance (máximo 20 por vez)
      const tracksNeedingMetadata = newTracks.filter(track => track.needsMetadata);
      const limitedTracks = tracksNeedingMetadata.slice(0, 20);
      
      console.log(`📊 [meta] Processando ${limitedTracks.length} de ${tracksNeedingMetadata.length} tracks que precisam de metadados`);
      
      for (const track of limitedTracks) {
        try {
          console.log(`🎵 [meta] Processando: ${track.filename}`);
          
          // Stream do arquivo do Spaces
          const stream = s3.getObject({ 
            Bucket: process.env.DO_SPACES_BUCKET || 'radio-importante-audio', 
            Key: `audio/${track.filename}` 
          }).createReadStream();
          
          // Extrair metadados
          const metadata = await parseNodeStream(stream);
          
          // Atualizar duração se necessário
          if (metadata.format && metadata.format.duration && (!track.duration || track.duration === 0)) {
            track.duration = Math.round(metadata.format.duration);
            metadataStats.durationComputed++;
            console.log(`⏱️ [meta] Duração calculada: ${track.duration}s`);
          }
          
          // Atualizar título se necessário
          if (metadata.common && metadata.common.title && track.title === 'Título não definido') {
            track.title = metadata.common.title;
            metadataStats.metadataFilled++;
            console.log(`🏷️ [meta] Título extraído: ${track.title}`);
          }
          
          // Atualizar artista se necessário
          if (metadata.common && metadata.common.artist && track.artist === 'Artista não definido') {
            track.artist = metadata.common.artist;
            console.log(`👤 [meta] Artista extraído: ${track.artist}`);
          }
          
          // Remover flag de necessidade de metadados
          delete track.needsMetadata;
          
        } catch (error) {
          console.error(`❌ [meta] Erro ao processar ${track.filename}:`, error.message);
          metadataStats.errors++;
          delete track.needsMetadata; // Remove flag mesmo com erro
        }
      }
      
      console.log(`✅ [meta] Enriquecimento concluído: ${metadataStats.durationComputed} durações, ${metadataStats.metadataFilled} metadados`);
    } else {
      // Remover flag de todas as tracks no modo básico
      newTracks.forEach(track => delete track.needsMetadata);
    }
    
    // Atualizar catálogo
    catalog.tracks = newTracks;
    catalog.metadata.totalTracks = newTracks.length;
    catalog.metadata.totalDuration = newTracks.reduce((sum, track) => sum + (track.duration || 0), 0);
    
    // Salvar catálogo atualizado
    await saveCatalog();
    
    console.log(`✅ [sync] Catálogo sincronizado: ${newTracks.length} tracks`);
    
    const response = {
      success: true,
      message: `Catálogo sincronizado com sucesso! ${newTracks.length} arquivos encontrados no Spaces.`,
      tracksFound: newTracks.length,
      added: newTracks.length - existingTracks.length, // Simplificado
      removed: Math.max(0, existingTracks.length - newTracks.length), // Simplificado
      updated: newTracks.length,
      saved: true
    };
    
    // Adicionar estatísticas de metadados se modo completo
    if (fullMode) {
      response.durationComputed = metadataStats.durationComputed;
      response.metadataFilled = metadataStats.metadataFilled;
      response.metadataErrors = metadataStats.errors;
    }
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ [sync] Erro na sincronização:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao sincronizar catálogo',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

app.post('/api/clear-catalog', async (req, res) => {
  catalog.tracks = [];
  catalog.metadata.totalTracks = 0;
  catalog.metadata.totalDuration = 0;
  await saveCatalog();
  
  res.json({
    success: true,
    message: 'Catálogo limpo com sucesso',
    catalog: catalog
  });
});

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
    
    const result = await generateContinuousFile();
    
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
    const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com');
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
      endpoint: process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com',
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

// Função para salvar catálogo localmente (fallback)
function saveCatalogLocally() {
  try {
    const catalogPath = process.env.CATALOG_PATH || path.join(process.cwd(), '..', 'public', 'data', 'catalog.json');
    const catalogDir = path.dirname(catalogPath);
    
    // Criar diretório se não existir
    if (!fs.existsSync(catalogDir)) {
      fs.mkdirSync(catalogDir, { recursive: true });
    }
    
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
    console.log('📝 [catalog] Catálogo salvo localmente (backup)');
  } catch (error) {
    console.error('❌ [catalog] Erro ao salvar catálogo localmente:', error);
  }
}

// Função para carregar catálogo do DigitalOcean Spaces
async function loadCatalogFromSpaces() {
  try {
    if (!process.env.DO_SPACES_KEY || !process.env.DO_SPACES_SECRET) {
      console.warn('⚠️ [catalog] Credenciais Spaces não configuradas, carregando localmente...');
      return false;
    }

    const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com');
    const s3 = new AWS.S3({
      endpoint: spacesEndpoint,
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
      region: process.env.DO_SPACES_REGION || 'nyc3'
    });

    const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
    
    const result = await s3.getObject({
      Bucket: bucket,
      Key: 'data/catalog.json'
    }).promise();

    const catalogData = JSON.parse(result.Body.toString());
    
    // Usar apenas os tracks no formato correto
    if (catalogData.tracks) {
      catalog.tracks = catalogData.tracks.map(track => ({
        id: track.id || track.filename?.replace(/\.[^/.]+$/, ''),
        filename: track.filename,
        title: track.title || track.filename?.replace(/\.[^/.]+$/, ''),
        artist: track.artist || 'Radio Importante',
        duration: track.duration || 0,
        size: track.size || 0,
        uploadDate: track.uploadDate || new Date().toISOString(),
        url: track.url || storageConfig.getFileUrl(`audio/${track.filename}`)
      }));

      // Atualizar metadata
      catalog.metadata.totalTracks = catalog.tracks.length;
      catalog.metadata.totalDuration = catalog.tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
      
      console.log(`✅ [catalog] Catálogo carregado do Spaces: ${catalog.tracks.length} tracks`);
      return true;
    }
    
  } catch (error) {
    if (error.code === 'NoSuchKey') {
      console.log('ℹ️ [catalog] Catálogo não existe no Spaces ainda, será criado no primeiro upload');
    } else {
      console.error('❌ [catalog] Erro ao carregar do Spaces:', error);
    }
    return false;
  }
}

// Função para upload para DigitalOcean Spaces
async function uploadToSpaces(localPath, spacesKey) {
  if (!AWS) {
    throw new Error('AWS SDK não disponível. Execute: npm install aws-sdk');
  }
  
  const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com');
  const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
    region: process.env.DO_SPACES_REGION || 'nyc3'
  });
  
  const fileContent = fs.readFileSync(localPath);
  const contentType = spacesKey.endsWith('.json') ? 'application/json' : 'audio/aac';
  
  const params = {
    Bucket: process.env.DO_SPACES_BUCKET || 'radio-importante-audio',
    Key: spacesKey,
    Body: fileContent,
    ContentType: contentType,
    ACL: 'public-read'
  };
  
  try {
    const result = await s3.upload(params).promise();
    console.log(`✅ [spaces] Upload: ${spacesKey} -> ${result.Location}`);
    return result;
  } catch (error) {
    console.error(`❌ [spaces] Erro upload ${spacesKey}:`, error);
    throw error;
  }
}

// ========== F2 HLS VOD GENERATION ENDPOINTS ==========

// Endpoint para gerar HLS VOD (assíncrono)
app.post('/api/generate-hls', async (req, res) => {
  try {
    console.log('🎬 [HLS] Iniciando geração de HLS VOD');
    
    // Configurações padrão
    const config = {
      shuffle: req.body.shuffle || true,
      limit: req.body.limit || 5,
      bitrate: req.body.bitrate || '128k',
      segment: req.body.segment || 6,
      mode: req.body.mode || 'latest' // 'latest' ou 'rolling'
    };
    
    console.log(`🎬 [HLS] Configuração: ${JSON.stringify(config)}`);
    
    // Validação básica
    if (config.limit > 20) {
      return res.status(400).json({ 
        error: 'Limite máximo de 20 faixas para evitar sobrecarga do servidor',
        limit: config.limit
      });
    }
    
    // Gerar ID único para o job
    const jobId = `hls_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Iniciar job assíncrono
    setImmediate(() => generateHLSJob(jobId, config));
    
    // Resposta imediata
    res.json({
      success: true,
      message: 'Job de geração HLS iniciado',
      jobId: jobId,
      config: config,
      statusUrl: `/api/hls-status?jobId=${jobId}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [HLS] Erro ao iniciar job:', error);
    res.status(500).json({ 
      error: 'Erro ao iniciar geração HLS',
      details: error.message 
    });
  }
});

// Endpoint para verificar status do HLS
app.get('/api/hls-status', async (req, res) => {
  try {
    const jobId = req.query.jobId;
    
    if (!jobId) {
      // Retornar status geral se não especificar jobId
      return res.json({
        latest: await getHLSStatus('latest'),
        rolling: await getHLSStatus('rolling')
      });
    }
    
    const status = await getHLSStatus(jobId);
    res.json(status);
    
  } catch (error) {
    console.error('❌ [HLS] Erro ao verificar status:', error);
    res.status(500).json({ 
      error: 'Erro ao verificar status HLS',
      details: error.message 
    });
  }
});

// Proxy para servir playlist HLS
app.get('/hls/latest/index.m3u8', async (req, res) => {
  try {
    console.log('📺 [HLS] Servindo playlist HLS latest');
    
    const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
    const endpoint = process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com';
    const spacesUrl = `https://${bucket}.${endpoint}/generated/hls/latest/index.m3u8`;
    
    // Fazer proxy para o Spaces
    const https = require('https');
    const request = https.get(spacesUrl, (spacesRes) => {
      res.set({
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Content-Length': spacesRes.headers['content-length'],
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*'
      });
      
      res.status(spacesRes.statusCode);
      spacesRes.pipe(res);
    });
    
    request.on('error', (error) => {
      console.error(`❌ [HLS] Erro ao acessar playlist: ${error.message}`);
      res.status(404).json({ error: 'Playlist HLS não encontrada' });
    });
    
  } catch (error) {
    console.error('❌ [HLS] Erro na rota de playlist:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Proxy para servir segmentos HLS
app.get('/hls/latest/:segment', async (req, res) => {
  try {
    const segment = req.params.segment;
    console.log(`📺 [HLS] Servindo segmento: ${segment}`);
    
    // Validar nome do segmento
    if (!segment.match(/^segment_\d{3}\.ts$/)) {
      return res.status(400).json({ error: 'Nome de segmento inválido' });
    }
    
    const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
    const endpoint = process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com';
    const spacesUrl = `https://${bucket}.${endpoint}/generated/hls/latest/${segment}`;
    
    // Fazer proxy para o Spaces
    const https = require('https');
    const request = https.get(spacesUrl, (spacesRes) => {
      res.set({
        'Content-Type': 'video/MP2T',
        'Content-Length': spacesRes.headers['content-length'],
        'Cache-Control': 'public, max-age=86400', // 24h cache para segmentos
        'Access-Control-Allow-Origin': '*'
      });
      
      res.status(spacesRes.statusCode);
      spacesRes.pipe(res);
    });
    
    request.on('error', (error) => {
      console.error(`❌ [HLS] Erro ao acessar segmento ${segment}: ${error.message}`);
      res.status(404).json({ error: 'Segmento HLS não encontrado' });
    });
    
  } catch (error) {
    console.error('❌ [HLS] Erro na rota de segmento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ========== F3 HLS ROLLING ROUTES ==========

// Proxy para servir playlist HLS Rolling
app.get('/hls/rolling/index.m3u8', async (req, res) => {
  const startTime = Date.now();
  const clientIP = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  try {
    saveAutoLog(`📺 [HLS Rolling] === REQUEST START ===`);
    saveAutoLog(`📺 [HLS Rolling] Client: ${clientIP}`);
    saveAutoLog(`📺 [HLS Rolling] User-Agent: ${userAgent.substring(0, 100)}...`);
    saveAutoLog(`📺 [HLS Rolling] Timestamp: ${new Date().toISOString()}`);
    
    const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
    const endpoint = process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com';
    const spacesUrl = `https://${bucket}.${endpoint}/generated/hls/rolling/index.m3u8`;
    
    saveAutoLog(`📺 [HLS Rolling] Fetching from: ${spacesUrl}`);
    
    // Fazer proxy para o Spaces
    const https = require('https');
    const request = https.get(spacesUrl, (spacesRes) => {
      const responseTime = Date.now() - startTime;
      saveAutoLog(`📺 [HLS Rolling] Spaces response status: ${spacesRes.statusCode} (${responseTime}ms)`);
      saveAutoLog(`📺 [HLS Rolling] Spaces headers: ${JSON.stringify(spacesRes.headers)}`);
      
      const headers = {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Content-Length': spacesRes.headers['content-length'],
        'Cache-Control': 'no-cache, no-store, must-revalidate', // Safari HLS otimizado
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Range',
        'Accept-Ranges': 'bytes'
      };
      
      saveAutoLog(`📺 [HLS Rolling] Response headers: ${JSON.stringify(headers)}`);
      res.set(headers);
      res.status(spacesRes.statusCode);
      
      let dataReceived = 0;
      spacesRes.on('data', (chunk) => {
        dataReceived += chunk.length;
      });
      
      spacesRes.on('end', () => {
        const totalTime = Date.now() - startTime;
        saveAutoLog(`📺 [HLS Rolling] Transfer complete: ${dataReceived} bytes in ${totalTime}ms`);
        saveAutoLog(`📺 [HLS Rolling] === REQUEST END ===`);
      });
      
      spacesRes.pipe(res);
    });
    
    request.on('error', (error) => {
      const errorTime = Date.now() - startTime;
      saveAutoLog(`❌ [HLS Rolling] Request error after ${errorTime}ms: ${error.message}`, 'error');
      res.status(404).json({ error: 'Playlist HLS Rolling não encontrada' });
    });
    
    request.setTimeout(10000, () => {
      saveAutoLog(`❌ [HLS Rolling] Request timeout after 10s to Spaces`, 'error');
      request.destroy();
    });
    
  } catch (error) {
    const errorTime = Date.now() - startTime;
    saveAutoLog(`❌ [HLS Rolling] Exception after ${errorTime}ms: ${error.message}`, 'error');
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Proxy para servir segmentos HLS Rolling
app.get('/hls/rolling/:segment', async (req, res) => {
  const startTime = Date.now();
  const segment = req.params.segment;
  const clientIP = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  try {
    saveAutoLog(`📺 [HLS Rolling Segment] === REQUEST START ===`);
    saveAutoLog(`📺 [HLS Rolling Segment] Segment: ${segment}`);
    saveAutoLog(`📺 [HLS Rolling Segment] Client: ${clientIP}`);
    saveAutoLog(`📺 [HLS Rolling Segment] User-Agent: ${userAgent.substring(0, 100)}...`);
    saveAutoLog(`📺 [HLS Rolling Segment] Timestamp: ${new Date().toISOString()}`);

    if (!segment.match(/^segment_\d{3}\.ts$/)) {
      saveAutoLog(`📺 [HLS Rolling Segment] Invalid segment name: ${segment}`, 'error');
      return res.status(400).json({ error: 'Nome de segmento inválido' });
    }

    const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
    const endpoint = process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com';
    const spacesUrl = `https://${bucket}.${endpoint}/generated/hls/rolling/${segment}`;
    saveAutoLog(`📺 [HLS Rolling Segment] Fetching: ${spacesUrl}`);

    const https = require('https');
    const request = https.get(spacesUrl, (spacesRes) => {
      const responseTime = Date.now() - startTime;
      saveAutoLog(`📺 [HLS Rolling Segment] Spaces response: ${spacesRes.statusCode} (${responseTime}ms)`);
      saveAutoLog(`📺 [HLS Rolling Segment] Content-Length: ${spacesRes.headers['content-length']}`);

      const headers = {
        'Content-Type': 'video/MP2T',
        'Content-Length': spacesRes.headers['content-length'],
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Range',
        'Accept-Ranges': 'bytes'
      };
      saveAutoLog(`📺 [HLS Rolling Segment] Response headers: ${JSON.stringify(headers)}`);
      res.set(headers);
      res.status(spacesRes.statusCode);

      let dataReceived = 0;
      spacesRes.on('data', (chunk) => { dataReceived += chunk.length; });
      spacesRes.on('end', () => {
        const totalTime = Date.now() - startTime;
        saveAutoLog(`📺 [HLS Rolling Segment] Transfer complete: ${dataReceived} bytes in ${totalTime}ms`);
        saveAutoLog(`📺 [HLS Rolling Segment] === REQUEST END ===`);
      });
      spacesRes.on('error', (error) => {
        const errorTime = Date.now() - startTime;
        saveAutoLog(`📺 [HLS Rolling Segment] Stream error after ${errorTime}ms: ${error.message}`, 'error');
      });
      spacesRes.pipe(res);
    });

    request.on('error', (error) => {
      const errorTime = Date.now() - startTime;
      saveAutoLog(`❌ [HLS Rolling Segment] Request error after ${errorTime}ms: ${error.message}`, 'error');
      res.status(404).json({ error: 'Segmento HLS Rolling não encontrado' });
    });

    request.setTimeout(15000, () => {
      const errorTime = Date.now() - startTime;
      saveAutoLog(`❌ [HLS Rolling Segment] Request timeout after ${errorTime}ms for ${segment}`, 'error');
      request.destroy();
    });
  } catch (error) {
    const errorTime = Date.now() - startTime;
    saveAutoLog(`❌ [HLS Rolling Segment] Exception after ${errorTime}ms: ${error.message}`, 'error');
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Alias routes for backward compatibility (/api/hls/rolling/* -> /hls/rolling/*)
// These duplicate the logic of the canonical routes, adding a small alias log marker.
app.get('/api/hls/rolling/index.m3u8', async (req, res) => {
  const startTime = Date.now();
  const clientIP = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  try {
    saveAutoLog(`📺 [HLS Rolling Alias] === REQUEST START (playlist alias) ===`);
    saveAutoLog(`📺 [HLS Rolling Alias] Client: ${clientIP}`);
    saveAutoLog(`📺 [HLS Rolling Alias] User-Agent: ${userAgent.substring(0, 100)}...`);
    saveAutoLog(`📺 [HLS Rolling Alias] Timestamp: ${new Date().toISOString()}`);

    const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
    const endpoint = process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com';
    const spacesUrl = `https://${bucket}.${endpoint}/generated/hls/rolling/index.m3u8`;
    saveAutoLog(`📺 [HLS Rolling Alias] Fetching from: ${spacesUrl}`);

    const https = require('https');
    const request = https.get(spacesUrl, (spacesRes) => {
      const responseTime = Date.now() - startTime;
      saveAutoLog(`📺 [HLS Rolling Alias] Spaces response status: ${spacesRes.statusCode} (${responseTime}ms)`);
      saveAutoLog(`📺 [HLS Rolling Alias] Spaces headers: ${JSON.stringify(spacesRes.headers)}`);

      const headers = {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Content-Length': spacesRes.headers['content-length'],
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Range',
        'Accept-Ranges': 'bytes'
      };
      saveAutoLog(`📺 [HLS Rolling Alias] Response headers: ${JSON.stringify(headers)}`);
      res.set(headers);
      res.status(spacesRes.statusCode);

      let dataReceived = 0;
      spacesRes.on('data', (chunk) => { dataReceived += chunk.length; });
      spacesRes.on('end', () => {
        const totalTime = Date.now() - startTime;
        saveAutoLog(`📺 [HLS Rolling Alias] Transfer complete: ${dataReceived} bytes in ${totalTime}ms`);
        saveAutoLog(`📺 [HLS Rolling Alias] === REQUEST END ===`);
      });
      spacesRes.pipe(res);
    });

    request.on('error', (error) => {
      const errorTime = Date.now() - startTime;
      saveAutoLog(`❌ [HLS Rolling Alias] Request error after ${errorTime}ms: ${error.message}`, 'error');
      res.status(404).json({ error: 'Playlist HLS Rolling não encontrada' });
    });

    request.setTimeout(10000, () => {
      saveAutoLog(`❌ [HLS Rolling Alias] Request timeout after 10s to Spaces`, 'error');
      request.destroy();
    });
  } catch (error) {
    const errorTime = Date.now() - startTime;
    saveAutoLog(`❌ [HLS Rolling Alias] Exception after ${errorTime}ms: ${error.message}`, 'error');
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/api/hls/rolling/:segment', async (req, res) => {
  const startTime = Date.now();
  const segment = req.params.segment;
  const clientIP = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  try {
    saveAutoLog(`📺 [HLS Rolling Segment Alias] === REQUEST START ===`);
    saveAutoLog(`📺 [HLS Rolling Segment Alias] Segment: ${segment}`);
    saveAutoLog(`📺 [HLS Rolling Segment Alias] Client: ${clientIP}`);
    saveAutoLog(`📺 [HLS Rolling Segment Alias] User-Agent: ${userAgent.substring(0, 100)}...`);
    saveAutoLog(`📺 [HLS Rolling Segment Alias] Timestamp: ${new Date().toISOString()}`);

    if (!segment.match(/^segment_\d{3}\.ts$/)) {
      saveAutoLog(`📺 [HLS Rolling Segment Alias] Invalid segment name: ${segment}`, 'error');
      return res.status(400).json({ error: 'Nome de segmento inválido' });
    }

    const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
    const endpoint = process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com';
    const spacesUrl = `https://${bucket}.${endpoint}/generated/hls/rolling/${segment}`;
    saveAutoLog(`📺 [HLS Rolling Segment Alias] Fetching: ${spacesUrl}`);

    const https = require('https');
    const request = https.get(spacesUrl, (spacesRes) => {
      const responseTime = Date.now() - startTime;
      saveAutoLog(`📺 [HLS Rolling Segment Alias] Spaces response: ${spacesRes.statusCode} (${responseTime}ms)`);
      saveAutoLog(`📺 [HLS Rolling Segment Alias] Content-Length: ${spacesRes.headers['content-length']}`);

      const headers = {
        'Content-Type': 'video/MP2T',
        'Content-Length': spacesRes.headers['content-length'],
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Range',
        'Accept-Ranges': 'bytes'
      };
      saveAutoLog(`📺 [HLS Rolling Segment Alias] Response headers: ${JSON.stringify(headers)}`);
      res.set(headers);
      res.status(spacesRes.statusCode);

      let dataReceived = 0;
      spacesRes.on('data', (chunk) => { dataReceived += chunk.length; });
      spacesRes.on('end', () => {
        const totalTime = Date.now() - startTime;
        saveAutoLog(`📺 [HLS Rolling Segment Alias] Transfer complete: ${dataReceived} bytes in ${totalTime}ms`);
        saveAutoLog(`📺 [HLS Rolling Segment Alias] === REQUEST END ===`);
      });
      spacesRes.on('error', (error) => {
        const errorTime = Date.now() - startTime;
        saveAutoLog(`📺 [HLS Rolling Segment Alias] Stream error after ${errorTime}ms: ${error.message}`, 'error');
      });
      spacesRes.pipe(res);
    });

    request.on('error', (error) => {
      const errorTime = Date.now() - startTime;
      saveAutoLog(`❌ [HLS Rolling Segment Alias] Request error after ${errorTime}ms: ${error.message}`, 'error');
      res.status(404).json({ error: 'Segmento HLS Rolling não encontrado' });
    });

    request.setTimeout(15000, () => {
      const errorTime = Date.now() - startTime;
      saveAutoLog(`❌ [HLS Rolling Segment Alias] Request timeout after ${errorTime}ms for ${segment}`, 'error');
      request.destroy();
    });
  } catch (error) {
    const errorTime = Date.now() - startTime;
    saveAutoLog(`❌ [HLS Rolling Segment Alias] Exception after ${errorTime}ms: ${error.message}`, 'error');
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Status HLS Rolling
app.get('/api/hls-rolling-status', async (req, res) => {
  try {
    console.log('📊 [HLS] Consultando status rolling');
    
    const status = await getHLSStatus('rolling');
    res.json({
      rolling: status
    });
    
  } catch (error) {
    console.error('❌ [HLS] Erro ao consultar status rolling:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para ver logs em tempo real
app.get('/api/hls-logs', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    totalLogs: hlsLogs.length,
    logs: hlsLogs.slice(0, 50) // Últimos 50 logs
  });
});

// Endpoint para limpar logs
app.post('/api/hls-logs/clear', (req, res) => {
  const previousCount = hlsLogs.length;
  hlsLogs = [];
  res.json({
    message: `${previousCount} logs limpos`,
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint para diagnóstico HLS Rolling
app.get('/api/hls-rolling-debug', async (req, res) => {
  try {
    addHLSLog('DEBUG', 'HLS Rolling debug endpoint accessed');
    
    const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
    const endpoint = process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com';
    const spacesUrl = `https://${bucket}.${endpoint}/generated/hls/rolling/index.m3u8`;
    
    addHLSLog('DEBUG', 'Testing direct Spaces access', { spacesUrl });
    
    // Testar acesso direto ao Spaces
    const https = require('https');
    const testPromise = new Promise((resolve, reject) => {
      const startTime = Date.now();
      const request = https.get(spacesUrl, (spacesRes) => {
        const responseTime = Date.now() - startTime;
        addHLSLog('DEBUG', `Spaces direct response: ${spacesRes.statusCode}`, { responseTime });
        
        let data = '';
        spacesRes.on('data', chunk => data += chunk);
        spacesRes.on('end', () => {
          const totalTime = Date.now() - startTime;
          addHLSLog('DEBUG', `Spaces response complete: ${data.length} bytes`, { totalTime });
          resolve({
            statusCode: spacesRes.statusCode,
            headers: spacesRes.headers,
            data: data
          });
        });
      });
      
      request.on('error', (err) => {
        reject(err);
      });
    });
    
    const testResult = await testPromise;
    
    res.json({
      timestamp: new Date().toISOString(),
      spacesUrl,
      testResult,
      message: 'HLS Rolling debug successful'
    });
    
  } catch (error) {
    addHLSLog('ERROR', 'Error in debug endpoint', { error: error.message });
    res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ========== F2 HLS GENERATION LOGIC ==========

async function generateHLSJob(jobId, config) {
  console.log(`🎬 [HLS] Job ${jobId} iniciado`);
  
  try {
    // Salvar status inicial
    await saveHLSStatus(jobId, {
      status: 'processing',
      progress: 0,
      message: 'Iniciando geração HLS',
      config: config,
      startTime: new Date().toISOString()
    });
    
    // F3: Para rolling mode, salvar status também no endpoint rolling
    if (config.mode === 'rolling') {
      await saveHLSStatus('rolling', {
        status: 'processing',
        progress: 0,
        message: 'Iniciando geração HLS Rolling',
        jobId: jobId,
        config: config,
        startTime: new Date().toISOString()
      });
    }
    
    // Helper para atualizar status em ambos os lugares quando rolling
    const updateHLSStatus = async (status) => {
      await saveHLSStatus(jobId, status);
      if (config.mode === 'rolling') {
        await saveHLSStatus('rolling', { ...status, jobId: jobId });
      }
    };
    
    // Importar ffmpeg dinamicamente
    const ffmpegStatic = require('ffmpeg-static');
    const ffmpeg = require('fluent-ffmpeg');
    ffmpeg.setFfmpegPath(ffmpegStatic);
    
    console.log(`🎬 [HLS] FFmpeg path: ${ffmpegStatic}`);
    
    // 1. Obter lista de faixas do catálogo
    await saveHLSStatus(jobId, {
      status: 'processing',
      progress: 10,
      message: 'Carregando catálogo de músicas'
    });
    
    const tracks = catalog.tracks || [];
    if (tracks.length === 0) {
      throw new Error('Nenhuma faixa encontrada no catálogo');
    }
    
    // 2. Selecionar e embaralhar faixas
    let selectedTracks = [...tracks];
    if (config.shuffle) {
      selectedTracks = selectedTracks.sort(() => Math.random() - 0.5);
    }
    selectedTracks = selectedTracks.slice(0, config.limit);
    
    console.log(`🎬 [HLS] Faixas selecionadas: ${selectedTracks.length}`);
    
    // 3. Baixar arquivos MP3 temporariamente
    await updateHLSStatus({
      status: 'processing',
      progress: 20,
      message: `Baixando ${selectedTracks.length} faixas`
    });
    
    const tempDir = `/tmp/hls_${jobId}`;
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFiles = [];
    for (let i = 0; i < selectedTracks.length; i++) {
      const track = selectedTracks[i];
      const tempFile = path.join(tempDir, `track_${i}.mp3`);
      
      await downloadTrackToTemp(track.filename, tempFile);
      tempFiles.push(tempFile);
      
      const progress = 20 + (i / selectedTracks.length) * 20;
      await updateHLSStatus({
        status: 'processing',
        progress: Math.round(progress),
        message: `Baixando: ${track.title || track.filename}`
      });
    }
    
    // 4. Gerar HLS usando FFmpeg
    await updateHLSStatus({
      status: 'processing',
      progress: 50,
      message: 'Processando áudio para HLS'
    });
    
    const outputDir = path.join(tempDir, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    await generateHLSFromFiles(tempFiles, outputDir, config);
    
    // 5. Upload para Spaces (com publicação atômica para rolling)
    await updateHLSStatus({
      status: 'processing',
      progress: 80,
      message: 'Fazendo upload para Spaces'
    });
    
    let targetPath;
    if (config.mode === 'rolling') {
      // F3: Publicação atômica - upload para tmp primeiro
      targetPath = `generated/hls/tmp/${jobId}`;
      console.log(`🎬 [HLS] Rolling mode: upload atômico para ${targetPath}`);
    } else {
      // F2: Upload direto para latest
      targetPath = 'generated/hls/latest';
    }
    
    await uploadHLSToSpaces(outputDir, targetPath);
    
    // 6. Salvar manifesto
    const manifest = {
      status: finalStatus,      jobId: jobId,
      tracks: selectedTracks.map(t => ({
        title: t.title,
        artist: t.artist,
        filename: t.filename,
        duration: t.duration
      })),
      config: config,
      createdAt: new Date().toISOString(),
      totalDuration: selectedTracks.reduce((sum, t) => sum + (t.duration || 0), 0)
    };
    
    await saveManifestToSpaces(manifest, `${targetPath}/manifest.json`);
    
    // F3: Publicação atômica para rolling mode
    if (config.mode === 'rolling') {
      await updateHLSStatus({
        status: 'processing',
        progress: 95,
        message: 'Publicando atomicamente para rolling'
      });
      
      console.log(`🎬 [HLS] Iniciando publicação atômica de tmp/${jobId} para rolling`);
      await publishRollingHLS(jobId);
    }
    
    // 7. Status final
    const finalTargetPath = config.mode === 'rolling' ? 'generated/hls/rolling' : targetPath;
    const finalStatus = config.mode === 'rolling' ? 'published' : 'completed';
    await updateHLSStatus({
      status: finalStatus,
      progress: 100,
      message: config.mode === 'rolling' ? 'HLS Rolling publicado com sucesso' : 'HLS gerado com sucesso',
      manifest: manifest,
      playlistUrl: `/${finalTargetPath.replace('generated/', '')}/index.m3u8`,
      endTime: new Date().toISOString()
    });
    
    // Limpar arquivos temporários
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    console.log(`✅ [HLS] Job ${jobId} concluído com sucesso`);
    
  } catch (error) {
    console.error(`❌ [HLS] Job ${jobId} falhou:`, error);
    
    // Para erro, salvar tanto no jobId quanto no rolling se aplicável
    const errorStatus = {
      status: 'failed',
      progress: 0,
      message: `Erro: ${error.message}`,
      error: error.message,
      endTime: new Date().toISOString()
    };
    
    await saveHLSStatus(jobId, errorStatus);
    if (config.mode === 'rolling') {
      await saveHLSStatus('rolling', { ...errorStatus, jobId: jobId });
    }
  }
}

// ========== F2 HELPER FUNCTIONS ==========

async function downloadTrackToTemp(filename, tempFile) {
  const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
  const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com');
  const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
    region: process.env.DO_SPACES_REGION || 'nyc3'
  });
  
  const params = {
    Bucket: bucket,
    Key: `audio/${filename}`
  };
  
  const readStream = s3.getObject(params).createReadStream();
  const writeStream = fs.createWriteStream(tempFile);
  
  return new Promise((resolve, reject) => {
    readStream.pipe(writeStream);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
    readStream.on('error', reject);
  });
}

async function generateHLSFromFiles(inputFiles, outputDir, config) {
  const ffmpeg = require('fluent-ffmpeg');
  
  return new Promise((resolve, reject) => {
    let command = ffmpeg();
    
    // Adicionar todos os arquivos de entrada
    inputFiles.forEach(file => {
      command = command.input(file);
    });
    
    // Concatenar e configurar HLS
    command
      .complexFilter(`concat=n=${inputFiles.length}:v=0:a=1[a]`)
      .map('[a]')
      .audioCodec('aac')
      .audioBitrate(config.bitrate)
      .audioFrequency(44100)
      .format('hls')
      .outputOptions([
        `-hls_time ${config.segment}`,
        '-hls_list_size 0',
        '-hls_segment_filename ' + path.join(outputDir, 'segment_%03d.ts')
      ])
      .output(path.join(outputDir, 'index.m3u8'))
      .on('end', () => {
        console.log('✅ [HLS] FFmpeg processamento concluído');
        resolve();
      })
      .on('error', (err) => {
        console.error('❌ [HLS] FFmpeg erro:', err);
        reject(err);
      })
      .on('progress', (progress) => {
        console.log(`🎬 [HLS] FFmpeg progresso: ${Math.round(progress.percent || 0)}%`);
      })
      .run();
  });
}

async function uploadHLSToSpaces(localDir, targetPath) {
  const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
  const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com');
  const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
    region: process.env.DO_SPACES_REGION || 'nyc3'
  });
  
  const files = fs.readdirSync(localDir);
  
  for (const file of files) {
    const localFile = path.join(localDir, file);
    const key = `${targetPath}/${file}`;
    
    let contentType = 'application/octet-stream';
    if (file.endsWith('.m3u8')) {
      contentType = 'application/vnd.apple.mpegurl';
    } else if (file.endsWith('.ts')) {
      contentType = 'video/MP2T';
    }
    
    const fileContent = fs.readFileSync(localFile);
    
    await s3.upload({
      Bucket: bucket,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
      ACL: 'public-read'
    }).promise();
    
    console.log(`📤 [HLS] Upload: ${key}`);
  }
}

async function saveManifestToSpaces(manifest, key) {
  const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
  const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com');
  const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
    region: process.env.DO_SPACES_REGION || 'nyc3'
  });
  
  await s3.upload({
    Bucket: bucket,
    Key: key,
    Body: JSON.stringify(manifest, null, 2),
    ContentType: 'application/json',
    ACL: 'public-read'
  }).promise();
  
  console.log(`📄 [HLS] Manifesto salvo: ${key}`);
}

async function saveHLSStatus(jobId, status) {
  let key;
  if (jobId === 'latest' || jobId === 'rolling') {
    key = `generated/status/hls-${jobId}-status.json`;
  } else {
    key = `generated/status/hls-${jobId}.json`;
  }
  
  const fullStatus = {
    jobId: jobId,
    ...status,
    updatedAt: new Date().toISOString()
  };
  
  try {
    await saveManifestToSpaces(fullStatus, key);
    console.log(`💾 [HLS] Status salvo: ${key}`);
  } catch (error) {
    console.error(`❌ [HLS] Erro ao salvar status ${jobId}:`, error);
  }
}

async function getHLSStatus(jobIdOrMode) {
  try {
    const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
    const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com');
    const s3 = new AWS.S3({
      endpoint: spacesEndpoint,
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
      region: process.env.DO_SPACES_REGION || 'nyc3'
    });
    
    let key;
    if (jobIdOrMode === 'latest' || jobIdOrMode === 'rolling') {
      key = `generated/status/hls-${jobIdOrMode}-status.json`;
    } else {
      key = `generated/status/hls-${jobIdOrMode}.json`;
    }
    
    const data = await s3.getObject({
      Bucket: bucket,
      Key: key
    }).promise();
    
    return JSON.parse(data.Body.toString());
    
  } catch (error) {
    return {
      status: 'not_found',
      message: `Status não encontrado para: ${jobIdOrMode}`
    };
  }
}

// ===========================================================

// 404 Handler
app.use('*', notFoundHandler);

// Error Handler
app.use(errorHandler);

// ========== F3 ATOMIC PUBLISHING ==========

async function publishRollingHLS(jobId) {
  console.log(`🔄 [HLS] Publicação atômica: tmp/${jobId} → rolling`);
  
  const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
  const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com');
  const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
    region: process.env.DO_SPACES_REGION || 'nyc3'
  });
  
  try {
    // 1. Listar arquivos do tmp
    const tmpPrefix = `generated/hls/tmp/${jobId}/`;
    const tmpObjects = await s3.listObjectsV2({
      Bucket: bucket,
      Prefix: tmpPrefix
    }).promise();
    
    if (!tmpObjects.Contents || tmpObjects.Contents.length === 0) {
      throw new Error(`Nenhum arquivo encontrado em ${tmpPrefix}`);
    }
    
    console.log(`📁 [HLS] Encontrados ${tmpObjects.Contents.length} arquivos para publicar`);
    
    // 2. Copiar arquivos de tmp para rolling (operação atômica)
    const copyPromises = tmpObjects.Contents.map(async (obj) => {
      const sourceKey = obj.Key;
      const targetKey = sourceKey.replace(`generated/hls/tmp/${jobId}/`, 'generated/hls/rolling/');
      
      console.log(`📋 [HLS] Copiando: ${sourceKey} → ${targetKey}`);
      
      // Primeiro copia o arquivo
      await s3.copyObject({
        Bucket: bucket,
        CopySource: `${bucket}/${sourceKey}`,
        Key: targetKey,
        MetadataDirective: 'COPY'
      }).promise();
      
      // Depois aplica ACL público separadamente
      await s3.putObjectAcl({
        Bucket: bucket,
        Key: targetKey,
        ACL: 'public-read'
      }).promise();
      
      console.log(`🔓 [HLS] ACL aplicado: ${targetKey}`);
    });
    
    await Promise.all(copyPromises);
    console.log(`✅ [HLS] Publicação atômica concluída: ${copyPromises.length} arquivos`);
    
    // 3. Limpar diretório tmp
    const deletePromises = tmpObjects.Contents.map(obj => ({
      Key: obj.Key
    }));
    
    if (deletePromises.length > 0) {
      await s3.deleteObjects({
        Bucket: bucket,
        Delete: {
          Objects: deletePromises
        }
      }).promise();
      console.log(`🗑️ [HLS] Limpeza tmp concluída: ${deletePromises.length} arquivos removidos`);
    }
    
    // 4. Salvar status rolling
    await saveHLSStatus('rolling', {
      status: 'published',
      progress: 100,
      message: 'HLS Rolling publicado com sucesso',
      publishedFrom: jobId,
      publishedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`❌ [HLS] Erro na publicação atômica:`, error);
    throw error;
  }
}

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🎵 Radio Importante Backend v2.2.4 running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📁 Catalog tracks: ${catalog.tracks.length}`);
  
  // Diagnostic logs for environment variables (without exposing secrets)
  console.log('🔍 Storage Configuration Diagnostics:');
  console.log(`  DO_SPACES_KEY: ${process.env.DO_SPACES_KEY ? 'SET' : 'NOT SET'}`);
  console.log(`  DO_SPACES_SECRET: ${process.env.DO_SPACES_SECRET ? 'SET' : 'NOT SET'}`);
  console.log(`  DO_SPACES_BUCKET: ${process.env.DO_SPACES_BUCKET || 'NOT SET'}`);
  console.log(`  DO_SPACES_ENDPOINT: ${process.env.DO_SPACES_ENDPOINT || 'NOT SET'}`);
  console.log(`  DO_SPACES_REGION: ${process.env.DO_SPACES_REGION || 'NOT SET'}`);
  
  // Show storage type being used
  if (process.env.DO_SPACES_KEY && process.env.DO_SPACES_SECRET) {
    console.log(`🌊 Using Digital Ocean Spaces: ${process.env.DO_SPACES_BUCKET}.${process.env.DO_SPACES_ENDPOINT}`);
  } else {
    console.log(`📁 Upload path: ${process.env.UPLOAD_PATH || path.join(process.cwd(), 'public', 'audio')}`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received, shutting down gracefully');  
  process.exit(0);
});
