# 🎨 PARTE 3: ATUALIZAÇÃO DO FRONTEND

> **Tempo estimado**: 30 minutos  
> **Objetivo**: Atualizar frontend para usar novo backend DigitalOcean  
> **Estratégia**: Atualizações mínimas, preservar PWA e funcionalidades iOS  

---

## 🎯 **CHECKLIST DESTA PARTE**

- [ ] Atualizar URLs do backend no código
- [ ] Atualizar Service Worker
- [ ] Audit completo de URLs HTTP
- [ ] Testar integração localmente
- [ ] Preparar para deploy

---

## 📊 **PASSO 1: PREPARAR INFORMAÇÕES (5 min)**

### **1.1 Documentar URLs**

📝 **AÇÃO**: Ter URLs claramente documentadas

💻 **COMANDO**:
```bash
# Verificar se URL da DO foi documentada na Parte 2
cat backend/URL_DIGITALOCEAN.md
```

✅ **VERIFICAR**: Deve ter URL da DO. Exemplo:
`https://radio-importante-backend-abc123.ondigitalocean.app`

❌ **SE NÃO TIVER**: Voltar à Parte 2 e documentar URL correta

### **1.2 Definir variáveis**

📝 **AÇÃO**: Definir URLs para uso nesta parte

💻 **COMANDO**:
```bash
# Substituir pela URL real da sua DO:
export NEW_BACKEND_URL="https://radio-importante-backend-[SEU-HASH].ondigitalocean.app"
export OLD_BACKEND_URL="radio-importante-backend-prod.eba-heipfui9.us-west-2.elasticbeanstalk.com"

echo "Nova URL: $NEW_BACKEND_URL"
echo "URL Antiga: $OLD_BACKEND_URL"
```

---

## 📊 **PASSO 2: ATUALIZAR CONFIGURAÇÃO DA API (10 min)**

### **2.1 Localizar arquivo de configuração API**

📝 **AÇÃO**: Encontrar onde estão as configurações de API

💻 **COMANDO**:
```bash
find src/ -name "*api*" -o -name "*config*" | head -5
```

### **2.2 Atualizar configuração principal**

📂 **ARQUIVO**: `src/config/api.ts` (ou arquivo encontrado acima)

📝 **AÇÃO**: Se arquivo existe, atualizar:

💻 **COMANDO**: Abrir arquivo e substituir:
```typescript
// ANTES:
const API_CONFIG = {
  // ... configuração antiga
};

// DEPOIS:
const API_CONFIG = {
  local: 'http://localhost:8080',
  production: 'https://radio-importante-backend-[SEU-HASH].ondigitalocean.app',
  current: process.env.NODE_ENV === 'production' ? 'production' : 'local'
};

export const getApiUrl = () => {
  const config = API_CONFIG[API_CONFIG.current];
  console.log(`🔗 Using API: ${config}`);
  return config;
};
```

### **2.3 Se não existe arquivo de config**

📝 **AÇÃO**: Criar arquivo de configuração

📂 **ARQUIVO**: `src/config/api.ts`

💻 **COMANDO**:
```bash
mkdir -p src/config
cat > src/config/api.ts << 'EOF'
// Configuração de API - Radio Importante
const API_CONFIG = {
  local: 'http://localhost:8080',
  production: 'https://radio-importante-backend-[SUBSTITUIR-HASH].ondigitalocean.app',
  current: process.env.NODE_ENV === 'production' ? 'production' : 'local'
};

export const getApiUrl = () => {
  const config = API_CONFIG[API_CONFIG.current];
  console.log(`🔗 Using API: ${config}`);
  return config;
};

export default API_CONFIG;
EOF
```

⚠️ **IMPORTANTE**: Substituir `[SUBSTITUIR-HASH]` pela hash real da DO

---

## 📊 **PASSO 3: BUSCAR E SUBSTITUIR URLs HARDCODED (10 min)**

### **3.1 Buscar URLs do backend antigo**

📝 **AÇÃO**: Encontrar todas as referências ao backend antigo

💻 **COMANDO**:
```bash
grep -r "elasticbeanstalk" src/ public/ --exclude-dir=node_modules 2>/dev/null || echo "Nenhuma referência elasticbeanstalk encontrada"
grep -r "eba-heipfui9" src/ public/ --exclude-dir=node_modules 2>/dev/null || echo "Nenhuma referência eba-heipfui9 encontrada"
```

### **3.2 Buscar URLs localhost hardcoded**

💻 **COMANDO**:
```bash
grep -r "localhost:8080" src/ public/ --exclude-dir=node_modules 2>/dev/null
grep -r "127.0.0.1" src/ public/ --exclude-dir=node_modules 2>/dev/null
```

### **3.3 Substituir URLs encontradas**

📝 **AÇÃO**: Para cada arquivo encontrado, substituir URLs

❌ **SE ENCONTRAR REFERÊNCIAS**: Substituir manualmente ou usar:

💻 **COMANDO**:
```bash
# Exemplo de substituição (ajustar conforme arquivos encontrados):
find src/ -name "*.js" -o -name "*.ts" | xargs sed -i.bak 's|http://localhost:8080|${getApiUrl()}|g' 2>/dev/null
```

---

## 📊 **PASSO 4: ATUALIZAR SERVICE WORKER (10 min)**

### **4.1 Localizar Service Worker**

📝 **AÇÃO**: Encontrar arquivo do Service Worker

💻 **COMANDO**:
```bash
find public/ -name "sw.js" -o -name "service-worker.js" -o -name "*worker*.js"
```

### **4.2 Verificar URLs HTTP no Service Worker**

📂 **ARQUIVO**: `public/sw.js` (ou arquivo encontrado)

💻 **COMANDO**:
```bash
cat public/sw.js | grep -n "http://" | head -5
```

### **4.3 Atualizar versão do cache**

📝 **AÇÃO**: Incrementar versão para forçar update

📂 **ARQUIVO**: `public/sw.js`

💻 **COMANDO**: Encontrar linha CACHE_NAME e incrementar:
```javascript
// ANTES:
const CACHE_NAME = 'radio-importante-v5';

// DEPOIS:
const CACHE_NAME = 'radio-importante-v6-do'; // Incrementar versão
```

### **4.4 Remover URLs HTTP hardcoded**

📝 **AÇÃO**: Remover ou converter URLs HTTP para HTTPS

💻 **COMANDO**: No arquivo `public/sw.js`, procurar e remover/corrigir:
```javascript
// REMOVER linhas como:
// 'http://localhost:8080/...',
// 'http://radio-importante-backend...',

// MANTER apenas:
// URLs relativas: '/', '/index.html'
// URLs HTTPS: 'https://...'
```

---

## 📊 **PASSO 5: TESTE LOCAL DA INTEGRAÇÃO (5 min)**

### **5.1 Testar se frontend aponta para DO**

📝 **AÇÃO**: Verificar se configuração está correta

💻 **COMANDO**:
```bash
# Se tiver Node.js build local:
npm run dev &
sleep 5
```

### **5.2 Verificar logs do console**

📝 **AÇÃO**: Abrir localhost no browser e verificar console

✅ **VERIFICAR**: 
- Deve aparecer log "Using API: https://radio-importante-backend-[hash].ondigitalocean.app"
- Não deve ter erros de CORS
- Service Worker deve registrar sem erro

### **5.3 Parar servidor local**

💻 **COMANDO**:
```bash
pkill -f "npm run dev" || pkill -f "vite"
```

---

## 📊 **PASSO 6: PREPARAR COMMIT DAS MUDANÇAS (5 min)**

### **6.1 Verificar arquivos modificados**

📝 **AÇÃO**: Ver o que foi alterado

💻 **COMANDO**:
```bash
git status
git diff --name-only
```

### **6.2 Fazer commit das mudanças**

📝 **AÇÃO**: Commitar atualizações do frontend

💻 **COMANDO**:
```bash
git add .
git commit -m "feat: Update frontend to use DigitalOcean backend

- Update API configuration for DO App Platform
- Increment Service Worker cache version to v6-do
- Remove hardcoded HTTP URLs
- Configure CORS for new backend URL

Backend URL: [SUBSTITUIR-PELA-URL-REAL]"
```

### **6.3 Push para repositório**

💻 **COMANDO**:
```bash
git push origin main
```

✅ **VERIFICAR**: Commit deve aparecer no GitHub

---

## ✅ **CHECKPOINT - FIM DA PARTE 3**

### **Validações Obrigatórias:**
- [ ] URLs do backend atualizadas para DO
- [ ] Service Worker versão incrementada
- [ ] Nenhuma URL HTTP hardcoded restante
- [ ] Configuração de API criada/atualizada
- [ ] Commit feito e pushed para GitHub

### **Próximo Passo:**
Se todos os checkpoints foram completados com sucesso:
👉 **Abrir arquivo**: `GUIA_PARTE_04_DEPLOY.md`

### **Se Algum Checkpoint Falhou:**
❌ **PARAR AQUI** e reportar:
- Quais arquivos não foram encontrados
- Erros no git commit/push
- URLs que não foram substituídas corretamente

---

**🎨 NOTA**: O frontend agora está preparado para usar o novo backend, mas ainda não foi deployado. O sistema em produção ainda usa o backend antigo.
