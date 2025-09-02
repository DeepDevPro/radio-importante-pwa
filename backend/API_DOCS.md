# 📚 API Documentation - Radio Importante Backend

## 🌐 Base URL
- **Desenvolvimento**: `http://localhost:8080`
- **Produção**: `https://radio-backend-prod.us-west-2.elasticbeanstalk.com`

## 🔐 Autenticação
Atualmente não há autenticação. Rate limiting configurado:
- **Upload**: 10 requests por 15 minutos por IP
- **Geral**: 100 requests por 15 minutos por IP

---

## 📋 Endpoints

### 🏥 Health Check

#### `GET /health`
**Descrição**: Verificar status do servidor

**Response 200**:
```json
{
  "status": "OK",
  "timestamp": "2025-09-02T21:26:00.000Z",
  "uptime": 123.45,
  "environment": "development",
  "version": "1.0.0"
}
```

#### `GET /`
**Descrição**: Informações da API

**Response 200**:
```json
{
  "name": "Radio Importante Backend",
  "version": "1.0.0",
  "status": "Running",
  "endpoints": {
    "health": "/health",
    "upload": "/api/upload",
    "catalog": "/api/catalog"
  }
}
```

---

### 📤 Upload de Arquivos

#### `POST /api/upload`
**Descrição**: Upload de arquivos de áudio para S3

**Content-Type**: `multipart/form-data`

**Body**:
- `audioFiles`: Array de arquivos (máximo 5)

**Arquivos aceitos**:
- Formatos: MP3, WAV, FLAC, AAC, OGG
- Tamanho máximo: 50MB por arquivo
- Tipos MIME: `audio/mpeg`, `audio/wav`, `audio/flac`, `audio/aac`, `audio/ogg`

**Response 201** (Sucesso total):
```json
{
  "success": true,
  "message": "2 arquivo(s) enviado(s) com sucesso",
  "uploaded": [
    {
      "fileName": "artist-song.mp3",
      "s3Key": "public/audio/1693689600000-artist-song.mp3",
      "url": "https://s3.amazonaws.com/bucket/public/audio/1693689600000-artist-song.mp3",
      "size": 4567890,
      "trackId": "1693689600000",
      "success": true
    }
  ],
  "errors": [],
  "stats": {
    "total": 2,
    "successful": 2,
    "failed": 0
  }
}
```

**Response 207** (Sucesso parcial):
```json
{
  "success": true,
  "message": "1 arquivo(s) enviado(s) com sucesso",
  "uploaded": [...],
  "errors": [
    {
      "fileName": "invalid-file.txt",
      "error": "Tipo de arquivo não suportado",
      "success": false
    }
  ],
  "stats": {
    "total": 2,
    "successful": 1,
    "failed": 1
  }
}
```

**Response 400** (Erro de validação):
```json
{
  "success": false,
  "error": "Nenhum arquivo foi enviado.",
  "code": "NO_FILES"
}
```

#### `GET /api/upload/status`
**Descrição**: Status do serviço de upload

**Response 200**:
```json
{
  "success": true,
  "service": "Upload Service",
  "status": "active",
  "limits": {
    "maxFileSize": "50MB",
    "maxFiles": 5,
    "allowedFormats": ["MP3", "WAV", "FLAC", "AAC", "OGG"]
  },
  "catalog": {
    "totalTracks": 15,
    "totalArtists": 8,
    "artists": ["Artist 1", "Artist 2", ...],
    "totalSize": 123456789,
    "lastUpdated": "2025-09-02T21:26:00.000Z"
  }
}
```

---

### 📚 Gerenciamento de Catálogo

#### `GET /api/catalog`
**Descrição**: Obter catálogo completo de músicas

**Response 200**:
```json
{
  "success": true,
  "catalog": {
    "tracks": [
      {
        "id": "1693689600000",
        "title": "Song Title",
        "artist": "Artist Name",
        "url": "https://s3.amazonaws.com/bucket/public/audio/song.mp3",
        "fileName": "artist-song.mp3",
        "addedAt": "2025-09-02T21:26:00.000Z",
        "duration": null,
        "size": 4567890
      }
    ]
  },
  "stats": {
    "totalTracks": 15,
    "version": "1.0.0",
    "lastUpdated": "2025-09-02T21:26:00.000Z"
  }
}
```

#### `GET /api/catalog/stats`
**Descrição**: Estatísticas do catálogo

**Response 200**:
```json
{
  "success": true,
  "stats": {
    "totalTracks": 15,
    "totalArtists": 8,
    "artists": ["Artist 1", "Artist 2", ...],
    "totalSize": 123456789,
    "lastUpdated": "2025-09-02T21:26:00.000Z"
  }
}
```

#### `GET /api/catalog/search`
**Descrição**: Buscar faixas no catálogo

**Query Parameters**:
- `q`: Busca geral (string) - opcional
- `artist`: Filtrar por artista (string) - opcional  
- `title`: Filtrar por título (string) - opcional

**Exemplo**: `/api/catalog/search?q=love&artist=beatles`

**Response 200**:
```json
{
  "success": true,
  "query": {
    "q": "love",
    "artist": "beatles",
    "title": null
  },
  "results": [
    {
      "id": "1693689600000",
      "title": "Love Me Do",
      "artist": "The Beatles",
      "url": "https://s3.amazonaws.com/bucket/public/audio/beatles-love.mp3",
      "fileName": "beatles-love-me-do.mp3",
      "addedAt": "2025-09-02T21:26:00.000Z",
      "duration": null,
      "size": 4567890
    }
  ],
  "totalResults": 1,
  "totalTracks": 15
}
```

#### `DELETE /api/catalog/track/:id`
**Descrição**: Remover faixa do catálogo

**URL Parameters**:
- `id`: ID da faixa (string, obrigatório)

**Response 200**:
```json
{
  "success": true,
  "message": "Faixa removida com sucesso.",
  "removedTrack": {
    "id": "1693689600000",
    "title": "Song Title",
    "artist": "Artist Name",
    "fileName": "artist-song.mp3"
  }
}
```

**Response 404**:
```json
{
  "success": false,
  "error": "Faixa não encontrada no catálogo",
  "code": "TRACK_NOT_FOUND"
}
```

#### `PUT /api/catalog/track/:id`
**Descrição**: Atualizar metadados de uma faixa

**URL Parameters**:
- `id`: ID da faixa (string, obrigatório)

**Body** (JSON):
```json
{
  "title": "New Song Title",
  "artist": "New Artist Name"
}
```

**Response 200**:
```json
{
  "success": true,
  "message": "Faixa atualizada com sucesso.",
  "track": {
    "id": "1693689600000",
    "title": "New Song Title", 
    "artist": "New Artist Name",
    "url": "https://s3.amazonaws.com/bucket/public/audio/song.mp3",
    "fileName": "artist-song.mp3",
    "addedAt": "2025-09-02T21:26:00.000Z",
    "updatedAt": "2025-09-02T21:30:00.000Z",
    "duration": null,
    "size": 4567890
  }
}
```

---

## 🚨 Códigos de Erro

### Erros Gerais
- `INTERNAL_ERROR`: Erro interno do servidor (500)
- `NOT_FOUND`: Endpoint não encontrado (404)
- `VALIDATION_ERROR`: Dados inválidos (400)

### Erros de Upload
- `NO_FILES`: Nenhum arquivo enviado (400)
- `FILE_TOO_LARGE`: Arquivo maior que 50MB (413)
- `INVALID_FILE_TYPE`: Tipo de arquivo não permitido (400)
- `UPLOAD_ERROR`: Erro durante upload (500)

### Erros de Catálogo
- `CATALOG_ERROR`: Erro ao carregar catálogo (500)
- `STATS_ERROR`: Erro ao obter estatísticas (500)
- `SEARCH_ERROR`: Erro durante busca (500)
- `TRACK_NOT_FOUND`: Faixa não encontrada (404)
- `REMOVE_ERROR`: Erro ao remover faixa (500)
- `UPDATE_ERROR`: Erro ao atualizar faixa (500)

### Erros de Validação
- `MISSING_TRACK_ID`: ID da faixa não fornecido (400)
- `INVALID_TRACK_ID`: ID da faixa inválido (400)
- `MISSING_SEARCH_PARAMS`: Parâmetros de busca não fornecidos (400)
- `MISSING_UPDATE_DATA`: Dados para atualização não fornecidos (400)

---

## 📊 Rate Limiting

### Limites por IP
- **Upload**: 10 requests por 15 minutos
- **Geral**: 100 requests por 15 minutos

### Headers de Rate Limit
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1693689900
```

### Response quando limite excedido (429):
```json
{
  "error": "Muitas requisições. Tente novamente em 15 minutos.",
  "retryAfter": 900
}
```

---

## 🔐 Segurança

### Headers de Segurança (Helmet)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`

### CORS
- **Allowed Origins**: 
  - `https://radio.importantestudio.com`
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`
- **Methods**: GET, POST, PUT, DELETE, OPTIONS
- **Headers**: Content-Type, Authorization

---

## 🧪 Exemplos de Uso

### Upload com curl
```bash
curl -X POST http://localhost:8080/api/upload \
  -F "audioFiles=@song1.mp3" \
  -F "audioFiles=@song2.mp3"
```

### Busca com curl
```bash
curl "http://localhost:8080/api/catalog/search?q=beatles&artist=john"
```

### Atualizar metadados
```bash
curl -X PUT http://localhost:8080/api/catalog/track/123456 \
  -H "Content-Type: application/json" \
  -d '{"title": "New Title", "artist": "New Artist"}'
```

---

## 🔄 Versionamento

**Versão atual**: 1.0.0  
**Compatibilidade**: Mantém compatibilidade com versões anteriores  
**Headers de versão**: `X-API-Version: 1.0.0`
