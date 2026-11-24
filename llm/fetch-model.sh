#!/bin/sh
# Roda uma vez (serviço llm-model): baixa o GGUF pro volume llm-models e
# confere o SHA-256. Se o arquivo já existe com o hash certo, não baixa de
# novo. O modelo nunca vai pro git.
set -eu

: "${MODEL_URL:?defina MODEL_URL}"
: "${MODEL_SHA256:?defina MODEL_SHA256}"
: "${MODEL_FILE:?defina MODEL_FILE}"
DEST="/models/$MODEL_FILE"

check() { echo "$MODEL_SHA256  $1" | sha256sum -c -s -; }

if [ -f "$DEST" ] && check "$DEST"; then
  echo "llm-model: $MODEL_FILE já está no volume (hash ok)"
  exit 0
fi

echo "llm-model: baixando $MODEL_FILE"
curl -fsSL --retry 3 --retry-delay 5 --connect-timeout 20 -o "$DEST.part" "$MODEL_URL"
if ! check "$DEST.part"; then
  echo "llm-model: SHA-256 não confere, apagando o download" >&2
  rm -f "$DEST.part"
  exit 1
fi
mv "$DEST.part" "$DEST"
echo "llm-model: pronto ($(du -h "$DEST" | cut -f1))"
