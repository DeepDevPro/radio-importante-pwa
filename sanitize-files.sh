#!/bin/bash

# Script para renomear arquivos com acentos para versões sanitizadas
# Este script deve ser executado no diretório public/audio/

echo "🔧 Iniciando sanitização de arquivos de áudio..."

# Arquivo com acentos problematiques
rename_file() {
    original="$1"
    sanitized="$2"
    
    if [ -f "$original" ]; then
        echo "📁 Renomeando: '$original' → '$sanitized'"
        mv "$original" "$sanitized"
        echo "✅ Renomeado com sucesso"
    else
        echo "⚠️ Arquivo não encontrado: $original"
    fi
}

# Mapeamento dos arquivos problemáticos
rename_file "Blazé - Melôdies & Lãve (DJ Black Remix).mp3" "Blaze - Melodies & Lave (DJ Black Remix).mp3"
rename_file "Céu - Cãngote & Groove's Sound (manhã & Café mix).mp3" "Ceu - Cangote & Groove's Sound (manha & Cafe mix).mp3"
rename_file "L_écio - Sõûr & Drums (DJ Black Mix).mp3" "L_ecio - Sour & Drums (DJ Black Mix).mp3"

echo "🎵 Sanitização concluída!"
echo ""
echo "ℹ️ Os nomes originais com acentos serão preservados no catálogo para exibição."
echo "ℹ️ Apenas os arquivos físicos foram renomeados para evitar problemas de encoding."
