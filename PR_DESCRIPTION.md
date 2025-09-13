# 🐳 Dockerize Backend + Configurable CATALOG_PATH

## 📋 Summary
This PR adds Docker support to the backend and fixes catalog persistence issues for containerized environments, preparing for DigitalOcean App Platform migration.

## 🔧 Changes Made

### New Files Added
- `backend/Dockerfile` - Node.js 18 Alpine container setup
- `backend/.dockerignore` - Optimized build context (excludes node_modules, .git)

### Code Updates
- **`backend/app.js`** - Updated paths to use `process.cwd()` and support `CATALOG_PATH` env var
  - Catalog loading/saving now uses configurable path
  - Upload storage paths use absolute paths for container compatibility
  - Maintains backward compatibility with existing deployments

### Workflow Cleanup
- Disabled problematic auto-trigger workflows during migration:
  - `deploy-complete.yml` → `.disabled`
  - `update-catalog.yml` → `.disabled` 
  - `deploy-backend-simple.yml` → `.disabled`
- Removed empty workflow files causing GitHub Actions failures

## 🧪 Testing Done

### Local Docker Testing
✅ **Build successful**: `docker build -t radio-backend:local ./backend`

✅ **Container runs**: Health endpoint responds at `/health`

✅ **Upload functionality**: File uploads work and persist to host volumes

✅ **Catalog persistence**: `public/data/catalog.json` updates correctly with `CATALOG_PATH`

### Test Commands Used
```bash
# Build image
docker build -t radio-backend:local ./backend

# Run with volume mounts
docker run --name radio-backend-local -p 8080:8080 \
  -v $(pwd)/public:/usr/src/public \
  -v $(pwd)/public/audio:/usr/src/app/public/audio \
  -e PORT=8080 \
  -e CATALOG_PATH=/usr/src/public/data/catalog.json \
  -d radio-backend:local

# Test endpoints
curl http://localhost:8080/health
curl http://localhost:8080/api/catalog
```

## 🎯 Next Steps (Post-Merge)

1. **Create DigitalOcean App** using this Dockerfile
2. **Configure DO environment variables**:
   - `PORT=8080`
   - `CATALOG_PATH=/app/public/data/catalog.json` (or use DO App Platform's persistent volume)
   - `NODE_ENV=production`
   - AWS credentials for S3 integration
3. **Update frontend** to point to new DO backend URL
4. **Create new DO-specific workflow** to replace disabled ones

## 🔒 Environment Variables Reference

For DigitalOcean App Platform:
```env
PORT=8080
NODE_ENV=production
CATALOG_PATH=/app/public/data/catalog.json
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-west-2
S3_BUCKET=radio-importantestudio-com
FRONTEND_URL=https://radio.importantestudio.com
```

## 📚 Documentation

Updated guides in `devFiles/`:
- `GUIA_PARTE_01_PREPARACAO.md` - Marked Docker steps completed
- `GUIA_PARTE_02_BACKEND.md` - Added Docker build/run instructions

## ⚠️ Breaking Changes
None - maintains full backward compatibility with existing AWS EB deployment.

## 🏷️ Related Issues
Addresses GitHub Actions failures and prepares infrastructure for DO migration as outlined in `PLANO_EXECUCAO.md`.

---

## ✅ Checklist para revisão (colar no corpo do PR)

- [ ] Revisar diff e arquivos modificados
  - Verificar: `backend/Dockerfile`, `backend/.dockerignore`, `backend/app.js`

- [ ] Testar build local Docker
  - Build: `docker build -t radio-backend:local ./backend`
  - Run (recomendo copiar/colar):

    docker run --name radio-backend-local -p 8080:8080 \
      -v $(pwd)/public:/usr/src/public \
      -v $(pwd)/public/audio:/usr/src/app/public/audio \
      -e PORT=8080 \
      -e CATALOG_PATH=/usr/src/public/data/catalog.json \
      -d radio-backend:local

  - Verificar: `curl http://localhost:8080/health` e `curl http://localhost:8080/api/catalog`

- [ ] Teste de upload e persistência
  - Upload de teste: `curl -F "audioFiles=@/caminho/para/test.mp3" http://localhost:8080/api/upload`
  - Confirmar arquivo em `public/audio` e `public/data/catalog.json` atualizado

- [ ] Validar configuração de catálogo em container
  - Confirmar `CATALOG_PATH` usado corretamente ou instruções de mount documentadas

- [ ] Confirmar workflow/CI
  - Confirmar arquivos desabilitados: `.github/workflows/deploy-complete.yml.disabled`, `.github/workflows/update-catalog.yml.disabled`, `.github/workflows/deploy-backend-simple.yml.disabled`
  - Confirmar remoção de arquivos vazios que causavam falha

- [ ] PR metadata
  - Reviewers: atribuir 1–2 pessoas
  - Labels: `infra`, `docker`
  - Merge strategy: `Squash and merge`

- [ ] Pós-merge (executar imediatamente)
  - Criar DigitalOcean App usando `backend/Dockerfile`
  - Definir env vars em DO: `PORT`, `NODE_ENV`, `CATALOG_PATH`, AWS keys (se necessário)
  - Testar integração frontend ↔ backend (atualizar endpoint)
  - Criar novo workflow GitHub Actions específico para DO e reativar/limpar workflows antigos
