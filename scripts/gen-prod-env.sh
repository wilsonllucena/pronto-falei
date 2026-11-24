#!/usr/bin/env bash
# Gera o .env de produção com segredos fortes, direto no servidor, sem
# imprimir nenhum valor. Num .env existente só acrescenta chaves que faltam.
#
#   bash scripts/gen-prod-env.sh ../.env
#
# SERVER_URL (opcional): URL pública do site; padrão é o Tailscale do Umbrel.
set -euo pipefail
OUT="${1:?uso: gen-prod-env.sh <arquivo .env>}"
umask 077
hex() { head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }

# Chaves que entraram depois da primeira geração: num .env existente, só
# acrescenta as que faltam (nunca muda nem mostra valores).
complete_env() {
  local added=()
  add() { grep -q "^$1=" "$OUT" || { printf '%s=%s\n' "$1" "$2" >> "$OUT"; added+=("$1"); }; }
  add PG_PASSWORD "$(hex 24)"
  add UMAMI_DB_PASSWORD "$(hex 24)"
  add UMAMI_APP_SECRET "$(hex 32)"
  chmod 600 "$OUT"
  if [ "${#added[@]}" -gt 0 ]; then echo "gen-prod-env: acrescentei ${added[*]}"; fi
}

if [ -e "$OUT" ]; then
  complete_env
  exit 0
fi
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
printf '\n# Analytics (passo 11): Postgres compartilhado + Umami\n' >> "$OUT"
complete_env
chmod 600 "$OUT"
echo "gen-prod-env: $OUT criado (600)"
