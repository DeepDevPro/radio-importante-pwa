# 🎯 PLANO DE RESTAURAÇÃO - Edição Inline de Metadados

> **Objetivo**: Restaurar funcionalidade de edição inline que existia na versão local  
> **Data**: 27 de Setembro de 2025  
> **Branch**: `feature/restore-inline-editing-metadata`  
> **Status**: 🚧 Em Desenvolvimento

---

## 📋 **FUNCIONALIDADES A RESTAURAR:**

### ✅ **1. Edição Inline de Campos**
- **Como era antes**: Clicar diretamente no título ou artista editava inline
- **Como está agora**: Botão "Editar" abre modal (não desejado)
- **O que implementar**: 
  - Clicar no título → transforma em input editável
  - Clicar no artista → transforma em input editável  
  - `Enter` → salva, `Escape` → cancela

### ✅ **2. Cálculo Automático de Duração**
- **Como era antes**: Sistema calculava duração automaticamente do arquivo MP3
- **Como está agora**: Mostra duração básica em segundos
- **O que implementar**:
  - Calcular duração real do arquivo durante upload
  - Mostrar em formato MM:SS ou HH:MM:SS
  - Totalizador automático

### ✅ **3. Totalizador Inteligente**
- **Como era antes**: "📊 Total: X músicas • Y minutos de duração"
- **Como está agora**: Não tem totalizador visível
- **O que implementar**:
  - Contador de músicas total
  - Soma total de duração em formato amigável
  - Atualização dinâmica

### ❌ **4. Remover Funcionalidades Desnecessárias**
- **Botão Preview**: Remover (usuário não quer)
- **Botão "Editar" (modal)**: Remover, substituir por edição inline

---

## 🔧 **IMPLEMENTAÇÃO TÉCNICA:**

### **PASSO 1: Modificar Renderização da Lista**
```html
<!-- ANTES (com botões) -->
<button onclick="playPreview('${track.filename}')">▶️ Preview</button>
<button onclick="editTrack('${track.id}')">✏️ Editar</button>

<!-- DEPOIS (campos editáveis) -->
<span class="editable-title" onclick="enableEdit('${track.id}', 'title')">${track.title}</span>
<span class="editable-artist" onclick="enableEdit('${track.id}', 'artist')">${track.artist}</span>
```

### **PASSO 2: Implementar Cálculo de Duração**
```typescript
function calculateAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.onloadedmetadata = () => resolve(audio.duration);
    audio.src = URL.createObjectURL(file);
  });
}
```

### **PASSO 3: Sistema de Edição Inline**
```typescript
function enableEdit(trackId: string, field: 'title' | 'artist') {
  // Converter span em input
  // Adicionar handlers para Enter/Escape
  // Salvar via API quando confirmar
}
```

### **PASSO 4: Totalizador Dinâmico**
```typescript  
function updateTotals(tracks: Track[]) {
  const totalTracks = tracks.length;
  const totalDuration = tracks.reduce((sum, track) => sum + track.duration, 0);
  const formattedDuration = formatDuration(totalDuration);
  
  document.getElementById('music-totals').innerHTML = 
    `📊 Total: ${totalTracks} músicas • ⏱️ ${formattedDuration}`;
}
```

---

## 🎯 **ARQUIVOS A MODIFICAR:**

### **1. `/src/admin.ts`** 
- Função `loadMusicList()` → remover botões, adicionar campos editáveis
- Adicionar funções `enableEdit()`, `saveEdit()`, `cancelEdit()`
- Implementar `calculateAudioDuration()`
- Adicionar `updateTotals()`

### **2. `/admin.html`**
- Adicionar CSS para campos editáveis (hover effects, styling)
- Garantir que totalizador `#music-totals` seja visível

### **3. `/backend/app.js` (se necessário)**
- Verificar se endpoint `PUT /api/tracks/:id/metadata` existe
- Implementar se não existir

---

## 🧪 **TESTES NECESSÁRIOS:**

### **Teste 1: Edição Inline**
- [ ] Clicar no título converte para input
- [ ] Enter salva alteração
- [ ] Escape cancela edição
- [ ] Mudança persiste no backend

### **Teste 2: Cálculo de Duração**
- [ ] Upload mostra duração real do arquivo
- [ ] Duração em formato legível (MM:SS)
- [ ] Totalizador soma corretamente

### **Teste 3: UX/UI**
- [ ] Campos editáveis têm hover effect
- [ ] Visual feedback durante edição
- [ ] Totalizador atualiza em tempo real
- [ ] Sem botões desnecessários

---

## 🚀 **CRONOGRAMA DE EXECUÇÃO:**

1. **[30 min]** Analisar código atual e dependências
2. **[45 min]** Implementar edição inline (funções JS/TS)
3. **[30 min]** Implementar cálculo de duração  
4. **[15 min]** Criar totalizador dinâmico
5. **[20 min]** Remover botões Preview/Edit desnecessários
6. **[30 min]** Testes e ajustes finais
7. **[15 min]** Commit e push para staging

**TOTAL ESTIMADO**: ~3 horas

---

## 📚 **REFERÊNCIAS DA VERSÃO LOCAL:**

Baseado nos arquivos encontrados:
- `admin-backup-original.html` - mostra edição inline funcionando
- `admin/scripts/music-manager.js` - funções de edição implementadas
- `PLANO_EXECUCAO.md` - documentação das funcionalidades

**PRÓXIMO PASSO**: Começar implementação seguindo este plano! 🚀
