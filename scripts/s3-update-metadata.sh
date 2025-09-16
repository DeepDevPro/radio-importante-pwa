#!/usr/bin/env bash
# Atualiza Content-Type e Cache-Control de arquivos já enviados ao S3
# e opcionalmente cria invalidation no CloudFront.
# Uso básico:
#   ./scripts/s3-update-metadata.sh -b radio-importante-frontend -d E7IJOAICB6CUO --all
# Opções:
#   -b <bucket>              (obrigatório) nome do bucket S3
#   -d <distribution_id>     (opcional) ID da distribuição CloudFront para invalidar
#   --all                    executa todos os grupos (senão use flags individuais)
#   --html --sw --scripts --assets --json --manifest --svg --invalidation
#   --dry-run                apenas mostra os comandos
#
# Atenção: --metadata-directive REPLACE substitui TODOS os metadados existentes.
# Se você tiver Content-Encoding ou outros metadados customizados, ajuste antes.

set -euo pipefail

SHORT_CACHE="public,max-age=300"           # 5 min
LONG_CACHE="public,max-age=31536000,immutable"  # 1 ano + immutable
NO_CACHE="no-cache"

BUCKET=""
DISTRIBUTION_ID=""
DO_HTML=false
DO_SW=false
DO_SCRIPTS=false
DO_ASSETS=false
DO_JSON=false
DO_MANIFEST=false
DO_SVG=false
DO_INVALIDATION=false
DRY_RUN=false
ALL=false

log(){ echo "[INFO] $*"; }
err(){ echo "[ERRO] $*" >&2; }
run(){ if $DRY_RUN; then echo "(dry-run) $*"; else eval "$*"; fi }

usage(){ grep '^#' "$0" | sed 's/^# //'; exit 1; }

[ $# -eq 0 ] && usage

while [ $# -gt 0 ]; do
  case $1 in
    -b) BUCKET=$2; shift 2;;
    -d) DISTRIBUTION_ID=$2; shift 2;;
    --dry-run) DRY_RUN=true; shift;;
    --all) ALL=true; shift;;
    --html) DO_HTML=true; shift;;
    --sw) DO_SW=true; shift;;
    --scripts) DO_SCRIPTS=true; shift;;
    --assets) DO_ASSETS=true; shift;;
    --json) DO_JSON=true; shift;;
    --manifest) DO_MANIFEST=true; shift;;
    --svg) DO_SVG=true; shift;;
    --invalidation) DO_INVALIDATION=true; shift;;
    -h|--help) usage;;
    *) err "Opção desconhecida: $1"; usage;;
  esac
done

if [ -z "$BUCKET" ]; then err "Bucket obrigatório (-b)."; exit 1; fi

if $ALL; then
  DO_HTML=true
  DO_SW=true
  DO_SCRIPTS=true
  DO_ASSETS=true
  DO_JSON=true
  DO_MANIFEST=true
  DO_SVG=true
fi

# Verifica credenciais
if ! aws sts get-caller-identity >/dev/null 2>&1; then
  err "Credenciais AWS não configuradas. Rode: aws configure"; exit 1
fi

log "Bucket: $BUCKET"
$DRY_RUN && log "Modo dry-run (nenhuma alteração será aplicada)"

# Cada bloco testa se há arquivos antes de aplicar (minimiza erros)
exec_block(){
  local label=$1; shift
  local test_cmd=$1; shift
  local cmd=$1; shift
  if eval "$test_cmd" >/dev/null 2>&1; then
    log "Aplicando: $label"
    run "$cmd"
  else
    log "Ignorando $label (nenhum arquivo)"
  fi
}

# HTML (no-cache)
$DO_HTML && exec_block "HTML" \
  "aws s3 ls s3://$BUCKET/ | grep -q .html" \
  "aws s3 cp dist s3://$BUCKET/ --recursive --exclude '*' --include '*.html' --content-type 'text/html' --cache-control '$NO_CACHE' --metadata-directive REPLACE"

# Service Worker (no-cache)
$DO_SW && exec_block "Service Worker" \
  "aws s3 ls s3://$BUCKET/sw.js" \
  "aws s3 cp dist s3://$BUCKET/ --recursive --exclude '*' --include 'sw.js' --content-type 'text/javascript' --cache-control '$NO_CACHE' --metadata-directive REPLACE"

# scripts/*.js e styles/*.css (curto)
$DO_SCRIPTS && exec_block "Scripts & CSS curtos" \
  "aws s3 ls s3://$BUCKET/scripts/ >/dev/null 2>&1" \
  "aws s3 cp dist s3://$BUCKET/ --recursive --exclude '*' --include 'scripts/*.js' --include 'styles/*.css' --content-type 'text/javascript' --cache-control '$SHORT_CACHE' --metadata-directive REPLACE; \
   aws s3 cp dist s3://$BUCKET/ --recursive --exclude '*' --include 'styles/*.css' --content-type 'text/css' --cache-control '$SHORT_CACHE' --metadata-directive REPLACE"

# assets/*.js (long cache)
$DO_ASSETS && exec_block "Assets JS (hash)" \
  "aws s3 ls s3://$BUCKET/assets/ | grep -q .js" \
  "aws s3 cp dist s3://$BUCKET/ --recursive --exclude '*' --include 'assets/*.js' --content-type 'text/javascript' --cache-control '$LONG_CACHE' --metadata-directive REPLACE"

# JSON
$DO_JSON && exec_block "JSON" \
  "aws s3 ls s3://$BUCKET/data/ >/dev/null 2>&1 || aws s3 ls s3://$BUCKET/assets/ | grep -q .json" \
  "aws s3 cp dist s3://$BUCKET/ --recursive --exclude '*' --include 'data/*.json' --include 'assets/*.json' --content-type 'application/json' --cache-control '$SHORT_CACHE' --metadata-directive REPLACE"

# Manifest
$DO_MANIFEST && exec_block "Manifest" \
  "aws s3 ls s3://$BUCKET/manifest.webmanifest" \
  "aws s3 cp dist s3://$BUCKET/ --recursive --exclude '*' --include 'manifest.webmanifest' --content-type 'application/manifest+json' --cache-control '$SHORT_CACHE' --metadata-directive REPLACE"

# SVG
$DO_SVG && exec_block "SVG" \
  "aws s3 ls s3://$BUCKET/icons/ | grep -q .svg" \
  "aws s3 cp dist s3://$BUCKET/ --recursive --exclude '*' --include 'icons/*.svg' --include '*.svg' --content-type 'image/svg+xml' --cache-control '$LONG_CACHE' --metadata-directive REPLACE"

# Invalidation
if $DO_INVALIDATION; then
  if [ -z "$DISTRIBUTION_ID" ]; then
    err "--invalidation requer -d <distribution_id>"; exit 1
  fi
  log "Criando invalidation CloudFront (/*)"
  run "aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths '/*'"
fi

log "Concluído."
