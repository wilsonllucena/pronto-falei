#!/usr/bin/env bash
# Cria o PRIMEIRO usuário do admin (só funciona com o banco sem usuários) com
# uma senha forte gerada aqui, e guarda e-mail + senha num arquivo 600.
# Não imprime a senha. Rode no servidor, logo depois do primeiro deploy, pra
# ninguém na rede "pegar" o admin antes.
#
#   ADMIN_EMAIL=voce@exemplo.com bash scripts/create-admin.sh ../secrets/admin.txt
set -euo pipefail
OUT="${1:?uso: create-admin.sh <arquivo de credenciais>}"
: "${ADMIN_EMAIL:?defina ADMIN_EMAIL}"
ADMIN_NAME="${ADMIN_NAME:-Wilson Lima}"
URL="${APP_URL:-http://127.0.0.1:3130}"
if [ -e "$OUT" ]; then
  echo "create-admin: $OUT já existe, não mexi" >&2
  exit 1
fi
umask 077
mkdir -p "$(dirname "$OUT")"
PASS=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
body=$(printf '{"email":"%s","password":"%s","name":"%s"}' "$ADMIN_EMAIL" "$PASS" "$ADMIN_NAME")
code=$(curl -s -o /tmp/create-admin.$$ -w '%{http_code}' -X POST "$URL/api/users/first-register" \
  -H 'Content-Type: application/json' -H "Origin: $URL" --data-binary @- <<<"$body")
rm -f /tmp/create-admin.$$
if [ "$code" != 200 ] && [ "$code" != 201 ]; then
  echo "create-admin: falhou (HTTP $code). Já existe usuário?" >&2
  exit 1
fi
printf 'url=%s/admin\nemail=%s\nsenha=%s\n' "$URL" "$ADMIN_EMAIL" "$PASS" > "$OUT"
chmod 600 "$OUT"
echo "create-admin: usuário $ADMIN_EMAIL criado; credenciais em $OUT (600)"
