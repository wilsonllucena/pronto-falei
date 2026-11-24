# Pronto, Falei!

Blog pessoal do Wilson Lima: ideias, opiniões e descobertas sobre tecnologia,
inovação e inteligência artificial, sem rodeios.

> **Status:** passos 1 (esqueleto), 2 (collections e admin), 3 (MinIO), 4
> (design e layout), 5 (página do post), 6 (navegação e páginas), 7 (leitura
> por IA: .md, llms.txt, JSON-LD, feeds), 8 (síntese com IA local) e 9 (séries
> e relacionados) e 10 (Docker de produção e deploy no Umbrel) prontos.
> No ar só pela LAN e pelo Tailscale; o domínio público vem no passo 14.

## Stack

| Peça                                     | Versão                                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------------------- |
| Node                                     | 24.22.3 (`node:24.22.3-alpine` na imagem)                                           |
| pnpm                                     | 10.34.6 (via `packageManager` / corepack)                                           |
| Payload CMS (`payload`, `@payloadcms/*`) | 3.94.1                                                                              |
| Next.js                                  | 16.4.6 (output `standalone`)                                                        |
| React                                    | 19.3.1                                                                              |
| TypeScript                               | 5.9.3                                                                               |
| Banco                                    | MongoDB 8.0.38, replica set de um nó (`rs0`) via `@payloadcms/db-mongodb`           |
| Editor                                   | Lexical (`@payloadcms/richtext-lexical`)                                            |
| Storage                                  | MinIO (fork `pgsty/silo:RELEASE.2026-11-12T00-00-00Z`) via `@payloadcms/storage-s3` |
| Testes                                   | Vitest 4 (unit + integração) e Playwright (smoke)                                   |

## Conteúdo no admin (passo 2)

O admin (`/admin`) está em pt-BR e agrupado em Conteúdo, Taxonomia, Admin e
Configurações.

| Collection / global                | O que tem                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Posts**                          | título, slug único (sem acento), linha fina, capa, texto (Lexical), síntese (`summary`, 160–400 caracteres), `keyPoints` (3–5 itens de até 140), `summarySource` (manual / ia / ia-editada), `summaryReviewed`, `summaryModel`, `summaryGeneratedAt`, categoria, tags, destaque, `publishedAt`, `readingTime`, `wordCount`, relacionados (override manual) e SEO |
| **Pages**                          | título, slug, texto e SEO (Sobre, Uses, Contato)                                                                                                                                                                                                                                                                                                                 |
| **Media**                          | `alt` obrigatório, legenda, crédito e focal point; arquivos no MinIO com tamanhos em WebP                                                                                                                                                                                                                                                                        |
| **Tags**                           | nome, slug, descrição                                                                                                                                                                                                                                                                                                                                            |
| **Categories**                     | nome, slug, descrição, cor (#RRGGBB)                                                                                                                                                                                                                                                                                                                             |
| **Users**                          | e-mail, nome, avatar, bio. Sem cadastro público                                                                                                                                                                                                                                                                                                                  |
| **Configurações do site** (global) | nome, tagline, redes sociais, texto do `llms.txt`, política de robôs de IA                                                                                                                                                                                                                                                                                       |
| **Navegação** (global)             | itens do header e do footer                                                                                                                                                                                                                                                                                                                                      |

Regras:

- Posts e páginas têm rascunho com autosave, histórico de versões e (posts)
  agendamento de publicação. Rascunho salva incompleto; **publicar** exige
  síntese e 3 a 5 pontos-chave.
- Se a síntese veio da IA (`ia` ou `ia-editada`), o post só publica com
  "Síntese revisada" marcada.
- `wordCount` e `readingTime` (220 palavras/min) são calculados num hook a
  partir do Lexical; `publishedAt` é preenchido na primeira publicação.
- Visitante só lê posts e páginas publicados; tags, categorias, mídias e
  globals são públicos; usuários só pra quem está logado.
- O editor tem os blocos Código (linguagem e título), Destaque, Embed
  (YouTube/X), Citação e imagem com legenda. O render no site é do passo 5.

## Imagens no MinIO (passo 3)

- Uploads da collection Media vão pro bucket `pronto-falei-media`, pasta
  `media/`, pelo `@payloadcms/storage-s3` (path-style).
- Cada upload gera, em WebP (qualidade 80): `thumb` 400, `card` 800, `hero`
  1600 (sem ampliar imagens menores) e `og` 1200×630 (recorte pelo focal point).
- O serviço `minio-init` (`minio/init/minio-init.sh`) roda uma vez e é
  idempotente: cria o bucket, deixa **só** `media/` com leitura anônima e cria
  o usuário do app com uma política restrita a esse bucket (ler, gravar,
  apagar e listar). O usuário root do MinIO não é usado pelo app.
- Com `MEDIA_PUBLIC_URL`, a URL das imagens aponta direto pro bucket público
  (em dev, `http://localhost:3131/pronto-falei-media`; em produção, o
  subdomínio de imagens com cache do Cloudflare, no passo 14).
- `GET /api/health` só responde 200 se o Mongo responde e o bucket existe
  (checado com as credenciais do app).

Pra rodar o `pnpm dev`/testes no host, suba o MinIO e rode o init uma vez:

```bash
docker compose up -d --wait mongo minio
docker compose run --rm minio-init
```

## Design e layout (passo 4)

- **Tokens** em `src/design/tokens.ts` (papel, tinta, muted, laranja, grifo,
  borda), nos temas claro e escuro. O layout injeta as variáveis CSS no
  `<head>`, então a paleta muda num lugar só. Um teste confere contraste AA
  (4.5:1) de todo par de texto.
- **Fontes** servidas pelo próprio site (`next/font/local` + Fontsource):
  Bricolage Grotesque (títulos e wordmark), Newsreader (texto), Inter
  (interface) e JetBrains Mono (código e datas). Nenhuma chamada ao Google.
- **Tema** segue o sistema; o botão salva a escolha no cookie `pf-theme`, e um
  script inline no `<head>` aplica antes da primeira pintura (sem piscar).
- **Wordmark** só em texto: "Pronto," em tinta e "Falei!" em laranja com grifo
  amarelo. Favicon: balão de fala com "!" (`src/app/(frontend)/icon.svg`).
- **Header** fixo e compacto (menu do global Navigation, ou Blog/Arquivo/Sobre
  por padrão, busca e tema; no mobile o menu recolhe). **Footer** com tags
  populares, links e redes do Site Settings.
- **Home**: hero com tagline e RSS, até 3 destaques (`featured`) em cards
  (carrossel no mobile) e recentes agrupados por mês, com alternância
  Lista/Grade lembrada no navegador. **/blog**: todos os textos paginados.
- Pular para o conteúdo, foco visível, alvos de toque de 44px e
  `prefers-reduced-motion`.

Os links de tag, arquivo, sobre, busca, feed e `.md` já apontam pras rotas
finais, que chegam nos passos 6 e 7.

## Página do post (passo 5)

- `/posts/[slug]`: cabeçalho (categoria, título, linha fina, data, tempo de
  leitura, tags e capa com legenda), **Resumo rápido** (TL;DR, pontos-chave,
  "Ler em Markdown" e "Resumir com IA" no Grok, ChatGPT ou Claude), aberto por
  padrão e lembrando se você fechou.
- Corpo do Lexical renderizado no servidor: títulos com âncora, listas, links,
  imagem com legenda e crédito, e os blocos Código (Shiki com github-light e
  github-dark, título do arquivo e botão Copiar), Destaque, Citação e Embed
  (YouTube sem cookies; X vira um cartão com link, sem JS de terceiros).
- Índice "Nesta página" fixo ao lado no desktop (marca a seção atual) e
  "Índice ▾" recolhido no mobile.
- **Leia também**: o override manual do post ou até 3 posts com mais tags em
  comum.
- **OG image** automática (`next/og`, 1200×630) com título, linha fina, data e
  wordmark; se o post tiver imagem de SEO, ela vence.
- **Pré-visualização e live preview**: no admin, o botão Pré-visualização abre
  o post com `?preview=1` ao lado do editor e atualiza a cada autosave. O
  rascunho só aparece pra quem está logado no admin; para o resto é o
  publicado.
- **ISR sob demanda**: home, `/blog`, post, relacionados e header/footer vêm
  de um cache com tags. Os hooks `afterChange`/`afterDelete` de posts, tags,
  categorias, mídias e globals chamam `revalidateTag`, então publicar aparece
  na hora; sem invalidação, o cache expira em 1 h.

## Navegação e páginas (passo 6)

- **Busca** `/busca?q=`: `@payloadcms/plugin-search` mantém a collection
  `search` com os posts publicados (título, linha fina, síntese, tags e o
  corpo em texto puro). A consulta usa um índice de texto do Mongo em
  português (radical e sem acento, título com peso maior); se não achar nada,
  tenta pedaço de palavra. Resultados com o termo destacado no título e num
  trecho do texto. Atalho **`/`** em qualquer página; funciona sem JS. Fica
  fora do índice dos buscadores (`noindex`). No admin, "Índice da busca" tem
  o botão de reindexar.
- **Tags** `/tags` (todas, com contagem) e `/tags/[slug]` (ano › mês ›
  título, com outras tags no fim). **Categorias** `/categorias` e
  `/categorias/[slug]`; a categoria do post e das listas virou link.
- **Arquivo** `/arquivo`: ano › mês › título, com filtro por categoria
  (`?categoria=`).
- **Sobre** `/sobre`: foto (ou iniciais), nome, linha curta e bio curta vêm
  de _Configurações do site › Autor_; o texto livre é a página `sobre` em
  Páginas; no fim, "Onde me achar" com as redes, e-mail e RSS. Outras páginas
  publicadas (ex.: `/uses`) abrem em `/<slug>`.
- **Redirecionamentos** (`@payloadcms/plugin-redirects`, em Configurações):
  caminho antigo → post, página ou URL. O caminho é normalizado ao salvar.
  Antes de qualquer 404 o site confere essa lista e redireciona (308 para
  permanente, 307 para temporário, que buscadores tratam como 301/302).
- **404** com busca, atalhos e tags populares.

## Leitura por IA (passo 7)

Tudo sai dos posts publicados, com cache por tag: publicar, despublicar ou
editar um post (ou o Sobre, ou as Configurações) invalida na hora.

| URL                                   | O que entrega                                                                                                                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/posts/<slug>.md`                    | `text/markdown`: frontmatter (title, url, published, updated, tags, reading_time, word_count, summary, key_points) + corpo convertido do Lexical. Link "Ler em Markdown" no Resumo rápido |
| `/<página>.md`                        | Páginas publicadas (ex.: `/sobre.md`)                                                                                                                                                     |
| `/llms.txt`                           | Índice no padrão llmstxt.org: um link pro `.md` de cada post com o TL;DR. A introdução vem de _Configurações › llms.txt_                                                                  |
| `/llms-full.txt`                      | Todos os posts publicados em Markdown num arquivo só                                                                                                                                      |
| `/rss.xml`, `/atom.xml`, `/feed.json` | RSS 2.0 / Atom / JSON Feed 1.1: description = síntese, `content:encoded` = texto completo (30 mais recentes). `/feed.xml` redireciona pro RSS                                             |
| `/sitemap.xml`                        | Páginas, posts, tags e categorias com `lastmod` real                                                                                                                                      |
| `/robots.txt`                         | Robôs de IA (GPTBot, ClaudeBot, PerplexityBot, Google-Extended…) liberados ou bloqueados conforme _Configurações › Robôs de IA_; `/admin`, `/api/` e preview fora                         |

No HTML: JSON-LD `BlogPosting` em cada post (headline, abstract, description,
keywords, wordCount, timeRequired, inLanguage pt-BR, autor, datas, imagem) e
`WebSite` com a busca na home; `<link rel="alternate">` pro `.md` do post e
pros três feeds em todas as páginas. Meta description e OG saem da síntese.

### Seed (só dev)

```bash
pnpm seed
```

Cria categorias (Opinião, Tutorial, Diário), tags com descrição, a página
Sobre (texto provisório), um redirecionamento de exemplo (`/2026/ola-mundo`),
capas abstratas geradas com sharp e sete posts de exemplo em meses diferentes
(três em destaque). É idempotente e **recusa rodar** com `NODE_ENV=production`
ou contra um banco que não seja local (`127.0.0.1`, `localhost` ou `mongo`).

## Síntese com IA local (passo 8)

No admin, aba **Síntese** do post, o botão **Gerar síntese com IA** enfileira o
job `generateSummary` (fila `ai`, um por vez) via
`POST /api/posts/:id/generate-summary` e acompanha por
`GET /api/posts/:id/summary-status`. A IA preenche síntese (160–400
caracteres) e 3–5 pontos-chave; a resposta passa por JSON Schema no
llama.cpp e por validação no app. Fica gravado `summarySource: ia`, o modelo e
a data, e o post **só publica depois de revisado**. Se a IA falhar, o admin
mostra o erro e oferece um **resumo extrativo** (linha fina + primeiro
parágrafo). Posts longos são resumidos em partes e depois juntados.

A IA é só texto, CPU-only, rodando num container `llm` sem porta no host e sem
internet (rede `internal`), limitado a 3 GB de RAM e 3 CPUs, que descarrega o
modelo da memória depois de 120 s parado (`--sleep-idle-seconds 120`).

| Item                     | Valor                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Servidor                 | `ghcr.io/ggml-org/llama.cpp:server-b12627`                                                                                                |
| Modelo                   | Qwen3-4B-Instruct-2507 Q3_K_M (~1,9 GB, baixado com SHA-256 conferido pelo serviço `llm-model` no volume `llm-models`; nunca vai pro git) |
| Plano B                  | Gemma 3 1B IT Q4_K_M (~770 MB): só trocar `LLM_MODEL_FILE`, `LLM_MODEL_URL` e `LLM_MODEL_SHA256` (valores no `.env.example`)              |
| Medido (Qwen, 3 threads) | post de 325 palavras: 37 s; post de 929 palavras: ~64 s; pico de RAM do llama-server ~2,9 GB (incluindo o modelo mapeado)                 |
| Medido (Gemma, plano B)  | post de 929 palavras: ~17 s; pico ~1,0 GB                                                                                                 |

```bash
COMPOSE_PROFILES=ia docker compose up -d --wait   # app + IA real (1º start baixa o modelo)
COMPOSE_PROFILES=mock docker compose up -d --wait # app + mock da IA (CI/testes)
```

## Séries e relacionados (passo 9)

- **Séries** (_Conteúdo › Séries_): título, slug, descrição e a lista de posts
  na ordem de leitura (arraste pra reordenar; mínimo 2). No post aparece a
  caixa "Parte N de M da série X" com todas as partes, a atual destacada, e
  os links ‹ Anterior / Próxima › (`rel="prev"`/`"next"`). Rascunhos não
  contam até serem publicados. Se um post estiver em mais de uma série, vale a
  criada primeiro.
- **Leia também**: o override manual do post vence; sem ele, até 3 posts
  pontuados por tags em comum (2 pontos cada) + mesma categoria (1 ponto), os
  mais novos no empate. As partes da série do post não se repetem ali.
- Salvar ou apagar uma série invalida o cache dos posts na hora.

## Produção no Umbrel (passo 10)

Projeto compose `pronto-falei` em `~/pronto-falei` no Umbrel, separado dos
outros apps:

```
~/pronto-falei/
  .env              # segredos (600), gerado no servidor, nunca no git
  secrets/          # credenciais do admin (700/600)
  src/              # código do commit no ar (src.prev = versão anterior)
  backups/          # daily/ e weekly/
  DEPLOYED_COMMIT
```

| Serviço                                 | Porta no host              | Limite           |
| --------------------------------------- | -------------------------- | ---------------- |
| app (Next + Payload)                    | **3130** (LAN e Tailscale) | 768 MB / 1,5 CPU |
| mongo 8.0.38 (rs0, auth + keyfile)      | —                          | 768 MB           |
| MinIO (Silo)                            | **3132** só o console      | 512 MB           |
| backup (mongodump + espelho do bucket)  | —                          | 256 MB           |
| llm (llama.cpp + Qwen3-4B, perfil `ia`) | —                          | 3 GB / 3 CPU     |

- Arquivo: `docker-compose.prod.yml`. Mongo, API do MinIO, llm e backup ficam
  só na rede `internal` (sem saída pra internet). Sub-redes fixas
  `172.29.130.0/24` e `172.29.131.0/24`, fora das que o Umbrel já usa.
- O Mongo tem usuário root (só administração) e um usuário do app com
  `readWrite` só no banco `pronto_falei`, criado na primeira subida.
- Domínio público: `https://wilsonlima.dev` pelo túnel do Cloudflare (configurado
  fora do repo) → `umbrel.local:3130`. No `.env`:
  `NEXT_PUBLIC_SERVER_URL=https://wilsonlima.dev` (canônicos, OG, feeds, sitemap,
  llms.txt) e `CANONICAL_REDIRECT_HOSTS=www.wilsonlima.dev` (o `src/proxy.ts`
  redireciona 308 pro apex, mantendo caminho e query; Tailscale e LAN seguem
  sem redirecionar).
- As imagens são servidas pelo próprio app (`/api/media/file/…`, URLs
  relativas com `PAYLOAD_SERVER_URL` vazio), então funcionam na LAN e no
  Tailscale. No passo 14 entram `PAYLOAD_SERVER_URL` e `MEDIA_PUBLIC_URL` do
  domínio.

### Deploy

```bash
scripts/deploy.sh          # da sua máquina, na raiz do repo (commit atual)
```

Envia o commit (`git archive`) pro Umbrel, faz backup se a stack já está no ar,
troca `src` (guarda `src.prev`), builda lá, sobe com `--wait` (só termina com
os healthchecks ok) e grava `DEPLOYED_COMMIT`. Na primeira vez gera o `.env`
com segredos fortes (`scripts/gen-prod-env.sh`, sem imprimir nada). Depois do
primeiro deploy, crie o admin antes de qualquer outra pessoa abrir o `/admin`:

```bash
ssh umbrel 'cd ~/pronto-falei && ADMIN_EMAIL=voce@exemplo.com bash src/scripts/create-admin.sh secrets/admin.txt'
```

A senha fica só em `~/pronto-falei/secrets/admin.txt` (600). **Nunca rode o
seed em produção** (ele recusa banco que não seja local).

### Backup e restauração

Backup diário às 03:30 (BRT) pelo serviço `backup`: `mongodump --archive
--gzip` + espelho do bucket em tar.gz, com `SHA256SUMS`, em
`~/pronto-falei/backups/daily/AAAA-MM-DD_HHMM`. Domingo vai também pra
`weekly/`. Retenção: 7 diários e 4 semanais.

```bash
cd ~/pronto-falei/src
dc() { docker compose -f docker-compose.prod.yml --env-file ../.env "$@"; }
dc exec backup backup.sh                                   # backup agora
dc stop app
dc exec backup restore.sh /backups/daily/<pasta> --sim     # restaura banco + bucket
dc up -d --force-recreate --wait app                       # recria o app (limpa o cache)
```

O `restore.sh` confere o `SHA256SUMS`, troca as coleções do banco (`--drop`) e
deixa o bucket igual ao do backup. Sem `--sim` ele só avisa e não mexe em nada.

## Rodando local

Pré-requisitos: Node 24.22.3+, pnpm 10 e Docker com Compose v2.

```bash
cp .env.example .env
# preencha PAYLOAD_SECRET, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD,
# S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY
# (gere segredos com: openssl rand -hex 32)

pnpm install
```

### Opção A — tudo em Docker (imagem de produção)

```bash
docker compose up -d --build --wait
```

- Site: http://localhost:3130
- Admin: http://localhost:3130/admin (na primeira vez ele pede pra criar o primeiro usuário)
- Health: http://localhost:3130/api/health
- Console do MinIO: http://localhost:3132

Todas as portas ficam presas em `127.0.0.1`.

### Opção B — `pnpm dev` com Mongo e MinIO no Docker

```bash
docker compose up -d --wait mongo minio
docker compose run --rm minio-init
pnpm dev   # http://localhost:3000
```

O `DATABASE_URI` do `.env` aponta pro Mongo do compose
(`mongodb://127.0.0.1:27017/pronto_falei?replicaSet=rs0&directConnection=true`).
O `replicaSet=rs0` é obrigatório: sem ele o Payload desliga as transações.

### Derrubar

```bash
docker compose down        # mantém os volumes
docker compose down -v     # apaga banco e arquivos de dev
```

## Scripts

| Comando                   | O que faz                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm dev`                | Next + Payload em modo dev                                                                |
| `pnpm build`              | Build de produção (standalone)                                                            |
| `pnpm lint`               | ESLint (config do Next)                                                                   |
| `pnpm typecheck`          | `tsc --noEmit`                                                                            |
| `pnpm test:unit`          | Vitest, sem dependências externas                                                         |
| `pnpm test:int`           | Vitest contra o Mongo e o MinIO do compose (replica set, collections, uploads e tamanhos) |
| `pnpm test`               | unit + integração                                                                         |
| `pnpm test:e2e`           | Smoke com Playwright contra o app rodando (`BASE_URL`, padrão `http://localhost:3130`)    |
| `pnpm seed`               | Seed de desenvolvimento (bloqueado em produção)                                           |
| `pnpm generate:types`     | Regenera `src/payload-types.ts`                                                           |
| `pnpm generate:importmap` | Regenera o import map do admin                                                            |

O smoke test (`01-smoke`) cria o primeiro usuário (ou faz login) e o `02-conteudo`
cria tag, categoria, página e post pelo admin, com `E2E_EMAIL` e
`E2E_PASSWORD` do ambiente. **Use só com banco descartável de dev/CI.** Com
`SHOTS_DIR=/algum/dir` ele salva prints das telas.

## Health check

`GET /api/health` responde `200 {"status":"ok","checks":{"mongo":"ok","bucket":"ok"}}`
quando o Mongo responde ao ping e o bucket do MinIO existe, e `503` caso contrário.

## CI

O GitHub Actions (`.github/workflows/ci.yml`) roda a cada push na `main`:
install, lint, typecheck, testes unitários, build, testes de integração contra o
Mongo do compose e um smoke test que sobe a stack com a imagem de produção e
roda o Playwright. No CI a IA é um mock (`llm/mock`, profile `mock`), pra não
baixar modelo. Os prints do smoke ficam como artefato do workflow.

## Regras do projeto

- Sem PRs: commit e push direto na `main`, um passo por vez, sempre depois de
  lint, typecheck, testes, build e prints verificados.
- Nada de segredo no repositório: o `.env` é ignorado pelo git e só existe na
  máquina; no repo vai apenas o `.env.example`.
- Seed só em dev, nunca em produção.

## Próximos passos (resumo do plano)

- 11–13: Umami, Remark42, Listmonk
- 14: Publicação (domínio), com aprovação

## Conteúdo de lançamento (`content/`)

Os artigos reais de lançamento ficam em `content/artigos/*.md` (frontmatter com
título, slug, síntese, pontos-chave, categoria, tags, capa e série), com
categorias, tags, séries e capas em `content/taxonomia.json` e `content/capas/`.
Quem importa é `scripts/import-content.ts` (não é o seed): fala com o blog pela
API REST com login de admin, roda com Node 24 sem dependências e é idempotente
por slug. Por padrão cria **rascunhos**; só publica com `--publicar`.

```bash
node scripts/import-content.ts --simular                      # só valida
node scripts/import-content.ts --url http://127.0.0.1:3130 \
  --credenciais ../secrets/admin.txt [--publicar] [--atualizar]
```

No Umbrel (sem Node no host), pela imagem do Node que já é base do app:

```bash
cd ~/pronto-falei/src && docker run --rm --network host \
  -v "$PWD":/work:ro -v ~/pronto-falei/secrets/admin.txt:/run/admin.txt:ro -w /work \
  node:24.22.3-alpine node scripts/import-content.ts \
  --url http://127.0.0.1:3130 --credenciais /run/admin.txt --publicar
```
