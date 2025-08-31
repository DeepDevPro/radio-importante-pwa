#!/usr/bin/env node
// scripts/generate-smart-hls.js - Gerador de HLS inteligente para grandes catálogos

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🎵 Iniciando geração de HLS inteligente para grandes catálogos...');

// Configurações otimizadas
const CONFIG = {
  audioDir: path.join(__dirname, '../public/audio'),
  outputDir: path.join(__dirname, '../public/audio/hls-smart'),
  catalogPath: path.join(__dirname, '../public/data/catalog.json'),
  hlsPlaylist: 'playlist-smart.m3u8',
  trackCuesFile: 'track-cues-smart.json',
  bitrate: '96k', // Reduzido para economizar banda
  segmentTime: 30, // Segmentos maiores para reduzir overhead
  maxContinuousSize: 50 * 1024 * 1024, // 50MB máximo para arquivo contínuo
  maxContinuousDuration: 60 * 60 // 1 hora máxima para arquivo contínuo
};

async function generateSmartHLS() {
  try {
    console.log('📊 Analisando catálogo...');
    
    // 1. Carregar e analisar catálogo
    const tracks = loadCatalog();
    const analysis = await analyzeCatalog(tracks);
    
    console.log(`📂 Análise do catálogo:`);
    console.log(`   • ${tracks.length} faixas`);
    console.log(`   • Duração total: ${Math.round(analysis.totalDuration / 60)} minutos`);
    console.log(`   • Tamanho estimado AAC: ${Math.round(analysis.estimatedSize / 1024 / 1024)} MB`);
    
    // 2. Decidir estratégia baseada no tamanho
    if (analysis.estimatedSize <= CONFIG.maxContinuousSize && 
        analysis.totalDuration <= CONFIG.maxContinuousDuration) {
      
      console.log('✅ Catálogo pequeno - usando arquivo contínuo');
      await generateContinuousFile(tracks);
      
    } else {
      console.log('📈 Catálogo grande - usando HLS segmentado inteligente');
      await generateSegmentedHLS(tracks);
    }
    
    console.log('🎉 Geração concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro na geração:', error.message);
    process.exit(1);
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

async function analyzeCatalog(tracks) {
  console.log('🔍 Analisando duração e tamanho das faixas...');
  
  let totalDuration = 0;
  let estimatedSize = 0;
  
  for (const track of tracks) {
    const audioPath = path.join(CONFIG.audioDir, track.filename);
    if (fs.existsSync(audioPath)) {
      try {
        // Obter duração real
        const ffprobeCmd = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`;
        const durationStr = execSync(ffprobeCmd, { encoding: 'utf8' }).trim();
        const duration = parseFloat(durationStr);
        
        totalDuration += duration;
        
        // Estimar tamanho AAC (96 kbps = 12 KB/s)
        estimatedSize += duration * 12 * 1024;
        
      } catch (error) {
        console.warn(`⚠️ Erro ao analisar ${track.filename}, usando estimativa`);
        totalDuration += 180; // 3 minutos padrão
        estimatedSize += 180 * 12 * 1024;
      }
    }
  }
  
  return { totalDuration, estimatedSize };
}

async function generateContinuousFile(tracks) {
  console.log('🔧 Gerando arquivo contínuo para catálogo pequeno...');
  
  // Usar a mesma lógica do script anterior
  ensureOutputDirectory();
  const fileListPath = generateFileList(tracks);
  const tracksWithDurations = await getTrackDurations(tracks);
  const trackCues = generateTrackCues(tracksWithDurations);
  saveTrackCues(trackCues, 'continuous');
  
  // Gerar arquivo AAC contínuo
  await generateContinuousAAC(fileListPath);
}

async function generateSegmentedHLS(tracks) {
  console.log('🎬 Gerando HLS segmentado para catálogo grande...');
  
  ensureOutputDirectory();
  
  // 1. Gerar track cues primeiro
  const tracksWithDurations = await getTrackDurations(tracks);
  const trackCues = generateTrackCues(tracksWithDurations);
  saveTrackCues(trackCues, 'segmented');
  
  // 2. Gerar playlist HLS com segmentos por faixa
  await generateSegmentedPlaylist(tracksWithDurations);
  
  // 3. Converter cada faixa para AAC padronizado
  await convertTracksToAAC(tracksWithDurations);
}

async function generateContinuousAAC(fileListPath) {
  console.log('🎵 Gerando arquivo AAC contínuo...');
  
  const outputFile = path.join(CONFIG.outputDir, 'radio-importante-continuous.aac');
  
  const ffmpegCmd = [
    'ffmpeg',
    '-f concat',
    '-safe 0',
    `-i "${fileListPath}"`,
    '-c:a aac',
    `-b:a ${CONFIG.bitrate}`,
    '-y',
    `"${outputFile}"`
  ].join(' ');
  
  console.log(`🎬 Executando: ${ffmpegCmd}`);
  
  try {
    execSync(ffmpegCmd, { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024 * 50 // 50MB buffer para arquivos grandes
    });
    
    console.log('✅ Arquivo contínuo gerado com sucesso');
  } catch (error) {
    console.error('❌ Erro ao gerar arquivo contínuo:', error.message);
    throw error;
  }
}

async function generateSegmentedPlaylist(tracks) {
  console.log('📝 Gerando playlist HLS segmentada...');
  
  const playlistPath = path.join(CONFIG.outputDir, CONFIG.hlsPlaylist);
  let playlistContent = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-PLAYLIST-TYPE:VOD\n';
  
  for (const track of tracks) {
    const duration = track.realDuration;
    const filename = track.filename.replace(/\.[^/.]+$/, '.aac'); // Trocar extensão para AAC
    
    playlistContent += `#EXTINF:${duration.toFixed(6)},\n`;
    playlistContent += `${filename}\n`;
  }
  
  playlistContent += '#EXT-X-ENDLIST\n';
  
  fs.writeFileSync(playlistPath, playlistContent);
  console.log(`✅ Playlist HLS gerada: ${playlistPath}`);
}

async function convertTracksToAAC(tracks) {
  console.log('🔄 Convertendo faixas para AAC padronizado...');
  
  for (const track of tracks) {
    const inputPath = track.fullPath;
    const outputFilename = track.filename.replace(/\.[^/.]+$/, '.aac');
    const outputPath = path.join(CONFIG.outputDir, outputFilename);
    
    // Pular se já existe
    if (fs.existsSync(outputPath)) {
      console.log(`⏭️ Já existe: ${outputFilename}`);
      continue;
    }
    
    console.log(`🔄 Convertendo: ${track.filename} → ${outputFilename}`);
    
    const ffmpegCmd = [
      'ffmpeg',
      `-i "${inputPath}"`,
      '-c:a aac',
      `-b:a ${CONFIG.bitrate}`,
      '-ar 44100', // Frequência padrão
      '-ac 2',     // Stereo
      '-y',
      `"${outputPath}"`
    ].join(' ');
    
    try {
      execSync(ffmpegCmd, { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 1024 * 1024 * 10
      });
      
      console.log(`  ✅ ${outputFilename}`);
    } catch (error) {
      console.error(`  ❌ Erro ao converter ${track.filename}:`, error.message);
    }
  }
}

// Funções auxiliares (reutilizadas do script anterior)
function ensureOutputDirectory() {
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    console.log(`📁 Diretório criado: ${CONFIG.outputDir}`);
  }
}

function generateFileList(tracks) {
  const fileListPath = path.join(CONFIG.outputDir, 'filelist.txt');
  const validTracks = tracks.filter(track => {
    const audioPath = path.join(CONFIG.audioDir, track.filename);
    return fs.existsSync(audioPath);
  });
  
  const fileListContent = validTracks.map(track => {
    const audioPath = path.join(CONFIG.audioDir, track.filename);
    return `file '${audioPath}'`;
  }).join('\n');
  
  fs.writeFileSync(fileListPath, fileListContent);
  console.log(`📄 Lista de arquivos criada: ${fileListPath}`);
  
  return fileListPath;
}

async function getTrackDurations(tracks) {
  console.log('⏱️ Obtendo durações reais dos arquivos...');
  
  const tracksWithDurations = [];
  
  for (const track of tracks) {
    const audioPath = path.join(CONFIG.audioDir, track.filename);
    if (!fs.existsSync(audioPath)) {
      console.warn(`⚠️ Arquivo não encontrado: ${track.filename}`);
      continue;
    }
    
    try {
      const ffprobeCmd = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`;
      const durationStr = execSync(ffprobeCmd, { encoding: 'utf8' }).trim();
      const duration = parseFloat(durationStr);
      
      tracksWithDurations.push({
        ...track,
        fullPath: audioPath,
        realDuration: duration
      });
      
      console.log(`  ✅ ${track.filename}: ${duration.toFixed(1)}s`);
    } catch (error) {
      console.warn(`  ⚠️ Erro ao obter duração de ${track.filename}, usando 180s`);
      tracksWithDurations.push({
        ...track,
        fullPath: audioPath,
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

function saveTrackCues(trackCues, mode) {
  const trackCuesPath = path.join(CONFIG.outputDir, CONFIG.trackCuesFile);
  const trackCuesData = {
    mode: mode, // 'continuous' ou 'segmented'
    totalDuration: trackCues[trackCues.length - 1]?.endTime || 0,
    trackCount: trackCues.length,
    generatedAt: new Date().toISOString(),
    tracks: trackCues
  };
  
  fs.writeFileSync(trackCuesPath, JSON.stringify(trackCuesData, null, 2));
  console.log(`📋 Track cues salvos (${mode}): ${trackCuesPath}`);
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  generateSmartHLS().catch(error => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
}

export { generateSmartHLS, CONFIG };
