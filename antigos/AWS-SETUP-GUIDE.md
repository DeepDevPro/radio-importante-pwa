# 🔧 Guia de Configuração AWS para GitHub Actions
# Radio Importante PWA - Deploy Automatizado

## 📋 PASSO 1: Criar Usuário IAM para GitHub Actions

### 1.1 Acessar AWS Console
1. Acesse: https://console.aws.amazon.com/
2. Faça login na sua conta AWS
3. Vá para: **IAM** (Identity and Access Management)

### 1.2 Criar Usuário IAM
1. No painel IAM, clique em **"Users"** (Usuários)
2. Clique em **"Add users"** (Adicionar usuários)
3. **User name**: `radio-github-actions`
4. **Select AWS credential type**: 
   - ✅ Marque **"Access key - Programmatic access"**
   - ❌ NÃO marque "Password - AWS Management Console access"
5. Clique **"Next: Permissions"**

### 1.3 Configurar Permissões
1. Selecione **"Attach existing policies directly"**
2. Procure e selecione as seguintes políticas:
   - ✅ **AmazonS3FullAccess** (para gerenciar bucket S3)
   - ✅ **AmazonRoute53FullAccess** (para configurar DNS)
3. Clique **"Next: Tags"** (pode pular)
4. Clique **"Next: Review"**
5. Clique **"Create user"**

### 1.4 IMPORTANTE: Salvar Credenciais
⚠️ **ATENÇÃO**: Esta é a ÚNICA vez que você verá essas credenciais!

Copie e salve em local seguro:
- **Access Key ID**: `AKIA...` (cerca de 20 caracteres)
- **Secret Access Key**: `...` (cerca de 40 caracteres)

## 📦 PASSO 2: Criar Bucket S3

### 2.1 Acessar S3 Console
1. No Console AWS, vá para **S3**
2. Clique em **"Create bucket"**

### 2.2 Configurar Bucket
- **Bucket name**: `radio-importantestudio-com`
- **AWS Region**: `US West (Oregon) us-west-2`
- **Object Ownership**: ACLs disabled (default)
- **Block Public Access**: ❌ DESMARCAR todas as opções
- **Bucket Versioning**: Enable (recomendado)
- **Tags**: (opcional)
- **Default encryption**: Enable (recomendado)

### 2.3 Confirmar
1. ⚠️ Confirme que desmarcou "Block all public access"
2. Marque a caixa: "I acknowledge that the current settings might result in this bucket and the objects within becoming public"
3. Clique **"Create bucket"**

### 2.4 Configurar Website Hosting
1. Clique no bucket criado
2. Vá para aba **"Properties"**
3. Role até **"Static website hosting"**
4. Clique **"Edit"**
5. Selecione **"Enable"**
6. **Index document**: `index.html`
7. **Error document**: `index.html`
8. Clique **"Save changes"**

### 2.5 Configurar Bucket Policy
1. Vá para aba **"Permissions"**
2. Role até **"Bucket policy"**
3. Clique **"Edit"**
4. Cole a seguinte política (substitua BUCKET-NAME pelo nome do seu bucket):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::radio-importantestudio-com/*"
        }
    ]
}
```

5. Clique **"Save changes"**

### 2.6 Anotar Endpoint
Na aba Properties > Static website hosting, anote o **Bucket website endpoint**:
`http://radio-importantestudio-com.s3-website-us-west-2.amazonaws.com`

## 🌐 PASSO 3: Configurar Route 53 (DNS)

### 3.1 Acessar Route 53
1. No Console AWS, vá para **Route 53**
2. Clique em **"Hosted zones"**

### 3.2 Verificar Hosted Zone
1. Você deve ter uma hosted zone para `importantestudio.com`
2. Se não tiver, clique **"Create hosted zone"**:
   - **Domain name**: `importantestudio.com`
   - **Type**: Public hosted zone

### 3.3 Criar Registro CNAME
1. Entre na hosted zone `importantestudio.com`
2. Clique **"Create record"**
3. **Record name**: `radio`
4. **Record type**: `CNAME`
5. **Value**: `radio-importantestudio-com.s3-website-us-west-2.amazonaws.com`
6. **TTL**: `300` (5 minutos)
7. Clique **"Create records"**

## 🔒 PASSO 4: Verificar SSL Certificate

### 4.1 Acessar Certificate Manager
1. No Console AWS, vá para **Certificate Manager**
2. ⚠️ **IMPORTANTE**: Mude a região para **US East (N. Virginia) us-west-2**
3. Verifique se existe certificado para `*.importantestudio.com`
4. Status deve ser **"Issued"**

Se não existir, você precisará solicitar um novo certificado wildcard.

## 🔧 PASSO 5: Configurar GitHub Secrets

### 5.1 Acessar Repositório GitHub
1. Vá para: https://github.com/DeepDevPro/radio-importante-pwa
2. Clique em **Settings** (Configurações)
3. No menu lateral, clique em **Secrets and variables** > **Actions**

### 5.2 Adicionar Secrets
Clique em **"New repository secret"** para cada um:

1. **Name**: `AWS_ACCESS_KEY_ID`
   **Value**: (a Access Key ID que você salvou)

2. **Name**: `AWS_SECRET_ACCESS_KEY`
   **Value**: (a Secret Access Key que você salvou)

3. **Name**: `AWS_REGION`
   **Value**: `us-west-2`

4. **Name**: `S3_BUCKET`
   **Value**: `radio-importantestudio-com`

## ✅ VERIFICAÇÃO FINAL

Após configurar tudo:
1. ✅ Usuário IAM criado com credenciais salvas
2. ✅ Bucket S3 configurado para website hosting
3. ✅ Bucket policy aplicada (acesso público)
4. ✅ Route 53 CNAME configurado
5. ✅ SSL certificate verificado
6. ✅ GitHub Secrets configurados

## 🚀 PRÓXIMO PASSO

Após completar todos os passos acima, você poderá:
1. Fazer commit das mudanças
2. Push para branch main
3. GitHub Actions fará deploy automático!

Endpoint de teste: `http://radio-importantestudio-com.s3-website-us-west-2.amazonaws.com`
URL final: `https://radio.importantestudio.com`
