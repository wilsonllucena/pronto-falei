#!/usr/bin/env bash
# Banco e usuário do Listmonk no Postgres compartilhado (passo 13). Idempotente:
# roda a cada subida (serviço listmonk-db) e funciona com o volume do Postgres
# já existente (os scripts de pg/init só rodam no primeiro boot). Também
# sincroniza a senha com a do .env.
set -euo pipefail
: "${PGHOST:?}" "${PGPASSWORD:?}" "${LISTMONK_DB_PASSWORD:?}"
for _ in $(seq 1 30); do pg_isready -q -U postgres && break; sleep 2; done
psql -v ON_ERROR_STOP=1 -v pw="$LISTMONK_DB_PASSWORD" -U postgres -d postgres <<'SQL'
SELECT format('CREATE ROLE listmonk LOGIN PASSWORD %L', :'pw')
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'listmonk') \gexec
SELECT format('ALTER ROLE listmonk LOGIN PASSWORD %L', :'pw') \gexec
SELECT 'CREATE DATABASE listmonk OWNER listmonk'
  WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'listmonk') \gexec
REVOKE ALL ON DATABASE listmonk FROM PUBLIC;
SQL
echo "listmonk-db: ok"
