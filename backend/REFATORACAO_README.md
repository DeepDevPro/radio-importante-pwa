# Backend Refatorado - Estrutura Modular

Esta é a nova estrutura modular do backend do Radio Importante, refatorada a partir do arquivo monolítico `app.js`.

## Objetivo
Melhorar manutenibilidade, reduzir complexidade e facilitar debugging separando responsabilidades em módulos específicos.

## Estrutura de Diretórios

```
backend/
├── app.js                    # Bootstrap principal (express setup, middlewares, routers)
├── routes/                   # Definições de rotas Express
│   ├── debugLogs.routes.js   # Endpoints de debug logs
│   ├── catalog.routes.js     # CRUD do catálogo musical
│   ├── upload.routes.js      # Upload de arquivos
│   ├── continuous.routes.js  # Geração e serving de arquivos contínuos
│   ├── hlsVod.routes.js      # HLS VOD (Video on Demand)
│   ├── hlsRolling.routes.js  # HLS Rolling (streaming contínuo)
│   └── hlsLogs.routes.js     # Logs específicos do HLS
├── services/                 # Lógica de negócio
│   ├── catalog.service.js    # Operações do catálogo
│   ├── upload.service.js     # Processamento de uploads
│   ├── continuous.service.js # Geração de arquivos contínuos
│   ├── hlsVod.service.js     # Processamento HLS VOD
│   ├── hlsRolling.service.js # Processamento HLS Rolling
│   ├── hlsStatus.service.js  # Gerenciamento de status HLS
│   ├── spaces.service.js     # Integração com DigitalOcean Spaces
│   └── logging.service.js    # Serviços de logging
├── utils/                    # Utilitários e helpers
│   ├── ffmpeg.js            # Helpers FFmpeg
│   ├── paths.js             # Construção de paths
│   ├── spacesClient.js      # Cliente S3/Spaces
│   └── fileIO.js            # Operações de arquivo
├── state/                    # Estado global da aplicação
│   ├── catalogState.js      # Estado do catálogo musical
│   └── hlsState.js          # Estado dos jobs HLS e logs
└── middleware/               # Middlewares Express
    ├── cors.js              # Configuração CORS
    ├── errorHandler.js      # Tratamento de erros
    ├── notFound.js          # Handler 404
    └── requestLogger.js     # Logging de requisições (futuro)
```

## Princípios da Refatoração

1. **Baixo Risco**: Mudanças incrementais, sem alterar URLs ou comportamento externo
2. **Simplicidade**: Usar padrões Node.js comuns, sem over-engineering
3. **Backward Compatibility**: Manter todas as rotas e endpoints existentes
4. **Testabilidade**: Cada módulo pode ser testado independentemente

## Migração

A refatoração foi feita em etapas pequenas:
- Etapa 0: Preparação e baseline
- Etapa 1: Scaffold de diretórios ✅
- Etapa 2: Middlewares básicos
- Etapa 3: Estado centralizado
- Etapa 4-7: Extração de rotas por funcionalidade
- Etapa 8: Consolidação de utils
- Etapa 9: Revisão final

## Status
🚧 **Em Desenvolvimento** - Refatoração em andamento conforme plano em `devFiles/refatoracoes/PlanoAppJSrefatoracao.md`
