# 🚀 Configuração do Ambiente Staging

## Passos para Configurar Staging Completo

### 1. AWS S3 - Criar Bucket Staging

```bash
# 1. Criar novo bucket S3 para staging
aws s3 mb s3://radio-importante-staging --region us-west-2

# 2. Configurar bucket para website hosting
aws s3 website s3://radio-importante-staging \
  --index-document index.html \
  --error-document index.html

# 3. Configurar política pública para o bucket
aws s3api put-bucket-policy --bucket radio-importante-staging --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::radio-importante-staging/*"
    }
  ]
}'

# 4. Desabilitar block public access
aws s3api put-public-access-block --bucket radio-importante-staging \
  --public-access-block-configuration \
  "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"
```

### 2. AWS CloudFront - Criar Distribuição Staging

```bash
# Criar arquivo de configuração CloudFront
cat > staging-distribution-config.json << 'EOF'
{
  "CallerReference": "staging-radio-importante-$(date +%s)",
  "Comment": "Radio Importante PWA - Staging Environment",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-radio-importante-staging",
        "DomainName": "radio-importante-staging.s3-website-us-west-2.amazonaws.com",
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "http-only"
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-radio-importante-staging",
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
    "MinTTL": 0
  },
  "Enabled": true,
  "PriceClass": "PriceClass_100"
}
EOF

# Criar distribuição
aws cloudfront create-distribution --distribution-config file://staging-distribution-config.json
```

### 3. DNS - Configurar Subdomínio

No seu provedor de DNS (onde está configurado importantestudio.com):

```dns
# Adicionar registro CNAME
staging.radio    CNAME    d1234567890.cloudfront.net
```

### 4. GitHub Secrets - Adicionar Variáveis

No GitHub (Settings > Secrets and variables > Actions):

```bash
# Secrets para Staging
S3_BUCKET_STAGING = radio-importante-staging
CLOUDFRONT_DISTRIBUTION_ID_STAGING = E1234567890XYZ
AWS_REGION = us-west-2 (se não existir)
```

### 5. URLs Finais

```bash
🚀 PRODUÇÃO: https://radio.importantestudio.com/
🔧 STAGING:   https://staging.radio.importantestudio.com/

Admin:
🚀 PRODUÇÃO: https://radio.importantestudio.com/admin.html  
🔧 STAGING:   https://staging.radio.importantestudio.com/admin.html
```

## Workflow de Deploy

```bash
# 1. Desenvolvimento
git checkout feature/improvements-v2.3
# fazer alterações...
git commit -m "nova feature"
git push origin feature/improvements-v2.3

# 2. Deploy para Staging  
git checkout staging
git merge feature/improvements-v2.3
git push origin staging  # → Deploy automático para staging

# 3. Teste em staging.radio.importantestudio.com

# 4. Deploy para Produção (quando aprovado)
git checkout main
git merge staging
git push origin main     # → Deploy automático para produção
```
