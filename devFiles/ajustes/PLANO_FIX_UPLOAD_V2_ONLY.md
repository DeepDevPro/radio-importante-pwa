# Plano: Corrigir erro "this.client.send is not a function" mantendo AWS SDK v2

Objetivo: resolver o erro de upload no backend sem alterar nada da UI (admin.html) e sem mexer em outras áreas. Escopo estritamente: dependências e configuração do storage S3 (DigitalOcean Spaces) compatíveis com aws-sdk v2.

ATENÇÃO PARA O EXECUTOR (Claude 4):
- NÃO altere arquivos do frontend nem admin.html.
- NÃO mude rotas, middlewares, nem lógica além do necessário para o upload.
- NÃO migre para AWS SDK v3 neste plano.
- Foque apenas em alinhar multer-s3 e configuração do S3 ao SDK v2.

## Fase 0 — Escopo e verificação
- Arquivos envolvidos: `backend/package.json`, `backend/storage-config.js`.
- Nada em `admin.html` ou demais pastas do frontend deve ser modificado.

## Fase 1 — Diagnóstico de versões (sem alterar nada)
1. Listar versões no backend:
   - Comandos (na pasta `backend/`):
     - `cat package.json | sed -n '1,120p'`
     - `npm ls aws-sdk multer-s3 | cat || true`
     - `grep -R "@aws-sdk/client-s3" -n package-lock.json || true`
2. O que confirmar:
   - `aws-sdk` está em v2.x (ex.: ^2.1692.0).
   - `multer-s3` está em 3.x (provável) e o lock traz `@aws-sdk/*` (SDK v3), indicando incompatibilidade com cliente v2.

Por quê: o erro ocorre porque alguma lib espera cliente v3 (com `.send`) enquanto passamos cliente v2 (`AWS.S3`).

### Resultado da Fase 1 — Diagnóstico executado em 2025-09-22
- backend/package.json confirma:
  - aws-sdk: ^2.1692.0
  - multer-s3: ^3.0.1
- npm ls (no diretório backend):
  - aws-sdk@2.1692.0
  - multer-s3@3.0.1
- package-lock.json contém referências a SDK v3:
  - @aws-sdk/client-s3 3.893.0
- Conclusão: incompatibilidade confirmada (multer-s3 3.x + cliente S3 v2). Seguir para Fase 2 fixando multer-s3 em 2.x.
- Versão do Node local: v22.12.0 (a versão do backend em staging/prod deve ser verificada no servidor conforme instruções deste plano).
- Status: aguardando autorização para executar Fase 2 em staging. Não alterar nada fora do escopo.

## Fase 2 — Alinhar dependências ao v2 (mudança mínima)
1. Fixar `multer-s3` em uma versão 2.x compatível com v2 (ex.: `2.10.0`).
   - Editar `backend/package.json`: setar `"multer-s3": "2.10.0"` (sem caret ^).
2. Reinstalar dependências somente no backend:
   - `rm -f package-lock.json` (opcional, se necessário)
   - `npm install`
3. Validar que `@aws-sdk/*` não aparece mais puxado por `multer-s3`:
   - `npm ls @aws-sdk/client-s3 | cat || true`

Por quê: `multer-s3@2.x` foi feito para `aws-sdk` v2 e não usa `.send` do v3.

### Status da Fase 2 — Concluída em 2025-09-22
- Alteração aplicada somente no backend: `multer-s3` fixado em `2.10.0`.
- Reinstalação feita apenas em `backend/`.
- `npm ls` confirma: `aws-sdk@2.1692.0` e `multer-s3@2.10.0`.
- `@aws-sdk/client-s3` (v3) não aparece mais na árvore do backend.
- Nenhuma mudança na UI/admin ou em outras áreas.
- **Commit e push executados**: commit `6fab52f` enviado para branch `staging`.
- **Aguardando redeploy**: DigitalOcean App deve detectar mudanças e fazer rebuild do backend.

### Status do Teste Inicial (antes do redeploy)
- Teste curl realizado em 2025-09-22 12:52:55 GMT
- Resultado: HTTP 400 com `{"success":false,"message":"this.client.send is not a function"}`
- Causa: backend de staging ainda com multer-s3 3.x (antes do redeploy)

### ✅ Status do Teste Pós-Deploy (SUCESSO!)
- Backend redeploy confirmado: timestamp 2025-09-22T13:01:59.494Z (uptime: 192s)
- Teste curl realizado em 2025-09-22 13:02:38 GMT
- **Resultado: HTTP 200 - SUCESSO!**
- Response: `{"success":true,"message":"1 arquivo(s) processado(s) com sucesso",...}`
- Arquivo enviado: `01_Damn_feat_Kinny.mp3` → `https://radio-importante-audio.atl1.digitaloceanspaces.com/audio/1758546157494-01_Damn_feat_Kinny.mp3`
- Catálogo atualizado com 1 track
- **Erro "this.client.send is not a function" RESOLVIDO!**

### ✅ Teste Final - Interface Admin (CONFIRMADO!)
- Upload testado via página admin do staging: **SUCESSO**
- Arquivos visíveis no painel DigitalOcean Spaces: **CONFIRMADO**
- Frontend totalmente funcional: **SIM**
- **CONCLUSÃO: UPLOAD PELO FRONTEND TOTALMENTE VIABILIZADO!**

---

## 🎯 RESULTADO FINAL: MISSÃO CUMPRIDA

**O que foi corrigido:**
- Erro "this.client.send is not a function" eliminado
- Upload funciona via curl: ✅
- Upload funciona via admin UI: ✅
- Arquivos chegam no Spaces: ✅
- Duration calculation restaurado: ✅ (commit 1067f3e)

**O que foi preservado:**
- Admin UI intacta (nenhuma alteração estrutural)
- Lógica de rotas mantida
- Apenas backend/package.json + src/admin.ts modificados

**Atualizações posteriores (28/09/2025):**
- ✅ Duration fix implementado e deployed
- ✅ Branch structure organizada (staging stable, feature/ux-improvements-v2.4 active)
- 🔄 Próximas melhorias de UX planejadas
- Lógica de rotas mantida
- Apenas backend/package.json alterado

**Resumo técnico:**
- multer-s3 downgrade: 3.0.1 → 2.10.0
- Compatibilidade AWS SDK v2 restaurada
- @aws-sdk v3 removido da cadeia de dependências

## ~~Fase 3 — Revisar configuração S3 v2 (sem reestruturar~~ código)
1. Em `backend/storage-config.js`, confirmar:
   - `const AWS = require('aws-sdk');`
   - `const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT)` (ex.: `atl1.digitaloceanspaces.com`).
   - Cliente v2 com opções explícitas:
     ```js
     const s3 = new AWS.S3({
       endpoint: spacesEndpoint,
       accessKeyId: process.env.DO_SPACES_KEY,
       secretAccessKey: process.env.DO_SPACES_SECRET,
       region: process.env.DO_SPACES_REGION || 'atl1',
       signatureVersion: 'v4',
       s3ForcePathStyle: false
     });
     ```
   - `multerS3({ s3, bucket, acl: 'public-read', contentType: multerS3.AUTO_CONTENT_TYPE, key(...) })`.
2. Não mudar a lógica de rotas ou UI. Apenas garantir essas opções se estiverem ausentes.

Por quê: DigitalOcean Spaces usa assinatura v4 e virtual-hosted style; ser explícito evita ambiguidades.

## Fase 4 — Sanity check de runtime (não intrusivo)
1. (Opcional) Log curto durante diagnóstico:
   - `console.log('S3 v2 methods:', typeof s3.upload, typeof s3.send); // deve ser 'function' e 'undefined'`
2. Manter os logs já existentes do middleware `flexibleUpload`.

Por quê: confirma que o cliente em uso é v2, antes de testar upload.

## Fase 5 — Teste controlado em staging (Passo a passo detalhado)
1) Identificar a URL do backend de staging
   - Use o domínio/endpoint do seu backend (Elastic Beanstalk, EC2, Docker, etc.). Ex.: `https://SEU-BACKEND-STAGING/api`.
   - Verifique saúde primeiro:
     - Navegue até `https://SEU-BACKEND-STAGING/health` e confirme `{"status":"healthy"...}`.

2) Testar upload via Postman (sem tocar na UI)
   - Método: POST
   - URL: `https://SEU-BACKEND-STAGING/api/upload`
   - Body: `form-data`
     - Adicione uma chave chamada `audioFiles` com tipo `File` e selecione 1 arquivo `.mp3` pequeno (ex.: < 1MB).
     - Para enviar múltiplos, adicione mais linhas `audioFiles` (mesmo nome de campo) com outros arquivos.
   - Headers: não defina manualmente `Content-Type`; deixe o Postman gerar o boundary automaticamente.
   - Envie e observe a resposta:
     - Esperado: status 201/200/207, `success: true`, lista `tracks`/`uploaded`, e sem mensagem "this.client.send".
   - Se houver erro 400/500: copie a resposta e colete logs do backend.

3) Testar upload via curl (macOS zsh)
   - Teste 1 arquivo:
     - `curl -i -X POST "https://SEU-BACKEND-STAGING/api/upload" \
       -H "Accept: application/json" \
       -F "audioFiles=@/caminho/para/arquivo1.mp3"`
   - Teste múltiplos arquivos:
     - `curl -i -X POST "https://SEU-BACKEND-STAGING/api/upload" \
       -H "Accept: application/json" \
       -F "audioFiles=@/caminho/para/arquivo1.mp3" \
       -F "audioFiles=@/caminho/para/arquivo2.mp3"`
   - Dicas:
     - Não adicione `-H "Content-Type: multipart/form-data"` manualmente; deixe o curl gerar o boundary.
     - Use `-v` para modo verboso se precisar diagnosticar headers: `curl -v ...`.
   - Resultado esperado:
     - Status 201/200/207 com JSON de sucesso e nomes/URLs dos arquivos (ex.: `location`/`url`).

4) Validar no backend (logs)
   - Logs devem mostrar:
     - `✅ [flexibleUpload] Sucesso com campo "audioFiles" (...)`.
     - `📥 [upload] Arquivos recebidos: N` e lista de `originalname`, `size`, `mimetype`.
   - Ausência total de `this.client.send is not a function`.

5) Verificações finais rápidas
   - Acessar a URL pública retornada (ex.: `https://bucket.endpoint/audio/arquivo.mp3`).
   - Confirmar presença do arquivo no Spaces (via painel da DO).
   - Checar se o catálogo retornado na resposta contém as novas faixas.

6) Em caso de falha
   - Registrar: status HTTP, corpo da resposta, e o trecho de log do backend.
   - Não alterar nada no frontend/admin.
   - Voltar a este plano para o "Fase 7 — Rollback".

## Fase 6 — Verificações finais
1. Confirmar arquivo no Spaces (bucket/prefixo `audio/`) e URL pública acessível.
2. Confirmar atualização do catálogo na resposta e no storage (se aplicável).

## Fase 7 — Plano de rollback (se persistir o erro)
1. Reconfirmar que `multer-s3` está realmente em 2.x (às vezes o lock mantém 3.x).
2. Checar se outro caminho de upload usa v3 (não esperado no fluxo atual `app.js` + `storage-config.js`).
3. Em teste, baixar `aws-sdk` para uma release anterior 2.x estável e reinstalar; se funcionar, retornar à versão mais recente v2.

---

Perguntas de alinhamento respondidas:
1) Fixar `multer-s3` em 2.x: SIM.
2) Teste primeiro em staging: SIM.
3) Validar versões agora: SIM (listar sem alterações).
4) Versão do Node no backend: verificar rodando `node -v` no servidor, ou logar no start `process.version`, ou consultar painel do provedor (Elastic Beanstalk/Docker base image). Ex.: adicionar log não intrusivo no server start:
   ```js
   console.log('Node version:', process.version);
   ```
   Alternativas: `eb ssh` e `node -v`, ou ver Dockerfile/base image. Manter isso fora de commits se não desejar mudança de código.

Observação final: Não alterar nada no frontend/admin. Qualquer modificação fora do escopo deste plano deve ser recusada.
