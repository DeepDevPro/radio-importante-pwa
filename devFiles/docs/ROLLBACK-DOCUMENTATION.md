# HLS Rollback Documentation
## R6-4: Sistema de Snapshot e Restauração

**Data:** 06/10/2025  
**Objetivo:** Preservar playlist funcional anterior antes de publicar nova versão.

---

## 📚 **Visão Geral**

O sistema de rollback cria automaticamente snapshots das playlists HLS antes de cada nova publicação, permitindo restauração rápida em caso de problemas.

### **Arquivos Envolvidos:**
- **Snapshot Module:** `backend/hls/rollbackSnapshot.js`
- **Upload Integration:** `backend/hls/uploadHlsFiles.js` 
- **API Endpoints:** `backend/routes/hlsGenerate.routes.js`

---

## 🔄 **Funcionamento Automático**

### **Criação de Snapshot (Automática)**
Toda vez que uma nova playlist é publicada:

1. **Antes do upload** da nova `index.m3u8`
2. **Backup automático** da playlist atual para `index.prev.m3u8`
3. **Log de confirmação** com prefixo `[Rollback]`
4. **Continuidade garantida** mesmo se snapshot falhar

**Localização dos Snapshots:**
```
generated/hls/latest/index.prev.m3u8   # Snapshot do latest
generated/hls/rolling/index.prev.m3u8  # Snapshot do rolling
```

---

## 🔧 **Restauração Manual**

### **Via API (Recomendado)**

**Restaurar Latest:**
```bash
curl -X POST https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/api/hls/rollback-latest
```

**Verificar Snapshots Disponíveis:**
```bash
curl https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/api/hls/rollback-info/latest
curl https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/api/hls/rollback-info/rolling
```

### **Via Storage Direto (Emergência)**

Se a API estiver indisponível, usar DigitalOcean Spaces diretamente:

1. **Fazer download do snapshot:**
   ```bash
   wget https://radio-importante-audio.atl1.digitaloceanspaces.com/generated/hls/latest/index.prev.m3u8
   ```

2. **Renomear para ativar:**
   - Copiar `index.prev.m3u8` → `index.m3u8` no Spaces
   - Usar interface web do DigitalOcean ou s3cmd

---

## 📊 **Monitoramento**

### **Logs de Rollback**
Monitorar no runtime do DigitalOcean:
```
[Rollback] Snapshot created: latest playlist backed up to generated/hls/latest/index.prev.m3u8
[Rollback] Restored: latest playlist restored from generated/hls/latest/index.prev.m3u8
```

### **Validação Pós-Restauração**
Após rollback, validar funcionamento:
```bash
# Testar playlist restaurada
curl https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/api/hls/latest/diagnostics

# Executar smoke test completo
npm run hls:smoke
```

---

## ⚠️ **Cenários de Uso**

### **1. Nova Geração Corrompida**
**Sintomas:** Playlist malformada, segmentos ausentes, erros de reprodução
**Ação:** Rollback imediato via API

### **2. Performance Degradada**
**Sintomas:** Diagnósticos mostram warnings, tempo de resposta alto
**Ação:** Rollback + investigação offline

### **3. Falha de Upload Parcial**
**Sintomas:** Apenas alguns segments foram uploadados
**Ação:** Sistema já protege via atomicidade, mas rollback disponível como backup

---

## 🧪 **Testes**

### **Teste de Snapshot Automático**
```bash
# Gerar nova playlist (cria snapshot automaticamente)
curl -X POST https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/api/hls/generate-hls \
  -H "Content-Type: application/json" \
  -d '{"mode":"latest","simulate":false}'

# Verificar se snapshot foi criado
curl https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/api/hls/rollback-info/latest
```

### **Teste de Restauração**
```bash
# Restaurar do snapshot
curl -X POST https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/api/hls/rollback-latest

# Validar playlist restaurada
curl https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/api/hls/latest/diagnostics
```

---

## 🔍 **Troubleshooting**

### **Snapshot Não Criado**
- **Causa:** Primeira geração (sem playlist anterior)
- **Solução:** Normal, próximas gerações terão snapshot

### **Rollback Falhou**
- **Causa:** Snapshot não existe ou corrompido
- **Solução:** Gerar nova playlist via simulate=false

### **Playlist Após Rollback Inválida**
- **Causa:** Snapshot estava corrompido
- **Solução:** Forçar nova geração completa

---

## 📋 **Checklist de Aceite**

- [x] ✅ Snapshot criado automaticamente antes de cada upload
- [x] ✅ Endpoint `/api/hls/rollback-latest` funcional
- [x] ✅ Endpoint `/api/hls/rollback-info/:mode` informativo
- [x] ✅ Logs com prefixo `[Rollback]` visíveis
- [x] ✅ Processo não bloqueia geração se snapshot falhar
- [x] ✅ Documentação completa para operação

---

**✅ Sistema de Rollback R6-4 Implementado e Documentado**
