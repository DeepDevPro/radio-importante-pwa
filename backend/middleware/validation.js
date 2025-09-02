// middleware/validation.js - Validação de dados usando Joi
const Joi = require('joi');

// Schema para upload de arquivos
const uploadSchema = Joi.object({
  files: Joi.array().items(
    Joi.object({
      fieldname: Joi.string().required(),
      originalname: Joi.string().required(),
      mimetype: Joi.string().valid(
        'audio/mpeg',
        'audio/mp3', 
        'audio/wav',
        'audio/flac',
        'audio/aac',
        'audio/ogg'
      ).required(),
      size: Joi.number().max(50 * 1024 * 1024).required() // 50MB
    })
  ).min(1).max(5).required()
});

// Schema para atualização de track
const updateTrackSchema = Joi.object({
  title: Joi.string().min(1).max(200).optional(),
  artist: Joi.string().min(1).max(100).optional()
}).or('title', 'artist'); // Pelo menos um campo deve estar presente

// Schema para busca
const searchSchema = Joi.object({
  q: Joi.string().min(1).max(100).optional(),
  artist: Joi.string().min(1).max(100).optional(),
  title: Joi.string().min(1).max(200).optional()
}).or('q', 'artist', 'title');

// Middleware de validação genérico
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property]);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        })),
        code: 'VALIDATION_ERROR'
      });
    }
    
    // Substituir dados validados
    req[property] = value;
    next();
  };
};

// Middleware específico para validação de upload
const validateUpload = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Nenhum arquivo foi enviado',
      code: 'NO_FILES'
    });
  }
  
  // Validar cada arquivo
  for (const file of req.files) {
    const { error } = Joi.object({
      fieldname: Joi.string().required(),
      originalname: Joi.string().required(),
      mimetype: Joi.string().valid(
        'audio/mpeg',
        'audio/mp3',
        'audio/wav', 
        'audio/flac',
        'audio/aac',
        'audio/ogg'
      ).required(),
      size: Joi.number().max(50 * 1024 * 1024).required()
    }).validate(file);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: `Arquivo inválido: ${file.originalname}`,
        details: error.details.map(detail => detail.message),
        code: 'INVALID_FILE'
      });
    }
  }
  
  next();
};

// Middleware para validar ID de track
const validateTrackId = (req, res, next) => {
  const { id } = req.params;
  
  if (!id || !id.match(/^[a-zA-Z0-9_-]+$/)) {
    return res.status(400).json({
      success: false,
      error: 'ID da faixa inválido',
      code: 'INVALID_TRACK_ID'
    });
  }
  
  next();
};

module.exports = {
  validate,
  validateUpload,
  validateTrackId,
  uploadSchema,
  updateTrackSchema,
  searchSchema
};
