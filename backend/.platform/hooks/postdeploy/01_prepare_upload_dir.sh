#!/bin/bash
set -euo pipefail

echo "🔧 Preparando diretórios para upload..."

# Garante o diretório esperado pelo código (com e sem "current")
sudo mkdir -p /var/app/current/public/audio
sudo mkdir -p /var/app/public

# Aponta /var/app/public/audio para o real
if [ ! -L /var/app/public/audio ]; then
  sudo ln -sfn /var/app/current/public/audio /var/app/public/audio
fi

# Permissões para o usuário da app (geralmente 'webapp' no EB Node)
sudo chown -R webapp:webapp /var/app/current/public
sudo chmod -R 755 /var/app/current/public

echo "✅ Diretórios de upload configurados com sucesso"
