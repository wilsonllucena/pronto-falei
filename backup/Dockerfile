# Backup do blog: mongodump/mongorestore (imagem oficial do Mongo, mesma versão
# do banco) + cliente do MinIO (mcli, binário estático do Silo) + pg_dump do
# banco do Umami (passo 11).
FROM pgsty/silo:RELEASE.2026-11-12T00-00-00Z AS silo

FROM mongo:8.0.38
# pg_dump/pg_restore 18 (mesma versão do Postgres do Umami), do repositório PGDG.
RUN rm -f /etc/apt/sources.list.d/mongodb*.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSo /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt noble-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-18 \
 && rm -rf /var/lib/apt/lists/*
COPY --from=silo /usr/bin/mcli /usr/local/bin/mc
COPY backup.sh restore.sh scheduler.sh /usr/local/bin/
RUN chmod 755 /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/scheduler.sh
ENV MC_CONFIG_DIR=/tmp/.mc HOME=/tmp
ENTRYPOINT []
CMD ["scheduler.sh"]
