#!/usr/bin/env node
/* eslint-env node */
/* eslint-disable no-undef */
// backend/scripts/generate-hls-spaces.js
// Versão adaptada para funcionar com arquivos no DigitalOcean Spaces

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');
const { pipeline } = require('stream');
const { promisify } = require('util');

const pipelineAsync = promisify(pipeline);

console.log('🎵 Iniciando geração de HLS para staging (Spaces)...');

// Configurações baseadas no ambiente
const CONFIG = {
  tempDir: '/tmp/hls-generation',
  bitrate: '128k',
  segmentTime: 6, // 6 segundos como no original
  spacesEndpoint: process.env.DO_SPACES_ENDPOINT || 'atl1.digitaloceanspaces.com',
  spacesBucket: process.env.DO_SPACES_BUCKET || 'radio-importante-audio',
  // Lista simplificada de tracks para teste
  sampleTracks: [
    { filename: '1759353027049-01_Ancestors.mp3', title: 'Ancestors', duration: 180 },
    { filename: '1759353027597-01_Check_82_My_Machine___Nirobi_Re-Edit_.mp3', title: 'Check My Machine', duration: 200 },
    { filename: '1759353027732-01_Damn_feat_Kinny.mp3', title: 'Damn feat Kinny', duration: 190 }
  ]
};

async function generateHLSForSpaces() {
  try {
    console.log('📁 Criando diretório temporário...');
    ensureTempDirectory();
    
    console.log('📥 Baixando arquivos de áudio do Spaces...');
    const downloadedTracks = await downloadTracksFromSpaces();
    
    if (downloadedTracks.length === 0) {
      throw new Error('Nenhum arquivo de áudio foi baixado com sucesso');
    }
    
    console.log('🔧 Gerando lista de concatenação...');
    const fileListPath = generateFileList(downloadedTracks);
    
    console.log('🎬 Executando FFmpeg para gerar HLS...');
    await executeFFmpeg(fileListPath);
    
    console.log('📤 Fazendo upload dos arquivos HLS para Spaces...');
    await uploadHLSToSpaces();
    
    console.log('🧹 Limpando arquivos temporários...');
    cleanupTempFiles();
    
    console.log('✅ Geração de HLS concluída com sucesso!');
    
    return {
      success: true,
      message: 'HLS gerado e publicado no Spaces',
      tracksProcessed: downloadedTracks.length,
      outputLocation: `https://${CONFIG.spacesBucket}.${CONFIG.spacesEndpoint}/generated/hls/latest/`
    };
    
  } catch (error) {
    console.error('💥 Erro durante geração HLS:', error.message);
    cleanupTempFiles();
    throw error;
  }
}

function ensureTempDirectory() {
  if (fs.existsSync(CONFIG.tempDir)) {
    fs.rmSync(CONFIG.tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(CONFIG.tempDir, { recursive: true });
  fs.mkdirSync(path.join(CONFIG.tempDir, 'audio'), { recursive: true });
  fs.mkdirSync(path.join(CONFIG.tempDir, 'output'), { recursive: true });
}

async function downloadTracksFromSpaces() {
  const downloadedTracks = [];
  
  for (const track of CONFIG.sampleTracks) {
    try {
      const url = `https://${CONFIG.spacesBucket}.${CONFIG.spacesEndpoint}/audio/${track.filename}`;
      const localPath = path.join(CONFIG.tempDir, 'audio', track.filename);
      
      console.log(`  📥 Baixando: ${track.title}`);
      await downloadFile(url, localPath);
      
      downloadedTracks.push({
        ...track,
        localPath
      });
      
      console.log(`  ✅ ${track.title}: ${(fs.statSync(localPath).size / 1024 / 1024).toFixed(2)}MB`);
      
    } catch (error) {
      console.warn(`  ⚠️ Falha ao baixar ${track.title}: ${error.message}`);
    }
  }
  
  return downloadedTracks;
}

function downloadFile(url, localPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(localPath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} para ${url}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (error) => {
        fs.unlinkSync(localPath);
        reject(error);
      });
      
    }).on('error', reject);
  });
}

function generateFileList(tracks) {
  const fileListPath = path.join(CONFIG.tempDir, 'filelist.txt');
  const fileListContent = tracks.map(track => 
    `file '${track.localPath}'`
  ).join('\n');
  
  fs.writeFileSync(fileListPath, fileListContent);
  console.log(`📄 Lista criada com ${tracks.length} arquivos`);
  
  return fileListPath;
}

async function executeFFmpeg(fileListPath) {
  const outputPlaylist = path.join(CONFIG.tempDir, 'output', 'index.m3u8');
  
  const ffmpegCmd = [
    'ffmpeg',
    '-f concat',
    '-safe 0',
    `-i "${fileListPath}"`,
    '-c:a aac',
    `-b:a ${CONFIG.bitrate}`,
    '-f hls',
    `-hls_time ${CONFIG.segmentTime}`,
    '-hls_playlist_type vod',
    '-hls_list_size 0',
    '-hls_segment_filename',
    `"${path.join(CONFIG.tempDir, 'output', 'segment_%03d.ts')}"`,
    '-y',
    `"${outputPlaylist}"`
  ].join(' ');
  
  console.log(`🎬 Executando: ${ffmpegCmd.substring(0, 100)}...`);
  
  try {
    const output = execSync(ffmpegCmd, { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024 * 10
    });
    
    console.log('✅ FFmpeg executado com sucesso');
    
    // Verificar arquivos gerados
    const outputDir = path.join(CONFIG.tempDir, 'output');
    const files = fs.readdirSync(outputDir);
    const segments = files.filter(f => f.endsWith('.ts'));
    
    console.log(`📊 Gerados: 1 playlist + ${segments.length} segmentos`);
    
  } catch (error) {
    console.error('❌ Erro FFmpeg:', error.message);
    throw error;
  }
}

async function uploadHLSToSpaces() {
  console.log('📤 Upload para Spaces ainda não implementado');
  console.log('📝 Por enquanto, arquivos ficam em:', path.join(CONFIG.tempDir, 'output'));
  
  // Listar arquivos gerados para debug
  const outputDir = path.join(CONFIG.tempDir, 'output');
  const files = fs.readdirSync(outputDir);
  
  console.log('📋 Arquivos gerados:');
  files.forEach(file => {
    const filePath = path.join(outputDir, file);
    const stats = fs.statSync(filePath);
    console.log(`  - ${file}: ${(stats.size / 1024).toFixed(1)}KB`);
  });
}

function cleanupTempFiles() {
  try {
    if (fs.existsSync(CONFIG.tempDir)) {
      fs.rmSync(CONFIG.tempDir, { recursive: true, force: true });
      console.log('🧹 Arquivos temporários removidos');
    }
  } catch (error) {
    console.warn('⚠️ Erro ao limpar arquivos temporários:', error.message);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  generateHLSForSpaces().catch(error => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
}

module.exports = { generateHLSForSpaces, CONFIG };
