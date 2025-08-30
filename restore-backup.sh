#!/bin/bash
# restore-backup.sh - Script de restauração do marco estável

echo "🛡️ SCRIPT DE RESTAURAÇÃO - iOS PWA Fix"
echo "======================================"

# Verificar se estamos em um repositório git
if [ ! -d ".git" ]; then
    echo "❌ Erro: Não é um repositório Git!"
    exit 1
fi

echo "📋 Tags disponíveis:"
git tag -l

echo ""
echo "🎯 Restaurando para marco estável: v1.0-ios-pwa-fix"
echo ""

# Mostrar status atual
echo "📊 Status atual do repositório:"
git status --short

echo ""
read -p "⚠️  Confirma restauração? Mudanças não commitadas serão perdidas! (y/N): " confirm

if [[ $confirm != [yY] ]]; then
    echo "❌ Restauração cancelada."
    exit 0
fi

echo ""
echo "🔄 Fazendo stash das mudanças atuais..."
git stash push -m "Backup antes da restauração $(date)"

echo "🎯 Restaurando para tag v1.0-ios-pwa-fix..."
git checkout v1.0-ios-pwa-fix

echo "🔧 Reinstalando dependências..."
npm install

echo "🏗️ Fazendo rebuild..."
npm run build

echo ""
echo "✅ Restauração completa!"
echo "📍 Você está agora na tag: v1.0-ios-pwa-fix"
echo "🎵 iOS PWA background audio deve estar funcionando perfeitamente"
echo ""
echo "Para voltar ao desenvolvimento:"
echo "  git checkout main"
echo "  git stash pop  # (para recuperar mudanças)"
echo ""
echo "Para verificar se está funcionando:"
echo "  npm run dev"
