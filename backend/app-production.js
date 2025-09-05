const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const app = express();

// Configuração simples para produção
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS simplificado
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Radio Importante Backend API',
    version: '2.1.2',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Configurar multer para upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const cleanName = file.originalname
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9.-]/g, '_');
    cb(null, Date.now() + '_' + cleanName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de áudio são permitidos'), false);
    }
  }
});

// Catálogo simplificado
let catalog = {
  tracks: [],
  lastUpdated: new Date().toISOString()
};

// Routes básicas
app.get('/api/catalog', (req, res) => {
  res.json(catalog);
});

app.post('/api/upload', upload.array('audioFiles'), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const uploadedFiles = req.files.map(file => ({
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      path: file.path,
      title: file.originalname.replace(/\.[^/.]+$/, ''),
      artist: 'Artista Desconhecido',
      duration: 0,
      uploadDate: new Date().toISOString()
    }));

    // Adicionar ao catálogo
    catalog.tracks.push(...uploadedFiles);
    catalog.lastUpdated = new Date().toISOString();

    res.json({
      success: true,
      message: `${uploadedFiles.length} arquivo(s) enviado(s) com sucesso`,
      files: uploadedFiles
    });

  } catch (error) {
    console.error('Erro no upload:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
});

app.put('/api/tracks/:id/metadata', (req, res) => {
  try {
    const trackId = req.params.id;
    const updates = req.body;
    
    const trackIndex = catalog.tracks.findIndex(track => track.id === trackId);
    if (trackIndex === -1) {
      return res.status(404).json({ error: 'Música não encontrada' });
    }

    // Atualizar metadados
    catalog.tracks[trackIndex] = { 
      ...catalog.tracks[trackIndex], 
      ...updates,
      lastModified: new Date().toISOString()
    };
    catalog.lastUpdated = new Date().toISOString();

    res.json({
      success: true,
      track: catalog.tracks[trackIndex]
    });

  } catch (error) {
    console.error('Erro ao atualizar metadados:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
});

app.delete('/api/delete/:id', (req, res) => {
  try {
    const trackId = req.params.id;
    const trackIndex = catalog.tracks.findIndex(track => track.id === trackId);
    
    if (trackIndex === -1) {
      return res.status(404).json({ error: 'Música não encontrada' });
    }

    const track = catalog.tracks[trackIndex];
    
    // Remover arquivo físico se existir
    if (track.path && fs.existsSync(track.path)) {
      fs.unlinkSync(track.path);
    }

    // Remover do catálogo
    catalog.tracks.splice(trackIndex, 1);
    catalog.lastUpdated = new Date().toISOString();

    res.json({
      success: true,
      message: 'Música deletada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao deletar:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
});

app.post('/api/regenerate-catalog', (req, res) => {
  try {
    // Recriar catálogo baseado nos arquivos existentes
    const uploadsPath = path.join(__dirname, 'uploads');
    
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
    }

    const files = fs.readdirSync(uploadsPath);
    const audioFiles = files.filter(file => 
      /\.(mp3|wav|ogg|aac)$/i.test(file)
    );

    catalog.tracks = audioFiles.map(file => {
      const filePath = path.join(uploadsPath, file);
      const stats = fs.statSync(filePath);
      
      return {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        filename: file,
        originalName: file,
        size: stats.size,
        path: filePath,
        title: file.replace(/\.[^/.]+$/, ''),
        artist: 'Artista Desconhecido',
        duration: 0,
        uploadDate: stats.birthtime.toISOString()
      };
    });

    catalog.lastUpdated = new Date().toISOString();

    res.json({
      success: true,
      message: `Catálogo regenerado com ${catalog.tracks.length} música(s)`,
      catalog: catalog
    });

  } catch (error) {
    console.error('Erro ao regenerar catálogo:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint não encontrado',
    path: req.originalUrl,
    method: req.method
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🎵 Radio Importante Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎵 Catalog: http://localhost:${PORT}/api/catalog`);
});
