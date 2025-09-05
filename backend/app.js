const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

// Configuração do multer para upload
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Catálogo em memória
let catalog = {
  tracks: [],
  metadata: {
    totalTracks: 0,
    radioName: "Radio Importante",
    lastUpdated: new Date().toISOString()
  }
};

// Tentar carregar catálogo existente
try {
  const catalogPath = path.join(__dirname, '../public/data/catalog.json');
  if (fs.existsSync(catalogPath)) {
    const catalogData = fs.readFileSync(catalogPath, 'utf8');
    catalog = JSON.parse(catalogData);
  }
} catch (error) {
  console.log('⚠️ Catálogo não encontrado, usando catálogo vazio');
}

// API Routes
app.get('/api/catalog', (req, res) => {
  res.json(catalog);
});

app.post('/api/upload', upload.array('audioFiles'), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo enviado'
      });
    }

    const newTracks = [];
    
    req.files.forEach((file, index) => {
      // Pegar duração enviada pelo frontend
      const duration = req.body[`duration_${index}`];
      
      const track = {
        id: `track_${Date.now()}_${index}`,
        title: path.parse(file.originalname).name,
        artist: 'Artista não definido',
        filename: file.originalname,
        duration: duration ? parseFloat(duration) : 0,
        url: `/audio/${file.originalname}`,
        uploadedAt: new Date().toISOString()
      };
      
      newTracks.push(track);
      catalog.tracks.push(track);
    });

    // Atualizar metadados
    catalog.metadata.totalTracks = catalog.tracks.length;
    catalog.metadata.lastUpdated = new Date().toISOString();

    // Salvar catálogo atualizado
    saveCatalog();

    res.json({
      success: true,
      message: `${newTracks.length} arquivo(s) processado(s) com sucesso`,
      tracks: newTracks,
      catalog: catalog
    });

  } catch (error) {
    console.error('Erro no upload:', error);
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
    
    catalog.metadata.lastUpdated = new Date().toISOString();
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

app.delete('/api/delete/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const trackIndex = catalog.tracks.findIndex(track => track.id === id);
    if (trackIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Música não encontrada'
      });
    }

    const deletedTrack = catalog.tracks.splice(trackIndex, 1)[0];
    catalog.metadata.totalTracks = catalog.tracks.length;
    catalog.metadata.lastUpdated = new Date().toISOString();
    
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
  catalog.metadata.lastUpdated = new Date().toISOString();
  saveCatalog();
  
  res.json({
    success: true,
    message: 'Catálogo regenerado com sucesso',
    catalog: catalog
  });
});

// Função para salvar catálogo
function saveCatalog() {
  try {
    const catalogPath = path.join(__dirname, '../public/data/catalog.json');
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
