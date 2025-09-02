// middleware/upload.js - Middleware para upload de arquivos
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const { s3, bucketConfig } = require('../config/aws');

// Função para validar tipo de arquivo
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/flac',
    'audio/aac',
    'audio/ogg'
  ];
  
  const allowedExts = ['.mp3', '.wav', '.flac', '.aac', '.ogg'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de arquivo não suportado: ${file.mimetype}. Formatos aceitos: MP3, WAV, FLAC, AAC, OGG`), false);
  }
};

// Função para gerar nome único do arquivo
const generateFileName = (req, file) => {
  const timestamp = Date.now();
  const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${timestamp}-${originalName}`;
};

// Configuração do multer com S3
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: bucketConfig.bucketName,
    key: (req, file, cb) => {
      const fileName = generateFileName(req, file);
      const fullPath = bucketConfig.audioPath + fileName;
      cb(null, fullPath);
    },
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (req, file, cb) => {
      cb(null, {
        originalName: file.originalname,
        uploadedAt: new Date().toISOString(),
        uploadedBy: req.ip || 'unknown'
      });
    }
  }),
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 5 // máximo 5 arquivos por vez
  }
});

module.exports = {
  upload,
  generateFileName
};
