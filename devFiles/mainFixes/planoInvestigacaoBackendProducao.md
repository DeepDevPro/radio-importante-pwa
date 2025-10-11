## 🔍 Plano de Investigação - Backend Produção

**Você está certo:** O app produção já funcionava, então é provável que seja algo simples que mudou com a separação staging/produção.

## 📋 Checklist de Investigação

### 1. **Configuração GitHub Integration**
- [ ] Verificar se app `radio-importante-pwa-backend-skg2w` tem GitHub connected
- [ ] Confirmar se Source Directory está server (não root)
- [ ] Validar se branch está configurada para `main` (não `master`)

### 2. **Environment Variables Produção**
- [ ] Verificar se tem as mesmas env vars que staging (mas com values de produção)
- [ ] Confirmar `NODE_ENV=production`
- [ ] Validar credentials DO_SPACES para produção

### 3. **App Spec Comparison**
- [ ] Comparar App Spec produção vs staging
- [ ] Verificar se buildpack strategy está igual
- [ ] Confirmar se service name não ultrapassou 32 chars

### 4. **DIGITALOCEAN_ACCESS_TOKEN**
- [ ] Verificar se token tem permissões para ambos os apps
- [ ] Testar se staging ainda funciona (confirmar que token está ok)

## 🔧 **Para quando você voltar:**

```bash
# 1. Testar staging ainda funciona (validar token)
git checkout staging
# fazer pequena mudança no server/server.js
# git commit & push → ver se deploy staging ainda funciona

# 2. Se staging ok → problema é específico do app produção
# 3. Focar em: Source Directory + GitHub Integration no app produção
```

## 🎯 **Hipóteses Principais:**

1. **Source Directory** não está server no app produção
2. **GitHub Integration** perdeu conexão durante mudanças
3. **Branch configuration** ainda apontando para branch antiga

## 🚀 **Status Atual:**
- ✅ **Staging:** 100% funcional com CI/CD
- ✅ **Produção:** Backend rodando, mas CI/CD falhando
- 🔍 **Next:** Investigação focada nas 3 hipóteses acima
