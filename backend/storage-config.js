/* eslint-env node */
const AWS = require('aws-sdk');
const multerS3 = require('multer-s3');

// Configure Digital Ocean Spaces (S3-compatible)
const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT || 'atl1.digitaloceanspaces.com');
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
  region: process.env.DO_SPACES_REGION || 'nyc3'
});

// Storage configuration for Digital Ocean Spaces
const storage = multerS3({
  s3: s3,
  bucket: process.env.DO_SPACES_BUCKET || 'radio-importante-audio',
  acl: 'public-read',
  key: function (req, file, cb) {
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = Date.now() + '-' + sanitizedName;
    cb(null, `audio/${filename}`);
  },
  contentType: multerS3.AUTO_CONTENT_TYPE
});

// File URL generator
const getFileUrl = (filename) => {
  const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
  const endpoint = process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com';
  return `https://${bucket}.${endpoint}/${filename}`;
};

// Delete file function
const deleteFile = async (fileKey) => {
  try {
    await s3.deleteObject({
      Bucket: process.env.DO_SPACES_BUCKET || 'radio-importante-audio',
      Key: fileKey
    }).promise();
    console.log(`✅ Arquivo deletado do Spaces: ${fileKey}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao deletar arquivo do Spaces:', error);
    return false;
  }
};

module.exports = {
  storage,
  getFileUrl,
  deleteFile
};
