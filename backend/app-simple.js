const express = require('express');
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

// Health check - essencial para EB
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK',
    message: 'Radio Importante Backend',
    version: '2.1.4',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'radio-importante-backend',
    version: '2.1.4',
    timestamp: new Date().toISOString()
  });
});

// Catálogo básico
let catalog = {
  tracks: [
    {
      id: 1,
      title: "Sample Track",
      artist: "Radio Importante",
      filename: "sample.mp3",
      duration: 180,
      url: "/audio/sample.mp3"
    }
  ],
  metadata: {
    totalTracks: 1,
    radioName: "Radio Importante",
    lastUpdated: new Date().toISOString()
  }
};

// API Routes
app.get('/api/catalog', (req, res) => {
  res.json(catalog);
});

app.post('/api/upload', (req, res) => {
  res.json({
    success: true,
    message: 'Upload endpoint disponível',
    note: 'Funcionalidade completa será implementada'
  });
});

app.put('/api/tracks/:id/metadata', (req, res) => {
  const { id } = req.params;
  res.json({
    success: true,
    message: `Metadados do track ${id} atualizados`,
    data: req.body
  });
});

app.delete('/api/delete/:id', (req, res) => {
  const { id } = req.params;
  res.json({
    success: true,
    message: `Track ${id} deletado`
  });
});

app.post('/api/regenerate-catalog', (req, res) => {
  catalog.metadata.lastUpdated = new Date().toISOString();
  res.json({
    success: true,
    message: 'Catálogo regenerado',
    catalog: catalog
  });
});

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
  console.log(`🎵 Radio Importante Backend running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`� Health check: http://localhost:${PORT}/health`);
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
