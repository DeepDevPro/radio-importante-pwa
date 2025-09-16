#!/bin/bash

# Build Script para Radio Importante PWA (produção)
# Gera a pasta dist pronta sem sobrescrever com arquivos de desenvolvimento

echo "🚀 Iniciando build para produção..."

# 1. Executar build do Vite (copiará public/ automaticamente)
echo "📦 Executando build do Vite..."
npm run build

# 2. Mostrar um resumo do que foi gerado
echo "🔍 Verificando estrutura da pasta dist..."
echo "Arquivos JavaScript:" 
find dist -name "*.js" | wc -l

echo "Arquivos CSS:"
find dist -name "*.css" | wc -l

echo "Arquivos HTML:"
find dist -name "*.html" | wc -l

# Importante: Não sobrescrever dist/index.html com index.html de dev
# Importante: Não sobrescrever dist/admin.html com versões de dev
# Importante: Vite já copia public/ (manifest.webmanifest, sw.js, icons, data, etc.)

echo "✅ Build concluído! Pasta dist atualizada para produção."
echo "📁 Arquivos prontos em: ./dist/"
echo ""
echo "🚀 Para fazer deploy:"
echo "   - Suba o conteúdo da pasta dist/ para o S3 (raiz do bucket)"
echo "   - Verifique que dist/index.html referencia /assets/main-*.js (não /src/app.ts)"
echo "   - Se usar CloudFront, faça uma invalidação em /*"
