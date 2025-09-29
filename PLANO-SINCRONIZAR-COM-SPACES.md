# ✅ Plano Simples e Funcional – Botão "Sincronizar com Spaces"

Data: 29/09/2025
Status: Proposta técnica detalhada e incremental, focada em simplicidade e robustez

Objetivo: Ao clicar no botão "Sincronizar com Spaces", executar:
- Já implementado hoje (mantemos):
  - 📁 Escanear o bucket do DigitalOcean Spaces (prefixo `audio/`)
  - 📋 Comparar com o catálogo atual (`data/catalog.json`)
  - 🔄 Sincronizar diferenças (adicionar novos e remover inexistentes)
  - 💾 Persistir catálogo atualizado no Spaces
- Extensões (novas), mantendo simplicidade:
  - ⏱️ Recalcular duração faltante (ou zero) usando leitura de metadados do arquivo
  - 🏷️ Reprocessar metadados básicos (title/artist) apenas quando faltarem
  - 🎛️ Opcional: Gerar um MP3 contínuo simples (“mix”) no servidor – fase posterior
  - 💡 Alternativa: “Continuous mode” client-side no PWA (sem gerar arquivo)

---

## 1) Estrutura de Pastas/Arquivos no Spaces (simples e organizada)

- `audio/` – arquivos originais `.mp3` (já em uso)
- `data/catalog.json` – catálogo canônico (já em uso)
- `data/metadata-cache.json` – cache incremental de metadados e duração (NOVO)
- `generated/mixes/latest.mp3` – mix contínuo mais recente (OPCIONAL)
- `generated/mixes/latest.json` – ordem das faixas do mix e timestamp (OPCIONAL)
- `generated/status/sync-status.json` – status da última sincronização (OPCIONAL)

Racional:
- Mantém tudo no Spaces (persistência garantida)
- Evita processamento repetido (cache)
- Facilita inspeção e troubleshooting (arquivos JSON legíveis)

---

## 2) Backend – Extensão do endpoint existente (simples, retrocompatível)

Endpoint atual: `POST /api/sync-catalog`
- Mantemos comportamento padrão (scan + reconcile + save)
- Acrescentamos um parâmetro opcional para “modo estendido”:
  - Querystring: `POST /api/sync-catalog?full=true`
  - Ou body JSON: `{ full: true, mix: false }`

Fluxo proposto (full=false → só o que já existe; full=true → inclui enriquecimento):

1. Scan do Spaces (`audio/`) → lista de chaves `.mp3`
2. Carregar catálogo atual de `data/catalog.json` (ou criar vazio)
3. Reconciliar diferenças (adicionar removidos; remover órfãos)
4. [NOVO – full=true] Enriquecer metadados minimamente:
   - Para cada faixa com `duration` ausente/zero → calcular duração
   - Para cada faixa sem `title/artist` → tentar extrair ID3, senão usar filename
5. Salvar catálogo atualizado em `data/catalog.json`
6. [NOVO] Salvar/atualizar `data/metadata-cache.json` (apenas deltas)
7. [OPCIONAL – fase 2] Se `mix=true` → gerar `generated/mixes/latest.mp3`
8. Retornar JSON com resumo e métricas

Retorno JSON (exemplo):
```json
{
  "tracksFound": 57,
  "added": 4,
  "removed": 1,
  "updated": 6,
  "durationComputed": 5,
  "metadataFilled": 3,
  "saved": true,
  "mix": { "generated": false },
  "message": "Sync completed"
}
```

---

## 3) Como calcular duração e metadados de forma simples (sem downloads completos)

Biblioteca sugerida: `music-metadata` (leve, confiável)
- Consegue extrair ID3 e estimar duração a partir do stream
- Funciona com stream do S3/Spaces (via `s3.getObject().createReadStream()`)
- Não precisa baixar o arquivo inteiro

Passos:
- Para cada track faltante em duração/metadados:
  - `const stream = s3.getObject({ Bucket, Key: 'audio/filename.mp3' }).createReadStream();`
  - `const mm = await parseNodeStream(stream)`
  - Extrair: `format.duration` (segundos), `common.title`, `common.artist`
  - Atualizar o objeto da track no catálogo
  - Atualizar `metadata-cache.json` para evitar recalcular no futuro
- Limitar a N faixas por execução (ex.: máximo 20) para performance
- Repetir enriquecimento nas próximas sincronizações até cobrir todas

Vantagens:
- Simples de implementar
- Sem dependência de `ffmpeg` para esta etapa
- Custo previsível (stream parcial)

---

## 4) Geração de MP3 contínuo (servidor) – fase posterior e opcional

Objetivo: criar um único `latest.mp3` com shuffle + concatenação das faixas

Solução minimalista e robusta:
- Dependências: `ffmpeg-static` + `fluent-ffmpeg`
- Estratégia:
  1. Selecionar um subconjunto limitado (ex.: 30 faixas) para manter tempo razoável
  2. Obter streams dos `.mp3` via URLs assinadas (ou `s3.getObject` → arquivos temporários em `/tmp`)
  3. Usar concat demuxer (requer parâmetros idênticos) ou re-encode (mais simples/robusto):
     - `ffmpeg -i input1 -i input2 ... -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1[a]" -map "[a]" -c:a libmp3lame -b:a 128k output.mp3`
  4. Upload do resultado para `generated/mixes/latest.mp3`
  5. Salvar `generated/mixes/latest.json` com ordem e timestamp
- Rodar de forma assíncrona (não bloquear resposta do endpoint):
  - Endpoint retorna imediatamente que “mix job started”
  - Status em `generated/status/sync-status.json` (+ endpoint GET `/api/sync-status`)

Nota: esta etapa envolve CPU/memória. Deixar como “opt-in” (param `mix=true`).

---

## 5) Alternativa: "MP3 contínuo" gerado no PWA iPhone (por usuário)

Prós: shuffle pessoal por usuário, zero custo de servidor para mix
Contras: CPU/bateria do iPhone, tempo de processamento, limites do Safari

Caminhos possíveis (simples → avançado):

- Opção A (recomendada p/ simplicidade):
  - "Continuous mode" via Web Audio API, sem gerar arquivo
  - Pré-decodar próxima faixa com `AudioContext.decodeAudioData`
  - Agendar reprodução sem gaps (gapless) e até fazer crossfade
  - Efeito prático de continuação, sem arquivo único

- Opção B (gerar arquivo no cliente – factível, mas pesado):
  - `lamejs` (encoder MP3 em JS) ou `ffmpeg.wasm`
  - Fluxo: baixar faixas → decodificar → re-encodar → juntar → gerar `Blob` MP3
  - Salvar no Cache Storage/IndexedDB; tocar via `blob:` URL
  - Riscos: pacote grande (wasm ~30–50MB), consumo intenso de CPU, possível throttling

Recomendação:
- Começar com Opção A (gapless play) – entrega a “sensação” de contínuo, muito mais leve
- Avaliar Opção B apenas se for requisito crítico ter um arquivo `.mp3` baixável

---

## 6) UI – Botão simples (sem complexidade)

Local: logo abaixo do título "🎵 Gerenciar Biblioteca Musical"
Ação: `POST /api/sync-catalog?full=true`
Comportamento:
- Desabilita botão enquanto processa; mostra “Sincronizando…”
- Ao concluir: alerta/console com resumo do JSON
- Recarrega a lista (`loadMusicList()`) e atualiza totais

Sem outras mudanças na UI/UX. Sem dependências novas no frontend.

---

## 7) Observabilidade e Segurança (simples)

- `generated/status/sync-status.json`: última execução, contagens, erros (se houver)
- Logs no backend com prefixos claros (SYNC, META, MIX)
- Limitar faixa de processamento por execução (ex.: 20) e tempo máximo (ex.: 25s)
- Garantir permissões S3 de leitura (já existentes) para `getObject`
- Não expor chaves/segredos em logs

---

## 8) Dependências e Esforço

Fase 1 (enriquecimento duração/metadados):
- Dependência: `music-metadata`
- Mudanças: apenas backend (endpoint existente)
- Esforço: baixo-médio; risco baixo

Fase 2 (mix contínuo no servidor – opcional):
- Dependências: `ffmpeg-static`, `fluent-ffmpeg`
- Mudanças: backend + job assíncrono simples
- Esforço: médio; risco moderado (CPU/tempo)

Fase 3 (continuous no PWA – sem arquivo):
- Dependências: nenhuma extra (Web Audio API)
- Mudanças: frontend Player
- Esforço: médio; risco baixo-médio

Fase 4 (mp3 cliente – opcional e pesado):
- Dependências: `lamejs` ou `ffmpeg.wasm`
- Mudanças: frontend
- Esforço: alto; risco alto (iOS)

---

## 9) Critérios de Aceite

- Botão executa o sync atual (scan/compare/sync/save) sem regressões
- Com `full=true`, completa também:
  - Preenche duração em tracks com 0 ou ausente
  - Preenche `title/artist` quando ausentes (de ID3 ou filename)
  - Atualiza `data/metadata-cache.json`
- UI atualiza lista e totais ao fim
- Operação segura, com limites e logs

Extra (quando habilitado):
- `generated/mixes/latest.mp3` criado com até N faixas
- Arquivo `latest.json` com ordem e timestamp

---

## 10) Plano de Entrega Incremental (sem quebrar nada)

1) F1 – Backend: `music-metadata` + enrich de ausentes (dur/ID3) + cache JSON
2) F1 – Frontend: Botão chama `POST /api/sync-catalog?full=true` e recarrega lista
3) F2 – Backend (opcional): Job de mix com `ffmpeg-static` (assíncrono, feature-flag `mix=true`)
4) F3 – Frontend (opção leve): Continuous mode gapless no Player
5) F4 – Frontend (opcional/pesado): Geração de `.mp3` no cliente

Rollback simples: usar `full=false` (volta ao comportamento atual)

---

## 11) Riscos e Mitigações

- Tempo de sync longo em bibliotecas grandes → limitar N por execução, executar incrementalmente
- Custos de CPU (mix) → deixar opcional e assíncrono; N baixo; bitrate fixo 128k
- Compatibilidade iOS para mp3 cliente → preferir gapless play; MP3 cliente apenas se imprescindível

---

## 12) Resumo Executivo

- Mantemos o que já funciona hoje (sync básico)
- Adicionamos enriquecimento leve no backend (dur/ID3) usando `music-metadata`
- Guardamos cache incremental para performance
- UI ganha um único botão simples (sem redesenho)
- Mix contínuo fica opcional, em fase separada, para não complicar
- Consideramos alternativa de “continuous mode” no PWA sem gerar arquivo

Solução simples, prática, incremental e segura.
