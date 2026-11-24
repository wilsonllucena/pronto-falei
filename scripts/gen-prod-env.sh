#!/usr/bin/env bash
# Gera o .env de produção com segredos fortes, direto no servidor, sem
# imprimir nenhum valor. Não sobrescreve um .env existente.
#
#   bash scripts/gen-prod-env.sh ../.env
#
# SERVER_URL (opcional): URL pública do site; padrão é o Tailscale do Umbrel.
set -euo pipefail
OUT="${1:?uso: gen-prod-env.sh <arquivo .env>}"
if [ -e "$OUT" ]; then
  echo "gen-prod-env: $OUT já existe, não mexi"
  exit 0
fi
umask 077
hex() { head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }
cat > "$OUT" <<ENV
# Produção do Pronto, Falei! — gerado por scripts/gen-prod-env.sh em $(date -Iseconds).
# NÃO versionar, NÃO imprimir. Permissão 600.
NEXT_PUBLIC_SERVER_URL=${SERVER_URL:-http://umbrel-1.tail3bbeb5.ts.net:3130}
PAYLOAD_SECRET=$(hex 32)

MONGO_ROOT_USER=root
MONGO_ROOT_PASSWORD=$(hex 24)
MONGO_KEYFILE=$(hex 96)
MONGO_APP_USER=pronto_falei
MONGO_APP_PASSWORD=$(hex 24)

MINIO_ROOT_USER=pf-admin-$(hex 4)
MINIO_ROOT_PASSWORD=$(hex 24)
S3_BUCKET=pronto-falei-media
S3_ACCESS_KEY_ID=pf-app-$(hex 6)
S3_SECRET_ACCESS_KEY=$(hex 24)

# IA local da síntese (llama.cpp + Qwen3-4B, só texto)
COMPOSE_PROFILES=ia

# Dono dos arquivos de backup no host
PF_UID=$(id -u)
PF_GID=$(id -g)
ENV
chmod 600 "$OUT"
echo "gen-prod-env: $OUT criado (600)"
