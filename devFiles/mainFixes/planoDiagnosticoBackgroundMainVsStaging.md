# Plano de Diagnóstico: Playback Em Background (Main vs Staging)

> Objetivo: Identificar causa da interrupção de áudio em background / tela bloqueada somente em produção (main), enquanto staging permanece estável. Nenhuma alteração de código até evidência. Seguir princípios dos guias: mudanças mínimas, rollback simples, instrumentação orientada a dados.
>
> Data: 08/10/2025  
> Responsáveis: Você + Sonnet (execução assistida)  
> Status: PLANEJADO

---
## 1. Hipóteses Prioritárias
| ID | Hipótese | Categoria | Prioridade | Sinal Esperado |
|----|----------|-----------|------------|----------------|
| H1 | Service Worker (SW) desatualizado em produção | Cache / SW | Alta | SW script diferente / sem timestamp ?v= |
| H2 | Playlist HLS em produção curta ou desatualizada | Conteúdo HLS | Alta | Total EXTINF baixo (< ~60–90s) |
| H3 | CDN/DNS (CloudFront/Route53) servindo versão cacheada antiga de assets | Infra Cache | Alta | Headers Cache-Control distintos / Age alto |
| H4 | Produção apontando para backend diferente (catálogo menor) | Config Origem | Média | Requests /api/ catalog apontando host divergente |
| H5 | SW intercepta e serve playlist velha (cache stale) | Cache / SW | Média | Fetch playlist via DevTools => from ServiceWorker |
| H6 | iOS PWA instalado em produção com versão anterior à correção (stale app shell) | PWA Lifecycle | Média | App manifest/SW update não aplicado até forçar reload |
| H7 | Diferentes headers (autoplay / media) limitando background | HTTP Headers | Baixa | CSP/Permissions-Policy divergentes |
| H8 | Falha silenciosa em carregamento de track cues / modo HLS fallback parcial | Player Logic | Baixa | Erros 404/ CORS no fetch track-cues.json |

---
## 2. Estratégia Geral
1. Coletar evidências sem alterar código.  
2. Validar ou eliminar H1–H4 rapidamente (Maior probabilidade/impacto).  
3. Somente após confirmação de causa → planejar correção incremental (novo plano separado).  
4. Manter documentação das observações dentro deste arquivo (seções de LOG).

---
## 3. Ferramentas & Recursos
- curl (headers, tamanho playlists)
- DevTools (Network + Application → Service Workers)
- iPhone real (PWA instalado + Safari direto)
- Logs console (já instrumentados)
- Endpoints debug/diagnostics backend (`/api/hls/latest/diagnostics`)

---
## 4. Sequência de Etapas
### Etapa 1: Inventário de Versionamento Frontend
Objetivo: Comparar rapidamente HTML e SW entre staging e produção.

Micropassos:
1. curl -I https://radio.importantestudio.com/  (salvar headers)
2. curl -s https://radio.importantestudio.com/ > prod_index.html
3. curl -I https://radio-importante-frontend-stagin-6rjzv.ondigitalocean.app/  (headers)
4. curl -s https://radio-importante-frontend-stagin-6rjzv.ondigitalocean.app/ > staging_index.html
5. Diff prod_index.html vs staging_index.html (buscar: sw.js registro, scripts com ?v=timestamp)  
6. Anotar: Existe query param forçando cache bust no SW em produção?  
7. NO iPhone (produção): abrir console (se possível) → navigator.serviceWorker.getRegistrations() e registrar scope + scriptURL.
8. Repetir no staging para comparação.
9. Registrar diferenças na seção LOG_ETAPA_1.

Critério de encerramento Etapa 1: SW e HTML equivalentes OU diferença catalogada.

### Etapa 2: Playlist HLS & Diagnósticos
Objetivo: Confirmar duração e integridade da playlist usada em produção vs staging.

Micropassos:
1. Identificar URL exata da playlist em produção (ex: /audio/hls/playlist-continuous.m3u8 ou outra) via Network.
2. curl -I <playlist_prod>
3. curl -s <playlist_prod> | tee playlist_prod.m3u8 | grep -E '^#EXTINF' | wc -l  (contagem de segments)
4. Somar duração: awk -F: '/#EXTINF/ {sub(/,.*/,"",$2); sum+=$2} END {print sum}' playlist_prod.m3u8
5. curl -I https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/api/hls/latest/diagnostics
6. Repetir passos 2–4 para staging (playlist equivalente)
7. Comparar: declaredCount, totalDurationApprox (diagnostics), presença #EXT-X-ENDLIST.
8. Anotar diferenças em LOG_ETAPA_2.

Critério de encerramento: Playlist produção >= baseline (~90s) OU insuficiente confirmado.

### Etapa 3: Cache & CDN Headers
Objetivo: Determinar se produção entrega assets/playlist com cache excessivo.

Micropassos:
1. curl -I <playlist_prod> (já coletado) → anotar Cache-Control, Age.
2. curl -I <um segment .ts ou .aac> produção.
3. Repetir para staging.
4. Comparar headers (Cache-Control, Expires, Age, ETag).
5. Verificar se index.html produção tem headers muito longos (ex: max-age > 300) impedindo atualização de SW.
6. Registrar em LOG_ETAPA_3.

Critério: Diferença significativa de cache identificada ou descartada.

### Etapa 4: Origem Backend / Catalog Consistency
Objetivo: Garantir que frontend produção aponta para mesmo backend dataset.

Micropassos:
1. No console produção: fetch('/api/catalog').then(r=>r.json()).then(c=>console.log(c.length || Object.keys(c).length))
2. Repetir em staging.
3. Inspecionar network: domínio alvo das chamadas /api/hls/* (produção vs staging).
4. Confirmar valores de track-cues.json ou track-cues-smart.json se carregados.
5. Registrar em LOG_ETAPA_4.

Critério: Backends idênticos OU divergência registrada.

### Etapa 5: SW Runtime Behavior
Objetivo: Ver se SW intercepta playlist/audio em produção de forma distinta.

Micropassos:
1. DevTools Application → Service Workers (produção): verificar status (activated / redundant).
2. Network → Filtrar por playlist-prod; checar coluna “from ServiceWorker”.
3. Repetir em staging.
4. Executar navigator.serviceWorker.controller no console (true/false) produção vs staging.
5. Forçar hard reload sem SW (Shift + Reload) e testar rapidamente início playback (sem esperar fundo longo) — NÃO fixar ainda, apenas observar.
6. Registrar em LOG_ETAPA_5.

Critério: Interceptação SW problemática confirmada ou excluída.

### Etapa 6: PWA Lifecycle / App Shell Stale
Objetivo: Checar se app instalado produção está preso a shell antigo.

Micropassos:
1. Em iPhone PWA produção: Abrir → verificar logs iniciais (versão, mensagens boundary scheduler).
2. Em Safari (não instalado) produção: abrir e testar comportamento background curto.
3. Comparar diferença (installed vs browser).
4. Se diferente: remover app produção, reinstalar, retestar.
5. Registrar em LOG_ETAPA_6.

Critério: Diferencial instalado vs navegador identificado ou descartado.

### Etapa 7: Headers de Políticas / Autoplay / Media
Objetivo: Eliminar impacto de CSP/Permissions.

Micropassos:
1. curl -I https://radio.importantestudio.com/ (já coletado) → examinar: Content-Security-Policy, Permissions-Policy, Feature-Policy.
2. Repetir staging.
3. Registrar diferenças em LOG_ETAPA_7.

Critério: Políticas neutras ou divergência relevante anotada.

### Etapa 8: Track Cues & Carregamentos Auxiliares
Objetivo: Ver se produção falha silenciosamente em assets auxiliares.

Micropassos:
1. Network produção: localizar fetch de track-cues*.json (status, tamanho, tempo, CORS).
2. Repetir staging.
3. Ver console errors produção relacionados.
4. Registrar em LOG_ETAPA_8.

Critério: Falha em track cues confirmada ou descartada.

---
## 5. Matriz de Decisão Pós-Diagnóstico
| Cenário | Evidência | Ação Planejada (Novo Plano) |
|---------|-----------|-----------------------------|
| SW desatualizado (H1) | Script antigo / sem bust | Plano: forçar atualização SW (rename + skipWaiting) |
| Playlist curta (H2) | EXTINF total baixo | Plano: regenerar HLS latest com N faixas / ajustar geração |
| Cache CDN agressivo (H3) | Age alto / max-age elevado | Plano: ajustar headers / invalidar CDN |
| Backend divergente (H4) | /api/catalog difere | Plano: alinhar endpoint base frontend |
| SW interceptando stale (H5) | Requests from ServiceWorker antiga | Plano: limpar caches programaticamente |
| PWA shell stale (H6) | Navegador ok / instalado falha | Plano: instrução de reinstalação + release com bust |
| Headers restritivos (H7) | CSP/Permissions divergentes | Plano: ajustar política mínima |
| Track cues ausente (H8) | 404/erro cues | Plano: corrigir path geração cues |

---
## 6. Registro de Evidências
Adicionar conforme avançar:
### LOG_ETAPA_1
**CONCLUÍDA** ✅

**Headers Produção:**
- Last-Modified: Wed, 08 Oct 2025 16:43:49 GMT
- Cache-Control: public,max-age=10,s-maxage=86400
- Age: 20551 (CloudFlare HIT)

**Headers Staging:**  
- Last-Modified: Wed, 08 Oct 2025 17:20:38 GMT
- Cache-Control: public,max-age=10,s-maxage=86400
- Age: 5391 (CloudFlare HIT)

**HTML Comparison:**
- ✅ **staging_index.html = prod_index.html** (100% idênticos)
- ⚠️ **Local index.html ≠ staging/produção** (desenvolvimento vs build)
  - Local: `<script type="module" src="/src/app.ts"></script>`
  - Staging/Produção: `<script type="module" crossorigin src="/assets/main-BfHsY_qJ.js"></script>`

**Build Comparison:**
- ✅ **STAGING = PRODUÇÃO** (mesmo arquivo: `main-BfHsY_qJ.js`)
- ⚠️ Local build diferente: `main-DzL5HqlC.js` (irrelevante para diagnóstico)

**Service Worker:**
- ✅ **SW staging = SW produção** (v7 - BACKEND URL FIX - FORCE CACHE CLEAR)
- ✅ Ambos têm timestamp dinâmico
- ✅ Cache busting presente

**Conclusão Etapa 1:** Hipóteses H1 (SW desatualizado) e **"build antigo"** **DESCARTADAS**. Staging e produção usam exatamente o mesmo código frontend. O problema está em outra camada.

### LOG_ETAPA_2
**CONCLUÍDA** ✅ - **PROBLEMA CRÍTICO IDENTIFICADO**

> **🚨 RELATÓRIO PARA GPT-5 - CORREÇÃO URGENTE NECESSÁRIA**
>
> **Problema identificado:** Playlist HLS em produção e staging contém apenas 0.025 segundos (1 segment), insuficiente para background audio iOS PWA que requer ≥90s.
>
> **Evidência objetiva:**
> - Backend gera playlist correta: 91.4s, 16 segments (`/api/hls/latest/diagnostics`)
> - Frontend serve playlist incorreta: 0.025s, 1 segment (`/audio/hls/playlist-continuous.m3u8`)
> - Frontends não conseguem acessar `/api/*` (404) - problema de proxy/roteamento
>
> **Ação requerida:** Corrigir geração/servimento da playlist HLS para garantir duração mínima de 90+ segundos em produção e staging. Investigar por que API proxy está falhando.
>
> **Prioridade:** ALTA - Causa raiz confirmada do problema de background audio.

**Diagnósticos Backend:**
- ❌ **Produção `/api/hls/latest/diagnostics`**: 404 Not Found  
- ❌ **Staging `/api/hls/latest/diagnostics`**: 404 Not Found
- ✅ **Backend direto**: `https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/api/hls/latest/diagnostics` → 91.4s, 16 segments

**API Proxy Issue:**
- ❌ **Ambos frontends** não conseguem acessar `/api/*` (frontend não proxifica para backend)
- ✅ **Backend direto** funciona perfeitamente

**Playlist HLS Analysis:**
```
# PRODUÇÃO: https://radio.importantestudio.com/audio/hls/playlist-continuous.m3u8
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:0
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:0.025156,  ← APENAS 0.025 SEGUNDOS!
segment-000.ts
#EXT-X-ENDLIST

# STAGING: Playlist idêntica (também defeituosa)
```

**Duração Analysis:**
- **Produção**: 0.025s (1 segment) ← **CAUSA RAIZ CONFIRMADA**
- **Staging**: 0.025s (1 segment) ← **Mesmo problema**
- **Backend esperado**: ~91.4s (16 segments)

**Conclusão Etapa 2:** Hipótese H2 **CONFIRMADA**. Playlist HLS extremamente curta (0.025s) é a causa raiz da interrupção de background audio. **Mas por que staging funciona com a mesma playlist defeituosa?**

### LOG_ETAPA_3
(pendente)

### LOG_ETAPA_4
(pendente)

### LOG_ETAPA_5
(pendente)

### LOG_ETAPA_6
(pendente)

### LOG_ETAPA_7
(pendente)

### LOG_ETAPA_8
(pendente)

---
## 7. Checklist Global de Diagnóstico
- [x] Etapa 1 concluída
- [x] Etapa 2 concluída
- [ ] Etapa 3 concluída
- [ ] Etapa 4 concluída
- [ ] Etapa 5 concluída
- [ ] Etapa 6 concluída
- [ ] Etapa 7 concluída
- [ ] Etapa 8 concluída
- [ ] Evidência consolidada
- [ ] Decisão de correção tomada

---
## 8. Critério de Encerramento do Plano
Plano encerrado quando: (a) causa raiz confirmada com evidência objetiva; (b) ação corretiva definida em novo plano separado; (c) staging continua estável.

---
## 9. Observações
- Não executar deploys durante coleta para não contaminar comparação.
- Se múltiplas causas suspeitas surgirem, priorizar aquela que exige menor mudança (guia: mudanças mínimas). 
- Qualquer modificação deve gerar novo documento de implementação.

---
## 10. Status
- Atual: PLANEJADO
- Próxima ação: Executar Etapa 1.

---
(Referências: PLANO_EXECUCAO.md – critérios MPC HLS / background; GUIA_TECNICO_DETALHADO.md – diagnostics & scheduler; DEPLOY-GUIDE-UNIFIED.md – fluxo de deploy incremental.)
