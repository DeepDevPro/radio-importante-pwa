# Plano de Criação: Backend Staging Dedicado (radio-importante-backend-staging)

> Objetivo: Criar um novo App no DigitalOcean Apps somente para o backend de staging (`radio-importante-backend-staging`), mantendo o backend atual (`radio-importante-pwa-backend`) exclusivamente para produção.
> Benefícios: elimina risco de afetar produção durante experimentos no backend; possibilita testes seguros do plano iOS PWA → MP3 contínuo.

---
## 0) Contexto e Pré-requisitos
- Repositório: DeepDevPro/radio-importante-pwa
- Pastas relevantes:
  - Backend: `backend/**`
  - Frontends: `src/**` (deploys separados em Staging e Produção)
- Apps atuais (produção):
  - Backend Prod (existente): `radio-importante-pwa-backend`
    - URL: https://radio-importante-pwa-backend-skg2w.ondigitalocean.app
  - Frontend Prod: https://radio.importantestudio.com
  - Frontend Staging: https://radio-importante-frontend-stagin-6rjzv.ondigitalocean.app
- Storage: DigitalOcean Spaces — bucket `radio-importante-audio`
- Variáveis/Secrets necessárias no backend (ver também `DEPLOY-GUIDE-UNIFIED.md`):
  ```
  NODE_ENV=production
  DO_SPACES_KEY=<chave>
  DO_SPACES_SECRET=<segredo>
  DO_SPACES_ENDPOINT=atl1.digitaloceanspaces.com
  DO_SPACES_REGION=nyc3
  DO_SPACES_BUCKET=radio-importante-audio
  ```

Observações:
- O novo backend de staging terá URL gerada pelo DO. Após criação, substituir [PREENCHER_URL_BACKEND_STAGING] abaixo.
- CORS/Headers do Spaces devem incluir o novo backend como Origin permitido, quando necessário.

### 0.1) Chaves e Privilégios (Spaces) para Staging
Objetivo: Isolar credenciais do Spaces para staging, aplicando princípio do mínimo privilégio.

Micropassos:
- [ ] Criar um novo par de Access Keys (Spaces) exclusivo para staging.
  - DO Console → API → Spaces Access Keys → Generate New Key
  - Nome: `radio-importante-staging`
- [ ] Escopo/Privilégios:
  - Se sua conta DO suportar escopo granular: restringir ao bucket `radio-importante-audio` e, se possível, ao prefixo desejado (ex.: `staging/` ou `continuous/`).
  - Se não houver escopo granular: usar chaves distintas e implementar restrição por prefixo NO BACKEND (validação de path antes de PUT/DELETE), não expondo as chaves no frontend.
- [ ] Armazenar as chaves no App de STAGING apenas, usando os MESMOS nomes de vars do prod (facilita código):
  - `DO_SPACES_KEY` = <key id de staging>
  - `DO_SPACES_SECRET` = <secret de staging>
  - Demais vars (endpoint/region/bucket) iguais às de produção
- [ ] Guardas no backend (aplicação):
  - Validar que qualquer upload/alteração só opera sob um prefixo permitido (ex.: `continuous/` ou `staging/`).
  - Bloquear tentativas fora do prefixo (retornar 403 + log).
- [ ] CORS no Spaces: incluir `[PREENCHER_URL_BACKEND_STAGING]` em AllowedOrigins (se acessos diretos com CORS forem necessários) e manter origens existentes.
- [ ] Testar: upload/list/HEAD/Range via backend de staging; tentar operação fora do prefixo permitido e validar bloqueio.

---
## 1) Arquitetura Alvo (alto nível)
- Frontend Staging → Backend Staging (novo: `radio-importante-backend-staging`)
- Frontend Produção → Backend Produção (existente: `radio-importante-pwa-backend`)
- Ambos consomem o mesmo Spaces (leitura), com CORS ajustado por origem.

---
## 2) Criação do App no DigitalOcean (Backend Staging)
Micropassos (UI DO Apps):
- [ ] Create App → GitHub → Selecione `DeepDevPro/radio-importante-pwa`
- [ ] Component: Web Service
  - Name: `radio-importante-backend-staging`
  - Source: branch `staging`
  - Root directory: `backend/`
  - Build (auto): Node.js (auto-detect)
  - Run command: auto (npm start) — ajuste se o backend exigir algo específico
- [ ] Resources: escolha o plano mínimo adequado (mesmo do prod ou menor, conforme carga)
- [ ] Environment Variables: adicionar os vars/secrets listados em “0) Contexto”
  - Usar as NOVAS chaves do Spaces criadas para staging
- [ ] Create & Deploy
- [ ] Copiar a URL gerada pelo DO: [PREENCHER_URL_BACKEND_STAGING]

Validações:
- [ ] Abrir `[PREENCHER_URL_BACKEND_STAGING]/health` → 200 OK
- [ ] Ver logs no painel do App (sem erros críticos)

---
## 3) CORS e Integrações (Backend + Spaces)
Backend Staging:
- [ ] Garantir que o backend responda CORS para o frontend de staging:
  - Origin permitido: `https://radio-importante-frontend-stagin-6rjzv.ondigitalocean.app`
  - (Opcional) Permitir também o domínio prod para testes cruzados, se necessário
- [ ] Se o backend faz proxy para o Spaces, confirmar pass-through de headers: `Accept-Ranges`, `Content-Length`, `Content-Range`, `ETag`
- [ ] Aplicar validação de prefixo em writes (aplicação) conforme 0.1.

Spaces (CORS):
- [ ] Incluir `[PREENCHER_URL_BACKEND_STAGING]` como AllowedOrigin (se o backend ou browser acessarem direto com CORS)
- [ ] Manter origens existentes (frontend prod e staging, backend prod)
- [ ] Validar HEAD/GET (Range) direto no Spaces e via backend staging

Validações:
- [ ] `curl -I [PREENCHER_URL_BACKEND_STAGING]/audio/...` retorna headers esperados
- [ ] `curl -I https://radio-importante-audio.atl1.digitaloceanspaces.com/...` com Origin do novo backend/FE retorna CORS adequado

---
## 4) Workflows de Deploy (GitHub Actions)
Objetivo: separar deploys do backend por ambiente.

Micropassos:
- [ ] Criar novo workflow: `.github/workflows/deploy-backend-staging.yml`
  - Trigger: push na branch `staging` com alterações em `backend/**`
  - Ação: deploy no App `radio-importante-backend-staging`
- [ ] Ajustar/confirmar workflow de produção: `.github/workflows/deploy-backend-prod.yml` (ou renomear o atual unificado)
  - Trigger: push na branch `main` com alterações em `backend/**`
  - Ação: deploy no App `radio-importante-pwa-backend`
- [ ] Desabilitar/remover workflow unificado antigo para evitar deploy cruzado
- [ ] Garantir que `DIGITALOCEAN_ACCESS_TOKEN` está configurado nos secrets do repositório

Validações:
- [ ] Commit de teste em `staging` (somente arquivo no `backend/`) dispara deploy do staging
- [ ] Commit em `main` (com mudanças no `backend/`) dispara deploy do prod

Observação:
- Dependendo da action usada, pode ser necessário fornecer `app_id`/`spec`/`doctl` com `DIGITALOCEAN_ACCESS_TOKEN`.

---
## 5) Atualizar Frontend Staging para usar o Novo Backend
Micropassos:
- [ ] Localizar onde a base URL do backend é definida e usada:
  - Fonte atual (source of truth): `src/config/api.ts` (linhas próximas a 27–28)
  - Referências hardcoded a substituir por uso centralizado:
    - `src/player/audio.ts` (~linha 177)
    - `src/admin.ts` (~linha 40)
    - `public/scripts/config.js` (linhas ~29–36)
    - `admin.html` (linhas ~507, ~601, ~733)
    - `public/debug.html` (diversos pontos)
- [ ] Etapa A — Padronizar uso de `src/config/api.ts`:
  - Exportar uma função única, ex.: `getApiBaseUrl()` de `src/config/api.ts`.
  - Refatorar os pontos hardcoded acima para importar/usar `getApiBaseUrl()` (quando em TS) ou ler de um atributo global gerado (quando em HTML/JS público).
  - Para arquivos HTML/JS em `public/` e `admin*.html`, expor a base URL em `window.__API_BASE__` gerado em build (ver Etapa B) ou incluir um pequeno script que injeta a URL a partir de `src/config/api.ts` no bundle.
- [ ] Etapa B — Migrar para ENV por ambiente (Vite):
  - Criar `.env.production` e `.env.staging` na raiz do projeto:
    - `.env.production`: `VITE_API_BASE_URL=https://radio-importante-pwa-backend-skg2w.ondigitalocean.app`
    - `.env.staging`: `VITE_API_BASE_URL=[PREENCHER_URL_BACKEND_STAGING]`
  - Ajustar `src/config/api.ts` para ler: `const base = import.meta.env.VITE_API_BASE_URL ?? fallbackAnterior;` e exportar `getApiBaseUrl()`.
  - Scripts no `package.json`:
    - `"build:staging": "vite build --mode staging"`
    - `"build:prod": "vite build --mode production"`
  - Deploy Staging (Github Action/DO Static Site): usar `npm run build:staging` para garantir que `.env.staging` é aplicado.
  - Deploy Produção: usar `npm run build:prod` (ou `npm run build` se já mapear pra production).
- [ ] Atualizar somente o frontend de staging para apontar para `[PREENCHER_URL_BACKEND_STAGING]` (via `.env.staging`).
- [ ] Build/deploy do frontend staging.

Validações:
- [ ] Abrir o app staging e verificar chamadas ao novo backend (Network)
- [ ] `/health` do novo backend OK a partir do staging
- [ ] Conferir que páginas HTML/JS que não passam por TS também utilizam a mesma base (via `window.__API_BASE__` ou fetch de uma config gerada em build)

---
## 5.1) Limpeza e Garantias Pós-Migração (Frontend)
- [ ] Confirmar que não há mais URLs hardcoded do backend em arquivos TS/JS/HTML (grep)
- [ ] Documentar que `src/config/api.ts` + ENV são a única fonte de verdade
- [ ] Adicionar teste rápido: falhar o build se `grep -R "radio-importante-pwa-backend-"` retornar ocorrências em `src/` e `public/` (opcional em CI)

---
## 6) Smoke Tests e Testes de Regressão
- [ ] Health: `[PREENCHER_URL_BACKEND_STAGING]/health` (com e sem header Origin dos frontends)
- [ ] HLS diagnostics (se aplicável): `[PREENCHER_URL_BACKEND_STAGING]/api/hls/latest/diagnostics`
- [ ] Rotas de proxy de áudio (se já existirem): HEAD e GET com `Range` → 206
- [ ] Confirmar que produção permanece íntegra:
  - `https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/health`
  - Frontend produção funcionando normalmente

---
## 7) Observabilidade e Logs
- [ ] Habilitar logs do App (DigitalOcean Apps) e revisar durante 24–48h após criação
- [ ] Adicionar logs moderados no backend de staging (se necessário) para endpoints novos
- [ ] Criar rotina curta de verificação manual (curl scripts) documentada em `DEPLOY-GUIDE-UNIFIED.md` (se desejar)

---
## 8) Rollback e Segurança
Rollback rápido:
- [ ] Desativar/pausar workflow `deploy-backend-staging.yml`
- [ ] Reverter commits problemáticos na branch `staging`
- [ ] Apontar frontend staging de volta para o backend de produção (temporariamente)
- [ ] Se necessário, destruir o App `radio-importante-backend-staging` (mantendo spec exportada)

Segurança/Boas práticas:
- [ ] Usar secrets distintos para staging (ou chaves Spaces com permissões mínimas)
- [ ] Restringir CORS às origens estritamente necessárias
- [ ] Desabilitar endpoints de debug sensíveis em staging público

---
## 9) Interação com o Plano iOS PWA → MP3 Contínuo
- [ ] Após o novo backend de staging estar no ar, executar as etapas do plano `plano-iospwa-mp3-continuo.md` sem risco à produção
- [ ] Validar rotas aditivas (`/audio/continuous/*`) no staging backend primeiro
- [ ] Somente depois de estabilizar, considerar promover mudanças para o backend de produção

---
## 10) Checklist Final
- [ ] App `radio-importante-backend-staging` criado e com URL definida → `[PREENCHER_URL_BACKEND_STAGING]`
- [ ] Variáveis de ambiente e secrets configurados (chaves de Spaces separadas para staging)
- [ ] Guardas de prefixo implementadas no backend de staging para writes
- [ ] CORS do backend e do Spaces ajustados (inclui novo backend)
- [ ] Workflows separados: staging → novo App; produção → App atual
- [ ] Frontend staging apontando ao novo backend (ENV `.env.staging` + `build:staging`)
- [ ] Testes de saúde, Range e diagnósticos OK
- [ ] Produção validada como inalterada
- [ ] Grep confirma ausência de URLs hardcoded do backend

---
## Anexos e Pedidos ao Usuário
- Preencher: `[PREENCHER_URL_BACKEND_STAGING]` após criação do App
- Confirmar: localização da base URL do backend no frontend staging para atualização (ver lista na seção 5)
- Confirmar: se deseja chaves Spaces com escopo granular (se suportado) ou apenas guardas por prefixo no backend
- Confirmar: se deseja domínio custom para o backend de staging (CNAME + TLS)

> Após concluir cada micropasso, marque o checkbox correspondente e prossiga. Em caso de incidentes, seguir a seção “8) Rollback e Segurança”.
