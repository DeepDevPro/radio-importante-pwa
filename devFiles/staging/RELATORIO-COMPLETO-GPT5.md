# RELATÓRIO COMPLETO - DIAGNÓSTICO TÉCNICO PWA BACKGROUND PLAYBACK

**Data:** 07/10/2025  
**Ambiente:** Staging em Produção  
**Objetivo:** Resolver problema de parada de áudio em background no PWA iOS  

---

## 🎯 SITUAÇÃO ATUAL

### ✅ SUCESSOS CONQUISTADOS
1. **HLS Sanitization:** Playlist sem marcadores VOD (`PLAYLIST-TYPE`/`ENDLIST`) - FUNCIONA ✅
2. **Safari Browser:** Playback perfeito em todos os cenários (foreground, background, screen lock) ✅
3. **PWA Screen Lock:** RESOLVIDO! Agora funciona >3min sem gaps ✅ 
4. **PWA Foreground:** Reprodução contínua estável ✅

### 🔴 PROBLEMA REMANESCENTE
**PWA Background Playback:** Para após 1-2 músicas (~60-120s) quando app está em segundo plano

---

## 📊 TESTES EXECUTADOS (iPhone Real - Staging)

### Environment
- **Frontend:** https://radio-importante-frontend-stagin-6rjzv.ondigitalocean.app
- **Backend:** https://radio-importante-pwa-backend-skg2w.ondigitalocean.app  
- **Device:** iPhone (iOS) 
- **Network:** 4G (150ms latência, adequada para HLS)

### Test Results Matrix

| Cenário | Safari Browser | PWA Instalado | Status |
|---------|---------------|---------------|---------|
| **Foreground** | ✅ Perfeito | ✅ Perfeito | RESOLVIDO |
| **Screen Lock** | ✅ Perfeito | ✅ FUNCIONOU! | RESOLVIDO |
| **Background** | ✅ Perfeito | 🔴 Para após 60-120s | PROBLEMA |

### Detailed Background Test (PWA)
1. **Início:** Música tocando normalmente
2. **T+0s:** Switch para outro app (restando ~12s na música)
3. **T+12s:** Música atual termina, próxima inicia ✅
4. **T+60-120s:** Áudio para completamente 🔴
5. **Volta ao app:** Player ainda "ativo" mas sem som

---

## 🧬 ANÁLISE TÉCNICA DO CÓDIGO

### Background Boundary Scheduler (Implementado)
**Arquivo:** `src/player/audio.ts`

```typescript
// Detecta fim iminente em background
if (!this.backgroundAdvanceTriggered && remaining <= this.backgroundBoundaryThreshold) {
  this.handleBackgroundAdvance(remaining);
}

// Dispara transição antecipada
private handleBackgroundAdvance(remaining: number): void {
  console.log(`⏭️ BG Boundary detectado (restam ~${remaining.toFixed(2)}s)`);
  setTimeout(() => {
    if (this.audio && !this.audio.ended) {
      console.log('⏭️ BG Advance: disparando onEnded antecipado');
      this.events.onEnded?.();
    }
  }, Math.max(remaining * 1000 - 300, 0));
}
```

### Audio Context Management
```typescript
// Detecção de background
document.addEventListener('visibilitychange', () => {
  this.isBackground = document.hidden;
  if (this.isBackground) {
    this.maintainAudioContext();
  }
});

// Tentativa de manutenção
private maintainAudioContext(): void {
  try {
    this.audio.preservesPitch = true;
    console.log('🍎 iOS PWA: Configurações de background aplicadas');
  } catch {
    console.log('⚠️ iOS PWA: Algumas configurações não suportadas');
  }
}
```

### Keep Alive Mechanism
```typescript
private setupKeepAlive(): void {
  this.keepAliveInterval = window.setInterval(() => {
    if (this.audio && !this.audio.paused) {
      console.log('🔄 Keep alive - audio ativo');
    }
  }, 5000);
}
```

---

## 🔍 DIFERENÇA CRÍTICA: SCREEN LOCK vs BACKGROUND

### Screen Lock (FUNCIONA ✅)
- `document.hidden = true`
- **iOS Behavior:** Trata como "active media playback"
- **Audio Context:** Mantido indefinidamente
- **Throttling:** Mínimo
- **Background Scheduler:** Funciona normalmente

### Background Switch (PROBLEMA 🔴)  
- `document.hidden = true` 
- **iOS Behavior:** App suspension após timeout
- **Audio Context:** Suspenso após ~60-120s
- **Throttling:** Agressivo
- **Background Scheduler:** Funciona 1-2 vezes, depois falha

---

## 🔧 HIPÓTESES DE CAUSA RAIZ

### 1. Audio Context Suspension
- iOS suspende AudioContext após timeout em background
- `audio.preservesPitch = true` insuficiente
- Necessário WebAudio API mais robusta

### 2. Service Worker Limitation  
```javascript
// Arquivo: public/sw.js
// Não intercepta HLS segments adequadamente para background
```

### 3. HLS Stream Handling
- Player HTML5 nativo dependente de main thread
- Stream buffer não mantido pelo Service Worker
- Necessário buffer management específico

### 4. PWA Manifest Configuration
```json
// Possível falta de background capability
{
  "display": "standalone",
  "start_url": "/",
  // Faltando: background audio declarations?
}
```

---

## 📱 COMPORTAMENTO IOS DETALHADO

### Timing Pattern Observado
```
T+0s:     Switch to background (document.hidden = true)
T+0-60s:  Background Scheduler funciona (1-2 transições)
T+60-120s: Audio context suspension 
T+120s+:  Silêncio total (player "ativo" mas sem som)
```

### Logs Expected vs Reality
**Expected:**
```
⏭️ BG Boundary detectado (restam ~3s)
⏭️ BG Advance: disparando onEnded antecipado
🔄 Keep alive - audio ativo
```

**Reality após 120s:**
```
🔄 Keep alive - audio ativo (mas sem som real)
(ausência de boundary logs)
```

---

## 🚨 PROBLEMAS IDENTIFICADOS NO CÓDIGO

### 1. Audio Context Inadequate Maintenance
```typescript
// ATUAL (Insuficiente):
private maintainAudioContext(): void {
  this.audio.preservesPitch = true; // Muito básico
}

// NECESSÁRIO: WebAudio API context lock
```

### 2. Service Worker Gap
```javascript
// public/sw.js NÃO intercepta:
// - HLS .m3u8 playlists  
// - HLS .ts segments
// - Background fetch para continuidade
```

### 3. Background Strategy Incomplete
```typescript
// Falta implementar:
// - Web Audio API context keep-alive
// - Audio worklet para background processing
// - Proper HLS segment preload strategy
```

---

## 💡 RECOMENDAÇÕES TÉCNICAS PARA GPT-5

### PRIORIDADE 1: Audio Context Enhancement
1. Implementar WebAudio API com AudioContext.resume() forçado
2. Audio Worklet para processing em background thread
3. Periodic audio buffer "ping" para manter contexto vivo

### PRIORIDADE 2: Service Worker HLS Handler
1. Interceptar requests de .m3u8 e .ts
2. Implementar background fetch para segments
3. Cache strategy específica para HLS streams

### PRIORIDADE 3: PWA Manifest & Configuration
1. Adicionar background audio capabilities
2. Media session API mais robusta
3. Background sync registration

### PRIORIDADE 4: Fallback Strategy  
1. Detectar context suspension
2. Automatic context restoration attempt
3. User notification se recovery falhar

---

## 🔬 ARQUIVOS PARA INVESTIGAÇÃO

### Core Files
- `src/player/audio.ts` - Audio engine principal
- `src/app.ts` - PWA initialization  
- `public/sw.js` - Service Worker
- `public/manifest.webmanifest` - PWA config
- `src/player/mediaSession.ts` - Media Session API

### Specific Functions to Enhance
- `maintainAudioContext()` - Needs WebAudio API
- `setupKeepAlive()` - Needs audio worklet approach
- `handleBackgroundAdvance()` - Needs context recovery
- Service Worker - Needs HLS interception

---

## 🎯 SUCESSO ESPERADO PÓS-FIX

```
PWA Background Test:
T+0s:     Switch to background  
T+60s:    Still playing (transição automática)
T+120s:   Still playing (transição automática)  
T+300s:   Still playing (múltiplas transições)
T+600s+:  Continuous playback (indefinido)

Logs esperados:
⏭️ BG Boundary detectado (consistente)
🔄 Audio context maintained (permanente)
🎵 Background transitions successful (múltiplas)
```

---

## 📋 ENVIRONMENT INFO

**Staging URLs:**
- Frontend: https://radio-importante-frontend-stagin-6rjzv.ondigitalocean.app
- Backend API: https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/api
- HLS Endpoint: https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/hls/latest/index.m3u8

**Current Branch:** `staging`  
**Ready for merge to main:** Após resolver background playback PWA

---

**CONCLUSÃO:** Screen lock resolvido = progresso significativo. Background switch é o último obstáculo técnico para PWA production-ready. Focus em Audio Context + Service Worker enhancement.
