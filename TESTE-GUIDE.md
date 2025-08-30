# 🧪 GUIA DE TESTE - iOS PWA Background Audio Fix

## 🚀 Como Testar

### 1. **Servidor Ativo**
✅ Servidor rodando em: `http://localhost:5174/`  
✅ HLS assets disponíveis em: `http://localhost:5174/audio/hls/`

### 2. **Plataformas de Teste**

#### 🌐 **Desktop/Laptop (Chrome/Safari)**
- **Comportamento**: Usa arquivos individuais (modo normal)
- **Console**: Deve mostrar "AudioPlayer inicializado" (sem iOS PWA)

#### 📱 **Safari iOS (navegador)**
- **Comportamento**: Usa arquivos individuais (modo normal)  
- **Console**: Deve mostrar "AudioPlayer inicializado" (sem iOS PWA)

#### 🍎 **iOS PWA (Safari + Add to Home Screen)**
- **Comportamento**: Usa HLS stream contínua
- **Console**: Deve mostrar:
  ```
  🍎 iOS PWA detectado - aplicando otimizações de áudio
  🍎 Carregando HLS para iOS PWA...
  ✅ Track cues carregados: 15 faixas
  🎵 HLS configurado para iOS PWA
  ```

### 3. **Testando iOS PWA**

#### Passo 1: Instalar PWA no iOS
1. Abra Safari no iPhone/iPad
2. Navegue para `http://192.168.15.5:5174/` (IP da rede local)
3. Toque no botão "Compartilhar" 
4. Selecione "Adicionar à Tela de Início"
5. Confirme a instalação

#### Passo 2: Testar Background Audio
1. **Abra o PWA** da tela de início (não pelo Safari)
2. **Play numa música** qualquer
3. **Pressione Home** para minimizar o app
4. **Aguarde** a música tocar até o final
5. **Verificar**: A próxima música deve começar **automaticamente** sem parar

### 4. **Verificação nos Logs**

#### No Desktop/Safari iOS Normal:
```
🎵 Tentando carregar áudio: /audio/filename.mp3
✅ Áudio carregado com sucesso: /audio/filename.mp3
```

#### No iOS PWA:
```
🍎 iOS PWA detectado - aplicando otimizações de áudio
🍎 Carregando HLS para iOS PWA...
✅ Track cues carregados: 15 faixas
🎵 HLS configurado para iOS PWA
🍎 HLS Mode: Procurando faixa: filename.mp3
🎵 HLS: Navegando para faixa X: Track Name
```

### 5. **HLS Assets Disponíveis**

Verifique se os arquivos HLS foram gerados:
- ✅ `http://localhost:5174/audio/hls/playlist-continuous.m3u8`
- ✅ `http://localhost:5174/audio/hls/track-cues.json`  
- ✅ `http://localhost:5174/audio/hls/segment-000.ts`

### 6. **Comportamentos Esperados**

#### ✅ **Funcionando Corretamente**
- **Desktop/Safari iOS**: Reprodução normal de arquivos individuais
- **iOS PWA**: Stream contínua sem interrupções entre faixas
- **Background Audio**: Continua tocando mesmo com app minimizado

#### ❌ **Problemas Possíveis**
- Console mostra erros 404 para HLS files
- iOS PWA volta para modo individual files
- Background audio ainda para entre faixas

### 7. **Debug Avançado**

Se algo não funcionar, verificar:

1. **HLS Files**: `curl http://localhost:5174/audio/hls/track-cues.json`
2. **Console Logs**: Abrir DevTools no navegador
3. **Network Tab**: Verificar requests para HLS files
4. **iOS PWA Detection**: Verificar se `window.matchMedia('(display-mode: standalone)').matches` retorna `true`

## 🎯 **Resultado Esperado**

**iOS PWA**: Zero interrupções entre faixas, background audio perfeito!  
**Outras plataformas**: Funcionamento idêntico ao anterior!

---

**Para parar o servidor**: `Ctrl+C` no terminal  
**Para rebuild**: `npm run build`  
**Para gerar novo HLS**: `npm run hls:generate`
