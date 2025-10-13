# Plano de Criação: Dockerfile do Backend (ffmpeg) para Staging e Produção

> ObjetivoConfiguração no DigitalOcean App Platform (UI):
- [x] Abrir App Staging: `rd-importante-backend-staging`
- [x] Alterar App Spec para usar Dockerfile:
  - dockerfile_path: server/Dockerfile
  - source_dir: / (context completo)
  - Removido environment_slug (conflito com dockerfile_path)
- [x] ENV/Secrets confirmados:
  - `NODE_ENV=staging`
  - `DO_SPACES_KEY`, `DO_SPACES_SECRET`, `DO_SPACES_ENDPOINT=atl1.digitaloceanspaces.com`, `DO_SPACES_REGION=atl1`, `DO_SPACES_BUCKET=radio-importante-audio`
- [x] App Spec modificado com sucesso - Deploy iniciará automaticamente um Dockerfile simples e padronizado para o backend (pasta `server/`) com ffmpeg/ffprobe instalado, garantindo que o gerador do MP3 contínuo funcione no runtime (DigitalOcean App Platform) sem dependências externas.
> Benefícios: elimina erro “ffmpeg não encontrado”, padroniza build/run, reduz variação entre ambientes e facilita diagnósticos e rollback.

---
## 0) Contexto e Pré-requisitos
- Repositório: DeepDevPro/radio-importante-pwa
- Backend: `server/**` (Node 18+, Express)
- Runtime alvo: DigitalOcean App Platform
- Staging backend “oficial” (conforme guia unificado):
  - App: `rd-importante-backend-staging`
  - URL: https://rd-importante-backend-staging-cudbw.ondigitalocean.app
- Produção backend: https://radio-importante-pwa-backend-skg2w.ondigitalocean.app
- Dependências de runtime necessárias pelo gerador contínuo:
  - ffmpeg e ffprobe
- Variáveis/Secrets do Spaces (iguais às do guia unificado `DEPLOY-GUIDE-UNIFIED.md`):
  - `DO_SPACES_KEY`, `DO_SPACES_SECRET`, `DO_SPACES_ENDPOINT=atl1.digitaloceanspaces.com`, `DO_SPACES_REGION=atl1`, `DO_SPACES_BUCKET=radio-importante-audio`

Observações:
- O App Platform define `PORT` automaticamente; o servidor deve escutar `process.env.PORT`.
- Não faremos deploy automaticamente; Sonnet 4 executará os micropassos de deploy.

---
## 1) Arquitetura Alvo (alto nível)
- Uma imagem Docker única para o backend, construída a partir de `server/`:
  - Base: Node LTS slim (ex.: `node:18-bookworm-slim`)
  - Instalação via apt-get: `ffmpeg` (inclui ffprobe)
  - Usuário não-root (`node`) e `WORKDIR /app`
  - `npm ci --only=production` e `npm start`
  - Health Check HTTP em `/health`
- A mesma imagem serve Staging e Produção (configs via ENV/Secrets).

---
## 2) Dockerfile Padrão (simples e consagrado)
Exemplo de referência (será criado em `server/Dockerfile`):

```Dockerfile
# Base oficial Node LTS (slim) — amplamente usada em produção
FROM node:18-bookworm-slim

# Atualiza pacotes e instala ffmpeg (inclui ffprobe)
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

# Diretório de trabalho
WORKDIR /app

# Copia manifestos e instala dependências de produção
COPY package*.json ./
RUN npm ci --only=production

# Copia o código do backend (pasta server)
COPY . .

# Define ambiente de produção por padrão
ENV NODE_ENV=production

# Exponha a porta padrão (o App Platform injeta PORT)
EXPOSE 8080

# Comando de execução — deve honrar process.env.PORT internamente
CMD ["npm", "start"]
```

Complemento recomendado: `server/.dockerignore` para reduzir o contexto de build:

```gitignore
node_modules
npm-debug.log*
Dockerfile
.dockerignore
**/.DS_Store
**/*.log
**/temp-remote
```

---
## 3) Micropassos (Criação e Configuração)
- [x] Criar arquivo `server/Dockerfile` com o conteúdo de referência acima
- [x] Criar `server/.dockerignore` com entradas essenciais (node_modules, logs, temp)
- [x] Garantir que o backend já escuta `process.env.PORT` (rota `/health` ativa)
- [x] Commitar em `staging` (commit 92f7c23 - feat(backend): adicionar Dockerfile com ffmpeg)
- [x] Push para staging disparou deploy automático do backend conforme workflow

Configuração no DigitalOcean App Platform (UI):
- [ ] Abrir App Staging: `rd-importante-backend-staging`
- [ ] Alterar o componente para “Build & Run from Dockerfile”
  - Dockerfile path: `/server/Dockerfile`
  - HTTP Port: usar variável `PORT` (App Platform) — EXPOSE no Dockerfile é só documentação
  - Health Check: Path `/health`, Timeout padrão
- [ ] Confirmar ENV/Secrets:
  - `NODE_ENV=staging`
  - `DO_SPACES_KEY`, `DO_SPACES_SECRET`, `DO_SPACES_ENDPOINT=atl1.digitaloceanspaces.com`, `DO_SPACES_REGION=atl1`, `DO_SPACES_BUCKET=radio-importante-audio`
- [ ] Salvar e Deploy (executado pelo Sonnet 4)

Repetir para Produção (App: `radio-importante-pwa-backend-skg2w`):
- [ ] Habilitar build via Dockerfile com o mesmo path
- [ ] `NODE_ENV=production` e os mesmos secrets de Spaces (chaves de produção)
- [ ] Health check em `/health`

---
## 4) Teste Local Opcional (Pré-Deploy)
- [ ] Build local na raiz do repo:
  - `docker build -t radio-importante-backend:staging -f server/Dockerfile server`
- [ ] Run local (expondo porta e injetando ENV mínimos):
  - `docker run --rm -p 8080:8080 -e PORT=8080 -e NODE_ENV=staging radio-importante-backend:staging`
- [ ] Testes:
  - `curl http://localhost:8080/health`
  - `curl http://localhost:8080/api/continuous/status`
  - `curl -X POST http://localhost:8080/api/continuous/rebuild`

Observação: para testar uploads/list do Spaces localmente, injete as variáveis de ambiente do Spaces no `docker run`.

---
## 5) Workflows de Deploy (sem executar agora)
- [ ] Confirmar que o App Staging já está apontando para o Dockerfile (UI DO)
- [ ] Manter os workflows existentes do repositório (Guia Unificado) — sem mudanças obrigatórias
- [ ] Se necessário, documentar no README interno do backend que o App é “Dockerfile-based”
- [ ] Deploys continuarão sendo feitos sob demanda pelo Sonnet 4

---
## 6) Smoke Tests Pós-Deploy (Staging)
- [ ] `GET /health` → 200 OK
- [ ] `GET /api/continuous/status` → sem erro de “ffmpeg não encontrado”
- [ ] `POST /api/continuous/rebuild` → status passa a `running` e finaliza `success`
- [ ] Artefatos atualizados no Spaces:
  - `continuous/track-cues.json` (Cache-Control ~60s)
  - `continuous/radio-importante-continuous.mp3` (Cache-Control ~3600s)
- [ ] `GET /audio/continuous/track-cues.json` via backend proxy retorna 200 + JSON
- [ ] `GET /audio/continuous/radio-importante-continuous.mp3` com Range → 206

---
## 7) Segurança, Performance e Tamanho da Imagem
- [ ] Usar imagem `*-slim` e limpar `apt` lists para reduzir tamanho
- [ ] Rodar como usuário `node` (não-root) — opcional, caso `npm start` suporte
- [ ] `npm ci --only=production` (sem devDependencies)
- [ ] Fixar versão base (ex.: `node:18-bookworm-slim`) e atualizar conscientemente
- [ ] Manter logs moderados (sem ruído excessivo)

---
## 8) Rollback
- [ ] Reverter App Platform para “Source Code” (sem Dockerfile) se necessário
- [ ] Remover `server/Dockerfile` (se a causa for específica de container)
- [ ] Manter branch `staging` com commit anterior pronto para rollback

---
## 9) Checklist Final
- [ ] `server/Dockerfile` criado e commitado em `staging`
- [ ] `server/.dockerignore` criado
- [ ] App Staging configurado para Dockerfile `/server/Dockerfile`
- [ ] ENV/Secrets revisados (Spaces + NODE_ENV)
- [ ] Smoke tests OK no Staging
- [ ] Decisão sobre promoção para Produção

---
## 10) Anexos e Pedidos ao Usuário
- Confirmar se deseja rodar como usuário não-root (`USER node`) — default do Node image permite
- Confirmar se deseja adicionar `HEALTHCHECK` no Dockerfile (ex.: `curl -f http://localhost:$PORT/health || exit 1`)
- Validar se o backend sempre lê `process.env.PORT` (recomendado pelo DO App Platform)
- Após validar no Staging, aprovar promoção para Produção (Sonnet 4 executa)
