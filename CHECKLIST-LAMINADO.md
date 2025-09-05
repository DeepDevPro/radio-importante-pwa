# 📋 CHECKLIST "LAMINADO" - FLUXO DE DESENVOLVIMENTO ORGANIZADO

> **Cola do lado do teclado** - Para manter tudo automatizado e organizado

---

## 🔄 WORKFLOW DIÁRIO (O QUE VOCÊ PEDE E QUANDO)

### 📝 **FASE 1: COMEÇAR NOVA FEATURE**
**Você me pede:**
```
"Claudinho, vou trabalhar na feature X. Cria uma branch feat/X para mim"
```
**Eu faço:**
- ✅ `git checkout -b feat/nome-da-feature`
- ✅ `git push -u origin feat/nome-da-feature`

### 💻 **FASE 2: DESENVOLVIMENTO (Commits pequenos)**
**Você me pede conforme desenvolve:**
```
"Claudinho, commita isso que fiz: [descrição breve]"
```
**Eu faço:**
- ✅ `git add .`
- ✅ `git commit -m "feat: descrição breve"`
- ✅ `git push origin feat/nome-da-feature`

### 🔄 **FASE 3: FINALIZAR FEATURE**
**Você me pede:**
```
"Claudinho, a feature está pronta. Abre PR para main"
```
**Eu faço:**
- ✅ Verifico se está tudo commitado
- ✅ Crio PR com template
- ✅ Descrevo mudanças e como testar

### ✅ **FASE 4: MERGE APROVADO**
**Você me pede:**
```
"Claudinho, o PR foi aprovado. Faz o merge e cria a TAG v1.X.X"
```
**Eu faço:**
- ✅ Merge do PR para main
- ✅ `git tag v1.X.X`
- ✅ `git push origin v1.X.X`
- ✅ **Deploy automático dispara** 🚀

### 🧪 **FASE 5: VALIDAÇÃO PRODUÇÃO**
**Você me pede:**
```
"Claudinho, testa se o deploy funcionou"
```
**Eu faço:**
- ✅ Testo frontend: `https://radio.importantestudio.com`
- ✅ Testo backend: `curl https://backend/health`
- ✅ Confirmo se tudo está funcionando

### 📝 **FASE 6: DOCUMENTAR RELEASE**
**Você me pede:**
```
"Claudinho, documenta essa release"
```
**Eu faço:**
- ✅ Anoto 2-3 linhas do que mudou
- ✅ Atualizo changelog se necessário

---

## 🚨 COMANDOS DE EMERGÊNCIA

### 🔄 **ROLLBACK RÁPIDO**
**Você me pede:**
```
"Claudinho, faz rollback para versão anterior"
```
**Eu faço:**
- Frontend: Uso backup `s3://bucket/releases/v1.X.X/`
- Backend: `eb deploy radio-importante-backend-prod --version v1.X.X`

### 🛠️ **HOTFIX URGENTE**
**Você me pede:**
```
"Claudinho, preciso de hotfix urgente na main"
```
**Eu faço:**
- ✅ `git checkout -b hotfix/descrição`
- ✅ Aplico correção
- ✅ PR direto para main
- ✅ Tag v1.X.Y (patch)

---

## 🎯 REGRAS AUTOMÁTICAS JÁ CONFIGURADAS

✅ **Deploy só acontece com TAG** (v1.0.0, v1.1.0, etc.)  
✅ **Backup automático** de cada versão em `releases/`  
✅ **Version-label do EB** = nome da TAG  
✅ **CloudFront invalidation** automática  
✅ **Branch protection** configurada (requer PR)  

---

## 💡 FRASES PARA VOCÊ USAR

### 🚀 **Para iniciar desenvolvimento:**
> "Claudinho, vou trabalhar na [feature/bugfix]. Prepara o ambiente."

### 🔄 **Para commits regulares:**
> "Claudinho, salva o progresso: [o que fiz]"

### ✅ **Para finalizar e deployar:**
> "Claudinho, está pronto. Faz o PR e prepara deploy v1.X.X"

### 🧪 **Para validar produção:**
> "Claudinho, confirma se o deploy funcionou"

### 🚨 **Para emergências:**
> "Claudinho, rollback urgente!" ou "Claudinho, hotfix urgente!"

---

## 📊 STATUS ATUAL DO PROJETO

✅ **Sistema funcionando**: Metadata extraction + Admin  
✅ **Infraestrutura**: AWS completa  
✅ **Workflows**: Trigger por TAG configurado  
✅ **Backup**: Automático por versão  
✅ **Rollback**: Preparado para emergências  

**🎯 Próximo passo**: Você me pede para executar `./fix-and-setup-tags.sh` que vai implementar tudo!
