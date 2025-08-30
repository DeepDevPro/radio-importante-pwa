Beleza — fui atrás das respostas “no fio do bigode” e com fontes. Vou direto ao ponto e depois trago os porquês e opções.

# Dá pra resolver no iOS PWA instalado?

## Resumo honesto

* **Safari (abrindo como site)**: áudio em background e na tela bloqueada funciona — inclusive passando pra próxima faixa — desde que você use `<audio>` e inicie via gesto. Isso é o comportamento esperado e bem documentado. ([WebKit][1], [Apple Developer][2], [Mozilla Developer Network][3])
* **PWA instalado (display: standalone)**: ainda há **instabilidades específicas do iOS** ao trocar de faixa em background. O padrão é: a faixa atual toca até o fim, mas a **próxima não inicia** porque o WebKit **suspende o JavaScript**/bloqueia `play()` sem gesto quando o app está em segundo plano; efeitos colaterais incluem sumir metadata no lock screen. Há bugs/regressões históricas confirmadas no WebKit e relatos atuais de players web que param “no boundary”. **Não é algo que você controla só com código da UI.** ([WebKit Bugzilla][4], [GitHub][5])

**Conclusão:** existe solução **viável** para o seu caso minimalista, mas ela evita “troca de arquivo” entre faixas. Em um PWA instalado, a forma **robusta** é transformar sua playlist fixa em **um único fluxo contínuo** (HLS VOD concatenado) e usar “seek” para pular entre marcadores. Se você insistir em carregar um arquivo novo por faixa com JS, a reprodução provavelmente **vai parar** ao fim de cada música quando o app estiver bloqueado ou em background. ([Apple Developer][6])

---

## Por que isso acontece

1. **Política de autoplay/gesto do iOS:** iniciar áudio exige gesto; chamadas `play()` vindas do background costumam ser bloqueadas. Safari documenta isso há anos. ([WebKit][1], [Apple Developer][2], [Mozilla Developer Network][7])
2. **Suspensão de JS/áudio no background (PWA):** houve bugs recorrentes de eventos como `ended` não dispararem e de `AudioContext` ser suspenso ao ir pro background (até com `navigator.audioSession`). Alguns foram “fixados”, mas regressões aparecem em versões novas. É por isso que **a transição automática** para a próxima faixa falha em PWA instalado. ([WebKit Bugzilla][8])
3. **Sem “Background Sync” no iOS:** não dá pra usar APIs de background do Service Worker pra “manter vivo” o app. Safari **não suporta** Background Sync/Periodic Background Sync. Logo, o **pipeline de mídia** é o único “motor” que segue rodando com a tela apagada. ([Can I Use][9], [LambdaTest][10], [Mozilla Developer Network][11])

---

## O que fazer (ordem de confiabilidade)

### Opção A — “Site-app” que abre no Safari (sem standalone)

Se você puder abrir do ícone **dentro do Safari** (sem o container standalone), o iOS mantém o comportamento estável de background. Tática conhecida: manifest com `display: "minimal-ui"` para forçar abrir no Safari ao tocar no ícone. Você continua sem App Store, tem ícone na Home e mantém background sólido. **Trade-off:** aparece a chrome do Safari. ([Stack Overflow][12])

### Opção B — PWA instalado **+** playlist contínua (recomendado p/ seu escopo)

Empacotar a playlist fixa como **um único HLS VOD** (fMP4/TS) com `#EXT-X-DISCONTINUITY` entre músicas. Resultado:

* O sistema trata **toda a sessão** como **um único recurso de mídia**; ao terminar “uma música”, **o player nativo já está no próximo trecho** sem precisar de JS em background.
* Botões **play/pause** no lock screen funcionam via **Media Session API**; `next/prev` no iOS nem sempre disparam para PWAs (há relatos do sistema “roubar” para Apple Music), então **tratar como best-effort**. Você mapeia “Próxima” para um `seek` até o próximo marcador. ([Mozilla Developer Network][3], [Stack Overflow][13])
* **Metadata/arte**: você pode manter uma arte genérica e título/artista da “faixa atual” na Media Session. Atualizações de metadata **em background** podem atrasar por throttling; se for crítico, insira **ID3/DATERANGE** como *timed metadata* no HLS (Safari expõe via `TextTrack kind="metadata"`; em web isso é lido pelo JS quando houver ciclo). ([Apple Developer][6])

> Referências HLS/metadata em Safari: WWDC e docs de HLS mostram suporte a **timed metadata** (ID3/DATERANGE) — útil para marcar início/fim de cada música e sincronizar UI quando o app volta ao foreground. ([Apple Developer][6])

### Opção C — Um arquivo longo (AAC/MP3 progressivo)

Mesmo raciocínio da opção B, mas sem HLS (só um `.mp3/.m4a` concatenado). É o mais simples, porém perde adaptação de rede e *seeking* pode ficar menos preciso. Útil como fallback. (O racional técnico é o mesmo das políticas de autoplay.) ([Mozilla Developer Network][7])

### Coisas que **não** resolvem no iOS PWA

* **Trocar `src`/chamar `play()` no `ended`** com a tela bloqueada: falha intermitente (o seu sintoma). ([GitHub][5])
* **Service Worker “mantendo vivo”**: indisponível em Safari. ([Can I Use][9])
* **WebAudio** para o stream principal: mais suscetível a suspensão (há bug histórico de `AudioContext` suspenso em background). Use **`<audio>` nativo**. ([WebKit Bugzilla][14])
* **Wake Lock**: hoje (iOS 18.4+) funciona em PWAs, mas **serve só para evitar que a tela apague**; não é objetivo ter a tela acesa pra ouvir música (drena bateria). Útil apenas para **diagnóstico**. ([WebKit][15], [Apple Developer][16])

---

## E os “grandes” (Spotify / YouTube Music / SoundCloud / Deezer/Tidal)?

* **Spotify Web Player**: já teve períodos sem suporte no Safari por DRM (Widevine); voltou no Safari de desktop em 2020, mas no iOS a experiência web é limitada e há relatos de parada em background. O **fluxo sério em iOS é o app nativo**, não PWA. ([MacRumors Forums][17], [Comunidade Spotify][18])
* **YouTube/YouTube Music**: **background é recurso Premium** e oficialmente gerido pelos apps nativos; no Safari existem “workarounds” e PiP, mas não há documentação pública de PWA iOS fazendo background estável entre faixas. ([Ajuda Google][19])
* **SoundCloud / Deezer / Tidal**: operam bem via apps nativos; **não há** guias públicas mostrando PWA iOS tocando **playlist** em background de forma estável sem truques. (Vários tópicos da comunidade apontam os mesmos limites do WebKit.) ([Discourse Meta][20], [Stack Overflow][21])

**Moral:** essas plataformas contornam com **apps nativos** (têm AVAudioSession, background modes, etc.). No **mundo web** elas aceitam limitações ou evitam PWA instalado no iOS.

---

## Check-list prático pro seu player minimalista

1. **Transporte**

* Gere **HLS VOD concatenado** (uma playlist contínua com `#EXT-X-DISCONTINUITY`). Separe *cues* por música. (Ferramentas: ffmpeg + `hls_segment_type=fmp4` / Apple HLS Tools.) ([Apple Developer][22])

2. **Player**

* Use `<audio src="...m3u8">` (ou `<video>` com `playsinline` se precisar HLS via elemento de vídeo) e **inicie por tap**. Evite WebAudio pro áudio principal. ([WebKit][1], [Mozilla Developer Network][7])

3. **Controles/lock screen**

* **Media Session API**: setar `metadata`, `play/pause` e tentar `next/prev` (degradar se iOS interceptar). O lock screen deve exibir título/artista e aceitar **play/pause**. ([Mozilla Developer Network][3], [web.dev][23])

4. **Service Worker**

* Cache só o **app shell**; **bypassar** o áudio (network-only, nada de cache do HLS). Isso evita interferência e range requests quebradas. (Padrão recomendado.) — (Prática amplamente recomendada, alinhada a docs do ecossistema PWA.)

5. **Metadata por faixa (opcional)**

* Se quiser sinalizar a faixa atual enquanto toca o fluxo único, **insira ID3/DATERANGE** no HLS (timed metadata). Em foreground, o JS lê os *cues* e atualiza a UI/Media Session. Em background, aceite eventual atraso. ([Apple Developer][6])

6. **Plano B se você quiser “ícone na Home” com background sólido**

* Manifest com **`display: "minimal-ui"`** para abrir no Safari (não “standalone”). Você mantém ícone sem ir à App Store **e** mantém o pipeline do Safari — é o melhor dos dois mundos, com a barra do Safari visível. ([Stack Overflow][12])

---

## Isso tem ou não tem solução?

* **Tem solução viável** para o seu escopo **fixo/minimalista**: **um único fluxo contínuo (HLS VOD)** + Media Session.
* **Não há solução confiável** para PWA instalado que **carrega um novo arquivo por faixa** em background no iOS. Esse padrão falha por política/bugs do WebKit e pela suspensão de JS. ([GitHub][5], [WebKit Bugzilla][4])

---

## Perguntas rápidas pra eu cravar o plano

1. Você **aceita** o caminho **A (abrir no Safari via `minimal-ui`)** caso o HLS concatenado não atenda alguma exigência sua? ([Stack Overflow][12])
2. Se formos de **PWA instalado**, está **ok** a solução de **playlist contínua** (um único HLS), com **next/prev** implementados via *seek* e **metadata** possivelmente genérica no lock screen durante o background? ([Apple Developer][6])
3. Em quais versões de **iOS** você precisa garantir? (Se já estiver em **iOS 18.4+**, posso sugerir usar **Wake Lock apenas para depurar** — comprova que o problema é o background, não o player — e depois desligar.) ([WebKit][15])

Se topar, eu te devolvo um **roteiro técnico fechado** (empacotamento HLS, estrutura de playlists com *discontinuities* + *cues*, checklist de Media Session e do SW) pra você colar pro Copilot executar etapa por etapa.

[1]: https://webkit.org/blog/6784/new-video-policies-for-ios/?utm_source=chatgpt.com "New <video> Policies for iOS"
[2]: https://developer.apple.com/documentation/webkit/delivering-video-content-for-safari?utm_source=chatgpt.com "Delivering Video Content for Safari"
[3]: https://developer.mozilla.org/en-US/docs/Web/API/MediaSession?utm_source=chatgpt.com "MediaSession - MDN - Mozilla"
[4]: https://bugs.webkit.org/show_bug.cgi?id=198277&utm_source=chatgpt.com "198277 – Audio stops playing when standalone web app is ..."
[5]: https://github.com/advplyr/audiobookshelf/issues/2655?utm_source=chatgpt.com "[Bug]: iOS Background audio stops at the end of each ..."
[6]: https://developer.apple.com/videos/play/wwdc2020/10663/?utm_source=chatgpt.com "What's new for web developers - WWDC20 - Videos"
[7]: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay?utm_source=chatgpt.com "Autoplay guide for media and Web Audio APIs - MDN"
[8]: https://bugs.webkit.org/show_bug.cgi?id=173332 "173332 – HTML5 audio .ended event not fired when app in background or phone screen is off"
[9]: https://caniuse.com/background-sync?utm_source=chatgpt.com "Background Sync API | Can I use... Support tables ..."
[10]: https://www.lambdatest.com/web-technologies/background-sync-safari?utm_source=chatgpt.com "Background Sync API Browser Compatibility On Safari"
[11]: https://developer.mozilla.org/en-US/docs/Web/API/PeriodicSyncManager?utm_source=chatgpt.com "PeriodicSyncManager - MDN"
[12]: https://stackoverflow.com/questions/60003027/ios-pwa-background-audio-support?utm_source=chatgpt.com "iOS PWA Background Audio Support"
[13]: https://stackoverflow.com/questions/73993512/web-audio-player-ios-next-song-previous-song-buttons-are-not-in-control-cent?utm_source=chatgpt.com "iOS next song & previous song buttons are not in control ..."
[14]: https://bugs.webkit.org/show_bug.cgi?id=261554 "261554 – [iOS] AudioContext is getting suspended when page goes in the background even if navigator.audioSession.type is set to playback"
[15]: https://webkit.org/blog/16574/webkit-features-in-safari-18-4/?utm_source=chatgpt.com "WebKit Features in Safari 18.4"
[16]: https://developer.apple.com/documentation/safari-release-notes/safari-18_4-release-notes?utm_source=chatgpt.com "Safari 18.4 Release Notes | Apple Developer Documentation"
[17]: https://forums.macrumors.com/threads/spotifys-web-player-support-for-safari-browser-has-been-restored.2236126/?utm_source=chatgpt.com "Spotify's Web Player Support for Safari Browser Has Been ..."
[18]: https://community.spotify.com/t5/Other-Podcasts-Partners-etc/Safari-No-Longer-Supported/td-p/1975103/page/2?utm_source=chatgpt.com "Safari No Longer Supported??!! - Page 2"
[19]: https://support.google.com/youtube/answer/7437614?co=GENIE.Platform%3DiOS&hl=en&utm_source=chatgpt.com "Background play isn't working - iPhone & iPad - YouTube ..."
[20]: https://meta.discourse.org/t/media-playback-with-pwa-keep-playing-when-phone-locked/182219?utm_source=chatgpt.com "Media Playback with PWA: keep playing when phone ..."
[21]: https://stackoverflow.com/questions/55872513/deezer-playback-stops-when-i-activate-the-lock-screen?utm_source=chatgpt.com "Deezer playback stops when I activate the lock screen"
[22]: https://developer.apple.com/documentation/http-live-streaming/using-apple-s-http-live-streaming-hls-tools?utm_source=chatgpt.com "Using Apple's HTTP Live Streaming (HLS) Tools"
[23]: https://web.dev/articles/media-session?utm_source=chatgpt.com "Customize media notifications and playback controls with ..."
