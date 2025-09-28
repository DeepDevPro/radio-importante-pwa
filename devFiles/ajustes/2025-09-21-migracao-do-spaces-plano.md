# Plano seguro de migração para DigitalOcean Spaces (sem quebrar o que já funciona)

Este plano segue os padrões e decisões registradas em `PLANO_EXECUCAO.md` e no guia técnico, preservando:
- Frontend em AWS S3 + CloudFront (inalterado)
- Backend no DigitalOcean App Platform (inalterado)
- Build com Vite (inalterado)
- Admin funcional e rotas atuais (inalterado)

Objetivo: alterar APENAS o local de armazenamento de arquivos do backend (DO App Platform) para o DigitalOcean Spaces, sem afetar pipeline, UI, nem endpoints existentes.


## Visão geral da estratégia
- Manter o backend em 1 instância (como definido) e substituir storage local por Spaces (S3‑compatible).
- Validar credenciais e endpoint do Spaces (chaves corretas e não PAT dop_v1).
- Garantir que o catálogo entregue URLs válidas do Spaces (sem depender de `/audio/*`).
- Ajustar somente o necessário no backend, de forma incremental e com rollback simples.


## Fase A — Validação de ambiente e credenciais (sem alterar código)
1) Verificar credenciais do Spaces
- Problema observado: DO_SPACES_KEY/DO_SPACES_SECRET usam token `dop_v1...` (Personal Access Token), que NÃO funciona para S3/Spaces.
- Ação: Gerar “Spaces access keys” (não PAT) em: DigitalOcean Dashboard → API → Spaces access keys → Generate New Key.
- Guardar com segurança o par `Access Key` e `Secret Key` (alfanuméricos, não começam com `dop_v1`).

2) Conferir variáveis no App Platform (componente do backend)
- Em App Platform → Seu app backend → Settings → Components → (service do backend) → Environment Variables:
  - DO_SPACES_ENDPOINT = atl1.digitaloceanspaces.com
  - DO_SPACES_REGION = atl1
  - DO_SPACES_BUCKET = radio-importante-audio
  - DO_SPACES_KEY = <Spaces Access Key>
  - DO_SPACES_SECRET = <Spaces Secret Key>
- Importante: garantir que estão no nível do componente do backend (não apenas App-Level se houver override por componente).
- Opcional: remover/ignorar `UPLOAD_PATH` para não confundir logs (só depois da migração validada).

3) CORS do bucket (para playback direto pelo navegador)
- Em Spaces → Bucket → Settings → CORS
- Sugerir política mínima:
```
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["Accept-Ranges", "Content-Range", "Content-Length", "Content-Type"],
    "MaxAgeSeconds": 3000
  }
]
```
- Observação: Upload é feito servidor→Spaces (SDK), portanto CORS não é necessário para o upload, apenas para o browser tocar o áudio direto do bucket.

4) Endpoint e naming
- Endpoint deve ser `https://<bucket>.<endpoint>/audio/<arquivo>`
- Região: `atl1` (mantém alinhado aos prints e docs atuais)


## Fase B — Verificações e ajustes de código planejados (sem aplicar agora)
1) Confirmar uso do storage do Spaces
- Arquivo `backend/storage-config.js` já usa `aws-sdk` v2 + `multer-s3` com:
  - endpoint = `process.env.DO_SPACES_ENDPOINT`
  - bucket = `process.env.DO_SPACES_BUCKET`
  - key = `audio/<timestamp>-<sanitized>`
  - contentType = `file.mimetype`

2) Melhorias de robustez (planejadas)
- Substituir `contentType: (req, file, cb) => cb(null, file.mimetype)` por `contentType: multerS3.AUTO_CONTENT_TYPE` (melhor detecção MIME).
- Validar tamanho e tipo de arquivo via Multer (limits / fileFilter) para prevenir uploads inválidos.
- Logar presença (não o valor) das envs críticas no startup do backend: `DO_SPACES_KEY set? yes/no`, idem para SECRET e BUCKET (sem vazar segredos).

3) Catálogo e URL das faixas
- Em `backend/app.js`, garantir que a resposta do catálogo usa `storageConfig.getFileUrl(key)` quando disponível, evitando montar URL `/audio/…` do próprio backend.
- Caso a UI ainda construa URLs locais, manter compatibilidade: se a entrada do catálogo já tiver `url` absoluta (Spaces), usá-la; senão, fallback.

4) Erros de ESLint no VSCode (planejado)
- Esses avisos são de linting/tipagem (ambiente de browser aplicado em arquivos Node). Planejar ajustes:
  - No `eslint.config.js`, adicionar um bloco para `files: ['backend/**/*.js']` com `env: { node: true }`, `sourceType: 'commonjs'` e `globals` de Node (`process`, `require`, `module`, `__dirname`, `console`).
  - Opcional: adicionar `@types/node` como devDependency e um `jsconfig.json`/`tsconfig.json` específico do backend.
  - Manter `/* eslint-env node */` no topo dos arquivos Node.
- Esses ajustes são apenas de DX (qualidade no editor); o runtime em produção já funciona sem eles.

5) SDK recomendado (futuro)
- aws-sdk v2 está em manutenção. Planejar migração para AWS SDK v3:
  - `@aws-sdk/client-s3` para operações (PutObject/DeleteObject)
  - Ajustar `multer` para usar `multer-s3-v3` ou fluxo manual de upload (stream → S3 v3)
  - Benefícios: pacotes modulares, menor superfície de ataque, suporte contínuo


## Fase C — Testes controlados em Staging (sem tocar frontend)
1) Deploy com as chaves do Spaces válidas
- Após setar as variáveis corretas (Spaces keys), fazer “Force Rebuild & Deploy” no App Platform.
- Conferir nos Runtime Logs:
  - `🌊 Using Digital Ocean Spaces: <bucket>.<endpoint>`
  - Ausência de `📁 Upload path: ...`

2) Testar upload pelo Admin
- Enviar 1–2 MP3 pequenos.
- Verificar nos logs se `multer-s3` escreveu no bucket (sem erros).
- Abrir a URL pública do arquivo direto no Spaces (200 OK esperado e `Content-Type: audio/mpeg`).

3) Testar catálogo e playback
- Verificar se a UI recebe URLs absolutas do Spaces (ou toca via URL local se mantido fallback temporário).
- Tocar as faixas no player, observando o console do navegador (sem CORS errors).

4) Teste de persistência
- Fazer novo “Force Rebuild & Deploy” do backend.
- Confirmar que os arquivos permanecem (não somem) — persistência confirmada.


## Fase D — Observabilidade e rollback (planejados)
1) Observabilidade
- Adicionar logs claros de inicialização indicando presença das envs (sem valores) e o tipo de storage ativo.
- Em caso de erro do S3 (credenciais, permissão, endpoint), retornar 500 com mensagem clara nos endpoints de upload.

2) Rollback simples
- Se o upload falhar após a migração, voltar temporariamente para storage local (variável de feature flag ou branch de rollback), mantendo 1 instância (conforme decisão em `PLANO_EXECUCAO.md`).


## Checklist resumido
- [ ] Gerar Spaces access keys (não `dop_v1`)
- [ ] Configurar envs no componente do backend (KEY, SECRET, BUCKET, ENDPOINT, REGION)
- [ ] Ajustar CORS no bucket para GET/HEAD
- [ ] Force Rebuild & Deploy
- [ ] Teste de upload (Admin) → Arquivo no bucket
- [ ] Catálogo/Playback → URL do Spaces
- [ ] Rebuild de verificação → Persistência confirmada
- [ ] (Opcional) Ajustar ESLint/Node env
- [ ] (Futuro) Migrar para AWS SDK v3


## Notas finais
- Este plano não altera pipeline de frontend nem configurações AWS do site estático (S3/CloudFront) descritas em `PLANO_EXECUCAO.md`.
- Mantém o backend no DO App Platform como hoje, trocando apenas o meio de armazenamento.
- Toda mudança de código proposta está planejada e pode ser aplicada em PRs pequenos e reversíveis.
