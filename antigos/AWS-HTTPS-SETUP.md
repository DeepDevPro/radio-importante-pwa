# 🔐 Configuração HTTPS para AWS Elastic Beanstalk
# Radio Importante Backend - Resolver Mixed Content

## 🎯 Objetivo
Configurar HTTPS no backend AWS para resolver o problema de Mixed Content (HTTPS -> HTTP) que está bloqueando uploads em produção.

## 📋 PASSO 1: Criar Certificado SSL/TLS

### 1.1 Acessar AWS Certificate Manager (ACM)
1. No Console AWS, vá para **Certificate Manager**
2. Clique em **"Request a certificate"**
3. Selecione **"Request a public certificate"**

### 1.2 Configurar Domínio
1. **Domain name**: `backend.radio.importantestudio.com`
   - Ou use um subdomínio da sua escolha
2. **Validation method**: **DNS validation** (mais rápido)
3. Clique **"Request"**

### 1.3 Validar Certificado
1. Vá para seu provedor de DNS (onde você gerencia `importantestudio.com`)
2. Adicione o registro CNAME que o AWS mostrar
3. Aguarde validação (pode levar alguns minutos)

## 📋 PASSO 2: Configurar Load Balancer no Elastic Beanstalk

### 2.1 Acessar Elastic Beanstalk Console
1. Vá para **Elastic Beanstalk**
2. Selecione sua aplicação: `radio-importante-backend`
3. Selecione o ambiente: `prod`

### 2.2 Configurar Load Balancer
1. No painel do ambiente, clique em **"Configuration"**
2. Na seção **"Load balancer"**, clique em **"Edit"**

### 2.3 Adicionar Listener HTTPS
1. Na seção **"Listeners"**, clique em **"Add listener"**
2. Configure:
   - **Listener port**: `443`
   - **Listener protocol**: `HTTPS`
   - **Instance port**: `80` (sua aplicação roda em HTTP internamente)
   - **Instance protocol**: `HTTP`
   - **SSL certificate**: Selecione o certificado criado no Passo 1

### 2.4 Configurar Redirecionamento (Opcional)
Para redirecionar HTTP -> HTTPS automaticamente:
1. Edite o listener existente (porta 80)
2. Configure uma regra de redirecionamento para porta 443

### 2.5 Aplicar Configurações
1. Clique **"Apply"**
2. Aguarde o Elastic Beanstalk atualizar o ambiente (pode levar 5-10 minutos)

## 📋 PASSO 3: Configurar DNS

### 3.1 Encontrar Load Balancer URL
1. Na configuração do Load Balancer, copie o **DNS name**
2. Será algo como: `backend-env.us-west-2.elb.amazonaws.com`

### 3.2 Criar Registro DNS
No seu provedor de DNS, adicione:
- **Type**: `CNAME`
- **Name**: `backend` (ou o subdomínio escolhido)
- **Value**: O DNS name do Load Balancer
- **TTL**: `300` (5 minutos)

## 📋 PASSO 4: Atualizar URLs no Código

### 4.1 Atualizar admin.html
Altere a URL de produção de:
```javascript
productionUrl: 'http://radio-importante-backend-prod.eba-heipfui9.us-west-2.elasticbeanstalk.com'
```

Para:
```javascript
productionUrl: 'https://backend.radio.importantestudio.com'
```

### 4.2 Atualizar state.ts
Altere a URL de produção no código TypeScript também.

## 📋 PASSO 5: Testar Configuração

### 5.1 Verificar HTTPS
```bash
curl -I https://backend.radio.importantestudio.com/health
```

Deve retornar:
- Status 200
- Headers de CORS corretos
- Certificado SSL válido

### 5.2 Testar Upload
1. Acesse o admin em produção: `https://radio.importantestudio.com/admin.html`
2. Verifique se o status mostra "Produção: ✅ Online"
3. Teste upload de uma música

## 🚨 Troubleshooting

### Erro: "Certificate not found"
- Aguarde a validação do certificado no ACM
- Verifique se o registro DNS foi adicionado corretamente

### Erro: "Load Balancer update failed"
- Verifique se você tem permissões IAM necessárias
- Tente novamente após alguns minutos

### Erro: "Mixed Content ainda acontece"
- Verifique se as URLs no código foram atualizadas
- Limpe cache do navegador
- Verifique se o DNS propagou (`nslookup backend.radio.importantestudio.com`)

## ⏱️ Tempo Estimado
- **Certificado SSL**: 5-30 minutos (depende da validação DNS)
- **Load Balancer**: 5-10 minutos
- **DNS propagação**: 5-60 minutos
- **Total**: 15-100 minutos

## 🎉 Resultado Esperado
Após a configuração:
- ✅ Backend disponível via HTTPS
- ✅ Admin mostra "Produção: ✅ Online"
- ✅ Uploads funcionam em produção
- ✅ Sem Mixed Content warnings
- ✅ Certificado SSL válido

---

💡 **Dica**: Se tiver dificuldades com DNS, pode usar o próprio Load Balancer URL temporariamente:
`https://your-loadbalancer-dns.us-west-2.elb.amazonaws.com`
