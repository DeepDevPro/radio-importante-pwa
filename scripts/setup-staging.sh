#!/bin/bash

# 🚀 Script de Configuração do Ambiente Staging
# Radio Importante PWA

set -e

echo "🎵 Configurando ambiente staging para Radio Importante PWA"
echo "=================================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log colorido
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar se AWS CLI está instalado
if ! command -v aws &> /dev/null; then
    log_error "AWS CLI não encontrado. Instale primeiro: https://aws.amazon.com/cli/"
    exit 1
fi

# Verificar credenciais AWS
if ! aws sts get-caller-identity &> /dev/null; then
    log_error "Credenciais AWS não configuradas. Execute: aws configure"
    exit 1
fi

log_info "Credenciais AWS verificadas ✅"

# Configurações
BUCKET_NAME="radio-importante-staging"
REGION="us-west-2"

# 1. Criar bucket S3
log_info "Criando bucket S3: $BUCKET_NAME"
if aws s3 ls "s3://$BUCKET_NAME" 2>/dev/null; then
    log_warning "Bucket $BUCKET_NAME já existe"
else
    aws s3 mb "s3://$BUCKET_NAME" --region $REGION
    log_success "Bucket criado: $BUCKET_NAME"
fi

# 2. Configurar website hosting
log_info "Configurando website hosting"
aws s3 website "s3://$BUCKET_NAME" \
    --index-document index.html \
    --error-document index.html
log_success "Website hosting configurado"

# 3. Configurar política pública
log_info "Configurando política pública do bucket"
cat > /tmp/bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file:///tmp/bucket-policy.json
log_success "Política pública configurada"

# 4. Desabilitar block public access
log_info "Configurando acesso público"
aws s3api put-public-access-block --bucket $BUCKET_NAME \
    --public-access-block-configuration \
    "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"
log_success "Acesso público configurado"

# 5. Criar distribuição CloudFront
log_info "Criando distribuição CloudFront"
cat > /tmp/cloudfront-config.json << EOF
{
  "CallerReference": "staging-radio-importante-$(date +%s)",
  "Comment": "Radio Importante PWA - Staging Environment",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-$BUCKET_NAME",
        "DomainName": "$BUCKET_NAME.s3-website-$REGION.amazonaws.com",
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "http-only"
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-$BUCKET_NAME",
    "ViewerProtocolPolicy": "redirect-to-https",
    "TrustedSigners": {
      "Enabled": false,
      "Quantity": 0
    },
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {
        "Forward": "none"
      }
    },
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000
  },
  "CustomErrorResponses": {
    "Quantity": 1,
    "Items": [
      {
        "ErrorCode": 404,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      }
    ]
  },
  "Enabled": true,
  "PriceClass": "PriceClass_100"
}
EOF

# Criar distribuição e capturar ID
DISTRIBUTION_OUTPUT=$(aws cloudfront create-distribution --distribution-config file:///tmp/cloudfront-config.json)
DISTRIBUTION_ID=$(echo $DISTRIBUTION_OUTPUT | jq -r '.Distribution.Id')
DISTRIBUTION_DOMAIN=$(echo $DISTRIBUTION_OUTPUT | jq -r '.Distribution.DomainName')

log_success "Distribuição CloudFront criada"
log_info "Distribution ID: $DISTRIBUTION_ID"
log_info "Domain Name: $DISTRIBUTION_DOMAIN"

# 6. Aguardar distribuição ficar disponível
log_info "Aguardando distribuição CloudFront ficar disponível..."
aws cloudfront wait distribution-deployed --id $DISTRIBUTION_ID
log_success "Distribuição CloudFront disponível"

# 7. Mostrar informações finais
echo ""
echo "🎉 CONFIGURAÇÃO CONCLUÍDA!"
echo "========================="
echo ""
echo "📋 INFORMAÇÕES PARA GITHUB SECRETS:"
echo "S3_BUCKET_STAGING = $BUCKET_NAME"
echo "CLOUDFRONT_DISTRIBUTION_ID_STAGING = $DISTRIBUTION_ID"
echo ""
echo "🌐 URLs:"
echo "CloudFront: https://$DISTRIBUTION_DOMAIN"
echo "S3 Website: http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo "1. Adicionar secrets no GitHub (Settings > Secrets > Actions)"
echo "2. Configurar DNS: staging.radio.importantestudio.com CNAME $DISTRIBUTION_DOMAIN"
echo "3. Fazer merge para branch 'staging' para testar deploy"
echo ""
log_success "Ambiente staging configurado com sucesso!"

# Cleanup
rm -f /tmp/bucket-policy.json /tmp/cloudfront-config.json
