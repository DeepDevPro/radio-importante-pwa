# 🐍 PARTE 6: PLANO B - PYTHON FASTAPI

> **Tempo estimado**: 4-6 horas  
> **Objetivo**: Fallback para backend Python se Node.js falhar  
> **Estratégia**: FastAPI minimalista com upload via URLs pré-assinadas  

---

## ⚠️ **QUANDO EXECUTAR ESTA PARTE**

Execute esta parte APENAS se:
- [ ] Parte 2 falhou (backend Node.js não funciona na DO)
- [ ] Parte 5 falhou (testes críticos não passaram)
- [ ] Preferência explícita por Python ao invés de Node.js

**Se as Partes 1-5 funcionaram, esta parte é OPCIONAL.**

---

## 🎯 **CHECKLIST DESTA PARTE**

- [ ] Criar estrutura do backend Python
- [ ] Implementar FastAPI com 3 endpoints essenciais
- [ ] Configurar upload via URLs pré-assinadas S3
- [ ] Deploy na DigitalOcean App Platform
- [ ] Testes de integração com frontend
- [ ] Migração completa para Python

---

## 📊 **PASSO 1: ESTRUTURA DO BACKEND PYTHON (30 min)**

### **1.1 Criar diretório do backend Python**

📝 **AÇÃO**: Criar novo diretório separado

💻 **COMANDO**:
```bash
mkdir backend-python
cd backend-python
```

### **1.2 Criar requirements.txt**

📂 **ARQUIVO**: `backend-python/requirements.txt`

💻 **COMANDO**:
```bash
cat > requirements.txt << 'EOF'
fastapi==0.104.1
uvicorn[standard]==0.24.0
boto3==1.34.0
python-multipart==0.0.6
python-dotenv==1.0.0
pydantic==2.5.0
cors==1.0.1
EOF
```

### **1.3 Criar arquivo principal**

📂 **ARQUIVO**: `backend-python/main.py`

💻 **COMANDO**:
```bash
cat > main.py << 'EOF'
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import boto3
import json
import os
from datetime import datetime
from typing import List, Optional
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Criar app FastAPI
app = FastAPI(
    title="Radio Importante Backend API",
    description="Backend Python para Radio Importante PWA",
    version="3.0.0"
)

# CORS - Configurar origens permitidas
origins = [
    "https://radio.importantestudio.com",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    os.getenv("FRONTEND_URL", "")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin for origin in origins if origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event
@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Radio Importante Backend (Python) starting...")
    logger.info(f"📝 Environment: {os.getenv('ENVIRONMENT', 'development')}")
    logger.info(f"🔌 Port: {os.getenv('PORT', '8080')}")
    logger.info(f"☁️ Platform: Python FastAPI")
    logger.info(f"📅 Start time: {datetime.now().isoformat()}")

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Radio Importante Backend API",
        "version": "3.0.0",
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "language": "Python",
        "framework": "FastAPI"
    }

# Health check
@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "radio-importante-backend-python",
        "version": "3.0.0", 
        "timestamp": datetime.now().isoformat()
    }

# AWS S3 client
def get_s3_client():
    return boto3.client(
        's3',
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        region_name=os.getenv('AWS_REGION', 'us-west-2')
    )

# Gerar URL pré-assinada para upload
@app.post("/api/upload/presigned")
async def get_presigned_upload_url(filename: str = Form(...)):
    """Gera URL pré-assinada para upload direto ao S3"""
    try:
        s3_client = get_s3_client()
        bucket = os.getenv('S3_BUCKET')
        
        if not bucket:
            raise HTTPException(status_code=500, detail="S3_BUCKET not configured")
        
        # Gerar key único para o arquivo
        key = f"audio/{filename}"
        
        # Gerar URL pré-assinada
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': bucket,
                'Key': key,
                'ContentType': 'audio/mpeg'
            },
            ExpiresIn=3600  # 1 hora
        )
        
        logger.info(f"Generated presigned URL for: {filename}")
        
        return {
            "presigned_url": presigned_url,
            "filename": filename,
            "key": key,
            "bucket": bucket,
            "expires_in": 3600
        }
        
    except Exception as e:
        logger.error(f"Error generating presigned URL: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating upload URL: {str(e)}")

# Upload tradicional (fallback)
@app.post("/api/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    """Upload tradicional como fallback"""
    try:
        s3_client = get_s3_client()
        bucket = os.getenv('S3_BUCKET')
        
        if not bucket:
            raise HTTPException(status_code=500, detail="S3_BUCKET not configured")
        
        uploaded_files = []
        
        for file in files:
            # Upload direto para S3
            key = f"audio/{file.filename}"
            
            s3_client.upload_fileobj(
                file.file,
                bucket,
                key,
                ExtraArgs={'ContentType': 'audio/mpeg'}
            )
            
            uploaded_files.append({
                "filename": file.filename,
                "key": key,
                "size": file.size
            })
            
            logger.info(f"Uploaded file: {file.filename}")
        
        return {
            "message": "Files uploaded successfully",
            "files": uploaded_files,
            "count": len(uploaded_files)
        }
        
    except Exception as e:
        logger.error(f"Error uploading files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error uploading files: {str(e)}")

# Gerenciar catálogo
@app.get("/api/catalog")
async def get_catalog():
    """Retorna catálogo de músicas"""
    try:
        s3_client = get_s3_client()
        bucket = os.getenv('S3_BUCKET')
        
        # Tentar ler catalog.json do S3
        try:
            response = s3_client.get_object(Bucket=bucket, Key='catalog.json')
            catalog = json.loads(response['Body'].read())
            return catalog
        except s3_client.exceptions.NoSuchKey:
            # Se não existe, retornar catálogo vazio
            return {"tracks": [], "last_updated": datetime.now().isoformat()}
            
    except Exception as e:
        logger.error(f"Error getting catalog: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting catalog: {str(e)}")

@app.put("/api/catalog")
async def update_catalog(catalog_data: dict):
    """Atualiza catálogo de músicas"""
    try:
        s3_client = get_s3_client()
        bucket = os.getenv('S3_BUCKET')
        
        # Adicionar timestamp
        catalog_data['last_updated'] = datetime.now().isoformat()
        
        # Salvar no S3
        s3_client.put_object(
            Bucket=bucket,
            Key='catalog.json',
            Body=json.dumps(catalog_data, indent=2),
            ContentType='application/json'
        )
        
        logger.info("Catalog updated successfully")
        
        return {
            "message": "Catalog updated successfully",
            "tracks_count": len(catalog_data.get('tracks', [])),
            "updated_at": catalog_data['last_updated']
        }
        
    except Exception as e:
        logger.error(f"Error updating catalog: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating catalog: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
EOF
```

### **1.4 Criar Procfile para DO**

📂 **ARQUIVO**: `backend-python/Procfile`

💻 **COMANDO**:
```bash
cat > Procfile << 'EOF'
web: uvicorn main:app --host 0.0.0.0 --port $PORT
EOF
```

---

## 📊 **PASSO 2: TESTE LOCAL DO BACKEND PYTHON (20 min)**

### **2.1 Criar ambiente virtual**

📝 **AÇÃO**: Configurar ambiente Python isolado

💻 **COMANDO**:
```bash
python3 -m venv venv
source venv/bin/activate  # No Windows: venv\Scripts\activate
```

### **2.2 Instalar dependências**

💻 **COMANDO**:
```bash
pip install -r requirements.txt
```

### **2.3 Configurar variáveis de ambiente locais**

📂 **ARQUIVO**: `backend-python/.env`

💻 **COMANDO**:
```bash
cat > .env << 'EOF'
PORT=8080
ENVIRONMENT=development
AWS_ACCESS_KEY_ID=your_aws_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_here
AWS_REGION=us-west-2
S3_BUCKET=radio-importantestudio-com
FRONTEND_URL=http://localhost:3000
EOF
```

⚠️ **IMPORTANTE**: Substituir pelas credenciais AWS reais

### **2.4 Testar servidor local**

💻 **COMANDO**:
```bash
python main.py &
sleep 3

# Testes básicos
curl http://localhost:8080/health
curl http://localhost:8080/
curl -X OPTIONS http://localhost:8080/api/upload

# Parar servidor
pkill -f "python main.py"
```

✅ **VERIFICAR**: Todos os endpoints devem responder corretamente

---

## 📊 **PASSO 3: DEPLOY PYTHON NA DIGITALOCEAN (45 min)**

### **3.1 Preparar repositório**

📝 **AÇÃO**: Commitar código Python

💻 **COMANDO**:
```bash
cd ..  # Voltar para raiz do projeto
git add backend-python/
git commit -m "feat: Add Python FastAPI backend as fallback

- FastAPI with 3 essential endpoints
- S3 presigned URLs for upload
- CORS configured for frontend
- Health check and info endpoints
- Catalog management via S3"

git push origin main
```

### **3.2 Criar novo app Python na DO**

📝 **AÇÃO**: Criar segunda aplicação na DigitalOcean

📋 **CONFIGURAÇÃO no painel DO**:
- Repository: `DeepDevPro/radio-importante-pwa`
- Branch: `main`
- Source Directory: `/backend-python`
- Build Command: `pip install -r requirements.txt`
- Run Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Environment: `Python 3.11`

### **3.3 Configurar variáveis de ambiente**

📋 **VARIÁVEIS** (no painel DO):
```
ENVIRONMENT=production
AWS_ACCESS_KEY_ID=[aws_key_real]
AWS_SECRET_ACCESS_KEY=[aws_secret_real]
AWS_REGION=us-west-2
S3_BUCKET=radio-importantestudio-com
FRONTEND_URL=https://radio.importantestudio.com
```

### **3.4 Fazer deploy e obter URL**

📝 **AÇÃO**: Deployar e documentar nova URL

✅ **VERIFICAR**: Deploy completa sem erros

💻 **COMANDO**: Documentar URL Python:
```bash
cat > backend-python/URL_PYTHON_DO.md << 'EOF'
# Backend Python - DigitalOcean

## URL
https://radio-importante-backend-python-[hash].ondigitalocean.app

## Endpoints
- Health: /health  
- Info: /
- Upload Presigned: /api/upload/presigned
- Upload Traditional: /api/upload
- Catalog GET: /api/catalog
- Catalog PUT: /api/catalog

## Data de Deploy
[DATA_ATUAL]
EOF
```

---

## 📊 **PASSO 4: TESTAR BACKEND PYTHON (30 min)**

### **4.1 Testes básicos de conectividade**

💻 **COMANDO**:
```bash
# Definir URL Python (substituir pela real)
PYTHON_URL="https://radio-importante-backend-python-[hash].ondigitalocean.app"

echo "🔍 Testando backend Python..."
echo "Python URL: $PYTHON_URL"

# Teste health
curl "$PYTHON_URL/health"

# Teste info
curl "$PYTHON_URL/"

# Teste CORS
curl -I -H "Origin: https://radio.importantestudio.com" \
     -X OPTIONS \
     "$PYTHON_URL/api/upload"
```

### **4.2 Teste de URL pré-assinada**

💻 **COMANDO**:
```bash
# Teste geração de URL pré-assinada
curl -X POST \
     -F "filename=test-audio.mp3" \
     "$PYTHON_URL/api/upload/presigned"
```

✅ **VERIFICAR**: Deve retornar JSON com `presigned_url`

### **4.3 Teste do catálogo**

💻 **COMANDO**:
```bash
# Teste GET catalog
curl "$PYTHON_URL/api/catalog"

# Teste PUT catalog (com dados dummy)
curl -X PUT \
     -H "Content-Type: application/json" \
     -d '{"tracks": [{"title": "Test Track", "artist": "Test Artist"}]}' \
     "$PYTHON_URL/api/catalog"
```

---

## 📊 **PASSO 5: MIGRAR FRONTEND PARA PYTHON (20 min)**

### **5.1 Atualizar configuração API**

📂 **ARQUIVO**: `src/config/api.ts`

💻 **COMANDO**: Substituir URL de produção:
```typescript
const API_CONFIG = {
  local: 'http://localhost:8080',
  production: 'https://radio-importante-backend-python-[SEU-HASH].ondigitalocean.app',
  current: process.env.NODE_ENV === 'production' ? 'production' : 'local'
};
```

### **5.2 Adaptar lógica de upload (se necessário)**

📝 **AÇÃO**: Atualizar frontend para usar URLs pré-assinadas

💻 **COMANDO**: Procurar código de upload no frontend:
```bash
grep -r "FormData\|upload" src/ | head -5
```

📝 **SE NECESSÁRIO**: Adaptar para usar endpoint `/api/upload/presigned`

### **5.3 Commit e deploy frontend atualizado**

💻 **COMANDO**:
```bash
git add src/
git commit -m "feat: Switch frontend to Python FastAPI backend

- Update API configuration for Python backend
- Use presigned URLs endpoint
- Maintain backward compatibility"

git push origin main
```

---

## 📊 **PASSO 6: TESTES FINAIS PYTHON (30 min)**

### **6.1 Teste integração completa**

📝 **AÇÃO**: Verificar se frontend conecta com backend Python

✅ **VERIFICAR no browser**:
1. Abrir https://radio.importantestudio.com
2. Console deve mostrar: "Using API: [URL-Python]"
3. Service Worker registra sem erro
4. PWA funciona normalmente

### **6.2 Teste de upload com Python**

📝 **AÇÃO**: Testar upload via interface

✅ **VERIFICAR**:
1. Tentar fazer upload de arquivo
2. Deve usar URLs pré-assinadas
3. Não deve haver MulterError (não usa multer)

### **6.3 Performance do Python vs Node.js**

💻 **COMANDO**:
```bash
echo "Comparando performance..."

# Python
time curl -s "$PYTHON_URL/health" > /dev/null

# Node.js (se ainda disponível)
# time curl -s "$NODEJS_URL/health" > /dev/null
```

---

## ✅ **CHECKPOINT FINAL - PYTHON BACKEND**

### **Migração Python Completada:**
- [ ] Backend FastAPI funcionando na DO
- [ ] Endpoints essenciais implementados
- [ ] Upload via URLs pré-assinadas
- [ ] Frontend conectando com Python
- [ ] Performance adequada
- [ ] PWA mantido funcional

### **Vantagens do Python:**
- ✅ Código mais simples e limpo
- ✅ Menos dependências externas
- ✅ Upload mais robusto (S3 direto)
- ✅ Melhor tratamento de erros
- ✅ Logs mais claros

### **Próximos Passos:**
1. **Monitorar estabilidade** Python vs Node.js
2. **Escolher definitivamente** qual backend manter
3. **Remover backend não usado**
4. **Atualizar documentação**

---

**🐍 SUCESSO**: Backend Python FastAPI está funcionando como alternativa robusta ao Node.js!
