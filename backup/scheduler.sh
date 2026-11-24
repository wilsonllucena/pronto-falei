#!/usr/bin/env bash
# Dorme até o próximo BACKUP_AT (padrão 03:30, no fuso do TZ) e roda o backup.
# Falha num dia não derruba o container: tenta de novo no dia seguinte.
set -uo pipefail
AT="${BACKUP_AT:-03:30}"
echo "backup: agendado todo dia às $AT ($TZ)"
while true; do
  now=$(date +%s)
  next=$(date -d "today $AT" +%s)
  [ "$next" -le "$now" ] && next=$(date -d "tomorrow $AT" +%s)
  echo "backup: próximo em $(date -d "@$next" '+%Y-%m-%d %H:%M %Z')"
  sleep $((next - now))
  backup.sh || echo "backup: FALHOU em $(date '+%Y-%m-%d %H:%M')" >&2
done
