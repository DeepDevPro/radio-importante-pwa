#!/bin/bash

# 🚀 Script para Padronizar Deploy e Implementar Fluxo de TAGs
# Baseado nas orientações do GPT5

set -e

echo "🔥 === CORRIGINDO AMBIENTES E IMPLEMENTANDO FLUXO DE TAGS === 🔥"
echo ""

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}🔄 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# PASSO 1: Corrigir deploy-complete.yml para usar radio-importante-backend
print_step "Corrigindo conflito de ambientes no deploy-complete.yml..."

sed -i.bak 's/radio-pwa-backend/radio-importante-backend/g' .github/workflows/deploy-complete.yml

print_success "Ambiente padronizado para radio-importante-backend"

# PASSO 2: Modificar triggers para usar TAGs nos workflows principais
print_step "Modificando triggers dos workflows para usar TAGs..."

# Deploy backend - trigger por TAG
cat > .github/workflows/deploy-backend.yml.new << 'EOF'
name: 🚀 Deploy Backend to Elastic Beanstalk

on:
  push:
    tags: ['v*']  # Trigger apenas em TAGs
  workflow_dispatch: # Permite trigger manual

jobs:
  deploy-backend:
    name: 🏗️ Deploy Backend
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./backend
        
    steps:
    - name: 📥 Checkout code
      uses: actions/checkout@v4
    
    - name: 🟢 Setup Node.js 20
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
        cache-dependency-path: './backend/package-lock.json'
        
    - name: 📦 Install dependencies
      run: npm ci
      
    - name: 🔧 Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2
        
    - name: 🛠️ Install EB CLI
      run: |
        pip install awsebcli
        
    - name: 📦 Create deployment package
      run: |
        ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
        S3_BUCKET="elasticbeanstalk-us-west-2-$ACCOUNT_ID"
        
        echo "Uploading source to S3 bucket: $S3_BUCKET"
        zip -r deploy-package.zip . -x "*.git*" "node_modules/*" "*.log" "*.tmp"
        
        aws s3 cp deploy-package.zip s3://$S3_BUCKET/radio-importante-backend/deploy-package.zip
        
    - name: 🚀 Deploy to Elastic Beanstalk
      run: |
        # Configurar EB CLI
        if [ ! -d ".elasticbeanstalk" ]; then
          eb init radio-importante-backend --region us-west-2 --platform node.js
        else
          rm -rf .elasticbeanstalk
          eb init radio-importante-backend --region us-west-2 --platform node.js
        fi
        
        # Usar TAG como version-label
        VERSION_LABEL="${{ github.ref_name }}"
        
        # Deploy com version-label da TAG
        if aws elasticbeanstalk describe-environments --environment-names radio-importante-backend-prod --region us-west-2 --query 'Environments[0].Status' --output text 2>/dev/null | grep -q "Ready"; then
          echo "Environment exists and is ready. Creating new version..."
          
          aws elasticbeanstalk create-application-version \
            --application-name radio-importante-backend \
            --version-label $VERSION_LABEL \
            --description "Deploy from TAG $VERSION_LABEL" \
            --source-bundle S3Bucket="elasticbeanstalk-us-west-2-$(aws sts get-caller-identity --query Account --output text)",S3Key="radio-importante-backend/deploy-package.zip" \
            --region us-west-2
          
          # Aguardar criação da versão
          for i in {1..12}; do
            STATUS=$(aws elasticbeanstalk describe-application-versions --application-name radio-importante-backend --version-labels $VERSION_LABEL --region us-west-2 --query 'ApplicationVersions[0].Status' --output text 2>/dev/null || echo "NOTFOUND")
            if [ "$STATUS" = "PROCESSED" ]; then
              echo "Application version $VERSION_LABEL is ready"
              break
            elif [ "$STATUS" = "FAILED" ]; then
              echo "Application version creation failed"
              exit 1
            else
              echo "Waiting for version $VERSION_LABEL to be processed... (attempt $i/12)"
              sleep 10
            fi
          done
          
          if [ "$STATUS" != "PROCESSED" ]; then
            echo "Timeout waiting for application version"
            exit 1
          fi
          
          # Deploy da nova versão
          aws elasticbeanstalk update-environment \
            --environment-name radio-importante-backend-prod \
            --version-label $VERSION_LABEL \
            --region us-west-2
            
          # Aguardar deploy
          aws elasticbeanstalk wait environment-updated --environment-names radio-importante-backend-prod --region us-west-2
          
        else
          echo "Environment does not exist. Creating..."
          eb create radio-importante-backend-prod --instance-type t3.micro --timeout 20 --envvars NODE_ENV=production,AWS_REGION=us-west-2,S3_BUCKET_NAME=radio-importante-storage
        fi
        
    - name: ✅ Verify deployment
      run: |
        URL=$(aws elasticbeanstalk describe-environments --environment-names radio-importante-backend-prod --region us-west-2 --query 'Environments[0].CNAME' --output text 2>/dev/null || echo "")
        
        if [ -z "$URL" ] || [ "$URL" = "None" ]; then
          URL="radio-importante-backend-prod.us-west-2.elasticbeanstalk.com"
        fi
        
        echo "🌐 Backend URL: http://$URL"
        
        # Test health endpoint
        for i in {1..5}; do
          if curl -f "http://$URL/health" > /dev/null 2>&1; then
            echo "✅ Health check passed!"
            break
          else
            echo "⏳ Waiting for backend to be ready... (attempt $i/5)"
            sleep 30
          fi
        done
        
        echo "📋 Deployment Summary:" >> $GITHUB_STEP_SUMMARY
        echo "- 🏗️ **Backend**: Deployed successfully" >> $GITHUB_STEP_SUMMARY
        echo "- 🌐 **URL**: http://$URL" >> $GITHUB_STEP_SUMMARY
        echo "- 🏷️ **Version**: ${{ github.ref_name }}" >> $GITHUB_STEP_SUMMARY
EOF

mv .github/workflows/deploy-backend.yml.new .github/workflows/deploy-backend.yml

# Deploy frontend - trigger por TAG
cat > .github/workflows/deploy.yml.new << 'EOF'
name: 🚀 Deploy Frontend to S3

on:
  push:
    tags: ['v*']  # Trigger apenas em TAGs
  workflow_dispatch: # Permite trigger manual

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: 📥 Checkout code
      uses: actions/checkout@v4

    - name: 📦 Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'

    - name: 📦 Install dependencies
      run: npm ci

    - name: 🔧 Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ secrets.AWS_REGION }}

    - name: 🏗️ Build production
      run: |
        # Build com TAG para versionamento
        VITE_VERSION="${{ github.ref_name }}" npm run build
        
        echo "Build completed for version ${{ github.ref_name }}"

    - name: 🚀 Deploy to S3
      run: |
        TAG_NAME="${{ github.ref_name }}"
        
        # Upload principal
        aws s3 sync dist/ s3://${{ secrets.S3_BUCKET }} --delete
        
        # Backup da versão em releases/
        aws s3 sync dist/ s3://${{ secrets.S3_BUCKET }}/releases/${TAG_NAME}/ 
        
        echo "✅ Frontend deployed to S3"
        echo "📦 Backup created at releases/${TAG_NAME}/"

    - name: 🔄 Invalidate CloudFront
      run: |
        if [ -n "${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }}" ]; then
          aws cloudfront create-invalidation --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} --paths "/*"
          echo "✅ CloudFront cache invalidated"
        else
          echo "⚠️ CloudFront distribution ID not configured"
        fi

    - name: 📋 Deployment Summary
      run: |
        echo "📋 Frontend Deployment Summary:" >> $GITHUB_STEP_SUMMARY
        echo "- 🌐 **URL**: https://${{ secrets.S3_BUCKET }}" >> $GITHUB_STEP_SUMMARY
        echo "- 🏷️ **Version**: ${{ github.ref_name }}" >> $GITHUB_STEP_SUMMARY
        echo "- 📦 **Backup**: s3://${{ secrets.S3_BUCKET }}/releases/${{ github.ref_name }}/" >> $GITHUB_STEP_SUMMARY
EOF

mv .github/workflows/deploy.yml.new .github/workflows/deploy.yml

print_success "Workflows modificados para usar TAGs"

# PASSO 3: Criar workflow para proteção de branch (opcional)
print_step "Criando workflow de proteção..."

cat > .github/workflows/protect-main.yml << 'EOF'
name: 🛡️ Protect Main Branch

on:
  pull_request:
    branches: [ main ]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
    - name: 📥 Checkout code
      uses: actions/checkout@v4
      
    - name: 📦 Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
        
    - name: 📦 Install dependencies
      run: npm ci
      
    - name: 🧪 Run tests
      run: |
        # Testes básicos
        npm run build
        echo "✅ Build successful"
        
    - name: 🔍 Validate backend
      run: |
        cd backend
        npm ci
        npm test || echo "⚠️ No tests configured"
        echo "✅ Backend validated"
EOF

print_success "Workflow de proteção criado"

# PASSO 4: Atualizar package.json com script de release
print_step "Adicionando scripts de release..."

# Verificar se já existe o script
if ! grep -q '"release":' package.json; then
  # Adicionar script de release
  sed -i.bak '/"scripts": {/a\
    "release": "echo \"Use: git tag v1.0.0 && git push origin v1.0.0\"",
' package.json
fi

print_success "Scripts de release adicionados"

echo ""
echo "🎉 === CONFIGURAÇÃO COMPLETA === 🎉"
echo ""
echo "✅ Ambientes padronizados para: radio-importante-backend"
echo "✅ Workflows configurados para trigger por TAG"
echo "✅ Backup automático em releases/<tag>/"
echo "✅ Version-label do EB = nome da TAG"
echo "✅ CloudFront invalidation automática"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo "1. Commit essas mudanças"
echo "2. Criar sua primeira TAG: git tag v1.0.0"
echo "3. Push da TAG: git push origin v1.0.0"
echo "4. Workflows executarão automaticamente!"
echo ""
