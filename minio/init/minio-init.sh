#!/bin/sh
# Roda uma vez (serviço minio-init): cria o bucket, libera leitura pública só
# da pasta media/ e cria o usuário do app com acesso restrito a esse bucket.
# Idempotente: pode rodar de novo sem estragar nada.
set -eu

: "${MINIO_ROOT_USER:?defina MINIO_ROOT_USER}"
: "${MINIO_ROOT_PASSWORD:?defina MINIO_ROOT_PASSWORD}"
: "${S3_BUCKET:?defina S3_BUCKET}"
: "${S3_ACCESS_KEY_ID:?defina S3_ACCESS_KEY_ID}"
: "${S3_SECRET_ACCESS_KEY:?defina S3_SECRET_ACCESS_KEY}"
MINIO_URL="${MINIO_URL:-http://minio:9000}"
POLICY="${S3_BUCKET}-app"

MC="mcli"
command -v "$MC" >/dev/null 2>&1 || MC="mc"

echo "minio-init: conectando em $MINIO_URL"
i=0
until $MC alias set pf "$MINIO_URL" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
  i=$((i + 1))
  [ "$i" -ge 30 ] && { echo "minio-init: MinIO não respondeu" >&2; exit 1; }
  sleep 2
done

echo "minio-init: bucket $S3_BUCKET"
$MC mb --ignore-existing "pf/$S3_BUCKET"

echo "minio-init: leitura pública só em $S3_BUCKET/media"
$MC anonymous set none "pf/$S3_BUCKET"
$MC anonymous set download "pf/$S3_BUCKET/media"

echo "minio-init: política $POLICY (só esse bucket)"
cat > /tmp/policy.json <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetBucketLocation", "s3:ListBucket", "s3:ListBucketMultipartUploads"],
      "Resource": ["arn:aws:s3:::${S3_BUCKET}"]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts"
      ],
      "Resource": ["arn:aws:s3:::${S3_BUCKET}/*"]
    }
  ]
}
JSON
$MC admin policy create pf "$POLICY" /tmp/policy.json >/dev/null 2>&1 \
  || { $MC admin policy remove pf "$POLICY" >/dev/null 2>&1 || true; $MC admin policy create pf "$POLICY" /tmp/policy.json; }

echo "minio-init: usuário do app"
$MC admin user add pf "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY"
$MC admin policy attach pf "$POLICY" --user "$S3_ACCESS_KEY_ID" >/dev/null 2>&1 || true

echo "minio-init: pronto"
