/** Posts de exemplo do seed de desenvolvimento (nunca rodar em produção). */
import type { Block } from '../lib/lexicalBuilder'

type Sample = {
  slug: string
  title: string
  subtitle: string
  publishedAt: string
  category: 'opiniao' | 'tutorial' | 'diario'
  tags: ('ia' | 'homelab' | 'carreira')[]
  featured?: boolean
  cover?: string
  /** Imagens no corpo usam `cover:<chave>` e o seed troca pelo id da mídia. */
  paragraphs: Block[]
  summary: string
  keyPoints: string[]
}

const filler = (topic: string): Block[] => [
  `Faz um tempo que eu queria escrever sobre ${topic}. Não é um tutorial definitivo, é o que funcionou pra mim até aqui, com os tropeços incluídos.`,
  { heading: 'O contexto' },
  'Antes de qualquer ferramenta, vale entender o problema. Eu tinha pouco tempo, pouco hardware e muita vontade de fazer do jeito certo, sem complicar.',
  'Testei três caminhos diferentes antes de chegar no que está rodando hoje. O critério foi simples: dá pra manter sozinho num fim de semana?',
  { heading: 'O que eu aprendi' },
  'A solução mais simples quase sempre ganha. Quando precisei de algo mais sofisticado, a base simples deixou a troca barata.',
  'Se for pra levar uma coisa deste texto, leve essa: comece pequeno, meça e só então otimize.',
]

/** Post de vitrine: usa todos os elementos do editor (títulos, listas, código, blocos, imagem). */
const SHOWCASE: Block[] = [
  {
    paragraph: [
      'Quando decidi gerar a síntese dos posts com IA, a regra era clara: ',
      { text: 'nada sai do homelab', bold: true },
      '. Nada de API paga, nada de mandar rascunho pra fora. O desafio era caber num mini PC sem GPU.',
    ],
  },
  { heading: 'Por que um modelo pequeno' },
  'Resumir texto é uma tarefa bem mais simples do que conversar sobre qualquer assunto. Um modelo de 4B parâmetros, quantizado, dá conta e ainda sobra memória pro resto do servidor.',
  {
    list: [
      [{ text: 'Qwen3-4B-Instruct', bold: true }, ' em Q3_K_M: 2,1 GB em disco'],
      ['Só texto: nada de visão ou áudio, que pesam e eu não uso'],
      ['Licença Apache 2.0, sem pegadinha'],
    ],
  },
  { heading: 'Os números do teste', tag: 'h3' },
  'Com 4 threads, um post de 929 palavras levou 46 segundos do começo ao fim, com pico de 2,7 GB de RAM. Pra um job que roda em segundo plano, é mais que suficiente.',
  {
    callout:
      'Limite a CPU e a memória do container. Assim, mesmo no pico, a IA não derruba os outros apps do servidor.',
    tone: 'dica',
    title: 'Dica de homelab',
  },
  { heading: 'Subindo o servidor' },
  {
    paragraph: [
      'O ',
      { text: 'llama.cpp', code: true },
      ' tem um servidor HTTP compatível com a API da OpenAI. Basta apontar pro arquivo do modelo:',
    ],
  },
  {
    code: [
      'llama-server \\',
      '  --model /models/qwen3-4b-instruct-2507-q3_k_m.gguf \\',
      '  --ctx-size 8192 \\',
      '  --threads 3 \\',
      '  --host 0.0.0.0 --port 8080',
    ].join('\n'),
    language: 'bash',
  },
  'No compose, o serviço fica só na rede interna, sem porta no host:',
  {
    code: 'services:\n  llm:\n    image: ghcr.io/ggml-org/llama.cpp:server\n    networks: [internal]   # sem porta no host\n    deploy:\n      resources:\n        limits: { cpus: "3", memory: 3g }',
    language: 'yaml',
    title: 'docker-compose.yml',
  },
  { heading: 'Chamando do app', tag: 'h3' },
  {
    code: "const res = await fetch('http://llm:8080/v1/chat/completions', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({ messages, temperature: 0.2, max_tokens: 450 }),\n})\nconst { choices } = await res.json()",
    language: 'typescript',
    title: 'src/ai/summary.ts',
  },
  { image: 'cover:ondas', caption: 'A fila processa um post por vez, sem travar o servidor.' },
  { heading: 'O que eu aprendi' },
  {
    quote:
      'A solução mais simples quase sempre ganha. Quando precisei de algo mais sofisticado, a base simples deixou a troca barata.',
    author: 'Eu mesmo, depois de três tentativas',
  },
  {
    paragraph: [
      'Se quiser se aprofundar, a ',
      { text: 'documentação do llama.cpp', href: 'https://github.com/ggml-org/llama.cpp' },
      ' é o melhor ponto de partida.',
    ],
  },
  { embed: 'https://x.com/ggml_org', caption: 'O perfil do projeto no X.' },
]

export const SAMPLE_POSTS: Sample[] = [
  {
    slug: 'ia-local-no-homelab-sem-gpu',
    title: 'IA local no homelab, sem GPU e sem drama',
    subtitle: 'Um modelo de 4B parâmetros rodando em CPU resolve mais do que parece.',
    publishedAt: '2026-11-20T12:00:00.000Z',
    category: 'tutorial',
    tags: ['ia', 'homelab'],
    featured: true,
    cover: 'grade',
    paragraphs: SHOWCASE,
    summary:
      'Rodei um modelo de linguagem de 4B parâmetros só em CPU, num mini PC do homelab, pra gerar sínteses de texto. Ficou leve, privado e rápido o bastante pro uso de um blog, sem GPU e sem mandar nada pra fora.',
    keyPoints: [
      'Modelos pequenos e quantizados cabem em 3 GB de RAM.',
      'Pra resumo de texto não precisa de modelo multimodal.',
      'Fila com um job por vez evita travar o servidor.',
    ],
  },
  {
    slug: 'por-que-voltei-a-escrever',
    title: 'Por que eu voltei a escrever (e por que você deveria também)',
    subtitle: 'Escrever organiza a cabeça mais do que qualquer ferramenta de produtividade.',
    publishedAt: '2026-11-12T13:30:00.000Z',
    category: 'opiniao',
    tags: ['carreira'],
    featured: true,
    cover: 'balao',
    paragraphs: filler('voltar a escrever'),
    summary:
      'Depois de anos só consumindo conteúdo, voltei a escrever pra organizar as ideias e registrar o que aprendo. Escrever obriga a pensar com clareza, e o texto vira uma memória pública que ajuda outras pessoas.',
    keyPoints: [
      'Escrever é uma forma de pensar melhor.',
      'Um blog próprio é um ativo que ninguém tira de você.',
      'Publicar imperfeito é melhor do que não publicar.',
    ],
  },
  {
    slug: 'payload-cms-mongodb-minio-docker',
    title: 'Payload, MongoDB e MinIO num compose só',
    subtitle: 'A stack do Pronto, Falei! explicada sem enrolação.',
    publishedAt: '2026-11-04T10:00:00.000Z',
    category: 'tutorial',
    tags: ['homelab'],
    cover: 'ondas',
    paragraphs: filler('a stack deste blog'),
    summary:
      'Montei o blog com Payload CMS, MongoDB em replica set e imagens no MinIO, tudo num docker compose. Cada serviço tem healthcheck, o bucket tem usuário restrito e as imagens saem em WebP nos tamanhos certos.',
    keyPoints: [
      'Replica set de um nó habilita transações no Mongo.',
      'O app acessa o bucket com usuário de permissão mínima.',
      'Healthchecks deixam o compose subir na ordem certa.',
    ],
  },
  {
    slug: 'o-mito-do-dev-10x',
    title: 'O mito do dev 10x e o que realmente faz diferença',
    subtitle: 'Spoiler: não é digitar mais rápido.',
    publishedAt: '2026-10-28T15:00:00.000Z',
    category: 'opiniao',
    tags: ['carreira', 'ia'],
    featured: true,
    cover: 'sol',
    paragraphs: filler('produtividade de dev'),
    summary:
      'O dev que entrega muito não é o que digita mais rápido, é o que entende o problema, corta escopo e evita retrabalho. Com IA no fluxo, saber o que pedir e revisar o que volta ficou ainda mais importante.',
    keyPoints: [
      'Entender o problema vale mais do que velocidade.',
      'Cortar escopo é uma habilidade técnica.',
      'IA amplifica quem já sabe revisar código.',
    ],
  },
  {
    slug: 'diario-de-bordo-backup-que-funciona',
    title: 'Diário de bordo: o backup que finalmente funciona',
    subtitle: 'Três tentativas, um disco cheio e uma lição sobre testar restore.',
    publishedAt: '2026-10-09T21:00:00.000Z',
    category: 'diario',
    tags: ['homelab'],
    paragraphs: filler('backup no homelab'),
    summary:
      'Backup que nunca foi restaurado não é backup. Depois de encher um disco e perder uma tarde, montei uma rotina diária com retenção e um teste de restore semanal que me avisa quando algo quebra.',
    keyPoints: [
      'Teste o restore, não só o backup.',
      'Retenção evita encher o disco.',
      'Alerta de falha vale mais que log bonito.',
    ],
  },
  {
    slug: 'primeiro-emprego-em-tech-conselhos',
    title: 'Conselhos que eu daria pro meu eu do primeiro emprego em tech',
    subtitle: 'Menos framework da moda, mais fundamento e mais gente.',
    publishedAt: '2026-09-17T11:00:00.000Z',
    category: 'opiniao',
    tags: ['carreira'],
    paragraphs: filler('início de carreira'),
    summary:
      'Se eu pudesse voltar no meu primeiro emprego, focaria em fundamentos, em aprender a ler código dos outros e em construir relações. Framework muda todo ano, mas saber resolver problema e se comunicar fica.',
    keyPoints: [
      'Fundamentos duram mais que frameworks.',
      'Ler código alheio acelera o aprendizado.',
      'Rede de contatos abre portas que currículo não abre.',
    ],
  },
]

/** Série de exemplo do seed (dev): ordem de leitura, não de data. */
export const SAMPLE_SERIES = {
  title: 'Homelab do zero',
  slug: 'homelab-do-zero',
  description: 'Do mini PC ao blog no ar: stack, backup e IA local, sem nuvem.',
  posts: [
    'payload-cms-mongodb-minio-docker',
    'diario-de-bordo-backup-que-funciona',
    'ia-local-no-homelab-sem-gpu',
  ],
}
