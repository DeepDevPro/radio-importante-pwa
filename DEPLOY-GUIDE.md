# 🚀 DEPLOY PARA PRODUÇÃO - importantestudio.com

## 🎯 Preparação Completa

### ✅ **Status Atual**
- **Build pronto**: `./dist/` com todos os arquivos
- **HLS verificado**: Playlist e track cues incluídos  
- **Git repository**: Commit estável criado
- **Tag segura**: `v1.0-ios-pwa-fix` para restauração

## 🌐 **Opções de Deploy**

### **Opção 1: Subdomínio recomendado**
`https://radio.importantestudio.com` ou `https://pwa.importantestudio.com`

### **Opção 2: Subpasta**  
`https://importantestudio.com/radio/`

## 📋 **Requisitos OBRIGATÓRIOS**

### 🔒 **HTTPS Essencial**
- PWA exige HTTPS em produção
- Service Worker só funciona com HTTPS
- Media Session API precisa de HTTPS

### 📁 **Estrutura de Deploy**
```
/ (raiz do subdomínio/subpasta)
├── index.html
├── assets/
├── audio/
│   ├── *.mp3 (15 arquivos)
│   └── hls/
│       ├── playlist-continuous.m3u8 ⚠️ CRÍTICO
│       ├── track-cues.json ⚠️ CRÍTICO  
│       └── segment-*.ts
├── manifest.webmanifest
└── sw.js
```

### 🎵 **Arquivos CRÍTICOS HLS**
- `audio/hls/playlist-continuous.m3u8` - Stream principal
- `audio/hls/track-cues.json` - Mapeamento temporal
- `audio/hls/segment-*.ts` - Segmento de áudio

## 🛠️ **Configuração do Servidor**

### **Apache (.htaccess)**
```apache
# PWA e HLS Headers
<IfModule mod_headers.c>
    Header set Cross-Origin-Embedder-Policy "require-corp"
    Header set Cross-Origin-Opener-Policy "same-origin"
    
    # HLS Content Types
    <FilesMatch "\.(m3u8)$">
        Header set Content-Type "application/vnd.apple.mpegurl"
        Header set Cache-Control "no-cache"
    </FilesMatch>
    
    <FilesMatch "\.(ts)$">
        Header set Content-Type "video/mp2t"
    </FilesMatch>
</IfModule>

# PWA Cache
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/cache-manifest "access plus 0 seconds"
    ExpiresByType application/manifest+json "access plus 1 year"
</IfModule>
```

### **Nginx**
```nginx
location ~* \.(m3u8)$ {
    add_header Content-Type application/vnd.apple.mpegurl;
    add_header Cache-Control no-cache;
}

location ~* \.(ts)$ {
    add_header Content-Type video/mp2t;
}
```

## 🚀 **Processo de Deploy**

### **1. Preparar arquivos** ✅
```bash
./deploy-production.sh
# Build está pronto em ./dist/
```

### **2. Upload para servidor**
- Copiar todo conteúdo de `./dist/` para raiz do subdomínio
- **Verificar**: Todos os arquivos HLS foram copiados

### **3. Configurar domínio**
- Apontar subdomínio para pasta
- Ativar certificado SSL/HTTPS
- Configurar headers (se necessário)

### **4. Teste final**
- Desktop: `https://radio.importantestudio.com` 
- Mobile: Instalar PWA e testar background audio

## 🛡️ **Pontos de Restauração**

### **Git Local**
```bash
# Se algo der errado:
./restore-backup.sh

# Volta para estado funcionando
```

### **Backup da Build**
```bash
# Fazer backup da dist/ antes de mudanças futuras
cp -r dist/ dist-backup-v1.0/
```

## 🧪 **Checklist Pós-Deploy**

- [ ] HTTPS ativo e funcionando
- [ ] PWA instala corretamente no mobile
- [ ] Arquivos HLS acessíveis:
  - [ ] `/audio/hls/playlist-continuous.m3u8`
  - [ ] `/audio/hls/track-cues.json`
- [ ] iOS PWA reproduz sem interrupções
- [ ] Desktop/Safari iOS funcionam normalmente

## 🎯 **URLs para Testar**

Depois do deploy, testar:
- **Playlist HLS**: `https://radio.importantestudio.com/audio/hls/playlist-continuous.m3u8`
- **Track Cues**: `https://radio.importantestudio.com/audio/hls/track-cues.json`
- **App Principal**: `https://radio.importantestudio.com/`

---

**🎉 Deploy está pronto! Arquivos em `./dist/` prontos para upload.**
