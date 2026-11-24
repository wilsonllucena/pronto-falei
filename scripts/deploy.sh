#!/usr/bin/env bash
# Deploy no Umbrel (rode da sua máquina, na raiz do repo):
#   scripts/deploy.sh            # commit atual (HEAD)
#   scripts/deploy.sh <sha>      # outro commit
#
# Fluxo: envia o código do commit (git archive) pra ~/pronto-falei/src.new,
# faz backup se a stack já está no ar, troca src (guarda src.prev pra voltar),
# builda no Umbrel, sobe com --wait (healthchecks) e grava DEPLOYED_COMMIT.
# Na primeira vez gera ~/pronto-falei/.env com segredos (sem imprimir).
set -euo pipefail
REMOTE="${REMOTE:-umbrel@umbrel-1.tail3bbeb5.ts.net}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519_homelab}"
DIR="${REMOTE_DIR:-pronto-falei}"
REF="${1:-HEAD}"
SHA=$(git rev-parse --verify "$REF^{commit}")
if [ "$REF" = HEAD ] && [ -n "$(git status --porcelain)" ]; then
  echo "deploy: há mudanças não commitadas; commite antes" >&2
  exit 1
fi
remote() { ssh -i "$SSH_KEY" -o BatchMode=yes "$REMOTE" "$@"; }

echo "deploy: enviando ${SHA:0:7} pra $REMOTE:~/$DIR"
git archive --format=tar "$SHA" |
  remote "set -e; mkdir -p ~/$DIR/backups; rm -rf ~/$DIR/src.new; mkdir ~/$DIR/src.new; tar -x -C ~/$DIR/src.new"

remote "DIR=$DIR SHA=$SHA bash -s" <<'REMOTE'
set -euo pipefail
cd "$HOME/$DIR"
chmod 700 . && mkdir -p secrets && chmod 700 secrets
bash src.new/scripts/gen-prod-env.sh .env # cria, ou só acrescenta chaves novas
# Comentários: credencial de admin do Remark42 num arquivo 600 (nada no terminal)
if [ ! -f secrets/remark42.txt ]; then
  (umask 077 && {
    echo "# Admin do Remark42 (moderação). Use pelo admin do blog: /admin/comentarios."
    echo "# A API de admin do Remark42 só é acessível na rede interna dos containers."
    echo "usuario=admin"
    sed -n 's/^REMARK_ADMIN_PASSWD=/senha=/p' .env
  } > secrets/remark42.txt)
fi
dc() { docker compose -f docker-compose.prod.yml --env-file ../.env "$@"; }
if [ -d src ] && (cd src && dc ps --status running -q backup 2>/dev/null | grep -q .); then
  echo "deploy: backup antes de trocar a versão"
  # </dev/null: sem isso o exec consome o resto deste script (que vem pelo stdin)
  (cd src && dc exec -T backup backup.sh </dev/null)
fi
rm -rf src.prev
[ -d src ] && mv src src.prev
mv src.new src
cd src
echo "$SHA" > REVISION
echo "deploy: build"
dc build --pull=false
echo "deploy: subindo (espera os healthchecks)"
dc up -d --wait --remove-orphans
# Analytics: na primeira vez troca a senha padrão do Umami (vai pra
# ../secrets/umami.txt) e cria o site; o app é recriado pra ler o id.
if ! grep -q '^UMAMI_WEBSITE_ID=.' ../.env; then
  site_host=$(sed -n 's#^NEXT_PUBLIC_SERVER_URL=https\{0,1\}://\([^/:]*\).*#\1#p' ../.env)
  umami_port=$(sed -n 's/^UMAMI_PORT=//p' ../.env)
  python3 scripts/setup-umami.py --url "http://127.0.0.1:${umami_port:-3133}" \
    --env-file ../.env --secret-file ../secrets/umami.txt --domain "$site_host"
  dc up -d --wait app
fi
echo "$SHA" > ../DEPLOYED_COMMIT
dc ps --format 'table {{.Service}}\t{{.Status}}'
echo "deploy: ok ${SHA:0:7}"
REMOTE
