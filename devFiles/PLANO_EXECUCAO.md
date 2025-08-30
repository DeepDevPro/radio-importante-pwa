# 📋 PLANO DE EXECUÇÃO - Radio Importante PWA

## 🎯 **Objetivo Principal**
Resolver o problema de background audio em iOS PWA mantendo compatibilidade total com outras plataformas.

---

## 🔍 **Problema Identificado**

### ✅ **Funciona Perfeitamente:**
- 🌐 Safari iOS (modo web)
- 📱 Chrome Android (web + PWA)  
- 🖥️ Desktop Chrome (web + PWA)

### ❌ **Falha Especificamente:**
- 🍎 **iOS PWA (modo standalone)**: 
  - Música para ao terminar faixa atual
  - Próxima faixa não inicia automaticamente
  - Lock screen perde metadata ("Não Reproduzindo")
  - Usuário precisa reabrir app manualmente

### 🔬 **Causa Raiz:**
- iOS PWA suspende JavaScript em background
- Autoplay policy bloqueia `play()` sem user gesture
- Transição entre arquivos de áudio separados falha

---

## 🛠️ **ESTRATÉGIA DE SOLUÇÃO**

### **Abordagem: Fallback Inteligente por Plataforma**

```typescript
if (isIOSPWA()) {
  // Estratégia HLS: Um único stream contínuo
  useHLSContinuousPlayback();
} else {
  // Estratégia atual: Arquivos individuais  
  useIndividualTrackPlayback();
}
```

### **Vantagens:**
- ✅ Zero impacto em plataformas que já funcionam
- ✅ Solução específica para iOS PWA
- ✅ Codebase unificada com detecção automática
- ✅ Manutenção simplificada

---

## 📊 **FASE 1: ESTRUTURA DE DETECÇÃO**

### **1.1 Detecção de Plataforma**
```typescript
// Já implementado - melhorar se necessário
function isIOSPWA(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && 
         window.matchMedia('(display-mode: standalone)').matches;
}
```

### **1.2 Player Strategy Factory**
```typescript
interface AudioStrategy {
  loadPlaylist(tracks: Track[]): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  next(): Promise<void>;
  previous(): Promise<void>;
}

class IOSPWAStrategy implements AudioStrategy {
  // HLS continuous playback
}

class StandardStrategy implements AudioStrategy {
  // Individual track playback (atual)
}
```

---

## 📊 **FASE 2: GERAÇÃO HLS CONTÍNUO**

### **2.1 Script de Empacotamento**
- **Input**: Arquivos MP3 individuais do `/audio/`
- **Output**: Playlist HLS única (`playlist-continuous.m3u8`)
- **Ferramenta**: FFmpeg com `#EXT-X-DISCONTINUITY`

### **2.2 Estrutura HLS**
```m3u8
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:180

#EXTINF:240.0,4 Hero feat. Jack Davey - Take My Time
#EXT-X-DISCONTINUITY  
segment-001.ts

#EXTINF:180.0,Artista - Sing
#EXT-X-DISCONTINUITY
segment-002.ts

[...outras faixas...]

#EXT-X-ENDLIST
```

### **2.3 Metadata Mapping**
```typescript
interface TrackCue {
  id: string;
  title: string;
  artist: string;
  startTime: number;
  endTime: number;
  duration: number;
}
```

---

## 📊 **FASE 3: IMPLEMENTAÇÃO DUAL STRATEGY**

### **3.1 iOS PWA Strategy**
```typescript
class IOSPWAStrategy {
  private audio: HTMLAudioElement;
  private trackCues: TrackCue[];
  private currentTrackIndex: number = 0;

  async loadPlaylist(tracks: Track[]): Promise<void> {
    // Carrega HLS contínuo
    this.audio.src = '/audio/playlist-continuous.m3u8';
    this.trackCues = await this.loadTrackCues();
  }

  async next(): Promise<void> {
    // Seek para próxima faixa
    const nextTrack = this.trackCues[this.currentTrackIndex + 1];
    if (nextTrack) {
      this.audio.currentTime = nextTrack.startTime;
      this.currentTrackIndex++;
      this.updateMediaSession();
    }
  }
}
```

### **3.2 Standard Strategy**
```typescript
class StandardStrategy {
  // Implementação atual mantida intacta
  // Carregamento de arquivos individuais
  // Funciona para Safari iOS, Chrome Android/Desktop
}
```

---

## 📊 **FASE 4: INTEGRAÇÃO E TESTES**

### **4.1 Pontos de Integração**
- **StateManager**: Detectar estratégia na inicialização
- **AudioPlayer**: Factory pattern para strategy
- **MediaSession**: Compatível com ambas estratégias
- **Controls**: UI unificada, comportamento específico

### **4.2 Testes por Plataforma**
- ✅ Safari iOS (web): Strategy Standard
- ✅ Chrome Android: Strategy Standard  
- ✅ Desktop Chrome: Strategy Standard
- 🎯 **iOS PWA**: Strategy HLS (novo)

---

## 🔧 **DETALHES TÉCNICOS**

### **FFmpeg Command para HLS**
```bash
# Concatenar MP3s em HLS com discontinuities
ffmpeg -f concat -safe 0 -i filelist.txt \
       -c:a aac -b:a 128k \
       -f hls -hls_time 10 \
       -hls_playlist_type vod \
       -hls_flags single_file \
       -hls_segment_filename "segment-%03d.ts" \
       playlist-continuous.m3u8
```

### **Media Session Otimizada**
```typescript
// iOS PWA: Metadata genérica + updates via timeupdate
// Outras plataformas: Metadata específica por faixa
if (isIOSPWA()) {
  // Update metadata baseado em currentTime vs trackCues
  this.audio.addEventListener('timeupdate', this.updateCurrentTrack);
} else {
  // Update metadata quando carrega nova faixa
  this.updateMetadataOnTrackChange();
}
```

---

## 📅 **CRONOGRAMA DE IMPLEMENTAÇÃO**

### **Fase 1: Estrutura (30 min)** ✅
- [x] Detecção de plataforma melhorada
- [x] Factory pattern para strategies
- [x] Interfaces definidas
- [x] StandardStrategy implementada (baseada no código atual)
- [x] IOSPWAStrategy criada (com fallback temporário)
- [x] AudioPlayerV2 com strategy pattern
- [x] Build funcionando corretamente

### **Fase 2: HLS Generation (45 min)**
- [ ] Script FFmpeg para concatenação
- [ ] Geração de trackCues mapping
- [ ] Testes de HLS playback

### **Fase 3: iOS PWA Strategy (60 min)**
- [ ] Implementação HLS player
- [ ] Seek-based navigation
- [ ] Media Session integration

### **Fase 4: Integração (30 min)**
- [ ] Factory integration no AudioPlayer
- [ ] Testes cross-platform
- [ ] Documentação

---

## 🎯 **CRITÉRIOS DE SUCESSO**

### **iOS PWA (objetivo principal):**
- ✅ Background audio contínuo
- ✅ Transição automática entre faixas  
- ✅ Lock screen controls funcionais
- ✅ Metadata persistente

### **Outras plataformas (manter funcionando):**
- ✅ Comportamento atual preservado
- ✅ Performance não impactada
- ✅ Features existentes intactas

---

## ❓ **DECISÕES CONFIRMADAS** ✅

1. **HLS apenas para iOS PWA**: ✅ Estratégia dupla confirmada
2. **Cache Strategy**: Network-only (como atual)
3. **Metadata Updates**: Via timeupdate quando precisar
4. **Quality**: ✅ 128k AAC confirmado
5. **Fallback**: Avaliar após implementação HLS

---

## 🚀 **PRÓXIMOS PASSOS**

1. ✅ **Estratégia dual aprovada**
2. 🔄 **Implementar Fase 1** (factory pattern) ← **PRÓXIMO**
3. **Criar script HLS** com músicas atuais
4. **Testar HLS playback** em iOS PWA
5. **Integrar strategy switching** automático

---

**🎵 Resultado esperado**: iOS PWA funcionando como Safari iOS, outras plataformas inalteradas.
