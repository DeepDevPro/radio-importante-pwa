#!/bin/bash

# Script para forçar recriação do EB environment
echo "🔥 FORCING EB ENVIRONMENT RECREATION"

# Terminar environment atual
echo "Terminating current environment..."
eb terminate radio-importante-backend-prod --force || echo "Environment termination failed or not found"

# Aguardar terminação
echo "Waiting for environment termination..."
sleep 30

# Recriar com Node.js 18 estável
echo "Creating new environment with Node.js 18..."
eb create radio-importante-backend-prod \
  --platform "Node.js 18 running on 64bit Amazon Linux 2023" \
  --instance-type t3.micro \
  --timeout 25 \
  --envvars NODE_ENV=production,PORT=8080

echo "✅ Environment recreation completed"
