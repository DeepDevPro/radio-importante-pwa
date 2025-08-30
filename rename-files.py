#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json
from pathlib import Path

def sanitize_filename(filename):
    """Aplica a mesma sanitização usada no TypeScript"""
    accent_map = {
        'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a',
        'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
        'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
        'ó': 'o', 'ò': 'o', 'õ': 'o', 'ô': 'o', 'ö': 'o',
        'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
        'ç': 'c', 'ñ': 'n',
        'Á': 'A', 'À': 'A', 'Ã': 'A', 'Â': 'A', 'Ä': 'A',
        'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
        'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
        'Ó': 'O', 'Ò': 'O', 'Õ': 'O', 'Ô': 'O', 'Ö': 'O',
        'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U',
        'Ç': 'C', 'Ñ': 'N'
    }
    
    result = filename
    for accented, clean in accent_map.items():
        result = result.replace(accented, clean)
    
    return result

def main():
    print("🔄 Script de renomeação de arquivos de áudio")
    
    # Caminho para o diretório de áudio
    audio_dir = Path("public/audio")
    
    if not audio_dir.exists():
        print("❌ Diretório public/audio não encontrado!")
        return
    
    print(f"📁 Trabalhando em: {audio_dir.absolute()}")
    
    # Listar arquivos atuais
    print("\n📋 Arquivos atuais:")
    audio_files = list(audio_dir.glob("*.mp3"))
    for file in audio_files:
        print(f"  📄 {file.name}")
    
    print("\n🔄 Processando renomeações...")
    
    renamed_count = 0
    
    for audio_file in audio_files:
        original_name = audio_file.name
        sanitized_name = sanitize_filename(original_name)
        
        if original_name != sanitized_name:
            new_path = audio_dir / sanitized_name
            
            if new_path.exists():
                print(f"⚠️ Arquivo de destino já existe: {sanitized_name}")
                continue
            
            try:
                audio_file.rename(new_path)
                print(f"✅ {original_name} → {sanitized_name}")
                renamed_count += 1
            except Exception as e:
                print(f"❌ Erro ao renomear {original_name}: {e}")
        else:
            print(f"ℹ️ {original_name} (sem alteração necessária)")
    
    print(f"\n✅ Renomeação concluída! {renamed_count} arquivos renomeados.")
    
    # Listar arquivos finais
    print("\n📋 Arquivos após renomeação:")
    audio_files = list(audio_dir.glob("*.mp3"))
    for file in audio_files:
        print(f"  📄 {file.name}")
    
    print("\n🎵 Agora teste o player no navegador!")

if __name__ == "__main__":
    main()
