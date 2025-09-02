// config/aws.js - Configuração AWS
const AWS = require('aws-sdk');

// Configuração baseada em variáveis de ambiente
const awsConfig = {
  region: process.env.AWS_REGION || 'us-west-2',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

// Aplicar configuração apenas se as credenciais estiverem definidas
if (awsConfig.accessKeyId && awsConfig.secretAccessKey) {
  AWS.config.update(awsConfig);
}

// Instância do S3 (ou mock para desenvolvimento)
let s3;
if (process.env.NODE_ENV === 'development' && 
    (!process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID === 'development_key')) {
  // Mock S3 para desenvolvimento local
  console.log('🔧 Usando S3 Mock para desenvolvimento local');
  s3 = {
    getObject: () => ({
      promise: () => Promise.reject({ code: 'NoSuchKey', message: 'Mock: No catalog found' })
    }),
    putObject: () => ({
      promise: () => {
        console.log('🔧 Mock S3: putObject called');
        return Promise.resolve({ ETag: '"mock-etag"' });
      }
    })
  };
} else {
  s3 = new AWS.S3({
    apiVersion: '2006-03-01',
    region: awsConfig.region
  });
}

// Configurações específicas do bucket
const bucketConfig = {
  bucketName: process.env.S3_BUCKET_NAME || 'radio-importante-storage',
  audioPath: 'public/audio/',
  catalogPath: 'public/data/catalog.json',
  region: awsConfig.region
};

module.exports = {
  s3,
  bucketConfig,
  awsConfig
};
