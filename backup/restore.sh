#!/usr/bin/env bash
# Restaura um backup (pasta com mongo.archive.gz e minio.tar.gz) por cima do
# banco, do bucket, do analytics, da newsletter e dos comentários atuais: o banco é substituído coleção por coleção (--drop)
# e o bucket fica igual ao do backup (--remove). Confere o SHA256SUMS antes.
#
#   restore.sh /backups/daily/2026-11-24_0330 --sim
#
# Pare o app antes (docker compose ... stop app) e depois recrie o container
# (docker compose ... up -d --force-recreate app): isso limpa o cache das páginas.
set -euo pipefail
: "${DATABASE_URI:?}" "${S3_BUCKET:?}" "${S3_ACCESS_KEY_ID:?}" "${S3_SECRET_ACCESS_KEY:?}"
SRC="${1:-}"
if [ -z "$SRC" ] || [ ! -f "$SRC/mongo.archive.gz" ] || [ ! -f "$SRC/minio.tar.gz" ]; then
  echo "uso: restore.sh /backups/daily/<pasta> --sim" >&2
  echo "backups disponíveis:" >&2
  ls -1d /backups/daily/* /backups/weekly/* 2>/dev/null >&2 || true
  exit 2
fi
if [ "${2:-}" != "--sim" ]; then
  echo "restore: isso SUBSTITUI o banco e o bucket atuais por $SRC." >&2
  echo "restore: rode de novo com --sim no fim pra confirmar." >&2
  exit 3
fi

echo "restore: conferindo SHA256SUMS"
(cd "$SRC" && sha256sum -c --quiet SHA256SUMS)

echo "restore: banco"
mongorestore --uri="$DATABASE_URI" --archive="$SRC/mongo.archive.gz" --gzip --drop \
  --nsInclude='pronto_falei.*' --quiet

echo "restore: bucket $S3_BUCKET"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
tar -xzf "$SRC/minio.tar.gz" -C "$work"
mc alias set pf "${MINIO_URL:-http://minio:9000}" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null
mc mirror --quiet --overwrite --remove "$work" "pf/$S3_BUCKET" >/dev/null

if [ -f "$SRC/umami.dump" ] && [ -n "${PGHOST:-}" ]; then
  echo "restore: analytics (postgres)"
  pg_restore --clean --if-exists --no-owner -d "${PGDATABASE:-umami}" "$SRC/umami.dump"
fi

if [ -f "$SRC/listmonk.dump" ] && [ -n "${PGHOST:-}" ] && [ -n "${LISTMONK_DB_PASSWORD:-}" ]; then
  echo "restore: newsletter (postgres)"
  PGUSER=listmonk PGPASSWORD="$LISTMONK_DB_PASSWORD" \
    pg_restore --clean --if-exists --no-owner -d listmonk "$SRC/listmonk.dump"
  echo "restore: reinicie o Listmonk (docker compose ... restart listmonk)"
fi

if [ -f "$SRC/remark42.json.gz" ] && [ -n "${REMARK_INTERNAL_URL:-}" ]; then
  echo "restore: comentários (remark42)"
  : "${REMARK_ADMIN_PASSWD:?}" "${REMARK_SITE_ID:?}"
  auth() { printf 'user = "admin:%s"\n' "$REMARK_ADMIN_PASSWD"; }
  # import nativo: substitui todos os comentários do site pelos do backup (assíncrono)
  gunzip -c "$SRC/remark42.json.gz" |
    curl -fsS -K <(auth) -X POST -H 'Content-Type: application/json' --data-binary @- \
      "$REMARK_INTERNAL_URL/api/v1/admin/import?site=$REMARK_SITE_ID&provider=native" >/dev/null
  auth | curl -fsS -K - -m 300 "$REMARK_INTERNAL_URL/api/v1/admin/wait?site=$REMARK_SITE_ID&timeout=5m" >/dev/null
fi

echo "restore: ok ($SRC)"
echo "restore: agora recrie o app (up -d --force-recreate app) pra limpar o cache das páginas"
