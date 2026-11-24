#!/usr/bin/env bash
# Primeira subida do Postgres compartilhado: banco e usuário do Umami (dono só
# do próprio banco). O Listmonk ganha o dele no passo da newsletter.
set -euo pipefail
: "${UMAMI_DB_PASSWORD:?}"
psql -v ON_ERROR_STOP=1 -v pw="$UMAMI_DB_PASSWORD" --username "$POSTGRES_USER" --dbname postgres <<'SQL'
CREATE ROLE umami LOGIN PASSWORD :'pw';
CREATE DATABASE umami OWNER umami;
REVOKE ALL ON DATABASE umami FROM PUBLIC;
SQL
