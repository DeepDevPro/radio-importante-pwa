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
let AWS;
try {
  AWS = require('aws-sdk');
} catch (e) {
  console.warn('⚠️ aws-sdk não encontrado. Instale com: npm install aws-sdk');
}

const app = express();

// Configuração básica
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS para desenvolvimento
app.use((req, res, next) => {
  const corsOrigins = process.env.CORS_ORIGINS || 'https://radio.importantestudio.com';
  const allowedOrigins = corsOrigins.split(',').map(origin => origin.trim());
  const requestOrigin = req.headers.origin;
  
  if (allowedOrigins.includes(requestOrigin)) {
    res.header('Access-Control-Allow-Origin', requestOrigin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

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
    console.log('🍎 [iPhone PWA] Solicitação de arquivo contínuo AAC');
    
    // Construir URL do arquivo no Spaces
    const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
    const endpoint = process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com';
    const spacesUrl = `https://${bucket}.${endpoint}/radio-importante-continuous.aac`;
    
    console.log(`🎯 [continuous] Proxy request: ${spacesUrl}`);
    
    // Fazer proxy para o Spaces
    const https = require('https');
    const request = https.get(spacesUrl, (spacesRes) => {
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
      console.error(`❌ [continuous] Erro ao acessar Spaces: ${error.message}`);
      res.status(404).json({ error: 'Arquivo contínuo não encontrado' });
    });
    
  } catch (error) {
    console.error('❌ [continuous] Erro na rota:', error);
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

// Catálogo em memória (formato compatível com frontend)
let catalog = {
  version: "v2.2.4",
  tracks: [],
  metadata: {
    totalTracks: 0,
    totalDuration: 0,
    artwork: "/icons/icon-192x192.png",
    radioName: "Radio Importante"
  }
};

// Tentar carregar catálogo existente
try {
  const catalogPath = process.env.CATALOG_PATH || path.join(process.cwd(), '..', 'public', 'data', 'catalog.json');
  if (fs.existsSync(catalogPath)) {
    const catalogData = fs.readFileSync(catalogPath, 'utf8');
    const loadedCatalog = JSON.parse(catalogData);
    
    // Usar apenas os tracks no formato correto
    if (loadedCatalog.tracks) {
      catalog.tracks = loadedCatalog.tracks.map(track => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        filename: track.filename,
        duration: track.duration || 0,
        format: track.format || path.extname(track.filename).toLowerCase()
      }));
      
      catalog.metadata.totalTracks = catalog.tracks.length;
      catalog.metadata.totalDuration = catalog.tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
    }
  }
} catch (error) {
  console.log('⚠️ Catálogo não encontrado, usando catálogo vazio');
}

// API Routes
app.get('/api/catalog', (req, res) => {
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
    saveCatalog();

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

app.put('/api/tracks/:id/metadata', (req, res) => {
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
    saveCatalog();

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
    
    saveCatalog();

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

app.post('/api/regenerate-catalog', (req, res) => {
  catalog.metadata.totalTracks = catalog.tracks.length;
  catalog.metadata.totalDuration = catalog.tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
  saveCatalog();
  
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
    
    // Criar novo catálogo baseado nos arquivos reais
    const newTracks = audioFiles.map((obj, index) => {
      const filename = (obj.Key || '').replace('audio/', '');
      const fileExtension = path.extname(filename).toLowerCase();
      
      // Gerar ID único baseado no timestamp e filename
      const trackId = `track_${Date.now()}_${index}`;
      
      // Extrair título do filename (remover extensão e limpar)
      let title = path.basename(filename, fileExtension);
      
      // Se o filename tem padrão timestamp, tentar extrair título real
      if (title.match(/^\d+-.+/)) {
        title = title.replace(/^\d+-/, '').replace(/_/g, ' ');
      }
      
      return {
        id: trackId,
        title: title || 'Título não definido',
        artist: 'Artista não definido',
        filename: filename,
        duration: 0, // Será calculado posteriormente se necessário
        format: fileExtension
      };
    });
    
    // Atualizar catálogo
    catalog.tracks = newTracks;
    catalog.metadata.totalTracks = newTracks.length;
    catalog.metadata.totalDuration = 0; // Será calculado conforme necessário
    
    // Salvar catálogo atualizado
    saveCatalog();
    
    console.log(`✅ [sync] Catálogo sincronizado: ${newTracks.length} tracks`);
    
    res.json({
      success: true,
      message: `Catálogo sincronizado com sucesso! ${newTracks.length} arquivos encontrados no Spaces.`,
      tracksFound: newTracks.length,
      catalog: catalog
    });
    
  } catch (error) {
    console.error('❌ [sync] Erro na sincronização:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao sincronizar catálogo',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

app.post('/api/clear-catalog', (req, res) => {
  catalog.tracks = [];
  catalog.metadata.totalTracks = 0;
  catalog.metadata.totalDuration = 0;
  saveCatalog();
  
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

// Função para salvar catálogo
function saveCatalog() {
  try {
    const catalogPath = process.env.CATALOG_PATH || path.join(process.cwd(), '..', 'public', 'data', 'catalog.json');
    const catalogDir = path.dirname(catalogPath);
    
    // Criar diretório se não existir
    if (!fs.existsSync(catalogDir)) {
      fs.mkdirSync(catalogDir, { recursive: true });
    }
    
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
    console.log('📝 Catálogo salvo com sucesso');
  } catch (error) {
    console.error('❌ Erro ao salvar catálogo:', error);
  }
}

// Função para gerar arquivo contínuo para iPhone PWA
async function generateContinuousFile() {
  console.log('🔧 [continuous] Iniciando geração...');
  
  // 1. Verificar se FFmpeg está disponível
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
    console.log('✅ [continuous] FFmpeg encontrado');
  } catch (error) {
    throw new Error('FFmpeg não encontrado. Necessário para gerar arquivo contínuo.');
  }
  
  // 2. Baixar arquivos do Spaces para temp
  const tempDir = path.join(os.tmpdir(), 'radio-importante-continuous');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  console.log(`📁 [continuous] Diretório temporário: ${tempDir}`);
  
  const trackFiles = [];
  const trackCues = [];
  let currentTime = 0;
  
  const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
  const endpoint = process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com';
  
  // 3. Baixar cada arquivo e calcular cues
  for (let i = 0; i < catalog.tracks.length; i++) {
    const track = catalog.tracks[i];
    const tempFilePath = path.join(tempDir, `track_${i}_${track.filename}`);
    
    try {
      console.log(`⬇️ [continuous] Baixando: ${track.filename}`);
      
      // Baixar arquivo do Spaces
      const spacesUrl = `https://${bucket}.${endpoint}/audio/${track.filename}`;
      
      await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(tempFilePath);
        const request = https.get(spacesUrl, (response) => {
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        });
        
        request.on('error', (err) => {
          fs.unlink(tempFilePath, () => {}); // Delete temp file on error
          reject(err);
        });
      });
      
      // Obter duração real do arquivo
      let duration;
      try {
        const ffprobeCmd = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${tempFilePath}"`;
        const durationStr = execSync(ffprobeCmd, { encoding: 'utf8' }).trim();
        duration = parseFloat(durationStr) || track.duration || 300;
      } catch (e) {
        duration = track.duration || 300; // Fallback para duração do catálogo
      }
      
      trackFiles.push(tempFilePath);
      
      // Criar cue para esta track
      trackCues.push({
        id: track.id,
        title: track.title,
        artist: track.artist,
        genre: track.genre || 'Unknown',
        startTime: currentTime,
        endTime: currentTime + duration,
        duration: duration,
        filename: track.filename
      });
      
      currentTime += duration;
      console.log(`✅ [continuous] ${track.filename} - ${duration.toFixed(1)}s`);
      
    } catch (error) {
      console.warn(`⚠️ [continuous] Erro ao baixar ${track.filename}:`, error.message);
      // Continuar sem este arquivo
    }
  }
  
  if (trackFiles.length === 0) {
    throw new Error('Nenhum arquivo válido encontrado para gerar arquivo contínuo');
  }
  
  // 4. Criar lista de arquivos para FFmpeg
  const fileListPath = path.join(tempDir, 'filelist.txt');
  const fileListContent = trackFiles.map(file => `file '${file}'`).join('\n');
  fs.writeFileSync(fileListPath, fileListContent);
  
  // 5. Gerar arquivo contínuo AAC
  const outputPath = path.join(tempDir, 'radio-importante-continuous.aac');
  console.log('🎬 [continuous] Executando FFmpeg...');
  
  const ffmpegCmd = [
    'ffmpeg',
    '-f concat',
    '-safe 0',
    `-i "${fileListPath}"`,
    '-c:a aac',
    '-b:a 128k',
    '-y',
    `"${outputPath}"`
  ].join(' ');
  
  try {
    execSync(ffmpegCmd, { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024 * 100 // 100MB buffer
    });
    console.log('✅ [continuous] Arquivo AAC gerado');
  } catch (error) {
    throw new Error(`Erro FFmpeg: ${error.message}`);
  }
  
  // 6. Criar track-cues.json
  const trackCuesData = {
    mode: 'single',
    totalDuration: currentTime,
    trackCount: trackCues.length,
    generatedAt: new Date().toISOString(),
    tracks: trackCues
  };
  
  const trackCuesPath = path.join(tempDir, 'track-cues.json');
  fs.writeFileSync(trackCuesPath, JSON.stringify(trackCuesData, null, 2));
  console.log('📋 [continuous] Track cues gerado');
  
  // 7. Upload para DigitalOcean Spaces
  await uploadToSpaces(outputPath, 'radio-importante-continuous.aac');
  await uploadToSpaces(trackCuesPath, 'hls/track-cues.json');
  
  // 8. Limpar arquivos temporários
  try {
    trackFiles.forEach(file => fs.unlinkSync(file));
    fs.unlinkSync(fileListPath);
    fs.unlinkSync(outputPath);
    fs.unlinkSync(trackCuesPath);
    fs.rmdirSync(tempDir);
    console.log('🧹 [continuous] Arquivos temporários limpos');
  } catch (e) {
    console.warn('⚠️ [continuous] Erro ao limpar temp files:', e.message);
  }
  
  console.log('🎉 [continuous] Arquivo contínuo gerado com sucesso!');
  
  return {
    totalDuration: currentTime,
    trackCount: trackCues.length,
    fileSize: fs.statSync(outputPath).size,
    generatedAt: new Date().toISOString()
  };
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

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint não encontrado',
    path: req.originalUrl
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Erro interno do servidor'
  });
});

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
