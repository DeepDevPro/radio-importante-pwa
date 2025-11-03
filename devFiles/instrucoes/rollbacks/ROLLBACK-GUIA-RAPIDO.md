# 🔄 GUIA RÁPIDO DE ROLLBACK

> **Versão Estável Atual**: v2.2.10-stable (13/10/2025)  
> **🎉 MARCO IMPORTANTE**: Primeira versão entregue ao cliente  
> **Referência Completa**: [DEPLOY-GUIDE-UNIFIED.md](./DEPLOY-GUIDE-UNIFIED.md)

---

## 🚨 Emergência - Rollback Imediato

### Voltar para Última Versão Estável (v2.2.10-stable)

```bash
# 1. Verificar versão estável
git tag -l v2.2.10-stable

# 2. Fazer checkout da tag
git checkout v2.2.10-stable

# 3. Criar branch de hotfix se precisar fazer alterações
git checkout -b hotfix-from-stable

# 4. Deploy (se necessário)
git push origin hotfix-from-stable
```

---

## 📋 Opções de Rollback

### Opção 1: Rollback Simples (Último Commit)
**Quando usar**: Última mudança quebrou algo

```bash
git revert HEAD
git push origin staging  # ou main
```

### Opção 2: Rollback para Versão Estável (Recomendado)
**Quando usar**: Múltiplas mudanças quebraram, precisa voltar ao ponto estável

```bash
# Para STAGING
git checkout staging
git reset --hard backup-staging-stable-13out2025
git push origin staging --force

# Para MAIN (PRODUÇÃO)
git checkout main
git reset --hard backup-main-stable-13out2025
git push origin main --force

# ⚠️ IMPORTANTE: Avisar o time antes de usar --force
```

### Opção 3: Rollback Seletivo (Commits Específicos)
**Quando usar**: Sabe exatamente qual commit causou o problema

```bash
# 1. Ver histórico
git log --oneline -10

# 2. Reverter commits específicos
git revert <commit-hash-1> <commit-hash-2>
git push origin staging  # ou main
```

---

## 📊 Informações da Versão Estável

### Commit Base
- **Hash**: f2867ec3238755bdf1fd091b34382fba03d902d3
- **Data**: 13/10/2025
- **Marco**: 🎉 **Primeira versão entregue ao cliente**
- **Descrição**: Upload não-ASCII fix + GitHub Actions v2 migration

### Features Consolidadas
✅ Upload com caracteres não-ASCII funcionando  
✅ GitHub Actions workflows usando v2 (sem erros)  
✅ MP3 contínuo operacional (Dockerfile + ffmpeg)  
✅ iOS PWA background playback ≥300s estável  
✅ HLS pipeline R6 validado (diagnostics p95: 44ms)  
✅ Backends staging e produção sincronizados  

### Branches de Backup
- **Main**: `backup-main-stable-13out2025`
- **Staging**: `backup-staging-stable-13out2025`

---

## 🔍 Verificação Pós-Rollback

```bash
# 1. Verificar commit atual
git log --oneline -1

# 2. Verificar se está na versão correta
git describe --tags

# 3. Health check dos backends
curl https://rd-importante-backend-staging-cudbw.ondigitalocean.app/health
curl https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/health

# 4. Verificar GitHub Actions
# https://github.com/DeepDevPro/radio-importante-pwa/actions
```

---

## 📞 Checklist de Comunicação

Antes de fazer rollback com `--force`:
- [ ] Avisar o time no Slack/Discord
- [ ] Documentar motivo do rollback
- [ ] Anotar qual commit/feature causou problema
- [ ] Aguardar confirmação de outros devs (se aplicável)

Após rollback:
- [ ] Confirmar que aplicação voltou a funcionar
- [ ] Atualizar issue/ticket com detalhes
- [ ] Planejar correção da feature que quebrou
- [ ] Considerar criar branch de teste isolada para nova tentativa

---

## 🛡️ Prevenção de Problemas Futuros

### Antes de Implementar Features Grandes
```bash
# Criar branch de backup
git checkout staging
git checkout -b backup-staging-pre-[nome-feature]
git push origin backup-staging-pre-[nome-feature]
```

### Workflow Incremental (Recomendado)
- Uma feature pequena por commit
- Testar em staging antes de merge para main
- Manter histórico limpo para rollback seletivo fácil

---

**Última Atualização**: 13/10/2025  
**Versão Estável**: v2.2.10-stable  
**Documentação Completa**: [DEPLOY-GUIDE-UNIFIED.md](./DEPLOY-GUIDE-UNIFIED.md)
