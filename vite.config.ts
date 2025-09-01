import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Buffer } from 'buffer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  server: {
    port: 5173,
    host: true, // Permite acesso via IP local para testes mobile
    fs: {
      // Permite servir arquivos com caracteres especiais
      strict: false
    }
  },
  plugins: [
    {
      name: 'api-routes',
      configureServer(server) {
        // Middleware para configurar MIME types para arquivos HLS e áudio
        server.middlewares.use((req, res, next) => {
          if (req.url?.endsWith('.m3u8')) {
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Access-Control-Allow-Origin', '*');
          } else if (req.url?.endsWith('.ts')) {
            res.setHeader('Content-Type', 'video/mp2t');
            res.setHeader('Access-Control-Allow-Origin', '*');
          } else if (req.url?.endsWith('.mp3')) {
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Accept-Ranges', 'bytes');
          } else if (req.url?.endsWith('.aac')) {
            res.setHeader('Content-Type', 'audio/aac');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Accept-Ranges', 'bytes');
          } else if (req.url?.endsWith('.wav')) {
            res.setHeader('Content-Type', 'audio/wav');
            res.setHeader('Access-Control-Allow-Origin', '*');
          }
          next();
        });

        // Middleware para salvar catalog.json
        server.middlewares.use('/api/save-catalog', (req, res, next) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            req.on('end', () => {
              try {
                const catalogData = JSON.parse(body);
                const catalogPath = path.join(__dirname, 'public', 'data', 'catalog.json');
                
                // Garantir que a pasta public/data existe
                const dataDir = path.dirname(catalogPath);
                if (!fs.existsSync(dataDir)) {
                  fs.mkdirSync(dataDir, { recursive: true });
                }
                
                // Escrever arquivo
                fs.writeFileSync(catalogPath, JSON.stringify(catalogData, null, 2), 'utf8');
                
                console.log('✅ Catálogo salvo com sucesso!');
                console.log(`📊 Total de faixas: ${catalogData.tracks?.length || 0}`);
                
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({ 
                  success: true, 
                  message: 'Catálogo salvo com sucesso!',
                  totalTracks: catalogData.tracks?.length || 0
                }));
                
              } catch (error) {
                console.error('❌ Erro ao salvar catálogo:', error);
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 500;
                res.end(JSON.stringify({ 
                  success: false, 
                  error: error.message 
                }));
              }
            });
          } else {
            next();
          }
        });

        // Middleware para upload de arquivos
        server.middlewares.use('/api/upload', (req, res, next) => {
          if (req.method === 'POST') {
            const uploadDir = path.join(__dirname, 'public', 'audio');
            
            // Garantir que a pasta audio existe
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }

            // Por simplicidade, vamos usar um approach básico
            // O frontend deve enviar o arquivo como base64
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            
            req.on('end', () => {
              try {
                const data = JSON.parse(body);
                const { filename, fileData } = data;
                
                // Validar nome do arquivo
                if (!filename || filename.includes('/') || filename.includes('..')) {
                  throw new Error('Nome de arquivo inválido');
                }
                
                // Decodificar base64 e salvar
                const buffer = Buffer.from(fileData, 'base64');
                const filePath = path.join(uploadDir, filename);
                fs.writeFileSync(filePath, buffer);
                
                console.log(`✅ Arquivo salvo: ${filename} (${buffer.length} bytes)`);
                
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({
                  success: true,
                  message: `Arquivo ${filename} salvo com sucesso!`,
                  filename,
                  size: buffer.length
                }));
                
              } catch (error) {
                console.error('❌ Erro no upload:', error);
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 500;
                res.end(JSON.stringify({
                  success: false,
                  error: error.message || 'Erro ao processar upload'
                }));
              }
            });
          } else {
            next();
          }
        });

        // Middleware para listar arquivos de áudio reais
        server.middlewares.use('/api/audio-files', (req, res, next) => {
          if (req.method === 'GET') {
            try {
              const audioDir = path.join(__dirname, 'public', 'audio');
              
              if (!fs.existsSync(audioDir)) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({ files: [] }));
                return;
              }
              
              // Listar apenas arquivos de áudio
              const files = fs.readdirSync(audioDir)
                .filter(file => {
                  const ext = path.extname(file).toLowerCase();
                  return ['.mp3', '.aac', '.wav', '.m4a', '.ogg'].includes(ext);
                })
                .filter(file => !file.startsWith('.')) // Ignorar arquivos ocultos
                .sort();
              
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ 
                files,
                count: files.length,
                audioDir: audioDir
              }));
              
            } catch (error) {
              console.error('❌ Erro ao listar arquivos:', error);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({
                error: error.message || 'Erro ao listar arquivos',
                files: []
              }));
            }
          } else {
            next();
          }
        });

        // Middleware para deletar arquivo de áudio
        server.middlewares.use('/api/delete-audio', (req, res, next) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            
            req.on('end', () => {
              try {
                const { filename } = JSON.parse(body);
                
                if (!filename) {
                  throw new Error('Nome do arquivo não fornecido');
                }
                
                // Validar nome do arquivo por segurança
                if (filename.includes('/') || filename.includes('..') || !filename.endsWith('.mp3')) {
                  throw new Error('Nome de arquivo inválido');
                }
                
                const audioDir = path.join(__dirname, 'public', 'audio');
                const filePath = path.join(audioDir, filename);
                
                // Verificar se arquivo existe
                if (!fs.existsSync(filePath)) {
                  throw new Error('Arquivo não encontrado');
                }
                
                // Deletar arquivo físico
                fs.unlinkSync(filePath);
                
                console.log(`🗑️ Arquivo deletado: ${filename}`);
                
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({
                  success: true,
                  message: `Arquivo ${filename} deletado com sucesso`,
                  filename
                }));
                
              } catch (error) {
                console.error('❌ Erro ao deletar arquivo:', error);
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 500;
                res.end(JSON.stringify({
                  success: false,
                  error: error.message || 'Erro ao deletar arquivo'
                }));
              }
            });
          } else {
            next();
          }
        });

        // Middleware para regenerar catálogo
        server.middlewares.use('/api/regenerate-catalog', (req, res, next) => {
          if (req.method === 'POST') {
            try {
              const audioDir = path.join(__dirname, 'public', 'audio');
              const catalogPath = path.join(__dirname, 'public', 'data', 'catalog.json');
              
              if (!fs.existsSync(audioDir)) {
                throw new Error('Pasta de áudio não encontrada');
              }
              
              // Ler catálogo existente para preservar metadados editados
              let existingCatalog: any = { tracks: [] };
              if (fs.existsSync(catalogPath)) {
                try {
                  existingCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
                } catch (error) {
                  console.log('⚠️ Erro ao ler catálogo existente, criando novo');
                }
              }
              
              // Ler arquivos da pasta audio, excluindo arquivos de stream contínuo
              const files = fs.readdirSync(audioDir)
                .filter(file => file.match(/\.(mp3|wav|ogg|aac|m4a)$/i))
                .filter(file => !file.startsWith('radio-importante-continuous')); // Excluir arquivos de stream
              
              // Separar arquivos existentes e novos
              const existingFiles: Array<{filename: string, existingTrack: any}> = [];
              const newFiles: string[] = [];
              
              files.forEach(filename => {
                const existingTrack = existingCatalog.tracks.find((t: any) => t.filename === filename);
                if (existingTrack) {
                  existingFiles.push({ filename, existingTrack });
                } else {
                  newFiles.push(filename);
                }
              });
              
              // Preservar ordem dos arquivos existentes + adicionar novos no final
              const tracks: any[] = [];
              
              // Primeiro: adicionar arquivos existentes na ordem original
              existingFiles.forEach(({ existingTrack }) => {
                tracks.push({
                  ...existingTrack,
                  id: `track${(tracks.length + 1).toString().padStart(3, '0')}`
                });
              });
              
              // Segundo: adicionar novos arquivos no final (em ordem alfabética para consistência)
              newFiles.sort().forEach(filename => {
                const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
                const parts = nameWithoutExt.split(' - ');
                let artist = 'Artista Desconhecido';
                let title = nameWithoutExt;
                
                if (parts.length >= 2) {
                  artist = parts[0].trim();
                  title = parts.slice(1).join(' - ').trim();
                }
                
                tracks.push({
                  id: `track${(tracks.length + 1).toString().padStart(3, '0')}`,
                  title,
                  artist,
                  filename,
                  duration: 300, // Duração estimada
                  format: filename.split('.').pop()?.toLowerCase() || 'mp3'
                });
              });
              
              const catalog = {
                version: '1.0.0',
                tracks,
                metadata: {
                  totalTracks: tracks.length,
                  totalDuration: tracks.length * 300,
                  artwork: '/images/cover.jpg',
                  radioName: 'Radio Importante'
                }
              };
              
              // Salvar catálogo
              fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
              
              console.log(`✅ Catálogo regenerado: ${tracks.length} faixas (ordem preservada, novos no final)`);
              
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                message: 'Catálogo regenerado com sucesso!',
                totalTracks: tracks.length,
                preservedTracks: existingFiles.length,
                newTracks: newFiles.length,
                orderInfo: 'Músicas existentes mantidas na ordem original, novas adicionadas no final'
              }));
              
            } catch (error) {
              console.error('❌ Erro ao regenerar catálogo:', error);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({
                success: false,
                error: error.message || 'Erro ao regenerar catálogo'
              }));
            }
          } else {
            next();
          }
        });
      }
    }
  ],
  build: {
    target: 'ES2020',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true
  },
  publicDir: 'public',
  // Configuração para melhor suporte a UTF-8
  define: {
    'process.env': {}
  }
})
