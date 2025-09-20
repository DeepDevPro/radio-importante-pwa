/* eslint-env node */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const storageConfig = require('./storage-config');

const app = express();

// Configuração básica
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS para desenvolvimento
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
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
  const catalogPath = process.env.CATALOG_PATH || path.join(process.cwd(), 'public', 'data', 'catalog.json');
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

app.post('/api/upload', flexibleUpload, (req, res) => {
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
        filename: file.key || file.filename, // Use key from S3 or filename from local
        duration: duration ? parseFloat(duration) : 0,
        format: path.extname(file.originalname).toLowerCase(),
        url: storageConfig.getFileUrl(file.key || file.filename) // URL correta baseada no storage
      };
      newTracks.push(track);
      catalog.tracks.push(track);
    });

    catalog.metadata.totalTracks = catalog.tracks.length;
    catalog.metadata.totalDuration = catalog.tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
    saveCatalog();

    console.log(`✅ [upload] ${newTracks.length} arquivo(s) processado(s) com sucesso`);

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

// Função para salvar catálogo
function saveCatalog() {
  try {
    const catalogPath = process.env.CATALOG_PATH || path.join(process.cwd(), 'public', 'data', 'catalog.json');
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
  console.log(`📁 Upload path: ${process.env.UPLOAD_PATH || path.join(process.cwd(), 'public', 'audio')}`);
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
