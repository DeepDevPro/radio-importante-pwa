#!/usr/bin/env node
// scripts/generate-multi-chunk-aac.js - Gerador de múltiplos chunks AAC para grandes catálogos

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🎵 Iniciando geração de chunks AAC para grandes catálogos...');

// Configurações
const CONFIG = {
  audioDir: path.join(__dirname, '../public/audio'),
  outputDir: path.join(__dirname, '../public/audio/chunks'),
  catalogPath: path.join(__dirname, '../public/data/catalog.json'),
  trackCuesFile: 'track-cues-chunks.json',
  bitrate: '96k', // Otimizado para tamanho
  maxChunkDuration: 60 * 60, // 1 hora por chunk
  maxChunkSize: 40 * 1024 * 1024, // 40MB por chunk
  maxSingleFileSize: 50 * 1024 * 1024 // 50MB limite para arquivo único
};

async function generateMultiChunkAAC() {
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
    if (analysis.estimatedSize <= CONFIG.maxSingleFileSize && 
        analysis.totalDuration <= CONFIG.maxChunkDuration) {
      
      console.log('✅ Catálogo pequeno - usando arquivo contínuo único');
      await generateSingleFile(tracks);
      
    } else {
      console.log('📈 Catálogo grande - usando múltiplos chunks AAC');
      await generateMultipleChunks(tracks);
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
        totalDuration += 360; // 6 minutos padrão
        estimatedSize += 360 * 12 * 1024;
      }
    }
  }
  
  return { totalDuration, estimatedSize };
}

async function generateSingleFile(tracks) {
  console.log('🔧 Gerando arquivo contínuo único...');
  
  ensureOutputDirectory();
  const tracksWithDurations = await getTrackDurations(tracks);
  const trackCues = generateTrackCues(tracksWithDurations);
  
  // Salvar metadata para arquivo único
  const metadata = {
    mode: 'single',
    totalDuration: trackCues[trackCues.length - 1]?.endTime || 0,
    trackCount: trackCues.length,
    chunks: [
      {
        id: 'chunk_001',
        filename: 'radio-importante-continuous.aac',
        startTime: 0,
        endTime: trackCues[trackCues.length - 1]?.endTime || 0,
        tracks: trackCues
      }
    ],
    generatedAt: new Date().toISOString()
  };
  
  saveTrackCues(metadata);
  
  // Gerar arquivo AAC único
  const fileListPath = generateFileList(tracksWithDurations);
  await generateAAC(fileListPath, 'radio-importante-continuous.aac');
}

async function generateMultipleChunks(tracks) {
  console.log('🎬 Gerando múltiplos chunks AAC...');
  
  ensureOutputDirectory();
  const tracksWithDurations = await getTrackDurations(tracks);
  
  // Dividir faixas em chunks
  const chunks = divideTracksIntoChunks(tracksWithDurations);
  console.log(`📦 Dividido em ${chunks.length} chunks`);
  
  const chunkMetadata = [];
  
  // Gerar cada chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkId = `chunk_${String(i + 1).padStart(3, '0')}`;
    const chunkFilename = `radio-importante-${chunkId}.aac`;
    
    console.log(`📦 Gerando ${chunkId}: ${chunk.tracks.length} faixas, ${Math.round(chunk.duration / 60)} min`);
    
    // Gerar track cues para este chunk
    const chunkTrackCues = generateChunkTrackCues(chunk.tracks, chunk.startTime);
    
    // Metadata do chunk
    chunkMetadata.push({
      id: chunkId,
      filename: chunkFilename,
      startTime: chunk.startTime,
      endTime: chunk.endTime,
      duration: chunk.duration,
      trackCount: chunk.tracks.length,
      tracks: chunkTrackCues
    });
    
    // Gerar arquivo do chunk
    const fileListPath = generateChunkFileList(chunk.tracks, chunkId);
    await generateAAC(fileListPath, chunkFilename);
  }
  
  // Salvar metadata completa
  const metadata = {
    mode: 'chunks',
    totalDuration: chunkMetadata[chunkMetadata.length - 1]?.endTime || 0,
    trackCount: tracksWithDurations.length,
    chunkCount: chunks.length,
    chunks: chunkMetadata,
    generatedAt: new Date().toISOString()
  };
  
  saveTrackCues(metadata);
}

function divideTracksIntoChunks(tracks) {
  const chunks = [];
  let currentChunk = {
    tracks: [],
    duration: 0,
    estimatedSize: 0,
    startTime: 0,
    endTime: 0
  };
  
  let globalTime = 0;
  
  for (const track of tracks) {
    const trackDuration = track.realDuration;
    const trackSize = trackDuration * 12 * 1024; // 96 kbps AAC
    
    // Verificar se precisa iniciar novo chunk
    if (currentChunk.tracks.length > 0 && 
        (currentChunk.duration + trackDuration > CONFIG.maxChunkDuration ||
         currentChunk.estimatedSize + trackSize > CONFIG.maxChunkSize)) {
      
      // Finalizar chunk atual
      currentChunk.endTime = globalTime;
      chunks.push(currentChunk);
      
      // Iniciar novo chunk
      currentChunk = {
        tracks: [],
        duration: 0,
        estimatedSize: 0,
        startTime: globalTime,
        endTime: 0
      };
    }
    
    // Adicionar faixa ao chunk atual
    currentChunk.tracks.push(track);
    currentChunk.duration += trackDuration;
    currentChunk.estimatedSize += trackSize;
    globalTime += trackDuration;
  }
  
  // Adicionar último chunk se não vazio
  if (currentChunk.tracks.length > 0) {
    currentChunk.endTime = globalTime;
    chunks.push(currentChunk);
  }
  
  return chunks;
}

function generateChunkTrackCues(tracks, chunkStartTime) {
  const trackCues = [];
  let currentTime = 0; // Tempo relativo dentro do chunk
  
  for (const track of tracks) {
    const startTime = currentTime;
    const endTime = currentTime + track.realDuration;
    
    trackCues.push({
      id: track.id,
      title: track.title,
      artist: track.artist,
      genre: track.genre,
      startTime: startTime, // Posição dentro do chunk
      endTime: endTime,
      globalStartTime: chunkStartTime + startTime, // Posição global
      globalEndTime: chunkStartTime + endTime,
      duration: track.realDuration,
      filename: track.filename
    });
    
    currentTime = endTime;
  }
  
  return trackCues;
}

// Funções auxiliares (similares ao script anterior)
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

function generateChunkFileList(tracks, chunkId) {
  const fileListPath = path.join(CONFIG.outputDir, `filelist-${chunkId}.txt`);
  const fileListContent = tracks.map(track => {
    const audioPath = path.join(CONFIG.audioDir, track.filename);
    return `file '${audioPath}'`;
  }).join('\n');
  
  fs.writeFileSync(fileListPath, fileListContent);
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
      console.warn(`  ⚠️ Erro ao obter duração de ${track.filename}, usando 360s`);
      tracksWithDurations.push({
        ...track,
        fullPath: audioPath,
        realDuration: 360 // 6 minutos padrão
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
  }
  
  return trackCues;
}

async function generateAAC(fileListPath, outputFilename) {
  console.log(`🎵 Gerando arquivo AAC: ${outputFilename}...`);
  
  const outputFile = path.join(CONFIG.outputDir, outputFilename);
  
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
  
  try {
    execSync(ffmpegCmd, { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024 * 50
    });
    
    console.log(`  ✅ ${outputFilename} gerado com sucesso`);
  } catch (error) {
    console.error(`  ❌ Erro ao gerar ${outputFilename}:`, error.message);
    throw error;
  }
}

function saveTrackCues(metadata) {
  const trackCuesPath = path.join(CONFIG.outputDir, CONFIG.trackCuesFile);
  fs.writeFileSync(trackCuesPath, JSON.stringify(metadata, null, 2));
  console.log(`📋 Metadata salva: ${trackCuesPath}`);
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  generateMultiChunkAAC().catch(error => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
}

export { generateMultiChunkAAC, CONFIG };
