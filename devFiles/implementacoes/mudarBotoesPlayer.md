# 🎯 Implementação: Reordenar Botões do Player (Next ➜ Play ➜ Info)

> Escopo mínimo e isolado. Foco exclusivo em alterar a ordem visual/DOM dos botões principais do player conforme solicitado.
> Contexto alinhado com princípios de micro‑entregas (ver padrões em `PLANO_EXECUCAO.md`).

---
## 1. Objetivo
Reorganizar a fileira de controles principais do player para que a ordem dos botões passe de:
```
ATUAL: [Play] [Next] [Info]
```
para:
```
DESEJADO: [Next] [Play] [Info]
```
Sem alterar comportamento, estilos globais ou lógica interna além do estritamente necessário para a mudança visual.

---
## 2. Escopo
### Incluído
- Alterar a ordem dos elementos na renderização dos controles principais.
- Garantir que eventos (play/pause, next, info/modal) continuem funcionando identicamente.
- Garantir acessibilidade básica (ordem de tab coerente: Next → Play → Info ou ajustar se preferirmos Play primeiro no teclado — ver Nota em Riscos).
- Alinhar mudança tanto em `controls.ts` (player completo) quanto em `controls-simple.ts` (variação simplificada) para consistência.

### Excluído (Não Fazer)
- Alterar ícones, estilos CSS, tamanhos, cores ou hover states.
- Introduzir novos botões ou remover existentes.
- Refatorar lógica de callbacks / estado.
- Renomear IDs ou classes.
- Alterar documentação extensa (apenas mencionar em changelog depois se necessário).

---
## 3. Localização dos Arquivos Alvos
| Arquivo | Trecho Relevante | Observação |
|---------|------------------|------------|
| `src/ui/controls.ts` | Método `render()` – bloco `<div class="controls">` | Player principal (usa ícones SVG) |
| `src/ui/controls-simple.ts` | Método `render()` – `<div class="controls">` inline styles | Variante simplificada |

---
## 4. Estado Atual (Resumo)
Markup (principal):
```html
<div class="controls">
  <button class="btn btn-play" id="playButton">...</button>
  <button class="btn btn-next" id="nextButton">...</button>
  <button class="btn btn-info" id="infoButton">...</button>
</div>
```
Eventos adicionados via `setupEventListeners()` dependem apenas de `getElementById`, logo a ordem no DOM é independente da lógica.

---
## 5. Estado Alvo
```html
<div class="controls">
  <button class="btn btn-next" id="nextButton">...</button>
  <button class="btn btn-play" id="playButton">...</button>
  <button class="btn btn-info" id="infoButton">...</button>
</div>
```
Mesma semântica; IDs preservados.

---
## 6. Estratégia Técnica
Opção escolhida: **Alterar ordem do markup no HTML gerado**.
Motivação:
- Simples / explícito.
- Evita dependência em `order` CSS (mais previsível para futuras manutenções).
- Menor superfície de risco que criar regras CSS adicionais.

Verificação adicional: procurar seletores que dependam de posição (ex: `:first-child`, `:nth-child(1)`, etc.) sobre os botões.

---
## 7. Micropassos
1. Análise preventiva: grep em `src/` por padrões `:first-child`, `:nth-child`, `btn-play`, `btn-next` dentro de contextos de `.controls` para confirmar ausência de dependência posicional.
2. Editar `src/ui/controls.ts`: no template do método `render()`, mover bloco do `nextButton` acima do `playButton` mantendo conteúdo intacto.
3. Editar `src/ui/controls-simple.ts` de forma equivalente (mover `<button id="nextButton">` antes do `<button id="playButton">`).
4. Build local (`npm run dev` / observar hot reload) e validar:
   - Clique em Play alterna ícones (▶️/⏸️) normalmente.
   - Clique em Next dispara callback (`onNext`) sem erro.
   - Botão Info abre/fecha modal (principal) ou permanece inexistente na versão simples (se não houver).
5. Testar navegação por teclado (Tab): confirmar ordem pretendida (decidir se manter Next primeiro ou ajustar atributo `tabindex` para dar prioridade ao Play se desejado — por padrão manter alinhado ao DOM).
6. Ver console: ausência de erros.
7. Commit isolado: `feat(ui): reordenar botões player para Next-Play-Info`.
8. Push para `staging` (workflow incremental) e validar em staging.
9. Atualizar (opcional) pequena nota em changelog / seção futura caso necessário.

---
## 8. Testes de Validação
| Teste | Ação | Resultado Esperado |
|-------|------|--------------------|
| Play Toggle | Clicar Play | Alterna ícones e estado sem travar |
| Next | Clicar Next | Avança para próxima faixa (callback executa) |
| Info Modal | Clicar Info | Abre/fecha modal sem deslocamento estranho |
| Ordem Visual | Inspeção | Sequência Next → Play → Info |
| Teclado | Tabulação | Foco percorre na nova sequência (ou ajustado conforme decisão) |
| Responsivo | Redimensionar / mobile | Layout mantém alinhamento central e espaçamento consistente |
| Console | Abrir DevTools | Zero erros JS relacionados aos controles |

---
## 9. Riscos & Mitigações
| Risco | Tipo | Mitigação |
|-------|------|-----------|
| CSS dependente de ordem oculta (não detectado) | Baixo | Grep por seletores posicional antes | 
| Acessibilidade: Play não central no fluxo de foco | Médio UX | Avaliar após teste; se necessário adicionar `tabindex="0"` prioritário e `tabindex="1"` para Next (fora do escopo imediato se não solicitado) |
| Versão simples divergente | Baixo | Aplicar mudança também em `controls-simple.ts` |
| Regressão ícones Play/Pause | Baixo | Teste manual direto após alteração |

---
## 10. Rollback
Se qualquer anomalia: `git revert <commit-hash>` do commit único desta alteração. Como só reorder de markup, revert é imediato e sem conflitos.

---
## 11. Critérios de Aceite
- [x] Ordem dos botões refletida visualmente: Next, Play, Info.
- [x] Nenhum erro no console após interação básica (Play, Next, Info).
- [x] Funções originais inalteradas (callbacks ainda disparados).
- [x] IDs, classes e estilos preservados.
- [x] Build / deploy staging concluído sem falhas.

---
## 12. Não Metas (Explícito)
- Não alterar estilos (cores, tamanhos, espaçamentos).
- Não adicionar animações.
- Não reorganizar outros elementos do player.
- Não mexer em instrumentação / métricas.

---
## 13. Próxima Ação
~~Executar Micropasso 1 (grep de verificação posicional) antes de editar arquivos.~~
✅ **CONCLUÍDO** - Implementação validada e funcionando em staging.

---
## 14. Observações Finais
Alteração mínima, alinhada à filosofia de micro‑deploy. Registrar no futuro changelog conciso caso haja série de pequenos ajustes UI.

---
**Status Final:** ✅ **CONCLUÍDO COM SUCESSO**

**Commit:** `ae4bef6` - feat(ui): reordenar botões player para Next-Play-Info

**Resultado da Validação:** 
- ✅ Deploy staging executado com sucesso
- ✅ Ordem dos botões confirmada: [Next] [Play] [Info]
- ✅ Funcionalidades testadas e operacionais
- ✅ Sem regressões detectadas

**Implementação completa e validada. Micro-entrega realizada conforme workflow incremental.**
