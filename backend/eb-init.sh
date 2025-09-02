#!/bin/bash

# Inicialização do Elastic Beanstalk para Radio Importante Backend

echo "🚀 Iniciando configuração do Elastic Beanstalk..."

# Verificar se estamos no diretório backend
if [ ! -f "app.js" ]; then
    echo "❌ Erro: Execute este script a partir do diretório /backend/"
    exit 1
fi

# Verificar se EB CLI está instalado
if ! command -v eb &> /dev/null; then
    echo "❌ EB CLI não encontrado. Instale com: pip install awsebcli"
    exit 1
fi

# Verificar se AWS CLI está instalado
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI não encontrado. Instale com: brew install awscli"
    exit 1
fi

echo "✅ Pré-requisitos verificados"

# Inicializar aplicação EB
echo "🔧 Inicializando aplicação Elastic Beanstalk..."
eb init radio-importante-backend --region us-east-1 --platform "Node.js 18"

# Verificar se inicialização foi bem-sucedida
if [ $? -eq 0 ]; then
    echo "✅ Aplicação EB inicializada com sucesso"
else
    echo "❌ Erro na inicialização do EB"
    exit 1
fi

# Instruções para próximos passos
echo ""
echo "🎯 Próximos passos:"
echo "1. Configure suas credenciais AWS:"
echo "   aws configure"
echo ""
echo "2. Crie o ambiente de produção:"
echo "   eb create radio-backend-prod --instance-type t3.micro"
echo ""
echo "3. Configure variáveis de ambiente:"
echo "   eb setenv AWS_REGION=us-east-1 S3_BUCKET_NAME=radio-importante-storage"
echo ""
echo "4. Deploy da aplicação:"
echo "   eb deploy"
echo ""
echo "5. Verifique o status:"
echo "   eb status"
echo "   eb open"
echo ""
echo "🔗 Documentação: https://docs.aws.amazon.com/elasticbeanstalk/"
