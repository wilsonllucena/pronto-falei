---
titulo: "Payload CMS e Next.js: como montei um blog que é meu de verdade"
slug: payload-cms-nextjs-blog-que-eu-controlo
linhaFina: "Admin decente, rascunho com autosave, imagens no meu storage e o conteúdo legível por gente e por IA, rodando em casa."
categoria: tutorial
tags:
  - nextjs
  - homelab
  - arquitetura
ordem: 5
capa: payload
resumo: "Este blog roda com Payload CMS dentro de um app Next.js, MongoDB em replica set e imagens num MinIO, tudo em Docker no servidor de casa. Explico por que escolhi Payload, como modelei posts com síntese obrigatória, como as imagens saem do meu storage e como o conteúdo vira Markdown, feed e llms.txt."
pontosChave:
  - "Payload 3 roda dentro do próprio app Next.js: um deploy, um processo, um repositório."
  - "Collections em TypeScript viram admin, API e tipos ao mesmo tempo."
  - "Rascunho com autosave e versões vêm de uma configuração, não de código próprio."
  - "Imagens vão pra um MinIO via adaptador S3, e o app acessa com usuário de permissão mínima."
  - "Cada post também sai em Markdown, RSS, Atom, JSON Feed e llms.txt."
---
Quando decidi ter um blog, eu tinha duas opções óbvias: uma plataforma pronta ou um gerador de site estático. Plataforma pronta é rápida, mas o conteúdo fica na casa dos outros, nas regras dos outros. Gerador estático é ótimo pra quem gosta de escrever em Markdown no editor de código, mas eu queria um admin de verdade, com rascunho salvo sozinho, pré-visualização e upload de imagem, sem abrir o terminal pra publicar um texto.

A resposta foi um CMS headless que eu hospedo. Escolhi o [Payload](https://payloadcms.com), e este texto é o porquê e o como.

## Por que Payload

Três motivos pesaram:

1. **Ele roda dentro do Next.js.** Desde a versão 3, o Payload é instalado dentro de um app Next: o admin fica em `/admin`, a API em `/api`, e o site em todas as outras rotas. Um repositório, um build, um container. Pra um projeto que eu mantenho sozinho, isso vale ouro.
2. **A configuração é código TypeScript.** Cada coleção é um objeto tipado. Dele saem a tela do admin, a API REST e GraphQL, a validação e os tipos que o front usa.
3. **É open source e self-hosted.** Nada de assinatura por número de posts ou de usuários.

A estrutura do app fica assim, com dois grupos de rotas que não se misturam:

```text
src/app/
  (frontend)/     # o blog: home, posts, busca, feeds
  (payload)/      # admin e API, gerados pelo Payload
src/collections/  # Posts, Pages, Media, Tags, Categories, Series, Users
src/payload.config.ts
```

## Modelando um post

A coleção de posts é onde mora a maior parte das regras. Um recorte simplificado:

```typescript title="src/collections/Posts.ts"
export const Posts: CollectionConfig = {
  slug: 'posts',
  access: {
    read: authenticatedOrPublished, // visitante só vê publicado
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  versions: {
    drafts: { autosave: { interval: 1500 }, schedulePublish: true },
    maxPerDoc: 50,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'content', type: 'richText', required: true },
    { name: 'summary', type: 'textarea', required: true, minLength: 160, maxLength: 400 },
    {
      name: 'keyPoints',
      type: 'array',
      required: true,
      minRows: 3,
      maxRows: 5,
      fields: [{ name: 'text', type: 'text', required: true }],
    },
    { name: 'tags', type: 'relationship', relationTo: 'tags', hasMany: true },
  ],
}
```

Algumas coisas que essa configuração entrega sem uma linha extra:

- **Autosave**: o rascunho é salvo a cada segundo e meio enquanto eu escrevo.
- **Versões**: até 50 versões por post, com comparação e restauração no admin.
- **Agendamento**: dá pra marcar a publicação pra uma data futura.
- **Validação só na publicação**: rascunho pode estar incompleto; a síntese e os pontos-chave são obrigatórios na hora de publicar.

A síntese obrigatória é uma escolha editorial. Todo post tem um resumo de duas ou três frases e de três a cinco pontos-chave no topo. Quem tem pressa lê isso e decide se continua. E esse mesmo resumo alimenta o feed, a busca, a descrição pra redes sociais e a versão pra IA.

## O editor e os blocos

O editor de texto do Payload é baseado no Lexical. Além de parágrafo, título, lista e link, eu registrei blocos próprios pra coisas que aparecem muito em post técnico: código com linguagem e nome de arquivo, destaque (dica, atenção, perigo), citação e embed do YouTube ou do X. O bloco de código vira HTML com destaque de sintaxe no servidor, então o visitante não baixa nenhuma biblioteca de highlight.

## Banco: MongoDB em replica set de um nó

O Payload usa transações quando o banco oferece, e no MongoDB transação exige replica set. Num servidor só, a saída é um replica set de um nó:

```bash
mongod --replSet rs0 --bind_ip_all
# na primeira subida:
mongosh --eval 'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "mongo:27017" }] })'
```

Em produção, o banco tem autenticação, e o app conecta com um usuário que só tem `readWrite` no banco do blog. O usuário root fica só pra administração.

## Imagens no meu storage

As imagens vão pra um MinIO, um storage compatível com S3 que roda no mesmo Compose. O Payload tem um adaptador oficial pra S3, e apontar pra um MinIO é questão de configurar o endpoint:

```typescript title="src/payload.config.ts"
s3Storage({
  collections: { media: { prefix: 'media' } },
  bucket: process.env.S3_BUCKET!,
  config: {
    endpoint: process.env.S3_ENDPOINT,   // http://minio:9000
    region: 'us-east-1',
    forcePathStyle: true,                // MinIO usa bucket no caminho
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  },
})
```

O app não usa a conta administrativa do MinIO. Um container de inicialização cria o bucket e um usuário com política restrita àquele bucket. Se a credencial do app vazar, o estrago fica limitado a ele. No upload, o `sharp` gera as variações de tamanho, e o site entrega a imagem no tamanho certo pra cada tela.

## Conteúdo pra gente e pra máquina

Uma parte que eu fiz questão: o conteúdo precisa ser fácil de ler fora da página HTML. Por isso, cada post também existe em outros formatos:

- **Markdown**: colocando `.md` no fim do endereço do post, você recebe o texto puro, com a síntese no topo.
- **Feeds**: RSS, Atom e JSON Feed, com o texto completo.
- **`llms.txt` e `llms-full.txt`**: um índice e o conteúdo completo num formato pensado pra ser lido por modelos de linguagem.
- **JSON-LD**: os dados estruturados do artigo, autor e datas, embutidos na página.
- **Sitemap e robots.txt** gerados a partir do que está publicado.

A ideia é simples: se alguém quiser citar, resumir ou indexar o que eu escrevo, que pegue a versão correta, e não um HTML raspado pela metade.

> [!dica] Cache com invalidação por evento
> As páginas são renderizadas no servidor e guardadas em cache. Quando um post é salvo, um hook do Payload invalida só o que mudou: a página do post, a home, a tag e o feed. O site fica rápido e nunca mostra conteúdo velho depois de uma publicação.

## Pré-visualização e IA no admin

Do admin, consigo abrir a pré-visualização do rascunho no próprio layout do site, em tamanhos de celular, tablet e desktop. E tem um botão que pede à IA local um rascunho da síntese, que roda em segundo plano e precisa da minha revisão antes de publicar. Contei como essa IA funciona na série **Homelab do zero**.

## Valeu a pena?

Pra mim, sim. Eu tenho um admin confortável, o conteúdo fica num banco que eu controlo, com backup que eu já testei, e o código inteiro está num repositório que eu entendo de ponta a ponta. O custo foi montar a stack, mas esse é o tipo de trabalho que eu faço com prazer, e que rendeu, inclusive, os textos deste blog.

Se você é dev e está pensando em ter um blog, a minha sugestão é: escolha uma ferramenta que você consiga hospedar e entender. O blog vai durar mais do que qualquer plataforma da moda.
