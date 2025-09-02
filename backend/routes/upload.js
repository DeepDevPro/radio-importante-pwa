// routes/upload.js - Rotas para upload de arquivos
const express = require('express');
const router = express.Router();
const { upload } = require('../middleware/upload');
const catalogService = require('../services/catalogService');

// POST /api/upload - Upload de múltiplos arquivos
router.post('/', upload.array('audioFiles', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo foi enviado.',
        code: 'NO_FILES'
      });
    }

    const uploadResults = [];
    const errors = [];

    // Processar cada arquivo
    for (const file of req.files) {
      try {
        // Adicionar ao catálogo
        const trackInfo = await catalogService.addTrack({
          key: file.key,
          location: file.location,
          size: file.size
        });

        uploadResults.push({
          fileName: file.originalname,
          s3Key: file.key,
          url: file.location,
          size: file.size,
          trackId: trackInfo.id,
          success: true
        });

      } catch (error) {
        console.error(`Erro ao processar arquivo ${file.originalname}:`, error);
        errors.push({
          fileName: file.originalname,
          error: error.message,
          success: false
        });
      }
    }

    // Resposta com resultados
    const response = {
      success: uploadResults.length > 0,
      message: `${uploadResults.length} arquivo(s) enviado(s) com sucesso`,
      uploaded: uploadResults,
      errors: errors,
      stats: {
        total: req.files.length,
        successful: uploadResults.length,
        failed: errors.length
      }
    };

    // Status code baseado nos resultados
    if (uploadResults.length === 0) {
      res.status(400).json(response);
    } else if (errors.length > 0) {
      res.status(207).json(response); // Multi-Status
    } else {
      res.status(201).json(response);
    }

  } catch (error) {
    console.error('Erro no upload:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor durante o upload.',
      code: 'UPLOAD_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/upload/status - Status do serviço de upload
router.get('/status', async (req, res) => {
  try {
    const stats = await catalogService.getStats();
    
    res.json({
      success: true,
      service: 'Upload Service',
      status: 'active',
      limits: {
        maxFileSize: '50MB',
        maxFiles: 5,
        allowedFormats: ['MP3', 'WAV', 'FLAC', 'AAC', 'OGG']
      },
      catalog: stats
    });
  } catch (error) {
    console.error('Erro ao obter status:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter status do serviço.',
      code: 'STATUS_ERROR'
    });
  }
});

module.exports = router;
