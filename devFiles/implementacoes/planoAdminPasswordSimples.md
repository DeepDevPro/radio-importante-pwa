# Plano: Proteção Simples por Senha (admin.html)

> Objetivo: Adicionar uma camada mínima de bloqueio (prompt de senha em JavaScript) antes de exibir a interface administrativa. Sem backend, sem hash forte — apenas controle leve para evitar acesso casual.
> Data: 08/10/2025
> Status: PLANEJADO

---
## 1. Contexto
A página `admin.html` hoje é acessível diretamente (com fallback via gesto secreto na PWA). Para o MVP cliente, deseja-se inserir um prompt simples solicitando senha. Segurança robusta NÃO é requisito (aceita-se que a senha esteja em texto no front). O foco é:
- Evitar que usuários ocasionais entrem por curiosidade.
- Não quebrar fluxo atual de staging/local.
- Não alterar backend.

Alinhado ao guia: mudanças reversíveis, escopo mínimo, impacto zero em player (`index.html`).

---
## 2. Escopo
INCLUI:
- Bloco JS inline inicial em `admin.html` (antes do restante do conteúdo ser mostrado) pedindo senha via `prompt()`.
- Máscara leve de conteúdo até validação (e.g. ocultar `<body>` temporariamente ou wrapper `.container`).
- Constante clara onde o desenvolvedor poderá trocar a senha manualmente.
- Registro deste plano e mudança em commit isolado.

NÃO INCLUI:
- Armazenamento seguro / hashing.
- Persistência em localStorage (aceitável re-pedir ao recarregar).
- Rate limiting / auditoria.
- Alterações em `debug.html`.

---
## 3. Requisitos / Critérios de Aceite
| ID | Critério | Aceitação |
|----|----------|-----------|
| C1 | Prompt aparece antes da interface | Ao abrir `admin.html`, antes de ver lista/conteúdo |
| C2 | Senha correta revela conteúdo | Interface aparece integralmente |
| C3 | Senha incorreta bloqueia acesso | Redireciona para `/` ou permanece em loop cancelável |
| C4 | Cancelar prompt não mostra admin | Redireciona para `/` |
| C5 | Fácil trocar senha | Única constante evidente no topo do script |
| C6 | Não interfere com staging gestures | Gesto 3 taps continua abrindo admin, mas ainda solicita senha |
| C7 | Rollback trivial | Remover bloco JS ou comentar |> restaura comportamento anterior |

---
## 4. Riscos e Mitigações
| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Senha exposta no código | Esperado (aceito) | Documentar claramente (não usar credencial real) |
| Prompt bloqueia carregamento se travar | UX leve incômodo | Loop máximo 1 tentativa adicional; após falha → redirect |
| Usuário digita errado várias vezes | Frustração | Mensagem simples "Acesso negado" + redirect |
| Cache do navegador mantém aba aberta | Admin visível até refresh | Aceito no escopo simples |

---
## 5. Design Técnico (Simples)
Estratégia: Inline `<script>` no início do `<body>` (logo após `<body>` abrir) que:
1. Aplica `document.documentElement.style.visibility = 'hidden'` ou adiciona classe `pre-auth` para ocultar.
2. Define constante configurável: `const SIMPLE_ADMIN_PASSWORD = 'TROCAR_SENHA_AQUI';`
3. Executa função imediata:
```js
(function authAdmin(){
  const PASS = SIMPLE_ADMIN_PASSWORD;
  const input = prompt('Senha de acesso ao Admin:');
  if (input === PASS) {
    document.documentElement.style.visibility = 'visible';
  } else {
    if (input !== null) alert('Acesso negado');
    window.location.href = '/';
  }
})();
```
4. (Opcional leve) Colocar `<noscript>` avisando que JavaScript é necessário.

Motivo para usar `visibility:hidden` no `<html>`/`<body>`: evita flash de conteúdo antes do prompt, sem reflow destrutivo.

Rollback: remover bloco + remover style inline.

---
## 6. Local de Inserção
Arquivo: `admin.html`
Posição sugerida:
- Após `<body>` abrir e antes do `<div class="container">` existente.
- Justificar: garante que nada da UI seja exibida antes da verificação.

Marcador de início claro:
```html
<!-- SIMPLE ADMIN PASSWORD GUARD (Plano: planoAdminPasswordSimples) -->
<script>
  // Configurar senha aqui:
  const SIMPLE_ADMIN_PASSWORD = 'DEFINIR_SENHA_AQUI';
  (function guard(){
    document.documentElement.style.visibility = 'hidden';
    const val = prompt('Senha de acesso ao Admin:');
    if (val === SIMPLE_ADMIN_PASSWORD) {
      document.documentElement.style.visibility = 'visible';
    } else {
      if (val !== null) alert('Acesso negado');
      window.location.replace('/');
    }
  })();
</script>
<!-- /SIMPLE ADMIN PASSWORD GUARD -->
```

Nota: Desenvolvedor substitui `'DEFINIR_SENHA_AQUI'` pela senha real (ex: `'radio2025'`).

---
## 7. Micropassos de Implementação (Sequência Sonnet)
| Passo | Ação | Resultado Esperado |
|-------|------|--------------------|
| 1 | Usar `staging` diretamente | Ambiente pronto |
| 2 | Abrir `admin.html` | Arquivo carregado |
| 3 | Localizar `<body>` | Ponto de inserção identificado |
| 4 | Inserir bloco guard acima da `<div class="container">` | Script inline presente |
| 5 | Definir senha temporária (ex: `radio2025`) | Senha configurada |
| 6 | Adicionar comentário TODO para troca em produção | Facilita revisão |
| 7 | Salvar arquivo | Modificação local |
| 8 | Commit: `feat(admin): simple password prompt guard` | Histórico registrado |
| 9 | Push para `staging` | Dispara deploy staging |
| 10 | Recarregar e testar senha incorreta | Redireciona para `/` |
| 11 | Testar cancelar prompt | Redireciona para `/` |
| 12 | Validar em URL staging | Prompt funcional em ambiente remoto |
| 13 | Merge em `main` (se aprovado) | Disponível produção |
| 14 | Registrar conclusão neste plano (atualizar Status) | Documentação coerente |

---
## 8. Testes Manuais Essenciais
| Caso | Ação | Resultado |
|------|------|-----------|
| T1 | Senha correta na primeira tentativa | Conteúdo visível |
| T2 | Senha incorreta | Alert + redirect `/` |
| T3 | Cancelar prompt | Redirect `/` |
| T4 | Inspecionar fonte | Constante clara e única |
| T5 | Gesto secreto (abrir admin) | Ainda exige senha |

---
## 9. Checklist Pré-Commit
- [ ] Script inserido antes do conteúdo.
- [ ] Constante única de senha.
- [ ] Nenhum outro side effect introduzido.
- [ ] Comentários de início/fim presentes.
- [ ] Sem alteração em outras páginas.

---
## 10. Plano de Rollback
| Cenário | Ação |
|---------|------|
| Problema UX (usuário reclama) | Remover bloco `<script>` e commit `revert` |
| Esquecimento de senha | Trocar valor constante e redeploy |
| Necessidade de reforço | Evoluir para hash + localStorage (futuro fora deste plano) |

---
## 11. Observações Futuras (Não Implementar Agora)
- Hash simples + armazenamento de flag em `sessionStorage` para não re-promptar a cada reload.
- Timeout de sessão.
- Tela custom em vez de `prompt()` (melhor UX + branding).

---
## 12. Status
- Estado atual: PLANEJADO
- Próxima ação: Aprovação do plano.

---
## 13. Ações Pós-Conclusão (Atualizar)
Após implementação bem-sucedida:
- Marcar este documento como CONCLUÍDO.
- Anotar senha usada em local seguro interno (não no repositório público se for sensível — usar placeholder se necessário em docs).

---
## 14. Confirmação
Se aprovado, prossigo com Passo 1–4 imediatamente.

---
(Referências consultadas: `PLANO_EXECUCAO.md` princípios de mudanças mínimas e reversíveis; gestos iPhone preservados; não impactar pipeline HLS ou player.)
