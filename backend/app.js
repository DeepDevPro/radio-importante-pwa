const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { parseFile } = require('music-metadata');
const app = express();

// Configurar multer para upload de arquivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Salvar na pasta public/audio do frontend
    const uploadPath = path.join(__dirname, '../public/audio');
    
    // Criar pasta se não existir
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Limpar nome do arquivo
    const cleanName = file.originalname
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9.-]/g, '_'); // Substitui caracteres especiais
    
    cb(null, cleanName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  },
  fileFilter: (req, file, cb) => {
    // Apenas arquivos de áudio
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de áudio são permitidos'), false);
    }
  }
});

// Middleware para parsing de JSON e form data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configurar CORS para permitir requisições do frontend
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check endpoint
app.get('/health', function(req, res) {
  res.json({ 
    status: 'OK', 
    message: 'API funcionando',
    timestamp: new Date().toISOString(),
    cors: 'enabled',
    upload: 'ready',
    multer: 'configured'
  });
});

// Root endpoint
app.get('/', function(req, res) {
  res.json({ 
    message: 'Radio Importante Backend API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: ['/health', '/api/upload', '/api/catalog'],
    cors: 'enabled'
  });
});

// Função para extrair metadados de áudio (duração, artista, título)
async function extractAudioMetadata(filePath) {
  try {
    const metadata = await parseFile(filePath);
    const duration = metadata.format.duration || 0; // Duração em segundos
    const title = metadata.common.title || null;
    const artist = metadata.common.artist || null;
    
    return {
      duration: Math.round(duration), // Arredondar para segundos inteiros
      title,
      artist
    };
  } catch (error) {
    console.error(`Erro ao extrair metadados de ${filePath}:`, error.message);
    return {
      duration: 0, // Fallback se não conseguir ler
      title: null,
      artist: null
    };
  }
}

// Função para atualizar catalog.json
async function updateCatalog(newFiles) {
  const catalogPath = path.join(__dirname, '../public/data/catalog.json');
  
  try {
    // Ler catálogo atual
    let catalog = { version: "1.0.0", tracks: [] };
    if (fs.existsSync(catalogPath)) {
      const catalogData = fs.readFileSync(catalogPath, 'utf8');
      catalog = JSON.parse(catalogData);
    }
    
    // Adicionar novas faixas ao final do catálogo existente
    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      const filePath = path.join(__dirname, '../public/audio', file.filename);
      
      // Extrair metadados automaticamente
      const metadata = await extractAudioMetadata(filePath);
      
      const newTrack = {
        id: 'temp', // Será reindexado
        title: metadata.title || extractTitle(file.originalname),
        artist: metadata.artist || extractArtist(file.originalname),
        filename: file.filename,
        duration: metadata.duration, // Duração real extraída do arquivo
        format: path.extname(file.filename).substring(1),
        uploadedAt: new Date().toISOString(),
        orderIndex: Date.now() + i
      };
      
      catalog.tracks.push(newTrack);
    }
    
    // Ordenar todas as tracks por uploadedAt (ordem de upload)
    catalog.tracks.sort((a, b) => {
      const timeA = new Date(a.uploadedAt || 0).getTime();
      const timeB = new Date(b.uploadedAt || 0).getTime();
      return timeA - timeB;
    });
    
    // Reindexar IDs
    catalog.tracks.forEach((track, index) => {
      track.id = `track${String(index + 1).padStart(3, '0')}`;
    });
    
    // Salvar catálogo atualizado
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
    
    // Gerar arquivo contínuo com shuffle para iOS
    await generateContinuousFile(catalog);
    
    return catalog;
    
  } catch (error) {
    console.error('Erro ao atualizar catálogo:', error);
    throw error;
  }
}

function extractTitle(filename) {
  const name = filename.replace(/\.(mp3|wav|ogg)$/i, '');
  if (name.includes(' - ')) {
    return name.split(' - ').slice(1).join(' - ').trim();
  }
  return name;
}

function extractArtist(filename) {
  const name = filename.replace(/\.(mp3|wav|ogg)$/i, '');
  if (name.includes(' - ')) {
    return name.split(' - ')[0].trim();
  }
  return 'Artista Desconhecido';
}

// Função para shuffle de array
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Função para gerar arquivo contínuo com shuffle para iOS
async function generateContinuousFile(catalog) {
  return new Promise((resolve, reject) => {
    try {
      const audioDir = path.join(__dirname, '../public/audio');
      const outputFile = path.join(audioDir, 'radio-importante-continuous.aac');
      
      if (catalog.tracks.length === 0) {
        // Se não há tracks, criar arquivo vazio
        fs.writeFileSync(outputFile, '');
        console.log('📻 Arquivo contínuo vazio criado (sem músicas)');
        return resolve();
      }
      
      // Fazer shuffle das músicas
      const shuffledTracks = shuffleArray(catalog.tracks);
      
      // Criar lista de arquivos para concatenação
      const inputFiles = shuffledTracks
        .map(track => path.join(audioDir, track.filename))
        .filter(file => fs.existsSync(file)); // Apenas arquivos que existem
      
      if (inputFiles.length === 0) {
        fs.writeFileSync(outputFile, '');
        console.log('📻 Arquivo contínuo vazio criado (arquivos não encontrados)');
        return resolve();
      }
      
      // Criar lista de inputs para FFmpeg
      const inputList = inputFiles.map(file => `file '${file}'`).join('\n');
      const listFile = path.join(audioDir, 'filelist.txt');
      
      fs.writeFileSync(listFile, inputList);
      
      // Comando FFmpeg para concatenar e converter para AAC
      const ffmpegCmd = `ffmpeg -f concat -safe 0 -i "${listFile}" -c:a aac -b:a 128k -y "${outputFile}"`;
      
      console.log('📻 Gerando arquivo contínuo com shuffle...');
      console.log(`🎵 Ordem shuffleada: ${shuffledTracks.map(t => t.title).slice(0, 3).join(', ')}${shuffledTracks.length > 3 ? '...' : ''}`);
      
      exec(ffmpegCmd, (error, stdout, stderr) => {
        // Limpar arquivo temporário
        if (fs.existsSync(listFile)) {
          fs.unlinkSync(listFile);
        }
        
        if (error) {
          console.error('❌ Erro ao gerar arquivo contínuo:', error.message);
          // Se falhar, tentar criar arquivo vazio
          fs.writeFileSync(outputFile, '');
          resolve(); // Não falhar o processo todo
        } else {
          console.log(`✅ Arquivo contínuo gerado: ${inputFiles.length} músicas em ordem shuffleada`);
          resolve();
        }
      });
      
    } catch (error) {
      console.error('❌ Erro na geração do arquivo contínuo:', error);
      resolve(); // Não falhar o processo todo
    }
  });
}

// Upload endpoint com multer
app.post('/api/upload', upload.array('audioFiles', 10), async function(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo enviado'
      });
    }

    console.log(`📁 Recebidos ${req.files.length} arquivo(s) para upload`);
    
    // Processar cada arquivo
    const processedFiles = req.files.map(file => ({
      id: Date.now() + Math.random(),
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      path: file.path,
      processed: true,
      timestamp: new Date().toISOString()
    }));

    // Atualizar catálogo (agora assíncrono)
    const updatedCatalog = await updateCatalog(req.files);
    
    console.log(`✅ Upload concluído: ${processedFiles.length} arquivo(s)`);
    console.log(`📋 Catálogo atualizado: ${updatedCatalog.tracks.length} faixas total`);

    res.json({
      success: true,
      message: `${processedFiles.length} arquivo(s) enviado(s) e catalogado(s) com sucesso`,
      files: processedFiles,
      catalog: {
        totalTracks: updatedCatalog.tracks.length,
        newTracks: processedFiles.length
      }
    });
    
  } catch (error) {
    console.error('Erro no upload:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
});

// Catalog endpoint
app.get('/api/catalog', function(req, res) {
  try {
    const catalogPath = path.join(__dirname, '../public/data/catalog.json');
    
    if (fs.existsSync(catalogPath)) {
      const catalogData = fs.readFileSync(catalogPath, 'utf8');
      const catalog = JSON.parse(catalogData);
      
      res.json({
        success: true,
        catalog: catalog,
        totalTracks: catalog.tracks.length
      });
    } else {
      res.json({
        success: true,
        catalog: { version: "1.0.0", tracks: [] },
        totalTracks: 0,
        message: 'Catálogo vazio - pronto para receber uploads'
      });
    }
  } catch (error) {
    console.error('Erro ao ler catálogo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint temporário para reorganizar catálogo
app.post('/api/reorganize-catalog', async function(req, res) {
  try {
    const catalogPath = path.join(__dirname, '../public/data/catalog.json');
    
    if (fs.existsSync(catalogPath)) {
      const catalogData = fs.readFileSync(catalogPath, 'utf8');
      const catalog = JSON.parse(catalogData);
      
      // Ordenar todas as tracks por uploadedAt (ordem de upload)
      catalog.tracks.sort((a, b) => {
        const timeA = new Date(a.uploadedAt || 0).getTime();
        const timeB = new Date(b.uploadedAt || 0).getTime();
        return timeA - timeB;
      });
      
      // Reindexar IDs para manter sequência
      catalog.tracks.forEach((track, index) => {
        track.id = `track${String(index + 1).padStart(3, '0')}`;
      });
      
      // Salvar catálogo reorganizado
      fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
      
      // Gerar arquivo contínuo com shuffle para iOS
      await generateContinuousFile(catalog);
      
      res.json({
        success: true,
        message: 'Catálogo reorganizado com sucesso',
        totalTracks: catalog.tracks.length
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Catálogo não encontrado'
      });
    }
  } catch (error) {
    console.error('Erro ao reorganizar catálogo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para deletar música
app.delete('/api/delete/:trackId', async function(req, res) {
  try {
    const trackId = req.params.trackId;
    const catalogPath = path.join(__dirname, '../public/data/catalog.json');
    
    if (!fs.existsSync(catalogPath)) {
      return res.status(404).json({
        success: false,
        error: 'Catálogo não encontrado'
      });
    }
    
    const catalogData = fs.readFileSync(catalogPath, 'utf8');
    const catalog = JSON.parse(catalogData);
    
    // Encontrar a música a ser deletada
    const trackIndex = catalog.tracks.findIndex(track => track.id === trackId);
    if (trackIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Música não encontrada'
      });
    }
    
    const trackToDelete = catalog.tracks[trackIndex];
    const audioFilePath = path.join(__dirname, '../public/audio', trackToDelete.filename);
    
    // Remover arquivo físico se existir
    if (fs.existsSync(audioFilePath)) {
      fs.unlinkSync(audioFilePath);
      console.log(`🗑️ Arquivo físico removido: ${trackToDelete.filename}`);
    }
    
    // Remover do catálogo
    catalog.tracks.splice(trackIndex, 1);
    
    // Reindexar IDs para manter sequência
    catalog.tracks.forEach((track, index) => {
      track.id = `track${String(index + 1).padStart(3, '0')}`;
    });
    
    // Salvar catálogo atualizado
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
    
    // Gerar arquivo contínuo com shuffle para iOS
    await generateContinuousFile(catalog);
    
    console.log(`✅ Música removida: ${trackToDelete.title} (${trackToDelete.filename})`);
    
    res.json({
      success: true,
      message: `Música "${trackToDelete.title}" removida com sucesso`,
      deletedTrack: {
        id: trackId,
        title: trackToDelete.title,
        filename: trackToDelete.filename
      },
      totalTracks: catalog.tracks.length
    });
    
  } catch (error) {
    console.error('Erro ao deletar música:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para regenerar arquivo contínuo manualmente
app.post('/api/regenerate-continuous', async function(req, res) {
  try {
    const catalogPath = path.join(__dirname, '../public/data/catalog.json');
    
    if (!fs.existsSync(catalogPath)) {
      return res.status(404).json({
        success: false,
        error: 'Catálogo não encontrado'
      });
    }
    
    const catalogData = fs.readFileSync(catalogPath, 'utf8');
    const catalog = JSON.parse(catalogData);
    
    // Gerar arquivo contínuo com shuffle para iOS
    await generateContinuousFile(catalog);
    
    res.json({
      success: true,
      message: 'Arquivo contínuo regenerado com sucesso',
      totalTracks: catalog.tracks.length
    });
    
  } catch (error) {
    console.error('Erro ao regenerar arquivo contínuo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para regenerar catálogo com durações corrigidas
app.post('/api/regenerate-catalog', async function(req, res) {
  try {
    const catalogPath = path.join(__dirname, '../public/data/catalog.json');
    const audioDir = path.join(__dirname, '../public/audio');
    
    if (!fs.existsSync(catalogPath)) {
      return res.status(404).json({
        success: false,
        error: 'Catálogo não encontrado'
      });
    }

    const catalogData = fs.readFileSync(catalogPath, 'utf8');
    const catalog = JSON.parse(catalogData);
    
    // Atualizar durações extraindo metadados reais dos arquivos
    for (let i = 0; i < catalog.tracks.length; i++) {
      const track = catalog.tracks[i];
      const audioFilePath = path.join(__dirname, '../public/audio', track.filename);
      
      if (fs.existsSync(audioFilePath)) {
        const metadata = await extractAudioMetadata(audioFilePath);
        track.duration = metadata.duration;
        
        // Também atualizar título e artista se extraídos dos metadados
        if (metadata.title && !track.title) {
          track.title = metadata.title;
        }
        if (metadata.artist && !track.artist) {
          track.artist = metadata.artist;
        }
      }
    }
    
    // Reindexar IDs
    catalog.tracks.forEach((track, index) => {
      track.id = `track${String(index + 1).padStart(3, '0')}`;
    });
    
    // Salvar catálogo atualizado
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
    
    // Gerar arquivo contínuo com shuffle para iOS
    await generateContinuousFile(catalog);
    
    res.json({
      success: true,
      message: 'Catálogo regenerado com durações reais extraídas dos arquivos',
      totalTracks: catalog.tracks.length,
      totalDuration: catalog.tracks.reduce((sum, track) => sum + track.duration, 0),
      updatedDuration: 'Durações extraídas automaticamente dos metadados'
    });

  } catch (error) {
    console.error('Erro ao regenerar catálogo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, function() {
  console.log(`🚀 Radio Importante Backend rodando na porta ${port}`);
  console.log(`📡 Endpoints disponíveis:`);
  console.log(`   GET  /health - Health check`);
  console.log(`   GET  / - API info`);
  console.log(`   POST /api/upload - Upload de arquivos (multer)`);
  console.log(`   GET  /api/catalog - Catálogo de músicas`);
  console.log(`📁 Upload path: ${path.join(__dirname, '../public/audio')}`);
});
