# 🔗 Guia de Integração Frontend-Backend

## 🎯 Objetivo
Integrar o sistema administrativo do frontend com o backend Elastic Beanstalk para upload via API.

## 📋 FASE 4: Integração Frontend ✅ PREPARADA

### 1. Detecção Automática de Backend

O frontend deve detectar automaticamente se o backend está disponível:

```typescript
// src/admin-simple.ts - Adicionar propriedade
private backendUrl: string = '';

// Detectar ambiente e configurar backend URL
private detectBackend(): void {
  const isProduction = !window.location.hostname.includes('localhost');
  this.backendUrl = isProduction 
    ? 'https://radio-backend-prod.us-east-1.elasticbeanstalk.com'
    : 'http://localhost:8080';
}
```

### 2. Teste de Conectividade

```typescript
private async testBackendConnectivity(): Promise<boolean> {
  try {
    const response = await fetch(`${this.backendUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
```

### 3. Upload para Backend

```typescript
private async uploadToBackend(files: File[]): Promise<void> {
  const formData = new FormData();
  files.forEach(file => formData.append('audioFiles', file));

  const response = await fetch(`${this.backendUrl}/api/upload`, {
    method: 'POST',
    body: formData
  });

  const result = await response.json();
  if (result.success) {
    console.log(`✅ ${result.uploaded.length} arquivos enviados!`);
  }
}
```

### 4. Atualização de CORS no Backend

Para integração completa, adicionar ao backend/app.js:

```javascript
app.use(cors({
  origin: [
    'https://radio.importantestudio.com',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    // Adicionar outros domínios conforme necessário
  ],
  credentials: true
}));
```

---

## 🧪 Teste da Integração

### Teste Local (Development)
1. Backend rodando em `http://localhost:8080`
2. Frontend em `http://localhost:5173`
3. CORS configurado para localhost

### Teste Produção
1. Backend: `https://radio-backend-prod.us-east-1.elasticbeanstalk.com`
2. Frontend: `https://radio.importantestudio.com`
3. CORS configurado para domínio produção

---

## 📊 Fluxo de Upload Integrado

```
1. Usuário arrasta arquivos → Interface Admin
2. Frontend detecta backend disponível
3. Se backend OK: Upload via API
4. Se backend OFF: Upload local (GitHub Actions)
5. Backend atualiza catálogo S3 automaticamente
6. Frontend recebe confirmação
```

---

## 🔧 Comandos para Teste

### Testar Backend Local
```bash
cd backend
node app.js
curl http://localhost:8080/health
```

### Testar Upload Local
```bash
# Com arquivos de teste
curl -X POST http://localhost:8080/api/upload \
  -F "audioFiles=@test.mp3"
```

### Testar Produção (após deploy)
```bash
curl https://radio-backend-prod.us-east-1.elasticbeanstalk.com/health
```

---

## 🚀 Status da Integração

### ✅ Backend Preparado
- Rotas `/api/upload` funcionais
- CORS configurado
- Rate limiting ativo
- Validação de arquivos
- S3 mock para desenvolvimento

### ⏳ Frontend Aguardando Deploy Backend
- Código de integração preparado
- Detecção automática pronta
- Fallback para modo local funcionando

### 🎯 Após Deploy EB
1. Atualizar CORS com URL do EB
2. Testar upload via frontend
3. Validar catálogo S3 atualizando
4. Confirmar funcionamento em produção

---

## 💡 Benefícios da Integração

### ✅ Upload Direto para S3
- Sem necessidade de GitHub Actions manual
- Upload instantâneo via interface web
- Múltiplos arquivos simultâneos

### ✅ Catálogo Automático
- Atualização automática do catalog.json
- Extração de metadados dos arquivos
- Sincronização imediata

### ✅ Experiência de Usuário
- Drag & drop funcional
- Feedback em tempo real
- Validação de arquivos
- Progress indicators

---

**Status**: 🎯 **INTEGRAÇÃO PREPARADA - AGUARDANDO DEPLOY BACKEND**
