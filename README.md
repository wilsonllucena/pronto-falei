# Pronto, Falei!

Blog pessoal do Wilson Lima: ideias, opiniões e descobertas sobre tecnologia,
inovação e inteligência artificial, sem rodeios.

> **Status:** passo 1 do plano (esqueleto). Ainda não tem posts, design final
> nem deploy — isso vem nos próximos passos.

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
| Storage | MinIO (fork `pgsty/silo:RELEASE.2026-11-12T00-00-00Z`) — o app passa a usar no passo 3 |
| Testes | Vitest 4 (unit + integração) e Playwright (smoke) |

Collections do esqueleto: **Users** (admin, com `name`) e **Media** (placeholder
de upload de imagem com `alt` obrigatório). O admin está em pt-BR.

## Rodando local

Pré-requisitos: Node 24.22.3+, pnpm 10 e Docker com Compose v2.

```bash
cp .env.example .env
# preencha PAYLOAD_SECRET, MINIO_ROOT_USER e MINIO_ROOT_PASSWORD
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
| `pnpm test:int` | Vitest contra o Mongo do compose (ping, replica set, transação, CRUD) |
| `pnpm test` | unit + integração |
| `pnpm test:e2e` | Smoke com Playwright contra o app rodando (`BASE_URL`, padrão `http://localhost:3130`) |
| `pnpm generate:types` | Regenera `src/payload-types.ts` |
| `pnpm generate:importmap` | Regenera o import map do admin |

O smoke test cria o primeiro usuário (ou faz login) com `E2E_EMAIL` e
`E2E_PASSWORD` do ambiente. **Use só com banco descartável de dev/CI.** Com
`SHOTS_DIR=/algum/dir` ele salva prints das telas.

## Health check

`GET /api/health` responde `200 {"status":"ok","checks":{"mongo":"ok"}}` quando o
Mongo responde ao ping, e `503` caso contrário. O check do bucket do MinIO entra
no passo 3.

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

2. Collections e admin (Posts, Tags, Categories, Pages, globals, drafts)
3. MinIO com `storage-s3` e tamanhos de imagem
4. Design system e layout (claro/escuro)
5. Página do post · 6. Navegação · 7. Leitura por IA (`.md`, `llms.txt`, JSON-LD, feeds)
8. IA local da síntese (llama.cpp, só texto) · 9. Séries e relacionados
10. Docker de produção e deploy no homelab · 11–13. Umami, Remark42, Listmonk
14. Publicação (domínio), com aprovação
