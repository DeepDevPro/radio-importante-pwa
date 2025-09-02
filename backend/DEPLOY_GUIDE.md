# 🚀 Guia de Deploy Manual - Elastic Beanstalk

## 📋 FASE 3: Deploy Simplificado

### Opção 1: Deploy via AWS Console (Recomendado)

#### 1. Preparar arquivo ZIP para deploy
```bash
# No diretório backend/
cd backend
zip -r radio-backend.zip . -x "node_modules/*" ".git/*" "*.log" ".env"
```

#### 2. Acessar AWS Console
1. Abra [AWS Elastic Beanstalk Console](https://console.aws.amazon.com/elasticbeanstalk/)
2. Clique em "Create Application"

#### 3. Configurar Aplicação
- **Application name**: `radio-importante-backend`
- **Platform**: Node.js
- **Platform version**: Node.js 18 running on 64bit Amazon Linux 2023
- **Application code**: Upload `radio-backend.zip`

#### 4. Configurar Ambiente
- **Environment name**: `radio-backend-prod`
- **Domain**: `radio-backend-prod` (será: radio-backend-prod.us-east-1.elasticbeanstalk.com)

#### 5. Configurar Variáveis de Ambiente
No console AWS EB > Configuration > Environment properties:
```
NODE_ENV=production
AWS_REGION=us-east-1
S3_BUCKET_NAME=radio-importante-storage
PORT=8080
```

#### 6. Deploy
- Clique em "Create environment"
- Aguarde ~5-10 minutos

---

### Opção 2: AWS CLI (Se EB CLI não funcionar)

#### 1. Criar aplicação
```bash
aws elasticbeanstalk create-application \
  --application-name radio-importante-backend \
  --description "Backend para Radio Importante PWA"
```

#### 2. Upload código
```bash
# Criar ZIP
zip -r radio-backend.zip . -x "node_modules/*" ".git/*"

# Upload para S3
aws s3 cp radio-backend.zip s3://elasticbeanstalk-us-east-1-ACCOUNT/
```

#### 3. Criar versão
```bash
aws elasticbeanstalk create-application-version \
  --application-name radio-importante-backend \
  --version-label v1.0.0 \
  --source-bundle S3Bucket=elasticbeanstalk-us-east-1-ACCOUNT,S3Key=radio-backend.zip
```

---

### Opção 3: EB CLI (quando funcionar)

#### 1. Instalar EB CLI novamente
```bash
pip3 install awsebcli --upgrade --user
export PATH=$PATH:~/.local/bin
# ou
export PATH=$PATH:/Users/$(whoami)/Library/Python/3.11/bin
```

#### 2. Inicializar
```bash
eb init radio-importante-backend --region us-east-1
```

#### 3. Criar ambiente
```bash
eb create radio-backend-prod --instance-type t3.micro
```

#### 4. Deploy
```bash
eb deploy
```

---

## 📋 Arquivos Preparados para Deploy

### ✅ Backend está pronto com:
- ✅ `package.json` com scripts corretos
- ✅ `.ebextensions/` configurações EB
- ✅ Todas as rotas implementadas
- ✅ S3 mock para desenvolvimento
- ✅ Documentação completa

### 📦 Estrutura para ZIP:
```
radio-backend.zip
├── app.js
├── package.json
├── .ebextensions/
├── config/
├── middleware/
├── routes/
├── services/
└── README.md
```

---

## 🎯 Próximos Passos (FASE 4)

Após deploy bem-sucedido:

1. **Testar backend em produção**:
```bash
curl https://radio-backend-prod.us-east-1.elasticbeanstalk.com/health
```

2. **Configurar CORS para frontend**:
   - Adicionar URL do EB nas origens permitidas
   - Testar upload via frontend

3. **Configurar credenciais AWS S3**:
   - IAM Role para EB EC2
   - Permissions para S3 bucket

---

## 💡 Troubleshooting

### Problema: Deploy falha
- Verificar logs no EB Console
- Confirmar Node.js version no package.json
- Verificar se .ebextensions está correto

### Problema: Aplicação não inicia
- Verificar script "start" no package.json
- Conferir PORT=8080 nas variáveis

### Problema: CORS
- Adicionar URL do EB no app.js CORS origins
- Redeploy após mudança
