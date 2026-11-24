# Backup do blog: mongodump/mongorestore (imagem oficial do Mongo, mesma versão
# do banco) + cliente do MinIO (mcli, binário estático do Silo).
FROM pgsty/silo:RELEASE.2026-11-12T00-00-00Z AS silo

FROM mongo:8.0.38
COPY --from=silo /usr/bin/mcli /usr/local/bin/mc
COPY backup.sh restore.sh scheduler.sh /usr/local/bin/
RUN chmod 755 /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/scheduler.sh
ENV MC_CONFIG_DIR=/tmp/.mc HOME=/tmp
ENTRYPOINT []
CMD ["scheduler.sh"]
