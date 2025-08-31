# 🎵 Radio Importante PWA

**Progressive Web App de música com suporte completo para iPhone PWA background audio**

## 🎯 Características Principais

- ✅ **iPhone PWA Background Audio** - Funciona perfeitamente durante screen lock
- 🎵 **Reprodução Contínua** - Zero interrupções entre faixas
- 📱 **PWA Completo** - Instalável no home screen
- 🎛️ **Interface Admin** - Gerenciamento de catálogo
- 🔄 **Sistema Escalável** - Detecta automaticamente a melhor estratégia de áudio

## 🚀 Quick Start

### 1. Instalar Dependências
```bash
npm install
```

### 2. Gerar Arquivos de Áudio
```bash
npm run audio
```

### 3. Executar em Desenvolvimento
```bash
npm run dev
```

### 4. Acessar no iPhone
- Abra Safari no iPhone
- Acesse `http://SEU-IP:5173`
- Toque "Compartilhar" → "Adicionar à Tela de Início"
- Abra o app PWA
- **Resultado**: Música continua durante screen lock! 🎉

## � Sistema de Áudio Inteligente

O sistema detecta automaticamente o tamanho do catálogo e escolhe a melhor estratégia:

### 🏠 **Catálogos Pequenos** (até 1 hora / 50MB)
- **Estratégia**: Arquivo contínuo único
- **Arquivo**: `public/audio/radio-importante-continuous.aac`
- **Benefícios**: Máxima simplicidade e confiabilidade

### 📈 **Catálogos Grandes** (100+ faixas / 6+ horas)  
- **Estratégia**: Múltiplos chunks AAC de 1 hora
- **Arquivos**: `public/audio/chunks/radio-importante-chunk_*.aac`
- **Benefícios**: Carregamento progressivo + preload inteligente

## 🛠️ Comandos Disponíveis

### Desenvolvimento
```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build para produção
npm run preview      # Preview do build
```

### Áudio
```bash
npm run audio        # Gera arquivos de áudio (detecção automática)
npm run catalog      # Atualiza catálogo de músicas
```

### Manutenção
```bash
npm run lint         # Verificar código
npm run format       # Formatar código
```

## 📁 Estrutura do Projeto

```
├── public/
│   ├── audio/                          # Arquivos de áudio
│   │   ├── *.mp3                      # Músicas originais  
│   │   ├── radio-importante-continuous.aac  # Arquivo contínuo
│   │   ├── chunks/                    # Chunks para catálogos grandes
│   │   └── hls/track-cues.json       # Mapeamento de faixas
│   ├── data/catalog.json             # Catálogo de músicas
│   └── manifest.webmanifest          # Manifesto PWA
├── src/
│   ├── app.ts                        # Aplicação principal
│   ├── player/audio.ts               # Player de áudio
│   ├── platform/deviceDetection.ts  # Detecção de dispositivo
│   └── ui/controls.ts               # Controles de interface
└── scripts/
    ├── generate-audio.js            # Gerador inteligente de áudio
    └── generateCatalog.js          # Gerador de catálogo
```

## 🏗️ Arquitetura Técnica

### 🎯 **Solução iPhone PWA Background Audio**

**Problema**: iPhone PWA para música entre faixas durante screen lock  
**Causa**: Carregamento de arquivos individuais interrompe reprodução  
**Solução**: 
- Arquivo AAC contínuo único para iPhone PWA
- Track cues mapping para navegação  
- Zero JavaScript execution durante background
- Background detection via `visibilitychange`

### 🧠 **Detecção Inteligente de Estratégia**

```javascript
// Análise automática do catálogo
if (tamanho <= 50MB && duração <= 1 hora) {
  estratégia = "arquivo único";    // ← Atual
} else {
  estratégia = "múltiplos chunks"; // ← Futuro
}
```

## 📱 Dispositivos Testados

| Dispositivo | Status | Estratégia |
|-------------|--------|------------|
| iPhone PWA | ✅ Funcionando | Arquivo contínuo + seek |
| iPad PWA | ✅ Compatível | Arquivo contínuo |
| Android PWA | ✅ Compatível | Arquivo contínuo |
| Desktop | ✅ Compatível | Arquivo contínuo |

## 🔧 Configuração Avançada

### Ajustar Limites de Detecção
```javascript
// scripts/generate-audio.js
const CONFIG = {
  maxSingleFileSize: 50 * 1024 * 1024,    // 50MB
  maxSingleFileDuration: 60 * 60,          // 1 hora
  // ...
};
```

### Qualidade de Áudio
```javascript
// Arquivo único (atual)
bitrate: '128k'  // Alta qualidade

// Chunks (futuro)  
bitrate: '96k'   // Otimizado para tamanho
```

## 🎉 Status do Projeto

### ✅ **FUNCIONANDO PERFEITAMENTE**
- [x] iPhone PWA background audio
- [x] 15 faixas × 1 minuto = 15 minutos contínuos
- [x] Zero interrupções durante screen lock
- [x] Navegação entre faixas
- [x] Interface administrativa
- [x] Sistema escalável automático

### 🚀 **PRONTO PARA ESCALAR**
- [x] Detecção automática de tamanho
- [x] Scripts preparados para chunks
- [x] Arquitetura extensível
- [x] Zero breaking changes

## 💡 Lições Aprendidas

### ❌ **O que NÃO funciona no iPhone PWA**
- HLS streaming (`DEMUXER_ERROR_DETECTED_HLS`)
- Carregamento de arquivos individuais durante background
- JavaScript updates durante screen lock
- Mudanças de metadata durante background

### ✅ **O que FUNCIONA no iPhone PWA**  
- Arquivo AAC contínuo único
- Seek por `currentTime`
- Background detection
- Static metadata mode
- Zero JavaScript execution durante background

## 🏆 Conquistas

1. ✅ **Resolveu problema complexo** do iPhone PWA background audio
2. ✅ **Manteve qualidade** (128k AAC)  
3. ✅ **Escalabilidade automática** baseada em tamanho
4. ✅ **Zero breaking changes** para usuários
5. ✅ **Arquitetura limpa** e extensível

**🎵 MISSÃO CUMPRIDA! 🎵**
