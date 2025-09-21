/* eslint-env node */
const multer = require('multer');
const path = require('path');

// Check if we should use Digital Ocean Spaces
const useSpaces = process.env.DO_SPACES_KEY && process.env.DO_SPACES_SECRET;

// Local storage configuration (fallback)
const localStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, process.env.UPLOAD_PATH || path.join(process.cwd(), 'public', 'audio'));
  },
  filename: function (req, file, cb) {
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = Date.now() + '-' + sanitizedName;
    cb(null, filename);
  }
});

// For now, use local storage until we implement proper Spaces integration
const storage = localStorage;

// File URL generator
const getFileUrl = (filename) => {
  // For local storage, return relative path
  return `/audio/${filename}`;
};

// Delete file function
const deleteFile = async (fileKey) => {
  try {
    const fs = require('fs');
    const filePath = path.join(process.cwd(), 'public', 'audio', fileKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ Arquivo deletado: ${fileKey}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Erro ao deletar arquivo:', error);
    return false;
  }
};

module.exports = {
  storage,
  getFileUrl,
  deleteFile
};
