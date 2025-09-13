# Dockerfile for backend (Radio Importante)
# Uses Node 18, listens on PORT env var (default 8080)
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app source
COPY . .

# Ensure upload directory exists when using disk storage
RUN mkdir -p /usr/src/app/public/audio || true

ENV PORT=8080
EXPOSE 8080

# Start the app
CMD ["node", "app.js"]
