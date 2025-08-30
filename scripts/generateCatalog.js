// scripts/generateCatalog.js - Script para gerar catalog.json automaticamente
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUDIO_DIR = path.join(__dirname, '../public/audio');
const CATALOG_PATH = path.join(__dirname, '../data/catalog.json');

// Função para gerar título e artista baseado no nome do arquivo
function parseFilename(filename) {
  // Remove extensão
  const name = filename.replace(/\.(mp3|m4a|aac|wav)$/i, '');
  
  // Tenta detectar padrão "Artista - Título"
  if (name.includes(' - ')) {
    const [artist, ...titleParts] = name.split(' - ');
    return {
      artist: artist.trim(),
      title: titleParts.join(' - ').trim()
    };
  }
  
  // Se não tem hífen, usa o nome do arquivo como título
  return {
    artist: 'Artista Desconhecido',
    title: name.trim()
  };
}

// Função para estimar duração (placeholder - em produção usaria ffprobe)
function estimateDuration() {
  return Math.floor(Math.random() * 180) + 120; // Entre 2-5 minutos
}

function generateCatalog() {
  console.log('🎵 Gerando catálogo automaticamente...');
  
  // Verificar se pasta existe
  if (!fs.existsSync(AUDIO_DIR)) {
    console.error('❌ Pasta /public/audio/ não encontrada!');
    return;
  }
  
  // Listar arquivos de áudio
  const files = fs.readdirSync(AUDIO_DIR)
    .filter(file => {
      // Filtrar apenas arquivos de áudio e ignorar .DS_Store
      return /\.(mp3|m4a|aac|wav)$/i.test(file) && !file.startsWith('.');
    })
    .sort(); // Ordenar alfabeticamente
  
  if (files.length === 0) {
    console.warn('⚠️ Nenhum arquivo de áudio encontrado em /public/audio/');
    return;
  }
  
  console.log(`📁 Encontrados ${files.length} arquivos:`);
  files.forEach((file, index) => {
    console.log(`   ${index + 1}. ${file}`);
  });
  
  // Gerar tracks
  const tracks = files.map((filename, index) => {
    const { artist, title } = parseFilename(filename);
    
    return {
      id: `track${String(index + 1).padStart(3, '0')}`,
      title,
      artist,
      filename,
      duration: estimateDuration(),
      format: path.extname(filename).slice(1).toLowerCase()
    };
  });
  
  // Criar objeto do catálogo
  const catalog = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    totalTracks: tracks.length,
    tracks
  };
  
  // Criar pasta data se não existir
  const dataDir = path.dirname(CATALOG_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Salvar catalog.json
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  
  console.log(`✅ Catálogo gerado com sucesso!`);
  console.log(`📄 Arquivo: ${CATALOG_PATH}`);
  console.log(`🎵 Total de faixas: ${tracks.length}`);
  console.log(`\n📋 Preview do catálogo:`);
  
  tracks.slice(0, 3).forEach(track => {
    console.log(`   • ${track.artist} - ${track.title} (${track.filename})`);
  });
  
  if (tracks.length > 3) {
    console.log(`   ... e mais ${tracks.length - 3} faixas`);
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  generateCatalog();
}

export { generateCatalog };
