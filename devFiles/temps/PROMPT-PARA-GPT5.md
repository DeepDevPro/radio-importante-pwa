# 📋 PROMPT PARA GPT5 - MAPEAMENTO INFRAESTRUTURA COMPLETO

---

## 🎯 CONTEXTO

Oi GPT5! Seguindo sua solicitação de mapeamento da infraestrutura de deploy, fizemos uma **análise completa** do projeto. Aqui está tudo organizado conforme você pediu.

---

## 📄 DOCUMENTAÇÃO COMPLETA

**Anexei o arquivo `DEPLOY-INFRASTRUCTURE-MAPPING.md`** que contém:

✅ **Todos os pontos que você solicitou**:
1. ✅ GitHub Workflows mapeados (6 workflows)
2. ✅ Backend Elastic Beanstalk analisado  
3. ✅ Frontend S3 + CloudFront identificado
4. ✅ GitHub Secrets listados
5. ✅ DNS Route 53 planejado

✅ **Análise baseada em documentação real**:
- `PLANO_EXECUCAO.md` (1927 linhas)
- `DEPLOY-GUIDE.md` (143 linhas) 
- `AWS-SETUP-GUIDE.md`
- `src/config/api.ts`
- `backend/.elasticbeanstalk/config.yml` ✅ ENCONTRADO
- `backend/.ebextensions/` ✅ 8 arquivos de config

---

## 🔥 DESCOBERTA CRÍTICA IDENTIFICADA

**PROBLEMA**: Dois workflows fazem deploy para ambientes diferentes
- ✅ `deploy-backend.yml` → `radio-importante-backend-prod` (FUNCIONANDO)
- ❌ `deploy-complete.yml` → `radio-pwa-backend-prod` (NÃO FUNCIONA)

**TESTADO**:
- `curl radio-importante-backend-prod.eba-heipfui9.us-west-2.elasticbeanstalk.com/health` → ✅ JSON API
- `curl radio-pwa-backend-prod.eba-heipfui9.us-west-2.elasticbeanstalk.com/health` → ❌ HTML estático

---

## 📊 SITUAÇÃO ATUAL (CONFIRMADA)

### ✅ **O QUE ESTÁ FUNCIONANDO**
- Backend: `radio-importante-backend-prod.eba-heipfui9.us-west-2.elasticbeanstalk.com`
- Admin interface com metadata extraction
- Sistema de upload funcionando
- Configurações EB completas

### 🎯 **ÚNICA CORREÇÃO NECESSÁRIA**
Padronizar `deploy-complete.yml` para usar `radio-importante-backend` (que funciona).

---

## 🤝 SOLICITAÇÃO PARA VOCÊ (GPT5)

Com base no mapeamento completo que fizemos, você ainda precisa dos **screenshots da AWS Console** que solicitou?

Ou podemos pular direto para:
1. **Corrigir o conflito dos workflows**
2. **Implementar o fluxo de branches** 
3. **Organizar o versionamento**

**Sua escolha**: Screenshots primeiro ou correção imediata do problema identificado?

---

## 📎 ARQUIVOS ANEXOS

1. ✅ `DEPLOY-INFRASTRUCTURE-MAPPING.md` - Mapeamento completo
2. ✅ Análise de todos os arquivos importantes do projeto

**Status**: Infraestrutura mapeada ✅ | Problema identificado ✅ | Solução definida ✅
