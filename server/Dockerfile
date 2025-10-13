# Base oficial Node LTS (slim) — amplamente usada em produção
FROM node:18-bookworm-slim

# Atualiza pacotes e instala ffmpeg (inclui ffprobe)
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

# Diretório de trabalho
WORKDIR /app

# Copia manifestos do diretório server e instala dependências de produção
COPY server/package*.json ./
RUN npm ci --only=production

# Copia o código do backend (pasta server)
COPY server/ .

# Define ambiente de produção por padrão
ENV NODE_ENV=production

# Exponha a porta padrão (o App Platform injeta PORT)
EXPOSE 8080

# Comando de execução — deve honrar process.env.PORT internamente
CMD ["npm", "start"]
