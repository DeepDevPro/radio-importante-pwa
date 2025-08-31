#!/usr/bin/env node
// scripts/generate-audio.js - Script unificado para geração de áudio inteligente

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🎵 Sistema de Áudio Inteligente - Radio Importante PWA');
console.log('🧠 Detectando melhor estratégia baseada no catálogo...\n');

// Configurações
const CONFIG = {
  audioDir: path.join(__dirname, '../public/audio'),
  catalogPath: path.join(__dirname, '../public/data/catalog.json'),
  
  // Limites para decisão automática
  maxSingleFileSize: 50 * 1024 * 1024,    // 50MB
  maxSingleFileDuration: 60 * 60,          // 1 hora
  
  // Configurações para arquivo único
  singleFile: {
    outputDir: path.join(__dirname, '../public/audio'),
    outputFile: 'radio-importante-continuous.aac',
    trackCuesDir: path.join(__dirname, '../public/audio/hls'),
    trackCuesFile: 'track-cues.json',
    bitrate: '128k'
  },
  
  // Configurações para chunks
  chunks: {
    outputDir: path.join(__dirname, '../public/audio/chunks'),
    trackCuesFile: 'track-cues-chunks.json',
    bitrate: '96k',
    maxChunkDuration: 60 * 60,             // 1 hora por chunk
    maxChunkSize: 40 * 1024 * 1024         // 40MB por chunk
  }
};

async function generateAudio() {
  try {
    // 1. Verificar dependências
    checkDependencies();
    
    // 2. Analisar catálogo
    const analysis = await analyzeCatalog();
    displayAnalysis(analysis);
    
    // 3. Decidir estratégia
    const strategy = decideStrategy(analysis);
    console.log(`🎯 Estratégia escolhida: ${strategy.name}`);
    console.log(`📋 Razão: ${strategy.reason}\n`);
    
    // 4. Executar estratégia
    if (strategy.type === 'single') {
      await generateSingleFile(analysis.tracks);
    } else {
      await generateChunks(analysis.tracks);
    }
    
    console.log('\n🎉 Geração de áudio concluída com sucesso!');
    console.log('✅ Sistema pronto para iPhone PWA background audio');
    
  } catch (error) {
    console.error('\n❌ Erro na geração de áudio:', error.message);
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

async function analyzeCatalog() {
  console.log('🔍 Analisando catálogo...');
  
  if (!fs.existsSync(CONFIG.catalogPath)) {
    throw new Error(`Catálogo não encontrado: ${CONFIG.catalogPath}`);
  }
  
  const catalogData = fs.readFileSync(CONFIG.catalogPath, 'utf8');
  const catalog = JSON.parse(catalogData);
  const tracks = catalog.tracks;
  
  console.log(`📂 Encontradas ${tracks.length} faixas no catálogo`);
  
  // Obter durações reais
  const tracksWithDurations = await getTrackDurations(tracks);
  
  // Calcular totais
  const totalDuration = tracksWithDurations.reduce((sum, track) => sum + track.realDuration, 0);
  const estimatedSize = totalDuration * 16 * 1024; // 128k AAC ≈ 16 KB/s
  
  return {
    tracks: tracksWithDurations,
    totalTracks: tracksWithDurations.length,
    totalDuration,
    estimatedSize
  };
}

async function getTrackDurations(tracks) {
  console.log('⏱️  Obtendo durações reais...');
  
  const tracksWithDurations = [];
  
  for (const track of tracks) {
    const audioPath = path.join(CONFIG.audioDir, track.filename);
    if (!fs.existsSync(audioPath)) {
      console.warn(`  ⚠️  ${track.filename} - não encontrado`);
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
      
      console.log(`  ✅ ${track.filename} - ${duration.toFixed(1)}s`);
    } catch (error) {
      console.warn(`  ⚠️  ${track.filename} - erro, usando 360s`);
      tracksWithDurations.push({
        ...track,
        fullPath: audioPath,
        realDuration: 360 // 6 minutos padrão
      });
    }
  }
  
  return tracksWithDurations;
}

function displayAnalysis(analysis) {
  console.log('\n📊 Análise do Catálogo:');
  console.log(`   • Faixas válidas: ${analysis.totalTracks}`);
  console.log(`   • Duração total: ${Math.round(analysis.totalDuration / 60)} minutos`);
  console.log(`   • Tamanho estimado: ${Math.round(analysis.estimatedSize / 1024 / 1024)} MB`);
}

function decideStrategy(analysis) {
  const { totalDuration, estimatedSize } = analysis;
  
  if (estimatedSize <= CONFIG.maxSingleFileSize && totalDuration <= CONFIG.maxSingleFileDuration) {
    return {
      type: 'single',
      name: 'Arquivo Contínuo Único',
      reason: `Catálogo pequeno (${Math.round(estimatedSize / 1024 / 1024)}MB, ${Math.round(totalDuration / 60)}min)`
    };
  } else {
    return {
      type: 'chunks',
      name: 'Múltiplos Chunks AAC',
      reason: `Catálogo grande (${Math.round(estimatedSize / 1024 / 1024)}MB, ${Math.round(totalDuration / 60)}min)`
    };
  }
}

async function generateSingleFile(tracks) {
  console.log('🔧 Gerando arquivo contínuo único...');
  
  // Criar diretórios
  ensureDirectory(CONFIG.singleFile.trackCuesDir);
  
  // Gerar lista de arquivos
  const fileListPath = generateFileList(tracks, 'single');
  
  // Gerar track cues
  const trackCues = generateTrackCues(tracks);
  
  // Salvar metadata
  const trackCuesPath = path.join(CONFIG.singleFile.trackCuesDir, CONFIG.singleFile.trackCuesFile);
  const metadata = {
    mode: 'single',
    totalDuration: trackCues[trackCues.length - 1]?.endTime || 0,
    trackCount: trackCues.length,
    generatedAt: new Date().toISOString(),
    tracks: trackCues
  };
  
  fs.writeFileSync(trackCuesPath, JSON.stringify(metadata, null, 2));
  console.log(`📋 Track cues salvos: ${trackCuesPath}`);
  
  // Gerar arquivo AAC
  const outputPath = path.join(CONFIG.singleFile.outputDir, CONFIG.singleFile.outputFile);
  await generateAAC(fileListPath, outputPath, CONFIG.singleFile.bitrate);
  
  console.log(`✅ Arquivo único gerado: ${CONFIG.singleFile.outputFile}`);
}

async function generateChunks(tracks) {
  console.log('🎬 Gerando múltiplos chunks AAC...');
  
  // Criar diretório
  ensureDirectory(CONFIG.chunks.outputDir);
  
  // Dividir em chunks
  const chunks = divideIntoChunks(tracks);
  console.log(`📦 Dividido em ${chunks.length} chunks`);
  
  const chunkMetadata = [];
  
  // Gerar cada chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkId = `chunk_${String(i + 1).padStart(3, '0')}`;
    const chunkFilename = `radio-importante-${chunkId}.aac`;
    
    console.log(`📦 Gerando ${chunkId}: ${chunk.tracks.length} faixas`);
    
    // Track cues do chunk
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
    const fileListPath = generateFileList(chunk.tracks, chunkId);
    const outputPath = path.join(CONFIG.chunks.outputDir, chunkFilename);
    await generateAAC(fileListPath, outputPath, CONFIG.chunks.bitrate);
  }
  
  // Salvar metadata completa
  const trackCuesPath = path.join(CONFIG.chunks.outputDir, CONFIG.chunks.trackCuesFile);
  const metadata = {
    mode: 'chunks',
    totalDuration: chunkMetadata[chunkMetadata.length - 1]?.endTime || 0,
    trackCount: tracks.length,
    chunkCount: chunks.length,
    chunks: chunkMetadata,
    generatedAt: new Date().toISOString()
  };
  
  fs.writeFileSync(trackCuesPath, JSON.stringify(metadata, null, 2));
  console.log(`📋 Metadata completa salva: ${trackCuesPath}`);
  console.log(`✅ ${chunks.length} chunks gerados com sucesso`);
}

function divideIntoChunks(tracks) {
  const chunks = [];
  let currentChunk = { tracks: [], duration: 0, startTime: 0, endTime: 0 };
  let globalTime = 0;
  
  for (const track of tracks) {
    const trackDuration = track.realDuration;
    
    // Verificar se precisa de novo chunk
    if (currentChunk.tracks.length > 0 && currentChunk.duration + trackDuration > CONFIG.chunks.maxChunkDuration) {
      currentChunk.endTime = globalTime;
      chunks.push(currentChunk);
      
      currentChunk = { tracks: [], duration: 0, startTime: globalTime, endTime: 0 };
    }
    
    currentChunk.tracks.push(track);
    currentChunk.duration += trackDuration;
    globalTime += trackDuration;
  }
  
  if (currentChunk.tracks.length > 0) {
    currentChunk.endTime = globalTime;
    chunks.push(currentChunk);
  }
  
  return chunks;
}

function generateTrackCues(tracks) {
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
      startTime,
      endTime,
      duration: track.realDuration,
      filename: track.filename
    });
    
    currentTime = endTime;
  }
  
  return trackCues;
}

function generateChunkTrackCues(tracks, chunkStartTime) {
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
      startTime,
      endTime,
      globalStartTime: chunkStartTime + startTime,
      globalEndTime: chunkStartTime + endTime,
      duration: track.realDuration,
      filename: track.filename
    });
    
    currentTime = endTime;
  }
  
  return trackCues;
}

function generateFileList(tracks, suffix) {
  const fileListPath = path.join(__dirname, `../temp-filelist-${suffix}.txt`);
  const fileListContent = tracks.map(track => `file '${track.fullPath}'`).join('\n');
  
  fs.writeFileSync(fileListPath, fileListContent);
  return fileListPath;
}

async function generateAAC(fileListPath, outputPath, bitrate) {
  const ffmpegCmd = [
    'ffmpeg',
    '-f concat',
    '-safe 0',
    `-i "${fileListPath}"`,
    '-c:a aac',
    `-b:a ${bitrate}`,
    '-y',
    `"${outputPath}"`
  ].join(' ');
  
  try {
    execSync(ffmpegCmd, { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024 * 50
    });
    
    // Limpar arquivo temporário
    fs.unlinkSync(fileListPath);
  } catch (error) {
    fs.unlinkSync(fileListPath);
    throw new Error(`Erro FFmpeg: ${error.message}`);
  }
}

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  generateAudio().catch(error => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
}

export { generateAudio, CONFIG };
