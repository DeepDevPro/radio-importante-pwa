#!/bin/bash
# deploy-production.sh - Script de deploy para produção

echo "🚀 Iniciando deploy para produção..."

# 1. Limpar build anterior
echo "🧹 Limpando build anterior..."
rm -rf dist/

# 2. Build para produção
echo "📦 Fazendo build para produção..."
npm run build

# 3. Verificar se build foi bem-sucedido
if [ ! -d "dist" ]; then
    echo "❌ Erro: Build falhou!"
    exit 1
fi

# 4. Verificar arquivos críticos HLS
echo "🔍 Verificando arquivos HLS críticos..."
if [ ! -f "dist/audio/hls/playlist-continuous.m3u8" ]; then
    echo "❌ Erro: Playlist HLS não encontrada no build!"
    exit 1
fi

if [ ! -f "dist/audio/hls/track-cues.json" ]; then
    echo "❌ Erro: Track cues não encontrados no build!"
    exit 1
fi

echo "✅ Verificações passed!"
echo "📁 Build pronto em: ./dist/"
echo ""
echo "🌐 Para deploy manual:"
echo "  1. Copie o conteúdo de ./dist/ para o servidor"
echo "  2. Configure HTTPS (obrigatório para PWA)"
echo "  3. Configure cabeçalhos CORS se necessário"
echo ""
echo "📋 Arquivos críticos incluídos:"
echo "  ✅ ./dist/audio/hls/playlist-continuous.m3u8"
echo "  ✅ ./dist/audio/hls/track-cues.json"
echo "  ✅ ./dist/audio/hls/segment-*.ts"
echo "  ✅ ./dist/manifest.webmanifest"
echo "  ✅ ./dist/sw.js"
echo ""
echo "🎉 Deploy preparado com sucesso!"
