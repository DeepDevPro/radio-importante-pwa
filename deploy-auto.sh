#!/bin/bash

# 🚀 Script de Deploy Automático - Rádio Importante PWA
# Este script configura e executa o deploy completo via GitHub Actions

set -e

echo "🔥 === DEPLOY AUTOMÁTICO GITHUB ACTIONS === 🔥"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções de utilidade
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_step() {
    echo -e "${BLUE}🔄 $1${NC}"
}

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ] || [ ! -d ".github/workflows" ]; then
    print_error "Execute este script na raiz do projeto (onde está o package.json)"
    exit 1
fi

echo "📋 CHECKLIST PRÉ-DEPLOY:"
echo ""

# 1. Verificar se estamos no git
print_step "Verificando repositório Git..."
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    print_error "Este não é um repositório Git"
    exit 1
fi
print_success "Repositório Git detectado"

# 2. Verificar se há mudanças não commitadas
if ! git diff-index --quiet HEAD --; then
    print_warning "Há mudanças não commitadas. Commit antes de continuar."
    read -p "Deseja continuar mesmo assim? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 3. Verificar se temos origin remote
print_step "Verificando remote origin..."
if ! git remote get-url origin > /dev/null 2>&1; then
    print_error "Remote origin não configurado"
    exit 1
fi
REPO_URL=$(git remote get-url origin)
print_success "Remote origin: $REPO_URL"

# 4. Verificar workflows
print_step "Verificando workflows GitHub Actions..."
WORKFLOWS=(
    ".github/workflows/deploy-backend.yml"
    ".github/workflows/deploy-complete.yml"
    ".github/workflows/test-setup.yml"
)

for workflow in "${WORKFLOWS[@]}"; do
    if [ -f "$workflow" ]; then
        print_success "$(basename $workflow)"
    else
        print_error "Workflow não encontrado: $workflow"
        exit 1
    fi
done

echo ""
echo "🔐 CONFIGURAÇÃO DE SECRETS:"
echo ""

print_info "Você precisa configurar estes secrets no GitHub:"
echo "   • AWS_ACCESS_KEY_ID"
echo "   • AWS_SECRET_ACCESS_KEY"
echo "   • S3_BUCKET_NAME"
echo ""

# Extrair owner/repo do URL
if [[ $REPO_URL =~ github\.com[:/]([^/]+)/([^/]+)(\.git)?$ ]]; then
    REPO_OWNER="${BASH_REMATCH[1]}"
    REPO_NAME="${BASH_REMATCH[2]%.git}"
    SECRETS_URL="https://github.com/$REPO_OWNER/$REPO_NAME/settings/secrets/actions"
    ACTIONS_URL="https://github.com/$REPO_OWNER/$REPO_NAME/actions"
    
    print_info "Configurar secrets em: $SECRETS_URL"
    print_info "Ver workflows em: $ACTIONS_URL"
else
    print_warning "Não foi possível extrair informações do repositório"
fi

echo ""
read -p "Já configurou os secrets? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Configure os secrets primeiro e execute o script novamente"
    print_info "Instruções completas em: .github/SECRETS_SETUP.md"
    exit 0
fi

echo ""
echo "🚀 OPÇÕES DE DEPLOY:"
echo ""
echo "1. 🧪 Testar configuração (recomendado primeiro)"
echo "2. 🏗️  Deploy apenas backend"
echo "3. 🎨 Deploy apenas frontend"
echo "4. 🚀 Deploy completo (backend + frontend)"
echo "5. 📝 Commit e push (deploy automático)"
echo ""

read -p "Escolha uma opção (1-5): " -n 1 -r
echo

case $REPLY in
    1)
        print_step "Executando teste de configuração..."
        echo ""
        print_info "Abra: $ACTIONS_URL"
        print_info "Execute: '🧪 Test GitHub Actions Setup'"
        print_info "Escolha 'full' para teste completo"
        ;;
    2)
        print_step "Executando deploy do backend..."
        echo ""
        print_info "Abra: $ACTIONS_URL"
        print_info "Execute: '🚀 Deploy Backend to Elastic Beanstalk'"
        ;;
    3)
        print_step "Deploy do frontend será via push..."
        print_info "O frontend é deployado automaticamente no push para main"
        print_info "Use opção 5 para fazer commit e push"
        ;;
    4)
        print_step "Executando deploy completo..."
        echo ""
        print_info "Abra: $ACTIONS_URL"
        print_info "Execute: '🚀 Deploy Complete Stack'"
        print_info "Habilite tanto backend quanto frontend"
        ;;
    5)
        print_step "Preparando commit e push..."
        echo ""
        
        # Verificar se há mudanças para commit
        if git diff-index --quiet HEAD --; then
            print_warning "Não há mudanças para commit"
        else
            # Mostrar status
            echo "📝 Status atual:"
            git status --short
            echo ""
            
            read -p "Mensagem do commit: " -r COMMIT_MSG
            if [ -z "$COMMIT_MSG" ]; then
                COMMIT_MSG="Deploy automático via script"
            fi
            
            print_step "Fazendo commit..."
            git add .
            git commit -m "$COMMIT_MSG"
        fi
        
        print_step "Fazendo push para main..."
        git push origin main
        
        print_success "Push realizado! Deploy automático iniciado."
        print_info "Acompanhe em: $ACTIONS_URL"
        ;;
    *)
        print_error "Opção inválida"
        exit 1
        ;;
esac

echo ""
echo "📊 MONITORAMENTO:"
echo ""
print_info "• GitHub Actions: $ACTIONS_URL"
print_info "• AWS Console EB: https://console.aws.amazon.com/elasticbeanstalk/"
print_info "• AWS Console S3: https://console.aws.amazon.com/s3/"
echo ""

print_success "Script executado com sucesso!"
print_info "Para troubleshooting, consulte: .github/SECRETS_SETUP.md"

echo ""
echo "🎯 PRÓXIMOS PASSOS:"
echo "1. ✅ Acompanhar execução no GitHub Actions"
echo "2. 🧪 Testar endpoints após deploy"
echo "3. 📊 Verificar health checks"
echo "4. 🎵 Testar upload de músicas!"

echo ""
print_success "🔥 DEPLOY AUTOMÁTICO CONFIGURADO! 🔥"
