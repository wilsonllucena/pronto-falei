/** Posts de exemplo do seed de desenvolvimento (nunca rodar em produção). */
type Sample = {
  slug: string
  title: string
  subtitle: string
  publishedAt: string
  category: 'opiniao' | 'tutorial' | 'diario'
  tags: ('ia' | 'homelab' | 'carreira')[]
  featured?: boolean
  cover?: string
  paragraphs: (string | { heading: string })[]
  summary: string
  keyPoints: string[]
}

const filler = (topic: string) => [
  `Faz um tempo que eu queria escrever sobre ${topic}. Não é um tutorial definitivo, é o que funcionou pra mim até aqui, com os tropeços incluídos.`,
  { heading: 'O contexto' },
  'Antes de qualquer ferramenta, vale entender o problema. Eu tinha pouco tempo, pouco hardware e muita vontade de fazer do jeito certo, sem complicar.',
  'Testei três caminhos diferentes antes de chegar no que está rodando hoje. O critério foi simples: dá pra manter sozinho num fim de semana?',
  { heading: 'O que eu aprendi' },
  'A solução mais simples quase sempre ganha. Quando precisei de algo mais sofisticado, a base simples deixou a troca barata.',
  'Se for pra levar uma coisa deste texto, leve essa: comece pequeno, meça e só então otimize.',
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
    paragraphs: filler('rodar IA local num mini PC'),
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
