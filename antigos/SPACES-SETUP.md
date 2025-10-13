# Digital Ocean Spaces - Configuração para Storage Persistente

## Problema Resolvido

Antes, os arquivos de música eram armazenados no filesystem do container, o que significa que **toda vez que fazíamos um deploy, os arquivos desapareciam**. Agora usamos Digital Ocean Spaces (compatível com S3) para storage persistente.

## Configuração do Digital Ocean Spaces

### 1. Criar o Space

1. Acesse o painel do Digital Ocean
2. Vá em **Spaces** no menu lateral
3. Clique em **Create a Space**
4. Escolha:
   - **Datacenter region**: NYC3 (ou a região mais próxima)
   - **Space name**: `radio-importante-audio`
   - **File Listing**: Public (para permitir acesso direto aos arquivos)

### 2. Gerar as Chaves de Acesso

1. No painel do Digital Ocean, vá em **API**
2. Na seção **Spaces access keys**, clique em **Generate New Key**
3. Anote o **Access Key** e **Secret Key** (o secret só aparece uma vez!)

### 3. Configurar as Variáveis de Ambiente

#### Para Digital Ocean App Platform:

Adicione estas variáveis no painel do App Platform:

```bash
DO_SPACES_ENDPOINT=nyc3.digitaloceanspaces.com
DO_SPACES_REGION=nyc3
DO_SPACES_BUCKET=radio-importante-audio
DO_SPACES_KEY=sua_access_key_aqui
DO_SPACES_SECRET=sua_secret_key_aqui
```

#### Para desenvolvimento local:

Crie um arquivo `.env` na pasta `backend/` com:

```bash
DO_SPACES_ENDPOINT=nyc3.digitaloceanspaces.com
DO_SPACES_REGION=nyc3
DO_SPACES_BUCKET=radio-importante-audio
DO_SPACES_KEY=sua_access_key_aqui
DO_SPACES_SECRET=sua_secret_key_aqui
NODE_ENV=development
```

## Como Funciona

1. **Upload**: Arquivos são enviados diretamente para o Digital Ocean Spaces
2. **URL**: Cada arquivo recebe uma URL pública: `https://radio-importante-audio.nyc3.digitaloceanspaces.com/audio/arquivo.mp3`
3. **Persistência**: Arquivos permanecem no Spaces mesmo com redeploys
4. **Performance**: CDN integrado do Digital Ocean para entrega rápida

## Benefícios

✅ **Persistência**: Arquivos sobrevivem a deploys  
✅ **Performance**: CDN global do Digital Ocean  
✅ **Escalabilidade**: Sem limite de storage no container  
✅ **Backup**: Digital Ocean cuida da redundância  
✅ **Custo**: Pague apenas pelo que usar  

## Verificação

Para testar se está funcionando:

1. Faça upload de uma música no admin
2. Faça um novo deploy
3. A música deve continuar disponível

## Troubleshooting

### Erro de permissão:
- Verifique se as chaves DO_SPACES_KEY e DO_SPACES_SECRET estão corretas

### Arquivo não encontrado:
- Confirme se o bucket name está correto
- Verifique se o Space está configurado como público

### Erro de CORS:
- Nas configurações do Space, adicione as origens permitidas na seção CORS
