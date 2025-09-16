#!/bin/bash

# Script para verificar se o deploy S3 está funcionando corretamente

echo "🔍 VERIFICANDO DEPLOY S3..."
echo ""

# URL base (substitua pela sua)
BASE_URL="https://radio.importantestudio.com"

echo "📡 Testando arquivos críticos:"
echo ""

# Teste 1: Admin HTML
echo "1. 📄 Admin HTML:"
curl -s -o /dev/null -w "Status: %{http_code} | Content-Type: %{content_type}\n" "$BASE_URL/admin.html"

# Teste 2: Scripts JS (módulos)
echo "2. 🔧 Script config.js:"
curl -s -o /dev/null -w "Status: %{http_code} | Content-Type: %{content_type}\n" "$BASE_URL/scripts/config.js"

echo "3. 🌐 Script api.js:"
curl -s -o /dev/null -w "Status: %{http_code} | Content-Type: %{content_type}\n" "$BASE_URL/scripts/api.js"

# Teste 3: CSS
echo "4. 🎨 CSS reset:"
curl -s -o /dev/null -w "Status: %{http_code} | Content-Type: %{content_type}\n" "$BASE_URL/styles/reset.css"

echo ""
echo "✅ RESULTADOS:"
echo ""
echo "👀 O que verificar:"
echo "- Status deve ser: 200"
echo "- .js deve ter Content-Type: text/javascript"
echo "- .css deve ter Content-Type: text/css"
echo "- .html deve ter Content-Type: text/html"
echo ""
echo "🚨 Se algum .js mostrar 'application/octet-stream':"
echo "   → Precisa configurar Content-Type no S3!"
echo ""
echo "🧪 Teste completo em:"
echo "   $BASE_URL/test-admin-refatorado.html"
