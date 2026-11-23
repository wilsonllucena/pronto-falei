# Pronto, Falei!

Blog pessoal do Wilson Lima: ideias, opiniões e descobertas sobre tecnologia,
inovação e inteligência artificial, sem rodeios.

> **Status:** passos 1 (esqueleto), 2 (collections e admin), 3 (MinIO), 4
> (design e layout) e 5 (página do post) prontos. Ainda não tem leitura por
> IA (.md, llms.txt, feeds), síntese automática nem deploy — isso vem nos
> próximos passos.

## Stack

| Peça | Versão |
| --- | --- |
| Node | 24.22.3 (`node:24.22.3-alpine` na imagem) |
| pnpm | 10.34.6 (via `packageManager` / corepack) |
| Payload CMS (`payload`, `@payloadcms/*`) | 3.94.1 |
| Next.js | 16.4.6 (output `standalone`) |
| React | 19.3.1 |
| TypeScript | 5.9.3 |
| Banco | MongoDB 8.0.38, replica set de um nó (`rs0`) via `@payloadcms/db-mongodb` |
| Editor | Lexical (`@payloadcms/richtext-lexical`) |
| Storage | MinIO (fork `pgsty/silo:RELEASE.2026-11-12T00-00-00Z`) via `@payloadcms/storage-s3` |
| Testes | Vitest 4 (unit + integração) e Playwright (smoke) |

## Conteúdo no admin (passo 2)

O admin (`/admin`) está em pt-BR e agrupado em Conteúdo, Taxonomia, Admin e
Configurações.

| Collection / global | O que tem |
| --- | --- |
| **Posts** | título, slug único (sem acento), linha fina, capa, texto (Lexical), síntese (`summary`, 160–400 caracteres), `keyPoints` (3–5 itens de até 140), `summarySource` (manual / ia / ia-editada), `summaryReviewed`, `summaryModel`, `summaryGeneratedAt`, categoria, tags, destaque, `publishedAt`, `readingTime`, `wordCount`, relacionados (override manual) e SEO |
| **Pages** | título, slug, texto e SEO (Sobre, Uses, Contato) |
| **Media** | `alt` obrigatório, legenda, crédito e focal point; arquivos no MinIO com tamanhos em WebP |
| **Tags** | nome, slug, descrição |
| **Categories** | nome, slug, descrição, cor (#RRGGBB) |
| **Users** | e-mail, nome, avatar, bio. Sem cadastro público |
| **Configurações do site** (global) | nome, tagline, redes sociais, texto do `llms.txt`, política de robôs de IA |
| **Navegação** (global) | itens do header e do footer |

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

### Seed (só dev)

```bash
pnpm seed
```

Cria categorias (Opinião, Tutorial, Diário), tags, a página Sobre (rascunho),
capas abstratas geradas com sharp e sete posts de exemplo em meses diferentes
(três em destaque). É idempotente e **recusa rodar** com `NODE_ENV=production`
ou contra um banco que não seja local (`127.0.0.1`, `localhost` ou `mongo`).

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

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | Next + Payload em modo dev |
| `pnpm build` | Build de produção (standalone) |
| `pnpm lint` | ESLint (config do Next) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test:unit` | Vitest, sem dependências externas |
| `pnpm test:int` | Vitest contra o Mongo e o MinIO do compose (replica set, collections, uploads e tamanhos) |
| `pnpm test` | unit + integração |
| `pnpm test:e2e` | Smoke com Playwright contra o app rodando (`BASE_URL`, padrão `http://localhost:3130`) |
| `pnpm seed` | Seed de desenvolvimento (bloqueado em produção) |
| `pnpm generate:types` | Regenera `src/payload-types.ts` |
| `pnpm generate:importmap` | Regenera o import map do admin |

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
roda o Playwright. Os prints do smoke ficam como artefato do workflow.

## Regras do projeto

- Sem PRs: commit e push direto na `main`, um passo por vez, sempre depois de
  lint, typecheck, testes, build e prints verificados.
- Nada de segredo no repositório: o `.env` é ignorado pelo git e só existe na
  máquina; no repo vai apenas o `.env.example`.
- Seed só em dev, nunca em produção.

## Próximos passos (resumo do plano)

5. Página do post · 6. Navegação · 7. Leitura por IA (`.md`, `llms.txt`, JSON-LD, feeds)
8. IA local da síntese (llama.cpp, só texto) · 9. Séries e relacionados
10. Docker de produção e deploy no homelab · 11–13. Umami, Remark42, Listmonk
14. Publicação (domínio), com aprovação
