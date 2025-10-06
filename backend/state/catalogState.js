// Estado do catálogo musical
// Extraído de app.js para facilitar manutenção
/* eslint-env node */

const path = require('path');
const fs = require('fs');
const storageConfig = require('../storage-config');

let AWS;
try {
  AWS = require('aws-sdk');
} catch (e) {
  console.warn('⚠️ aws-sdk não encontrado. Instale com: npm install aws-sdk');
}

// Catálogo em memória (formato compatível com frontend)
let catalog = {
  version: "v2.2.4",
  tracks: [],
  metadata: {
    totalTracks: 0,
    totalDuration: 0,
    artwork: "/icons/icon-192x192.png",
    radioName: "Radio Importante"
  }
};

// Inicializar catálogo carregando do DigitalOcean Spaces (SOLUÇÃO PARA PERSISTÊNCIA)
async function initializeCatalog() {
  console.log('🔄 [catalog] Inicializando catálogo...');
  
  // Tentar carregar do Spaces primeiro
  const spacesLoaded = await loadCatalogFromSpaces();
  
  if (!spacesLoaded) {
    // Fallback: tentar carregar localmente
    try {
      const catalogPath = process.env.CATALOG_PATH || path.join(process.cwd(), '..', 'public', 'data', 'catalog.json');
      if (fs.existsSync(catalogPath)) {
        const catalogData = fs.readFileSync(catalogPath, 'utf8');
        const loadedCatalog = JSON.parse(catalogData);
        
        // Usar apenas os tracks no formato correto
        if (loadedCatalog.tracks) {
          catalog.tracks = loadedCatalog.tracks.map(track => ({
            id: track.id || track.filename?.replace(/\.[^/.]+$/, ''),
            filename: track.filename,
            title: track.title || track.filename?.replace(/\.[^/.]+$/, ''),
            artist: track.artist || 'Radio Importante',
            duration: track.duration || 0,
            size: track.size || 0,
            uploadDate: track.uploadDate || new Date().toISOString(),
            url: track.url || storageConfig.getFileUrl(`audio/${track.filename}`)
          }));
          
          catalog.metadata.totalTracks = catalog.tracks.length;
          catalog.metadata.totalDuration = catalog.tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
          
          console.log(`✅ [catalog] Catálogo carregado localmente: ${catalog.tracks.length} tracks`);
          
          // Migrar para Spaces se possível
          if (process.env.DO_SPACES_KEY && process.env.DO_SPACES_SECRET) {
            console.log('🔄 [catalog] Migrando catálogo local para Spaces...');
            await saveCatalogToSpaces();
          }
        }
      } else {
        console.log('ℹ️ [catalog] Nenhum catálogo encontrado, usando catálogo vazio');
      }
    } catch (error) {
      console.log('⚠️ [catalog] Erro ao carregar catálogo local:', error);
    }
  }
  
  console.log(`🎵 [catalog] Inicialização completa: ${catalog.tracks.length} tracks carregadas`);
}

async function saveCatalogToSpaces() {
  try {
    if (!process.env.DO_SPACES_KEY || !process.env.DO_SPACES_SECRET) {
      console.warn('⚠️ [catalog] Credenciais Spaces não configuradas, salvando localmente...');
      return saveCatalogLocally();
    }

    const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com');
    const s3 = new AWS.S3({
      endpoint: spacesEndpoint,
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
      region: process.env.DO_SPACES_REGION || 'nyc3'
    });

    const catalogData = JSON.stringify(catalog, null, 2);
    const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';

    await s3.putObject({
      Bucket: bucket,
      Key: 'data/catalog.json',
      Body: catalogData,
      ContentType: 'application/json',
      ACL: 'public-read'
    }).promise();

    console.log('✅ [catalog] Catálogo salvo no DigitalOcean Spaces: data/catalog.json');
    
    // Backup local também (fallback)
    saveCatalogLocally();
    
  } catch (error) {
    console.error('❌ [catalog] Erro ao salvar no Spaces, usando backup local:', error);
    saveCatalogLocally();
  }
}

// Função para salvar catálogo localmente (fallback)
function saveCatalogLocally() {
  try {
    const catalogPath = process.env.CATALOG_PATH || path.join(process.cwd(), '..', 'public', 'data', 'catalog.json');
    const catalogDir = path.dirname(catalogPath);
    
    // Criar diretório se não existir
    if (!fs.existsSync(catalogDir)) {
      fs.mkdirSync(catalogDir, { recursive: true });
    }
    
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
    console.log('📝 [catalog] Catálogo salvo localmente (backup)');
  } catch (error) {
    console.error('❌ [catalog] Erro ao salvar catálogo localmente:', error);
  }
}

// Função para carregar catálogo do DigitalOcean Spaces
async function loadCatalogFromSpaces() {
  try {
    if (!process.env.DO_SPACES_KEY || !process.env.DO_SPACES_SECRET) {
      console.warn('⚠️ [catalog] Credenciais Spaces não configuradas, carregando localmente...');
      return false;
    }

    const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com');
    const s3 = new AWS.S3({
      endpoint: spacesEndpoint,
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
      region: process.env.DO_SPACES_REGION || 'nyc3'
    });

    const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
    
    const result = await s3.getObject({
      Bucket: bucket,
      Key: 'data/catalog.json'
    }).promise();

    const catalogData = JSON.parse(result.Body.toString());
    
    // Usar apenas os tracks no formato correto
    if (catalogData.tracks) {
      catalog.tracks = catalogData.tracks.map(track => ({
        id: track.id || track.filename?.replace(/\.[^/.]+$/, ''),
        filename: track.filename,
        title: track.title || track.filename?.replace(/\.[^/.]+$/, ''),
        artist: track.artist || 'Radio Importante',
        duration: track.duration || 0,
        size: track.size || 0,
        uploadDate: track.uploadDate || new Date().toISOString(),
        url: track.url || storageConfig.getFileUrl(`audio/${track.filename}`)
      }));

      // Atualizar metadata
      catalog.metadata.totalTracks = catalog.tracks.length;
      catalog.metadata.totalDuration = catalog.tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
      
      console.log(`✅ [catalog] Catálogo carregado do Spaces: ${catalog.tracks.length} tracks`);
      return true;
    }
    
  } catch (error) {
    if (error.code === 'NoSuchKey') {
      console.log('ℹ️ [catalog] Catálogo não existe no Spaces ainda, será criado no primeiro upload');
    } else {
      console.error('❌ [catalog] Erro ao carregar do Spaces:', error);
    }
    return false;
  }
}

// Função principal para salvar catálogo (usa Spaces como principal)
async function saveCatalog() {
  await saveCatalogToSpaces();
}

module.exports = {
  catalog,
  initializeCatalog,
  saveCatalog,
  saveCatalogToSpaces,
  loadCatalogFromSpaces,
  saveCatalogLocally
};
