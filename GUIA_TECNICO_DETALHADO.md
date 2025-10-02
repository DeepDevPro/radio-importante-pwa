# 🔧 Guia Técnico - Radio Importante PWA

> **Complemento**: PLANO_EXECUCAO.md  
> **Foco**: Detalhes técnicos, troubleshooting e manutenção  
> **Atualizado em**: 02/10/2025 - F1 Sync+Metadados concluída em staging  
> **Para**: Programador Junior/Amador

---

## 🆕 Atualizações Recentes (02/10/2025) — F1 Sync+Metadados ✅

### Backend
- Endpoint: `POST /api/sync-catalog?full=true`  
- Enriquecimento: `duration`, `title`, `artist` apenas quando faltam  
- Stream: lê `.mp3` direto do Spaces (S3-compatible) via `getObject().createReadStream()`  
- Biblioteca: `music-metadata` com import dinâmico ESM (`const mm = await import('music-metadata')`) → `parseNodeStream()`  
- Performance: limite de 20 faixas/execução; logs prefixados (SYNC, META)  
- Retorno inclui: `durationComputed` e `metadataFilled`

### Frontend (Admin)
- Botão: "Sincronizar com Spaces (Completo)" em `admin.html`  
- Comportamento: desabilita durante execução, mostra status, recarrega lista e totais  
- Ajuste temporário: chamada direta para URL do backend do DO App Platform para evitar 405 em staging. Planejado consolidar via `src/config/api.ts` mais tarde

### Estratégia iPhone PWA
- `src/player/strategies/IOSPWAStrategy.ts` permanece IMUTÁVEL e é usada como fallback apenas. Nenhuma alteração necessária nesta fase

---

## Troubleshooting (F1)
- Erro 405 no staging: foi causado por chamar `/api/...` no domínio do frontend. Correção: usar URL direta do backend enquanto consolidamos a config
- ESM vs CommonJS: `music-metadata` é ESM; evitar `require('music-metadata')`. Usar `await import('music-metadata')` e obter `parseNodeStream`
- CORS Spaces: confirmar `GET, HEAD` e headers `Range, Content-Type` para streaming parcial

---

## Próximos Passos
- F1.1: Implementar `data/metadata-cache.json` para evitar retrabalho em execuções futuras  
- F2: Implementar pipeline HLS VOD com `ffmpeg-static` + `fluent-ffmpeg` (assíncrono)  
- F3: HLS Rotativo com publicação atômica  
- F4: Switch de background no Player (opt-in), mantendo IOSPWAStrategy como fallback

---

## 🆕 Atualizações Recentes (29/09/2025) - DEBUG UI + IPHONE PWA GESTOS ✅

### �️ Debug/Admin UI + iPhone PWA Gestos - Sistema Completo de Desenvolvimento
```bash
STATUS: 🎉 DEBUG/ADMIN UI TOTALMENTE FUNCIONAL + GESTO SECRETO IPHONE
COMMITS RECENTES: 
- 815fc34: fix: corrigir exibição botões Debug/Admin + gesto secreto para iPhone
- ad49009: fix: corrigir CSS dos botões Debug/Admin para aparecer em staging
- 2508188: feat: atualizar título da staging para teste dos botões Debug/Admin
- 4ff6219: fix: melhorar detecção de ambiente staging para mostrar botões Debug/Admin
- f57b209: fix: corrigir exibição dos botões Debug e Admin em staging
BRANCH STRUCTURE: staging (active development) | main (stable) | staging-stable-v2.2.5-backup (preserved)

PROBLEMAS RESOLVIDOS:
✅ Upload: "this.client.send is not a function" → multer-s3 2.10.0
✅ Player: URLs "/audio/audio/" duplicadas → filename cleanup
✅ Serving: 404 audio files → proxy route backend
✅ Persistence: Files mantidos cross-deploy → DigitalOcean Spaces
✅ Duration: Cálculo zerado → HTML5 Audio API restoration

RESULTADO FINAL:
✅ Upload Admin: Funcionando → DigitalOcean Spaces  
✅ Player: Tocando música → Streaming direto do Spaces
✅ URLs: Corretas sem duplicação → /audio/arquivo.mp3
✅ Backend: Proxy servindo arquivos → GET /audio/:filename
✅ Persistência: Garantida → Files não perdidos em deploy
✅ Duration: Preview real-time → "⏱️ 2:45" format

ARQUITETURA FINAL:
Upload: Admin → Frontend Duration Calc → Backend + duration_${index} → DigitalOcean Spaces
Catalog: Backend retorna filename + duration corretos
Serving: Frontend → Backend /audio/:filename → Spaces
Streaming: Direto do Spaces para Player
Preview: HTML5 Audio API → Real-time duration calculation
```

---

## 🕐 **DURATION CALCULATION FIX DETALHADO (28/09/2025)**

### **📋 Technical Analysis of Duration Problem**

#### **Root Cause Investigation**
```bash
PROBLEMA IDENTIFICADO:
- Local environment: Duration calculation working (admin-backup-original.html)
- Staging environment: All tracks showing duration = 0
- Gap: src/admin.ts missing calculateDurationForFile() function
- Backend: Already configured to expect duration_${index} fields

TECHNICAL EVIDENCE:
// admin-backup-original.html (WORKING):
function calculateAudioDuration(file) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.onloadedmetadata = () => resolve(Math.round(audio.duration));
    audio.onerror = () => resolve(0);
    audio.src = URL.createObjectURL(file);
  });
}

// src/admin.ts (MISSING):
// No duration calculation function - causing 0 duration
```

### **🛠️ Implementation Details**

#### **HTML5 Audio API Integration**
```typescript
// NEW FUNCTION IN src/admin.ts
async function calculateDurationForFile(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    
    audio.onloadedmetadata = () => {
      const duration = Math.round(audio.duration);
      URL.revokeObjectURL(audio.src); // Memory cleanup
      resolve(duration);
    };
    
    audio.onerror = () => {
      URL.revokeObjectURL(audio.src); // Memory cleanup on error
      resolve(0); // Fallback for invalid files
    };
    
    audio.src = URL.createObjectURL(file);
  });
}

// INTEGRATION IN handleFileSelection()
for (let i = 0; i < files.length; i++) {
  const file = files[i];
  
  // Show loading state
  fileItem.innerHTML = `
    <span class="file-name">${file.name}</span>
    <span class="file-info">
      <span class="file-size">${(file.size / (1024 * 1024)).toFixed(2)} MB</span>
      <span class="file-duration">🔄 Calculando duração...</span>
    </span>
  `;
  
  // Calculate actual duration
  const duration = await calculateDurationForFile(file);
  
  // Update with real duration
  const minutes = Math.floor(duration / 60);
  const seconds = (duration % 60).toString().padStart(2, '0');
  fileItem.querySelector('.file-duration').textContent = `⏱️ ${minutes}:${seconds}`;
}
```

#### **Backend Integration Pattern**
```typescript
// UPLOAD FUNCTION MODIFICATION
const uploadFiles = async () => {
  const formData = new FormData();
  
  for (let index = 0; index < selectedFiles.length; index++) {
    const file = selectedFiles[index];
    
    // Add file
    formData.append('audioFiles', file);
    
    // Add corresponding duration (CRITICAL)
    const fileItem = filePreview.children[index];
    const durationText = fileItem.querySelector('.file-duration').textContent;
    const duration = parseDurationFromText(durationText); // Extract seconds from "⏱️ 2:45"
    formData.append(`duration_${index}`, duration.toString());
  }
  
  // Send to backend
  const response = await fetch(`${backendUrl}/api/upload`, {
    method: 'POST',
    body: formData
  });
};

// DURATION PARSING UTILITY
function parseDurationFromText(durationText: string): number {
  if (!durationText || durationText.includes('Calculando')) return 0;
  
  const match = durationText.match(/(\d+):(\d+)/);
  if (!match) return 0;
  
  const minutes = parseInt(match[1]);
  const seconds = parseInt(match[2]);
  return minutes * 60 + seconds;
}
```

### **⚙️ Backend Configuration (Already Working)**
```javascript
// backend/app.js - EXPECTS duration_${index} fields
app.post('/api/upload', flexibleUpload, async (req, res) => {
  const uploadedTracks = [];
  
  for (let index = 0; index < req.files.length; index++) {
    const file = req.files[index];
    
    // Extract duration from form data
    const duration = parseInt(req.body[`duration_${index}`]) || 0;
    
    const track = {
      filename: file.key.replace(/^audio\//, ''),
      title: extractTitle(file.originalname),
      duration: duration, // Now receives correct value from frontend
      size: file.size,
      url: file.location || storageConfig.getFileUrl(file.key)
    };
    
    uploadedTracks.push(track);
  }
  
  // Update catalog with correct durations
  await saveCatalogToDisk(uploadedTracks);
  res.json({ success: true, tracks: uploadedTracks });
});
```

### **✅ Validation Results**
```bash
BEFORE FIX:
- Upload: ✅ Working
- Preview: ❌ Duration showed "🔄 Calculando duração..." permanently
- Backend: ❌ Received duration_${index} = undefined
- Catalog: ❌ All tracks duration = 0

AFTER FIX (commit 1067f3e):
- Upload: ✅ Working  
- Preview: ✅ Shows real duration "⏱️ 2:45"
- Backend: ✅ Receives duration_${index} = 165 (seconds)
- Catalog: ✅ All tracks have correct duration

BUILD STATUS:
- npm run build: ✅ SUCCESS
- TypeScript compilation: ✅ SUCCESS (with warnings ignored)
- admin-DLvw4A1n.js: ✅ Generated (15.88 kB)
- Deploy: ✅ Auto-deployed to staging
```

---

## 📁 **ARQUIVOS PRINCIPAIS DO PROJETO**

### **Frontend Critical Files**
```bash
ARQUIVOS ESSENCIAIS:
src/admin.ts: ✅ Duration calculation + Upload functionality
index.html: ✅ Main player interface  
admin.html: ✅ Admin panel interface
vite.config.ts: ✅ Build configuration (multiple entry points)
package.json: ✅ Frontend dependencies management

ESTADO ATUAL:
- src/admin.ts: Contém calculateDurationForFile() function ✅
- Build system: Configurado para admin.html + index.html ✅
- TypeScript: Compilando sem erros críticos ✅
```

### **Backend Critical Files**  
```bash
ARQUIVOS ESSENCIAIS:
backend/app.js: ✅ Main server + upload routes + duration handling
backend/package.json: ✅ Dependencies (multer-s3@2.10.0)
backend/storage-config.js: ✅ DigitalOcean Spaces configuration
backend/Dockerfile: ✅ Container configuration

ESTADO ATUAL:
- multer-s3: Fixed at 2.10.0 (AWS SDK v2 compatible) ✅
- Duration handling: Expects duration_${index} fields ✅
- Storage: DigitalOcean Spaces working ✅
- Auto-deploy: GitHub → DigitalOcean App Platform ✅
```

### **Documentation Files (Centralized)**
```bash
ARQUIVOS DE DOCUMENTAÇÃO:
PLANO_EXECUCAO.md: ✅ Status geral + próximos passos + timeline
GUIA_TECNICO_DETALHADO.md: ✅ Detalhes técnicos + troubleshooting
PLANO_FIX_UPLOAD_V2_ONLY.md: ✅ Upload fix documentation (histórico)

PRINCÍPIO: Documentação centralizada para evitar duplicação
```

---

## 🚀 **ENVIRONMENT READINESS**

### **Development Environment**
```bash
LOCAL SETUP: ✅ Ready for next development phase
- Node.js project configured and working
- Dependencies up to date and compatible
- Build system (Vite + TypeScript) functional
- Development server available (npm run dev)
- Branch: feature/ux-improvements-v2.4 active and clean
```

### **Staging Environment**
```bash
STAGING STATUS: ✅ Stable and operational
- Duration fix deployed and working (commit 1067f3e)
- Upload system fully functional
- Player system working with correct URLs
- DigitalOcean Spaces integration stable
- Auto-deploy pipeline functional
```

### **Next Development Steps**
```bash
READY FOR: UX Improvements Phase
APPROACH: Incremental changes following "uma pequena tarefa de cada vez"
CURRENT FOCUS: User to specify which UX improvement to tackle first

TECHNICAL READINESS:
✅ Stable base in staging branch
✅ Clean development branch active  
✅ Build system working
✅ Documentation updated
✅ All critical systems functional
```

---

## 🛠️ **DEBUG/ADMIN UI TECHNICAL IMPLEMENTATION (29/09/2025)**

### **📋 Problem Analysis: CSS vs JavaScript Conflict**

#### **Root Cause Identification**
```bash
PROBLEMA TÉCNICO IDENTIFICADO:
- JavaScript: Detecção staging funcionando ✅
- Console: "🚧 Botões de Debug e Admin habilitados para staging/desenvolvimento" ✅
- CSS Rule: .utility-btn.debug-btn { display: none !important; } ❌
- Resultado: Botões existem no DOM mas invisible ao usuário

DEBUGGING PROCESS:
1. Verificar detecção hostname: ✅ "stagin" detectado corretamente
2. Verificar getElementById: ✅ elementos encontrados
3. Verificar CSS computed styles: ❌ display: none !important ganhando
4. Verificar JavaScript execution order: ✅ DOMContentLoaded funcionando
```

### **🔧 Technical Solutions Applied**

#### **CSS Specificity Fix (Commits ad49009, 815fc34)**
```css
/* ANTES - PROBLEMÁTICO */
.utility-btn.debug-btn,
.utility-btn.admin-btn {
  display: none !important; /* Impossível sobrescrever */
}

/* DEPOIS - CORRIGIDO */
.utility-btn.debug-btn,
.utility-btn.admin-btn {
  display: none; /* Sem !important - permitir override JS */
}

/* POSICIONAMENTO CORRETO */
.utility-buttons {
  position: fixed;
  bottom: 20px;
  left: 20px;
  display: flex;
  gap: 8px;
  z-index: 1000; /* Garantir visibilidade sobre outros elementos */
}
```

#### **JavaScript Robustness Enhancement**
```typescript
// DETECÇÃO STAGING ROBUSTA - Commit 4ff6219
const isStaging = window.location.hostname.includes('staging') || 
                 window.location.hostname.includes('stagin') ||    // DigitalOcean specific
                 window.location.hostname === 'localhost' ||       // Development
                 window.location.hostname === '127.0.0.1';        // IP local

// APLICAÇÃO CSS COM !IMPORTANT - Commit 815fc34
if (isStaging) {
  const utilityButtons = document.getElementById('utility-buttons');
  if (utilityButtons) {
    // Container principal
    utilityButtons.style.setProperty('display', 'flex', 'important');
    
    // Botões individuais (CRÍTICO)
    const debugBtn = utilityButtons.querySelector('.debug-btn');
    const adminBtn = utilityButtons.querySelector('.admin-btn');
    
    if (debugBtn) debugBtn.style.setProperty('display', 'flex', 'important');
    if (adminBtn) adminBtn.style.setProperty('display', 'flex', 'important');
    
    console.log('🚧 Botões de Debug e Admin habilitados para staging/desenvolvimento');
  }
}
```

#### **iPhone PWA Gesture System (Commit 815fc34)**
```javascript
// SISTEMA DE GESTOS SECRETOS
let tapCount = 0;
let tapTimer = null;

const logo = document.querySelector('.radio-logo');
if (logo) {
  logo.addEventListener('click', function() {
    tapCount++;
    
    if (tapTimer) clearTimeout(tapTimer);
    
    if (tapCount >= 5) {
      // 5 TAPS = DEBUG
      console.log('🐛 Gesto secreto detectado - abrindo debug');
      window.open('/debug.html', '_blank');
      tapCount = 0;
    } else if (tapCount >= 3) {
      // 3 TAPS = ADMIN
      tapTimer = setTimeout(() => {
        if (tapCount === 3) {
          console.log('⚙️ Gesto secreto detectado - abrindo admin');
          window.open('/admin.html', '_blank');
        }
        tapCount = 0;
      }, 500); // Delay para permitir 5 taps
    } else {
      // RESET TIMER
      tapTimer = setTimeout(() => {
        tapCount = 0;
      }, 1000);
    }
  });
}
```

### **🎯 Environment Detection Matrix**
```bash
STAGING DETECTION LOGIC:
✅ radio-importante-frontend-stagin-6rjzv.ondigitalocean.app → "stagin" detected
✅ radio-importante-frontend-staging-xyz.ondigitalocean.app → "staging" detected  
✅ localhost:5173 → "localhost" detected
✅ 127.0.0.1:5173 → "127.0.0.1" detected

PRODUCTION BLOCKING:
❌ radio-importante-frontend-xyz.ondigitalocean.app → No match, buttons hidden
❌ Custom domain → No match, buttons hidden
❌ GitHub Pages → No match, buttons hidden

RESULTADO: Botões aparecem APENAS em ambientes de desenvolvimento/staging
```

### **📱 iPhone PWA Specific Implementation**
```bash
PROBLEMA IPHONE PWA:
- Botões podem não aparecer devido a cache/CSS issues
- Necessário método alternativo garantido
- Gesto deve ser intuitivo mas discreto

SOLUÇÃO GESTURE SYSTEM:
✅ Target: Logo da Radio Importante (sempre visível)
✅ 3 taps rápidos = Admin (mais comum, sequência mais fácil)
✅ 5 taps rápidos = Debug (menos comum, evita ativação acidental)
✅ Timer inteligente: Reset automático após 1s de inatividade
✅ Delay de 500ms para permitir upgrade de 3→5 taps
✅ Console logs para feedback/debugging
✅ window.open('_blank') para nova aba/janela

VALIDAÇÃO TÉCNICA:
✅ Funciona em todos os browsers
✅ Funciona em iPhone PWA (standalone mode)
✅ Não interfere com funcionalidade normal da logo
✅ Discreto: não aparece na UI normal
✅ Robusto: funciona mesmo com CSS issues
```

### **✅ Implementation Validation**
```bash
COMMITS SEQUENCE APPLIED:
- 4ff6219: Staging detection enhancement
- 2508188: Staging title visual identification  
- ad49009: CSS !important removal
- 815fc34: Individual buttons + gesture system

TESTING MATRIX:
✅ Desktop Chrome: Botões visíveis em staging URL
✅ Desktop Safari: Botões visíveis em staging URL  
✅ Mobile Chrome: Botões visíveis em staging URL
✅ iPhone Safari: Botões visíveis + gesture fallback
✅ iPhone PWA: Gesture system primary method
✅ Localhost: Botões visíveis durante development

STATUS: DUAL SOLUTION OPERATIONAL - Visual buttons + Gesture fallback
```

---