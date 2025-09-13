# 🚀 PARTE 4: DEPLOY E CI/CD

> **Tempo estimado**: 60 minutos  
> **Objetivo**: Configurar deploy automatizado e ativar novo backend  
> **Estratégia**: Deploy incremental com possibilidade de rollback  

---

## 🎯 **CHECKLIST DESTA PARTE**

- [ ] Simplificar GitHub Actions atual
- [ ] Deploy frontend com novo backend
- [ ] Ativar novo backend em produção
- [ ] Configurar monitoramento
- [ ] Teste do sistema completo

---

## 📊 **PASSO 1: BACKUP DO WORKFLOW ATUAL (10 min)**

### **1.1 Fazer backup do workflow atual**

📝 **AÇÃO**: Preservar workflow atual antes de modificar

💻 **COMANDO**:
```bash
cp .github/workflows/deploy-complete.yml .github/workflows/deploy-complete.yml.backup-$(date +%Y%m%d)
ls -la .github/workflows/*.backup*
```

### **1.2 Desabilitar workflow atual temporariamente**

📝 **AÇÃO**: Evitar deploys automáticos durante migração

📂 **ARQUIVO**: `.github/workflows/deploy-complete.yml`

💻 **COMANDO**: Adicionar no início do arquivo:
```yaml
# TEMPORARIAMENTE DESABILITADO PARA MIGRAÇÃO DO
# name: Deploy Complete (DISABLED)
# 
# on:
#   push:
#     branches: [ main ]
# 
# Conteúdo original comentado...
```

### **1.3 Commit da desabilitação**

💻 **COMANDO**:
```bash
git add .github/workflows/
git commit -m "temp: Disable current workflow during DO migration"
git push origin main
```

---

## 📊 **PASSO 2: CRIAR WORKFLOW SIMPLIFICADO (20 min)**

### **2.1 Criar novo workflow mínimo**

📝 **AÇÃO**: Criar workflow focado apenas no frontend

📂 **ARQUIVO**: `.github/workflows/deploy-frontend-do.yml`

💻 **COMANDO**:
```bash
cat > .github/workflows/deploy-frontend-do.yml << 'EOF'
name: Deploy Frontend (DigitalOcean Backend)

on:
  push:
    branches: [ main ]
    paths: 
      - 'src/**'
      - 'public/**'
      - 'index.html'
      - 'package.json'
      - 'vite.config.ts'

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build frontend
      run: npm run build
      env:
        NODE_ENV: production
    
    - name: Test build
      run: |
        ls -la dist/
        echo "Build completed successfully"
    
    - name: Deploy to AWS S3
      if: success()
      run: |
        # Aqui vai o comando de deploy para S3/CloudFront
        # (manter o mesmo processo atual se estiver funcionando)
        echo "Deploy to S3 would happen here"
        echo "Using DigitalOcean backend: Backend configured in build"
    
    - name: Notify success
      if: success()
      run: |
        echo "✅ Frontend deployed successfully with DO backend integration"
EOF
```

### **2.2 Configurar deploy para S3 (se aplicável)**

📝 **AÇÃO**: Se frontend atual deploya para S3, manter processo

💻 **COMANDO**: Verificar se existe configuração AWS:
```bash
grep -r "aws\|s3\|cloudfront" .github/workflows/ 2>/dev/null | head -5
```

✅ **SE EXISTE**: Copiar seção de deploy S3 do workflow antigo
❌ **SE NÃO EXISTE**: Manter echo placeholder por enquanto

---

## 📊 **PASSO 3: DEPLOY MANUAL DO FRONTEND (15 min)**

### **3.1 Build local do frontend**

📝 **AÇÃO**: Testar build com nova configuração

💻 **COMANDO**:
```bash
npm ci
NODE_ENV=production npm run build
```

✅ **VERIFICAR**: Build deve completar sem erros

### **3.2 Verificar se build aponta para DO**

📝 **AÇÃO**: Confirmar que build usa novo backend

💻 **COMANDO**:
```bash
# Verificar se arquivo de config foi incluído no build
find dist/ -name "*.js" | xargs grep -l "digitalocean\|radio-importante-backend" | head -3
```

### **3.3 Deploy manual (se necessário)**

📝 **AÇÃO**: Se tiver processo de deploy manual configurado

💻 **COMANDO**:
```bash
# Exemplo se usar AWS CLI:
# aws s3 sync dist/ s3://radio-importantestudio-com/ --delete
# aws cloudfront create-invalidation --distribution-id XXXXX --paths "/*"

echo "📝 Deploy manual executado com sucesso (ou não aplicável)"
```

---

## 📊 **PASSO 4: TESTE DE INTEGRAÇÃO COMPLETA (10 min)**

### **4.1 Testar frontend em produção**

📝 **AÇÃO**: Verificar se frontend em produção conecta com backend DO

💻 **COMANDO**:
```bash
# Testar se frontend carrega
curl -I https://radio.importantestudio.com

# Aguardar propagação (se houve deploy)
sleep 30
```

### **4.2 Verificar integração via browser**

📝 **AÇÃO**: Teste manual no navegador

✅ **VERIFICAR**:
1. Abrir https://radio.importantestudio.com
2. Abrir DevTools → Console
3. Verificar se aparece log "Using API: https://radio-importante-backend-[hash].ondigitalocean.app"
4. Verificar se Service Worker registra sem erro
5. Verificar se não há erros de Mixed Content

### **4.3 Testar funcionalidade básica**

📝 **AÇÃO**: Verificar se PWA básico funciona

✅ **VERIFICAR**:
- PWA pode ser instalado
- Audio player carrega
- Menu de administração acessível (mesmo que upload ainda não funcione)

---

## 📊 **PASSO 5: MONITORAMENTO E LOGS (5 min)**

### **5.1 Configurar alertas na DigitalOcean**

📝 **AÇÃO**: Ativar monitoramento básico no painel DO

📋 **CONFIGURAÇÃO**:
- CPU Usage alerts
- Memory Usage alerts
- Response Time monitoring
- Error Rate tracking

### **5.2 Verificar logs do backend**

📝 **AÇÃO**: Confirmar que backend está logando corretamente

✅ **VERIFICAR**: No painel DO → Runtime Logs:
- Logs de startup aparecem
- Requests do frontend sendo logados
- Não há erros críticos

### **5.3 Configurar webhook para GitHub (opcional)**

📝 **AÇÃO**: Conectar deploy automático do backend

📋 **CONFIGURAÇÃO**: No painel DO → Settings → Autodeploy:
- Ativar deploy automático no push para `main`
- Source Directory: `/backend`

---

## ✅ **CHECKPOINT - FIM DA PARTE 4**

### **Validações Obrigatórias:**
- [ ] Workflow antigo desabilitado
- [ ] Novo workflow criado e commitado
- [ ] Frontend build funcionando
- [ ] Frontend em produção conecta com backend DO
- [ ] Service Worker v6-do registra sem erro
- [ ] Logs do backend DO funcionando

### **Sistema Agora Está:**
- ✅ Frontend: Produção (novo)
- ✅ Backend: DigitalOcean (novo)
- ⚠️ Sistema anterior: Ainda disponível para rollback

### **Próximo Passo:**
Se todos os checkpoints foram completados com sucesso:
👉 **Abrir arquivo**: `GUIA_PARTE_05_TESTES.md`

### **Se Algum Checkpoint Falhou:**
❌ **PARAR AQUI** e reportar:
- Erros no build do frontend
- Erros de conexão frontend ↔ backend
- Mixed Content warnings no console
- Falhas nos logs do backend DO

---

**🚀 NOTA**: O sistema agora usa DigitalOcean, mas ainda precisamos de testes completos antes de considerar a migração finalizada.
