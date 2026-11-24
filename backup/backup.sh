#!/usr/bin/env bash
# Backup completo: banco (mongodump --archive --gzip) + bucket do MinIO
# (espelho incremental, empacotado em tar.gz). Cada backup vira uma pasta em
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

(cd "$TMP" && sha256sum mongo.archive.gz minio.tar.gz > SHA256SUMS)
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
