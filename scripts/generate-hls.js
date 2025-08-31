#!/usr/bin/env node
// scripts/generate-hls.js - Gerador de HLS contínuo para iOS PWA

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🎵 Iniciando geração de HLS contínuo para iOS PWA...');

// Configurações
const CONFIG = {
  audioDir: path.join(__dirname, '../public/audio'),
  outputDir: path.join(__dirname, '../public/audio/hls'),
  catalogPath: path.join(__dirname, '../public/data/catalog.json'),
  hlsPlaylist: 'playlist-continuous.m3u8',
  trackCuesFile: 'track-cues.json',
  bitrate: '128k', // Confirmado pelo usuário
  segmentTime: 10 // Segmentos de 10 segundos
};

async function generateHLS() {
  try {
    // 1. Verificar dependências
    checkDependencies();
    
    // 2. Carregar catálogo
    const tracks = loadCatalog();
    console.log(`📂 Encontradas ${tracks.length} faixas no catálogo`);
    
    // 3. Verificar arquivos de áudio
    const validTracks = validateAudioFiles(tracks);
    console.log(`✅ ${validTracks.length} arquivos de áudio válidos`);
    
    // 4. Criar diretório de saída
    ensureOutputDirectory();
    
    // 5. Gerar lista de concatenação
    const fileListPath = generateFileList(validTracks);
    
    // 6. Obter durações reais dos arquivos
    const tracksWithDurations = await getTrackDurations(validTracks);
    
    // 7. Gerar track cues mapping
    const trackCues = generateTrackCues(tracksWithDurations);
    saveTrackCues(trackCues);
    
    // 8. Executar FFmpeg
    await executeFFmpeg(fileListPath);
    
    // 9. Validar saída
    validateOutput();
    
    console.log('🎉 HLS contínuo gerado com sucesso!');
    console.log(`📁 Arquivos criados em: ${CONFIG.outputDir}`);
    console.log(`🎵 Playlist: ${CONFIG.hlsPlaylist}`);
    console.log(`📋 Track Cues: ${CONFIG.trackCuesFile}`);
    
  } catch (error) {
    console.error('❌ Erro na geração HLS:', error.message);
    process.exit(1);
  }
}

function checkDependencies() {
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
    console.log('✅ FFmpeg encontrado');
  } catch (error) {
    throw new Error('FFmpeg não encontrado. Instale com: brew install ffmpeg (macOS)');
  }
}

function loadCatalog() {
  if (!fs.existsSync(CONFIG.catalogPath)) {
    throw new Error(`Catálogo não encontrado: ${CONFIG.catalogPath}`);
  }
  
  const catalogData = fs.readFileSync(CONFIG.catalogPath, 'utf8');
  const catalog = JSON.parse(catalogData);
  return catalog.tracks;
}

function validateAudioFiles(tracks) {
  const validTracks = [];
  
  for (const track of tracks) {
    const audioPath = path.join(CONFIG.audioDir, track.filename);
    if (fs.existsSync(audioPath)) {
      validTracks.push({
        ...track,
        fullPath: audioPath
      });
    } else {
      console.warn(`⚠️ Arquivo não encontrado: ${track.filename}`);
    }
  }
  
  if (validTracks.length === 0) {
    throw new Error('Nenhum arquivo de áudio válido encontrado');
  }
  
  return validTracks;
}

function ensureOutputDirectory() {
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    console.log(`📁 Diretório criado: ${CONFIG.outputDir}`);
  }
}

function generateFileList(tracks) {
  const fileListPath = path.join(CONFIG.outputDir, 'filelist.txt');
  const fileListContent = tracks.map(track => 
    `file '${track.fullPath}'`
  ).join('\n');
  
  fs.writeFileSync(fileListPath, fileListContent);
  console.log(`📄 Lista de arquivos criada: ${fileListPath}`);
  
  return fileListPath;
}

async function getTrackDurations(tracks) {
  console.log('⏱️ Obtendo durações reais dos arquivos...');
  
  const tracksWithDurations = [];
  
  for (const track of tracks) {
    try {
      const ffprobeCmd = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${track.fullPath}"`;
      const durationStr = execSync(ffprobeCmd, { encoding: 'utf8' }).trim();
      const duration = parseFloat(durationStr);
      
      tracksWithDurations.push({
        ...track,
        realDuration: duration
      });
      
      console.log(`  ✅ ${track.filename}: ${duration.toFixed(1)}s`);
    } catch (error) {
      console.warn(`  ⚠️ Erro ao obter duração de ${track.filename}, usando 180s`);
      tracksWithDurations.push({
        ...track,
        realDuration: 180
      });
    }
  }
  
  return tracksWithDurations;
}

function generateTrackCues(tracks) {
  console.log('🏷️ Gerando track cues mapping...');
  
  let currentTime = 0;
  const trackCues = [];
  
  for (const track of tracks) {
    const startTime = currentTime;
    const endTime = currentTime + track.realDuration;
    
    trackCues.push({
      id: track.id,
      title: track.title,
      artist: track.artist,
      genre: track.genre,
      startTime: startTime,
      endTime: endTime,
      duration: track.realDuration,
      filename: track.filename
    });
    
    currentTime = endTime;
    console.log(`  🎵 ${track.title}: ${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s`);
  }
  
  return trackCues;
}

function saveTrackCues(trackCues) {
  const trackCuesPath = path.join(CONFIG.outputDir, CONFIG.trackCuesFile);
  const trackCuesData = {
    totalDuration: trackCues[trackCues.length - 1]?.endTime || 0,
    trackCount: trackCues.length,
    generatedAt: new Date().toISOString(),
    tracks: trackCues
  };
  
  fs.writeFileSync(trackCuesPath, JSON.stringify(trackCuesData, null, 2));
  console.log(`📋 Track cues salvos: ${trackCuesPath}`);
}

async function executeFFmpeg(fileListPath) {
  console.log('🔧 Executando FFmpeg para gerar HLS...');
  
  const outputPlaylist = path.join(CONFIG.outputDir, CONFIG.hlsPlaylist);
  
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
    `"${path.join(CONFIG.outputDir, 'segment-%03d.ts')}"`,
    '-y', // Sobrescrever arquivos existentes
    `"${outputPlaylist}"`
  ].join(' ');
  
  console.log(`🎬 Executando: ${ffmpegCmd}`);
  
  try {
    const output = execSync(ffmpegCmd, { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });
    
    console.log('✅ FFmpeg executado com sucesso');
    if (output) {
      console.log('📊 Saída FFmpeg:', output.slice(-200)); // Últimas 200 chars
    }
  } catch (error) {
    console.error('❌ Erro FFmpeg:', error.message);
    throw error;
  }
}

function validateOutput() {
  const playlistPath = path.join(CONFIG.outputDir, CONFIG.hlsPlaylist);
  const trackCuesPath = path.join(CONFIG.outputDir, CONFIG.trackCuesFile);
  
  if (!fs.existsSync(playlistPath)) {
    throw new Error(`Playlist HLS não foi gerada: ${playlistPath}`);
  }
  
  if (!fs.existsSync(trackCuesPath)) {
    throw new Error(`Track cues não foram gerados: ${trackCuesPath}`);
  }
  
  // Verificar conteúdo da playlist
  const playlistContent = fs.readFileSync(playlistPath, 'utf8');
  if (!playlistContent.includes('#EXTM3U')) {
    throw new Error('Playlist HLS inválida - não contém #EXTM3U');
  }
  
  const segmentCount = (playlistContent.match(/\.ts/g) || []).length;
  console.log(`📊 Playlist gerada com ${segmentCount} segmentos`);
  
  console.log('✅ Validação da saída concluída');
}

// Executar se chamado diretamente (ES module check)
if (import.meta.url === `file://${process.argv[1]}`) {
  generateHLS().catch(error => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
}

// Export para uso como módulo
export { generateHLS, CONFIG };
