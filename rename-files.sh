#!/bin/bash

# Script para renomear arquivos de áudio para versões sanitizadas
# Execute este script manualmente no terminal

cd "$(dirname "$0")"

echo "🔄 Iniciando renomeação de arquivos..."

# Verificar se o diretório public/audio existe
if [ ! -d "public/audio" ]; then
    echo "❌ Diretório public/audio não encontrado!"
    exit 1
fi

cd public/audio

echo "📁 Trabalhando em: $(pwd)"

# Listar arquivos atuais
echo "📋 Arquivos atuais:"
ls -la

echo ""
echo "🔄 Renomeando arquivos..."

# Renomear cada arquivo conforme mapeamento do catalog.json
# Baseado nos nomes do catalog.json, precisamos renomear:

# 1. Blazé - Melôdies & Lãve.mp3 → Blaze - Melodies & Lave.mp3
if [ -f "Blazé - Melôdies & Lãve.mp3" ]; then
    mv "Blazé - Melôdies & Lãve.mp3" "Blaze - Melodies & Lave.mp3"
    echo "✅ Blazé → Blaze"
else
    echo "⚠️ Arquivo 'Blazé - Melôdies & Lãve.mp3' não encontrado"
fi

# 2. Céu - Cãngote & Groove's Sound.mp3 → Ceu - Cangote & Groove's Sound.mp3
if [ -f "Céu - Cãngote & Groove's Sound.mp3" ]; then
    mv "Céu - Cãngote & Groove's Sound.mp3" "Ceu - Cangote & Groove's Sound.mp3"
    echo "✅ Céu → Ceu"
else
    echo "⚠️ Arquivo 'Céu - Cãngote & Groove's Sound.mp3' não encontrado"
fi

# Verificar outros arquivos que possam ter acentos...
# (Adicionar conforme necessário)

echo ""
echo "📋 Arquivos após renomeação:"
ls -la

echo ""
echo "✅ Renomeação concluída!"
echo "🎵 Agora teste o player no navegador"
