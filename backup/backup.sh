#!/usr/bin/env bash
# Backup completo: banco (mongodump --archive --gzip) + bucket do MinIO
# (espelho incremental, empacotado em tar.gz) + analytics (pg_dump do Umami,
# e newsletter (Listmonk), se PGHOST estiver definido) + comentários (export nativo do Remark42, se
# REMARK_INTERNAL_URL estiver definido). Cada backup vira uma pasta em
# /backups/daily/AAAA-MM-DD_HHMM com SHA256SUMS. Domingo também vai pra
# /backups/weekly. Retenção: KEEP_DAILY diários e KEEP_WEEKLY semanais.
set -euo pipefail
: "${DATABASE_URI:?}" "${S3_BUCKET:?}" "${S3_ACCESS_KEY_ID:?}" "${S3_SECRET_ACCESS_KEY:?}"
ROOT=/backups
KEEP_DAILY="${KEEP_DAILY:-7}"
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"
STAMP=$(date +%Y-%m-%d_%H%M)
DEST="$ROOT/daily/$STAMP"
TMP="$DEST.part"
mkdir -p "$ROOT/daily" "$ROOT/weekly" "$ROOT/.minio-mirror"
rm -rf "$TMP" && mkdir -p "$TMP"
start=$(date +%s)

echo "backup: banco"
mongodump --uri="$DATABASE_URI" --archive="$TMP/mongo.archive.gz" --gzip --quiet

echo "backup: bucket $S3_BUCKET"
mc alias set pf "${MINIO_URL:-http://minio:9000}" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null
mc mirror --quiet --overwrite --remove "pf/$S3_BUCKET" "$ROOT/.minio-mirror" >/dev/null
objects=$(find "$ROOT/.minio-mirror" -type f | wc -l)
tar -czf "$TMP/minio.tar.gz" -C "$ROOT/.minio-mirror" .

files=(mongo.archive.gz minio.tar.gz)
if [ -n "${PGHOST:-}" ]; then # analytics (Umami), se configurado
  echo "backup: analytics (postgres)"
  pg_dump -Fc -f "$TMP/umami.dump"
  files+=(umami.dump)
  if [ -n "${LISTMONK_DB_PASSWORD:-}" ]; then # newsletter (Listmonk)
    echo "backup: newsletter (postgres)"
    PGUSER=listmonk PGDATABASE=listmonk PGPASSWORD="$LISTMONK_DB_PASSWORD" \
      pg_dump -Fc -f "$TMP/listmonk.dump"
    files+=(listmonk.dump)
  fi
fi
if [ -n "${REMARK_INTERNAL_URL:-}" ]; then # comentários (Remark42), se configurado
  echo "backup: comentários (remark42)"
  : "${REMARK_ADMIN_PASSWD:?}" "${REMARK_SITE_ID:?}"
  # senha via stdin (-K -), nunca na linha de comando
  printf 'user = "admin:%s"\n' "$REMARK_ADMIN_PASSWD" |
    curl -fsS -K - "$REMARK_INTERNAL_URL/api/v1/admin/export?site=$REMARK_SITE_ID&mode=stream" |
    gzip -9 > "$TMP/remark42.json.gz"
  gzip -t "$TMP/remark42.json.gz"
  files+=(remark42.json.gz)
fi
(cd "$TMP" && sha256sum "${files[@]}" > SHA256SUMS)
printf 'data=%s\nobjetos_no_bucket=%s\n' "$(date -Iseconds)" "$objects" > "$TMP/INFO"
mv "$TMP" "$DEST"

if [ "$(date +%u)" = 7 ] || [ "${FORCE_WEEKLY:-}" = 1 ]; then
  rm -rf "$ROOT/weekly/$STAMP" && cp -a "$DEST" "$ROOT/weekly/$STAMP"
fi

prune() { # mantém só os N mais novos de uma pasta
  find "$1" -mindepth 1 -maxdepth 1 -type d ! -name '*.part' | sort | head -n "-$2" | xargs -r rm -rf
}
prune "$ROOT/daily" "$KEEP_DAILY"
prune "$ROOT/weekly" "$KEEP_WEEKLY"

size=$(du -sh "$DEST" | cut -f1)
echo "backup: ok $DEST ($size, $objects objetos, $(($(date +%s) - start)) s)"
