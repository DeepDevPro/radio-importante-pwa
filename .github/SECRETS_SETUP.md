# 🔐 GitHub Secrets Configuration

## 📋 Secrets Necessários para GitHub Actions

Para o deploy automático funcionar, você precisa configurar estes secrets no GitHub:

### **1. AWS Credentials (Obrigatórios)**
```
AWS_ACCESS_KEY_ID = your_aws_access_key_id
AWS_SECRET_ACCESS_KEY = your_aws_secret_access_key
```

### **2. S3 Bucket (Obrigatório)**
```
S3_BUCKET_NAME = radio-importante-storage
```

### **3. CloudFront (Opcional)**
```
CLOUDFRONT_DISTRIBUTION_ID = E1234567890ABC
```

---

## 🔧 Como Configurar no GitHub

### **1. Acessar Settings do Repositório**
1. Ir para: https://github.com/DeepDevPro/radio-importante-pwa/settings/secrets/actions
2. Clicar em "New repository secret"

### **2. Adicionar cada secret:**

#### **AWS_ACCESS_KEY_ID**
- Name: `AWS_ACCESS_KEY_ID`
- Secret: Sua AWS Access Key ID

#### **AWS_SECRET_ACCESS_KEY**
- Name: `AWS_SECRET_ACCESS_KEY`
- Secret: Sua AWS Secret Access Key

#### **S3_BUCKET_NAME**
- Name: `S3_BUCKET_NAME`
- Secret: `radio-importante-storage` (ou nome do seu bucket)

### **3. Verificar Permissions AWS**

O usuário AWS deve ter estas policies:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "elasticbeanstalk:*",
        "s3:*",
        "ec2:*",
        "iam:PassRole",
        "autoscaling:*",
        "cloudformation:*",
        "logs:*"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## 🚀 Como Usar os Workflows

### **Deploy Automático (Push)**
Quando você fizer push para `main`, o GitHub Actions detectará automaticamente:
- Se mudou `backend/` → Deploy do backend
- Se mudou `src/`, `public/` → Deploy do frontend

### **Deploy Manual**
1. Ir para: https://github.com/DeepDevPro/radio-importante-pwa/actions
2. Selecionar "🚀 Deploy Complete Stack"
3. Clicar "Run workflow"
4. Escolher o que deploar:
   - ✅ Deploy backend: Sim/Não
   - ✅ Deploy frontend: Sim/Não

### **Deploy Apenas Backend**
1. Selecionar "🚀 Deploy Backend to Elastic Beanstalk"
2. Clicar "Run workflow"

---

## 📊 O que cada Workflow faz

### **deploy-backend.yml**
- 🔧 Setup Node.js 18
- 📦 Install dependencies
- 🧪 Run tests (opcional)
- 🚀 Deploy para Elastic Beanstalk
- ✅ Health check
- 📊 Summary report

### **deploy-complete.yml**
- 🔍 Detecta mudanças (backend vs frontend)
- 🏗️ Deploy backend (se necessário)
- 🎨 Deploy frontend (se necessário)
- 🧪 Testes de integração
- 📢 Relatório final

---

## 🧪 Testando Workflows

### **1. Primeiro Deploy (Manual)**
1. Configure todos os secrets
2. Execute "Deploy Complete Stack" manualmente
3. Verifique se backend e frontend funcionam

### **2. Deploy Automático (Push)**
1. Faça mudanças no código
2. Commit e push para `main`
3. GitHub Actions detecta e executa automaticamente

### **3. Verificar Results**
- Backend: https://radio-backend-prod.us-east-1.elasticbeanstalk.com/health
- Frontend: https://radio-importante-storage.s3-website-us-east-1.amazonaws.com

---

## 🚨 Troubleshooting

### **Erro: AWS Credentials**
- Verificar se secrets estão configurados
- Confirmar IAM permissions

### **Erro: EB CLI**
- Primeiro deploy pode demorar 10-15 minutos
- Verificar se application existe

### **Erro: S3 Sync**
- Confirmar nome do bucket
- Verificar permissions S3

### **Logs Detalhados**
- GitHub Actions > Job específico > Step details
- AWS Console > Elastic Beanstalk > Logs
- AWS Console > S3 > Access logs

---

## 💡 Próximos Passos

1. **Configurar Secrets** no GitHub
2. **Testar Deploy Manual** primeiro
3. **Fazer Push** para testar automático
4. **Monitorar** workflows e logs
5. **Ajustar** conforme necessário

**Status**: 🔥 **GITHUB ACTIONS CI/CD COMPLETO CONFIGURADO!** 🔥
