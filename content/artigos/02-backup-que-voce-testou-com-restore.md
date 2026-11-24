---
titulo: "Homelab do zero, parte 2: backup só conta se você já testou o restore"
slug: backup-que-voce-testou-com-restore
linhaFina: "Banco, imagens, retenção e o teste que quase ninguém faz: apagar de propósito e trazer de volta."
categoria: tutorial
tags:
  - homelab
  - docker
ordem: 3
capa: backup
serie: homelab-do-zero
serieOrdem: 2
resumo: "Um backup que nunca foi restaurado é só um arquivo com esperança. Mostro a rotina que uso no homelab: dump do MongoDB, espelho do bucket de imagens, checksum, retenção diária e semanal, e o teste que importa, que é apagar um post de propósito, restaurar e ver ele voltar."
pontosChave:
  - "Backup tem que cobrir banco e arquivos juntos, no mesmo ponto no tempo."
  - "Checksum na criação e conferência antes do restore pegam arquivo corrompido."
  - "Retenção automática evita o clássico disco cheio."
  - "Restore destrutivo pede confirmação explícita, nunca por padrão."
  - "O teste de verdade é apagar algo, restaurar e conferir no site."
---
Todo mundo concorda que precisa de backup. Pouca gente já restaurou um. E é só no restore que você descobre que o dump estava vazio, que faltou a pasta das imagens, que a senha do banco mudou ou que o arquivo de três semanas atrás foi apagado pela própria rotina de limpeza.

Nesta segunda parte da série **Homelab do zero**, mostro como ficou o backup deste blog. A stack é Payload CMS com MongoDB e as imagens num bucket S3 compatível (MinIO), tudo em Docker no servidor de casa. Mas a lógica serve pra qualquer app com banco mais arquivos.

## O que precisa ser salvo

Antes de escrever qualquer script, eu listo o que eu perderia se o disco morresse hoje:

- **O banco**: posts, páginas, usuários, versões dos rascunhos.
- **Os arquivos**: as imagens enviadas pelo admin, que ficam no bucket.
- **A configuração**: o `.env` com os segredos. Esse fica fora do backup automático, guardado à parte, porque não muda e não deve viajar junto com os dados.

O erro mais comum é salvar só o banco. O post volta, mas a capa vira um link quebrado, porque o registro da imagem está no banco e o arquivo está no storage. Os dois precisam ser copiados juntos.

## Um container só pra backup

Em vez de um cron no host, eu uso um container dedicado no mesmo Compose. Ele já está na rede interna, enxerga o banco e o storage pelo nome do serviço, e leva as ferramentas certas (`mongodump`, `mongorestore` e o cliente `mc` do MinIO) sem eu instalar nada no servidor.

O agendamento é um loop simples que dorme até o próximo horário:

```bash title="backup/scheduler.sh"
AT="${BACKUP_AT:-03:30}"
while true; do
  now=$(date +%s)
  next=$(date -d "today $AT" +%s)
  [ "$next" -le "$now" ] && next=$(date -d "tomorrow $AT" +%s)
  sleep $((next - now))
  backup.sh || echo "backup: FALHOU em $(date '+%Y-%m-%d %H:%M')" >&2
done
```

Repare no `|| echo`: se um dia falhar, o container não morre. Ele registra o erro e tenta de novo no dia seguinte.

## O backup em si

O script faz quatro coisas: copia o banco, copia o bucket, gera checksum e aplica a retenção.

```bash title="backup/backup.sh"
set -euo pipefail
STAMP=$(date +%Y-%m-%d_%H%M)
DEST="/backups/daily/$STAMP"
TMP="$DEST.part"
mkdir -p "$TMP"

# 1) banco: um arquivo só, comprimido
mongodump --uri="$DATABASE_URI" --archive="$TMP/mongo.archive.gz" --gzip --quiet

# 2) bucket: espelho incremental, depois empacotado
mc alias set pf "$MINIO_URL" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null
mc mirror --quiet --overwrite --remove "pf/$S3_BUCKET" /backups/.minio-mirror
tar -czf "$TMP/minio.tar.gz" -C /backups/.minio-mirror .

# 3) checksum dos dois arquivos
(cd "$TMP" && sha256sum mongo.archive.gz minio.tar.gz > SHA256SUMS)

# 4) só vira backup "de verdade" quando está completo
mv "$TMP" "$DEST"
```

Dois detalhes que fazem diferença:

- **A pasta `.part`**. O backup é montado numa pasta temporária e só é renomeado no final. Se o processo cair no meio, sobra um `.part` incompleto, que a retenção ignora e o restore nunca usa por engano.
- **O espelho incremental**. O `mc mirror` só copia o que mudou desde a última vez. As imagens não são baixadas todas de novo toda noite.

## Retenção: o disco cheio é o vilão silencioso

Backup sem retenção funciona por algumas semanas e depois enche o disco, e aí quem para é o servidor inteiro. Eu guardo os 7 diários mais recentes e, aos domingos, uma cópia vai pra uma pasta semanal, que guarda os 4 mais recentes:

```bash
prune() { # mantém só os N mais novos de uma pasta
  find "$1" -mindepth 1 -maxdepth 1 -type d ! -name '*.part' \
    | sort | head -n "-$2" | xargs -r rm -rf
}
prune /backups/daily 7
prune /backups/weekly 4
```

Como o nome da pasta é a data no formato `AAAA-MM-DD_HHMM`, a ordem alfabética é a ordem cronológica, e um `sort` resolve.

> [!dica] Uma cópia fora de casa
> Backup no mesmo disco protege contra erro humano e bug, mas não contra disco queimado, roubo ou raio. Sincronize a pasta de backups pra outro lugar, nem que seja um HD externo que você pluga uma vez por semana. A regra 3-2-1 (três cópias, duas mídias, uma fora do local) continua valendo.

## O restore, com trava

O restore é destrutivo: ele substitui o banco e o bucket atuais pelo conteúdo do backup. Por isso ele não roda por padrão. Sem uma confirmação explícita no fim do comando, o script só explica o que vai fazer e sai:

```bash title="backup/restore.sh"
if [ "${2:-}" != "--sim" ]; then
  echo "restore: isso SUBSTITUI o banco e o bucket atuais por $SRC." >&2
  echo "restore: rode de novo com --sim no fim pra confirmar." >&2
  exit 3
fi

(cd "$SRC" && sha256sum -c --quiet SHA256SUMS)   # arquivo corrompido para aqui

mongorestore --uri="$DATABASE_URI" --archive="$SRC/mongo.archive.gz" --gzip --drop
work=$(mktemp -d); trap 'rm -rf "$work"' EXIT
tar -xzf "$SRC/minio.tar.gz" -C "$work"
mc mirror --quiet --overwrite --remove "$work" "pf/$S3_BUCKET"
```

O `--drop` faz o `mongorestore` apagar cada coleção antes de restaurar, então o banco fica igual ao do backup, sem misturar com o que veio depois. Isso é o que você quer num desastre, e é exatamente por isso que precisa de trava.

## O teste que importa

Ter os scripts não prova nada. O que eu fiz quando coloquei este blog no servidor foi um ensaio de desastre, com dados de teste:

1. Criei um post de teste com uma imagem de capa.
2. Rodei o backup.
3. Apaguei o post e a imagem e confirmei que a página dava 404.
4. Parei o app, rodei o restore com `--sim` e recriei o container do app (pra limpar o cache das páginas).
5. Abri a URL de novo: o post voltou, com status 200, e a imagem também.
6. Apaguei os dados de teste e gerei um backup limpo.

O passo 4 tem um detalhe que só aparece quando você ensaia de verdade: o site guarda as páginas em cache, então mesmo com o banco restaurado, a página continuaria dando 404 até o cache ser limpo. Se eu não tivesse ensaiado, ia descobrir isso no meio de um problema real, com pressa.

> [!atencao] Ensaie com dados de teste
> Faça o ensaio com um registro criado só pra isso, e apague no final. E sempre gere um backup novo antes de restaurar um antigo: se o restore der errado, você tem pra onde voltar.

## Backup antes de cada deploy

Além do horário fixo, o script de deploy roda um backup antes de trocar a versão do app. Deploy é o momento em que mais coisa pode dar errado, e ter um ponto de restauração de cinco minutos atrás é bem melhor do que um da madrugada.

## Resumo da ópera

- Salve banco e arquivos juntos.
- Monte o backup numa pasta temporária e só "promova" quando terminar.
- Gere checksum e confira antes de restaurar.
- Aplique retenção, senão o disco enche.
- Coloque trava no restore.
- E, principalmente: apague algo de teste e traga de volta. Antes de precisar.

Na parte 3, a última da série, eu coloco uma IA local no mesmo servidor, só pra texto, sem GPU e sem atrapalhar os outros apps.
