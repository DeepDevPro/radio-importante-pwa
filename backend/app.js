// app.js - Express server principal
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();

// Middlewares de segurança
app.use(helmet());

// CORS configurado para o frontend
app.use(cors({
  origin: [
    'https://radio.importantestudio.com',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logging
app.use(morgan('combined'));

// Parsing de JSON
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting geral
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP
  message: {
    error: 'Muitas requisições. Tente novamente em 15 minutos.',
    retryAfter: 15 * 60
  }
});

// Rate limiting específico para upload
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 uploads por IP
  message: {
    error: 'Muitos uploads. Tente novamente em 15 minutos.',
    retryAfter: 15 * 60
  }
});

app.use(generalLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Routes
app.use('/api/upload', uploadLimiter, require('./routes/upload'));
app.use('/api/catalog', require('./routes/catalog'));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Radio Importante Backend',
    version: '1.0.0',
    status: 'Running',
    endpoints: {
      health: '/health',
      upload: '/api/upload',
      catalog: '/api/catalog'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: 'Arquivo muito grande. Máximo 50MB por arquivo.',
      code: 'FILE_TOO_LARGE'
    });
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: 'Tipo de arquivo não permitido.',
      code: 'INVALID_FILE_TYPE'
    });
  }
  
  res.status(500).json({
    success: false,
    error: 'Erro interno do servidor.',
    code: 'INTERNAL_ERROR'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint não encontrado.',
    code: 'NOT_FOUND'
  });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`🚀 Radio Importante Backend rodando na porta ${port}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${port}/health`);
});
