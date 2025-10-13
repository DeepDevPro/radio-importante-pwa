# 🚀 Workflow de Desenvolvimento - Radio Importante PWA

## Ambiente Staging Configurado

### 📁 Estrutura de Branches

```bash
main                     # 🚀 PRODUÇÃO (radio.importantestudio.com)
staging                  # 🔧 STAGING (staging.radio.importantestudio.com)  
feature/improvements-v2.3 # 🛠️ DESENVOLVIMENTO
```

### 🔄 Fluxo de Trabalho

#### 1. Desenvolvimento (Feature Branch)
```bash
# Trabalhar na feature branch
git checkout feature/improvements-v2.3
# fazer alterações...
git add .
git commit -m "feat: nova funcionalidade"
git push origin feature/improvements-v2.3
```

#### 2. Deploy para Staging (Teste)
```bash
# Quando ready para testar
git checkout staging
git merge feature/improvements-v2.3
git push origin staging
# 🚀 Deploy automático para staging.radio.importantestudio.com
```

#### 3. Teste em Staging
```bash
# Testar funcionalidades em:
🔧 Player: https://staging.radio.importantestudio.com/
🔧 Admin:  https://staging.radio.importantestudio.com/admin.html

# Validar:
✅ Upload de músicas
✅ Edição de metadados
✅ Player funcionando
✅ Performance
✅ Responsividade mobile
```

#### 4. Deploy para Produção (Aprovado)
```bash
# Quando aprovado no staging
git checkout main
git merge staging
git tag v2.3.0-staging-approved
git push origin main
git push origin --tags
# 🚀 Deploy automático para radio.importantestudio.com
```

### 🔧 URLs dos Ambientes

| Ambiente | Player | Admin | Backend |
|----------|--------|-------|---------|
| **Produção** | https://radio.importantestudio.com/ | https://radio.importantestudio.com/admin.html | radio-importante-pwa-backend-skg2w.ondigitalocean.app |
| **Staging** | https://staging.radio.importantestudio.com/ | https://staging.radio.importantestudio.com/admin.html | (mesmo backend) |

### 🚨 Rollback Rápido

Se algo der errado em produção:
```bash
# Reverter para versão anterior estável
git checkout main
git revert HEAD
git push origin main
# Deploy automático volta versão anterior
```

### 📊 Monitoramento

- **Status do Pipeline**: GitHub Actions tabs
- **Performance**: Chrome DevTools
- **Erros**: Browser Console + Network tab
- **Backend**: https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/health

### 🎯 Benefícios dessa Estrutura

✅ **Zero downtime**: Produção nunca fica quebrada  
✅ **Testes reais**: Staging idêntico à produção  
✅ **Rollback rápido**: Volta versão anterior facilmente  
✅ **Histórico claro**: Tags marcam versões estáveis  
✅ **Deploy automático**: GitHub Actions cuida de tudo  
✅ **Ambiente isolado**: Pode quebrar staging sem problemas  

### 🛠️ Troubleshooting

**Se staging não funcionar:**
1. Verificar GitHub Actions logs
2. Verificar AWS S3/CloudFront status
3. Verificar DNS staging.radio.importantestudio.com
4. Verificar secrets do GitHub

**Se produção quebrar:**
1. Fazer rollback imediato (comando acima)
2. Investigar no staging
3. Corrigir na feature branch
4. Re-testar staging
5. Re-deploy produção
