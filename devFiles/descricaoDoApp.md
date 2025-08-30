# MVP – PWA Music Player (iOS + Android)

> **Objetivo:** implementar um player de música **super simples** que funcione como **PWA** (instalável sem loja) e **continue tocando em segundo plano / tela bloqueada** no iOS e no Android, respeitando as limitações do sistema. Sem playlist editável pelo usuário.

---

## Escopo funcional (v1)

1. **Reprodução** de uma playlist **fixa** (definida pelo app), em ordem, com **Next** e **Play/Pause**.
2. **Info Card**: ao tocar no botão *info*, exibir card com **título** e **artista** da faixa atual (arte é genérica do app; sem capa por faixa).
3. **Background/Lock Screen**: áudio continua tocando com a tela bloqueada ou com o app em background.
4. **Media Session API**: metadados (título/artista) + botões de **Play/Pause** e **Next** no lock screen/central de controle quando suportado.
5. **PWA instalável** (Add to Home Screen), com **manifest.json**, **service worker** e **HTTPS**.
6. **Robustez iOS**: priorizar elemento **`<audio>`** nativo (não WebAudio) e iniciar playback **após gesto** do usuário.
7. **HLS como formato principal** (AAC), com **fallback MP3/AAC progressivo**.
8. **Não cachear áudio** no SW (apenas UI). Áudio via CDN.

> **Não metas:** fila dinâmica, shuffle, repeat, equalizador, crossfade, busca por faixas, login/conta, DRM, baixes offline, download local.

---

## Decisões técnicas (obrigatórias nesta v1)

* **Player:** usar **`<audio src="...">`** como mecanismo principal de reprodução.
* **Autoplay:** **somente** após gesto do usuário (tap no botão Play).
* **Formato/Entrega:**

  * **HLS (`.m3u8`)** como padrão (melhor no iOS).
  * **Fallback** transparente para **MP3/AAC progressivo** quando HLS não for suportado.
* **Sequenciamento:**

  * **Opção A (preferida – robustez)**: **HLS VOD encadeado** (uma playlist `.m3u8` única, com `EXT-X-DISCONTINUITY` separando faixas). O app mantém um **cue sheet** (tabela com `startMs`/`endMs` por faixa) para atualizar UI/Media Session ao cruzar fronteiras.
  * **Opção B (mais simples – etapa intermediária)**: arquivos separados por faixa. Útil para validar o básico; depois migrar para VOD encadeado.
* **Metadata/Lock Screen:** **Media Session API** para título/artista e handlers de play/pause/next. *Artwork* opcional (uma imagem genérica do app).
* **PWA:** manifest + SW. **Service Worker apenas cacheia UI** (HTML/CSS/JS/ícones). **Não** interceptar/capear requisições de HLS/MP3.
* **Rede/CDN:**

  * HLS servido com **HTTPS**, **CORS** permissivo para o domínio do app e **`Accept-Ranges: bytes`**.
  * Segmentos curtos (2–6s) e cacheáveis em CDN.
* **Telemetria mínima** (anônima): erros de playback/buffer, mudanças de faixa.

---

## Estrutura de pastas sugerida

```
root/
  public/
    index.html
    manifest.webmanifest
    icons/ (maskable + iOS pngs)
  src/
    app.ts (bootstrap)
    ui/
      controls.ts (play/pause/next, info card)
      installPrompt.ts (guia A2HS no iOS)
    player/
      audio.ts (instância <audio>, init após gesto, eventos timeupdate, ended, stalled)
      mediaSession.ts (setActionHandler + metadata)
      hlsAdapter.ts (detectar suporte HLS nativo; usar hls.js **apenas** como fallback NÃO-iOS)
      sequencing.ts (lógica de cue sheet + fronteiras ou fallback por arquivos)
      state.ts (trackIndex, position, persistência em localStorage)
    net/
      reconnect.ts (estratégia simples de recuperação)
    telemetry/
      events.ts
  data/
    catalog.json (lista de faixas: title, artist, duração, etc.)
    cues.json (para VOD encadeado: startMs/endMs por faixa)
  sw.js (service worker – cache da UI)
  vite.config.ts (ou equivalente)
```

> **Nota:** iOS tem suporte nativo a HLS no Safari/PWA, portanto **não use hls.js no iOS**; use-o apenas como fallback em navegadores sem HLS nativo.

---

## Requisitos de infra (áudio)

* **Codificação**: AAC-LC (m4a) para HLS; MP3 opcional como fallback universal.
* **Segmentação HLS**: use `ffmpeg` (ou pipeline equivalente) para gerar `.m3u8` + segmentos (`.ts`/`.m4s`).
* **CDN/Servidor**: HTTPS, CORS liberado para o domínio do app, `Accept-Ranges: bytes`, `Cache-Control` adequado.
* **Layout VOD encadeado** (Opção A): playlist única por “álbum/compilação”, com `#EXT-X-DISCONTINUITY` entre faixas.
* **Catalog/Cues**: arquivo JSON com metadados por faixa e fronteiras (quando VOD encadeado).

> **Exemplo (conceitual) ffmpeg** – *referência, Copilot deve propor comandos finais*: segmentação \~4s, playlist VOD, *discontinuities* entre faixas (pode exigir concat intermédiario ou `chapter` mapping). A abordagem exata fica a cargo do plano do Copilot.

---

## PWA/Manifest/Meta iOS

* `manifest.webmanifest`: `name`, `short_name`, `start_url`, `display: "standalone"`, `background_color`, `theme_color`, ícones **maskable**.
* Meta iOS (em `index.html`): `apple-mobile-web-app-capable` e `apple-mobile-web-app-status-bar-style`; ícones iOS.
* **Service Worker**: estratégia **stale-while-revalidate** para UI; **excluir** caminhos de mídia (`/audio/`, `/hls/`).

---

## UX/Estados

* **Primeiro acesso**: mostrar botão **Play** (desabilitado até assets carregarem minimamente). Ao toque, inicializar `<audio>` e iniciar.
* **Info Card**: toggle modal/card com título e artista da faixa atual; sem capa individual.
* **Persistência**: ao encerrar, salvar `trackIndex` (ou `position` global no VOD) + `currentTime`. Ao reabrir, retomar.
* **Erros de rede**: tentar `reload()` e reposicionar; expor toast discreto de reconexão.

---

## Critérios de aceite (v1)

1. **Instalação**: app instalável como PWA no Android e iOS (A2HS), ícones corretos.
2. **Playback**: ao tocar **Play** (gesto), a música toca; **Play/Pause/Next** funcionam.
3. **Background**: bloquear tela → áudio continua; alternar para outro app → áudio continua.
4. **Lock Screen**: Media Session mostra título/artista; **Play/Pause** funcionam; **Next** quando suportado.
5. **Robustez**: em iOS, a troca de faixa acontece sem depender de eventos JS em segundo plano (via VOD encadeado ou estratégia equivalente).
6. **Fallback**: em um browser sem HLS nativo, player usa fallback (hls.js ou MP3 progressivo) e toca normalmente.
7. **SW**: UI cacheada; **stream não** cacheado; atualização do app (nova build) é refletida via SW update.

---

## Matriz de testes manuais

* **Ambientes**: iOS Safari (aba), iOS PWA (Add to Home Screen), Android Chrome (aba), Android PWA, Desktop Chrome/Edge/Firefox/Safari.
* **Cenários**:

  * Tocar/pausar/avançar.
  * Bloquear tela e desbloquear (iOS/Android).
  * Sair para outro app e voltar.
  * Receber ligação/alarme/notificação (retomar áudio depois).
  * Conectar/desconectar fones BT; usar botões do fone (play/pause/next se disponível).
  * Alternar rede Wi‑Fi/4G (reconectar buffer).
  * Remover app do switcher (iOS) e reabrir: retomar de onde parou.
  * Instalar PWA e repetir todos os testes acima.

---

## Instruções ao Copilot (Agente do VSCode)

> **Você é o Copilot Agent com acesso ao workspace.** Leia este documento por completo e proceda da seguinte forma:

### 0) Proponha um **Plano de Execução (PE)**

* Entregue um **checklist em etapas pequenas**, com estimativa de esforço relativa (S/M/L) e dependências.
* Cada etapa deve terminar em um estado **testável** (manual) e conter **critérios de aceite**.
* Inclua uma seção de **riscos** (iOS PWA, reconexão, Media Session) e como mitigá-los.

### 1) Configure o projeto (sem quebrar nada)

* Inicialize um projeto web leve (sugestão: **Vite + TS**), estrutura de pastas conforme acima.
* Adicione **lint/prettier**, scripts de build/dev.
* **Não** implemente SW/manifests ainda.
* **Peça minha confirmação** antes de seguir.

### 2) Player básico (arquivos separados – etapa de validação)

* Renderize **UI mínima**: Play/Pause, Next, Info.
* Implemente `<audio>` nativo, **inicializado após gesto**.
* Carregue **arquivos separados** (MP3/AAC) a partir de `catalog.json` só para validar.
* **Media Session** básica (title/artist) + handlers play/pause/next.
* **Critérios**: tocar em iOS/Android/desktop, pausar/retomar, next funciona. **Peça validação.**

### 3) PWA (

* Adicione **manifest** e **ícones**; **A2HS** funcional.
* Adicione **Service Worker** mínimo (cache da UI; **excluir** `/audio/`/`/hls/`).
* **Critérios**: instalável em iOS/Android; app abre em `standalone`. **Peça validação.**

### 4) HLS – fallback e detecção

* Adapte o player para priorizar **HLS** (src `.m3u8`).
* **No iOS**: usar **HLS nativo** (sem hls.js). **Em navegadores sem HLS**: usar **hls.js** ou fallback MP3.
* **Critérios**: HLS toca no iOS (aba + PWA). Em desktop/Android sem HLS nativo, fallback funciona. **Peça validação.**

### 5) Sequenciamento robusto (VOD encadeado)

* Implementar **playlist VOD** única com fronteiras de faixa (discontinuities).
* Introduzir **`cues.json`** (ou embutir no catalog) com `{ index, startMs, endMs, title, artist }`.
* Atualizar **Media Session** e **Info Card** ao cruzar fronteiras (via `timeupdate`).
* **Critérios**: Next salta para o próximo boundary; lock screen atualiza título/artista confiavelmente (iOS/Android). **Peça validação.**

### 6) Robustez e persistência

* Persistir `trackIndex`/`position` (VOD global) em `localStorage`.
* Implementar **reconexão simples** (on `stalled`/`error`: `reload()` do `<audio>` no ponto). Logs mínimos em console/telemetria.
* **Critérios**: recuperar após troca de rede; retomar após reabrir app/PWA. **Peça validação.**

### 7) Polimento final

* Revisar SW (cache only UI, atualizar versão).
* Acessibilidade básica (labels/roles), foco/teclado.
* Testes manuais segundo a **matriz** acima. Lista de *known issues*.

> **Regras de operação:**
>
> * Avance **uma etapa por vez**. Ao concluir, **descreva o que fez**, como testar, e **aguarde minha confirmação**.
> * Mantenha commits pequenos e mensagens claras (ex.: `feat(player): add media session basics`).
> * Nunca cacheie mídia no SW. Não use WebAudio para o stream principal.
> * Em iOS, **não** use hls.js.
> * Se algum device falhar, proponha diagnóstico e fallback.

---

## Perguntas/Assunções para confirmar comigo

1. Host/CDN dos áudios (S3/CloudFront, Nginx, etc.) e CORS liberado para o domínio do app.
2. Vamos começar com **arquivos separados** (etapa 2) e migrar para **VOD encadeado** (etapa 5)?
3. Nome da **arte genérica** (PNG) do app e paleta de cores.
4. Domínio/HTTPS para testes (pode ser localhost + vite; iOS aceita `http://localhost`). Para PWA, produção com HTTPS real.
5. Telemetria: OK armazenar contagens anônimas de erros/play?

---

## Definition of Done (geral)

* App instalável como PWA no iOS/Android.
* Toca em **segundo plano** e com **tela bloqueada** (iOS/Android) após gesto inicial.
* Controles **Play/Pause/Next** funcionam na UI e, quando suportado, na lock screen.
* **HLS** como caminho principal no iOS; fallback funcionando nos demais.
* **Sem cache de áudio** no SW; UI cacheada.
* Matriz de testes executada; *known issues* documentados.

---

## 🐛 Correções Aplicadas (Etapa 1 - Debug)

### Problemas Identificados pelo Usuário
1. **Música para após primeira faixa**: Auto-play não funcionava após `ended`
2. **Botão play não responde**: Após mudança de faixa o player travava
3. **Erros no console**: DEMUXER_ERROR e NotSupportedError nos logs

### Soluções Implementadas

#### 1. Carregamento Robusto (`audio.ts`)
```typescript
async loadTrack(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    this.audio.src = url;
    this.audio.load(); // 🔥 Crucial para reset do elemento
    
    const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
    
    this.audio.addEventListener('canplay', () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}
```

#### 2. Transição Automática (`app.ts`)
```typescript
private handleAudioEnded(): void {
  console.log('🎵 Faixa acabou, avançando...');
  this.stateManager.nextTrack();
  this.loadAndUpdateCurrentTrack(); // 🔥 Auto-play
}
```

#### 3. Reset Correto no Next
```typescript
private async handleNext(): Promise<void> {
  this.audioPlayer.stop(); // 🔥 Para completamente antes de trocar
  this.stateManager.nextTrack();
  await this.loadAndUpdateCurrentTrack();
}
```

#### 4. URLs com Caracteres Especiais
- Arquivos funcionando com acentos/espaços: `Ângela Maria - A Noite do Meu Bem.mp3`
- Teste curl confirmou HTTP 200 OK para todos os arquivos
- Encoding UTF-8 preservado no catálogo

### ✅ Status: Etapa 1 Completa
- ✅ Reprodução contínua funcionando
- ✅ Controles responsivos após correções
- ✅ Tratamento de erros robusto
- ✅ URLs com caracteres especiais testadas
- ✅ **Pronto para Etapa 2 (PWA)**

---
