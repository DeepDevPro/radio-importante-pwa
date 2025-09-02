# Radio Importante - Backend API

Backend em Express.js para o sistema de upload de músicas do Radio Importante.

## 🚀 Características

- **Upload de Arquivos**: Suporte para MP3, WAV, FLAC, AAC, OGG
- **Integração S3**: Upload direto para Amazon S3
- **Gerenciamento de Catálogo**: Atualização automática do catálogo de músicas
- **Segurança**: Rate limiting, CORS configurado, validação de arquivos
- **Monitoramento**: Health checks e logs estruturados

## 📋 Pré-requisitos

- Node.js 18+
- Conta AWS com acesso ao S3
- AWS CLI configurado
- EB CLI instalado

## 🔧 Configuração Local

1. **Instalar dependências**:
```bash
npm install
```

2. **Configurar variáveis de ambiente**:
```bash
cp .env.example .env
# Editar .env com suas credenciais AWS
```

3. **Executar localmente**:
```bash
npm run dev
```

O servidor estará disponível em `http://localhost:3001`

## 🌐 Deploy no Elastic Beanstalk

1. **Inicializar aplicação EB**:
```bash
eb init
```

2. **Criar ambiente**:
```bash
eb create radio-importante-api
```

3. **Configurar variáveis de ambiente**:
```bash
eb setenv AWS_ACCESS_KEY_ID=your_key AWS_SECRET_ACCESS_KEY=your_secret S3_BUCKET_NAME=your_bucket
```

4. **Deploy**:
```bash
eb deploy
```

## 📚 API Endpoints

### Upload
- `POST /api/upload` - Upload de arquivos de áudio
- `GET /api/upload/status` - Status do serviço

### Catálogo
- `GET /api/catalog` - Obter catálogo completo
- `GET /api/catalog/stats` - Estatísticas do catálogo
- `GET /api/catalog/search` - Buscar faixas
- `DELETE /api/catalog/track/:id` - Remover faixa

### Sistema
- `GET /health` - Health check
- `GET /` - Informações da API

## 🔒 Segurança

- Rate limiting configurado
- CORS para domínios específicos
- Validação de tipos de arquivo
- Helmet para headers de segurança
- Limite de tamanho de arquivo (50MB)

## 📁 Estrutura do Projeto

```
backend/
├── app.js              # Servidor principal
├── config/
│   └── aws.js          # Configuração AWS/S3
├── middleware/
│   └── upload.js       # Middleware de upload
├── routes/
│   ├── upload.js       # Rotas de upload
│   └── catalog.js      # Rotas do catálogo
├── services/
│   └── catalogService.js # Serviço do catálogo
└── .ebextensions/      # Configurações EB
```

## 🐛 Debug

Para testar localmente sem S3:
```bash
NODE_ENV=development npm run dev
```

Para logs detalhados:
```bash
DEBUG=* npm run dev
```

## 📊 Monitoramento

- Health check: `/health`
- Logs: CloudWatch (produção) ou console (desenvolvimento)
- Métricas: AWS CloudWatch
