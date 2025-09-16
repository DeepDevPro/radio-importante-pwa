#!/usr/bin/env bash
# Cria/atualiza um perfil AWS CLI e gera um .env.aws local (ignorado pelo git)
# Uso:
#   ./scripts/setup-aws-env.sh -p radio-importante -r us-west-2
# Opções:
#   -p <profile>   Nome do perfil AWS CLI (default: default)
#   -r <region>    Região (default: us-west-2)
#   --no-dotenv    Não criar .env.aws
#
set -euo pipefail
PROFILE="default"
REGION="us-west-2"
WRITE_DOTENV=true

while [ $# -gt 0 ]; do
  case "$1" in
    -p) PROFILE="$2"; shift 2;;
    -r) REGION="$2"; shift 2;;
    --no-dotenv) WRITE_DOTENV=false; shift;;
    -h|--help) grep '^#' "$0" | sed 's/^# //'; exit 0;;
    *) echo "Opção desconhecida: $1" >&2; exit 1;;
  esac
done

read -rp "AWS Access Key ID: " AWS_ACCESS_KEY_ID
read -srp "AWS Secret Access Key: " AWS_SECRET_ACCESS_KEY; echo

# Configura o perfil no AWS CLI
aws configure set aws_access_key_id "$AWS_ACCESS_KEY_ID" --profile "$PROFILE"
aws configure set aws_secret_access_key "$AWS_SECRET_ACCESS_KEY" --profile "$PROFILE"
aws configure set region "$REGION" --profile "$PROFILE"
aws configure set output "json" --profile "$PROFILE"

# Gera .env.aws local (para facilitar uso em shells/CI locais)
if $WRITE_DOTENV; then
  cat > .env.aws <<EOF
AWS_PROFILE=$PROFILE
AWS_DEFAULT_REGION=$REGION
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
EOF
  echo "Gerado .env.aws (não comitar)."
fi

# Garante que .env* fique ignorado no git
if [ ! -f .gitignore ]; then
  echo -e ".env\n.env.*\n.env.aws\n" > .gitignore
elif ! grep -qE '^\.env(\.|$)' .gitignore; then
  printf "\n.env\n.env.*\n.env.aws\n" >> .gitignore
fi

echo "Perfil configurado: $PROFILE (região: $REGION)"

echo "Teste suas credenciais com:"
echo "  AWS_PROFILE=$PROFILE aws sts get-caller-identity"

echo "Para carregar variáveis no shell atual:"
echo "  source ./.env.aws  # (apenas local, não comitar)"
