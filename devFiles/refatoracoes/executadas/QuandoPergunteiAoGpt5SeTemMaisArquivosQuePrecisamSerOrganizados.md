Sugestão de próximos alvos (prioridade alta → baixa):

1. app.js (feito)  
2. Variantes antigas no backend: app-production.js, `app-simple.js`, `app-ultra-minimal.js`, `app-debug.js`, etc.  
   - Ação: decidir quais ainda são usados; remover ou consolidar para evitar drift.  
3. Rotas ainda embutidas em app.js:  
   - Continuous / generate (`/api/generate-continuous`)  
   - Proxy áudio (`/audio/:filename`, continuous mp3/aac, track-cues)  
   - `verify-spaces` (endpoint temporário)  
   - Ação: extrair para `routes/continuous.routes.js`, `routes/audio.routes.js`, `routes/devtools.routes.js` (ou remover se só diagnóstico).  
4. Criar camada `services/`:  
   - `continuous.service.js`, `audioProxy.service.js`, depois mover lógica de sync catalog hoje em catalog.routes.js para `catalog.service.js`.  
5. `storage-config.js`: separar cliente Spaces/S3 em `utils/spacesClient.js` e helpers de path em `utils/paths.js`.  
6. Admin frontend gigante (HTML): arquivos como admin.html, admin-backup-original.html, admin-BACKUP-v2.html, etc.  
   - Ação: eleger 1 canonical (admin.html), mover lógica JS inline para src (ex: `src/admin/` com módulos: `apiClient.ts`, `catalogUI.ts`, `upload.ts`, `metadataEditor.ts`). Apagar backups obsoletos após confirmação.  
7. admin.ts e admin-simple.ts (provavelmente grandes)  
   - Ação: dividir em módulos + centralizar endpoints em api.ts.  
8. api.js: padronizar como `src/admin/apiClient.ts` e gerar build.  
9. Scripts de deploy redundantes: deploy-production.sh, deploy-auto.sh, build-production.sh, etc.  
   - Ação: unificar em um script parametrizado (`./scripts/deploy.sh --env staging|prod`).  
10. Documentos HTML de teste múltiplos (ex: test.html, test-integration.html, variantes admin corrompidas)  
    - Ação: arquivar em `legacy/` ou remover.  
11. Shell helpers sobre tags / rename / sanitize (ex: rename-files.sh, fix-and-setup-tags.sh)  
    - Ação: mover lógica repetida para um único script utilitário ou um pequeno CLI Node.  
12. Futuro: logs/HLS  
    - Extrair HLS (rolling + vod) quando entrar na fase de serviços: `hlsRolling.service.js`, `hlsVod.service.js`, `hlsStatus.service.js`.

Critérios usados: (a) risco de divergência, (b) impacto em manutenção, (c) facilidade de extração sem alterar contratos HTTP.

Sequência recomendada (incremental, baixo risco):
- Limpeza variantes app-* (2)
- Extrair rotas restantes (3)
- Introduzir `services/` para continuous + audio proxy (4)
- Refatorar storage (5)
- Consolidar admin UI (6–7)
- Unificar scripts (9)
- Remover HTML/testes legacy (10)

Se quiser começo já pela extração das rotas de áudio/continuous. É só pedir.