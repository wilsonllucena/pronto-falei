---
titulo: "Cobrança por Pix num SaaS pequeno: o que precisa estar certo antes do primeiro real"
slug: cobranca-por-pix-em-saas-pequeno
linhaFina: "QR dinâmico, txid, webhook idempotente e conciliação. O básico que separa um checkout confiável de um suporte lotado."
categoria: tutorial
tags:
  - pagamentos
  - arquitetura
ordem: 6
capa: pix
resumo: "Pix é o jeito mais simples de cobrar no Brasil, mas integrar direito tem detalhes. Mostro o fluxo que uso em produtos pequenos: cobrança com txid gerado por mim, QR dinâmico com expiração, webhook idempotente que confirma o pagamento consultando o PSP e uma rotina de conciliação que pega o que o webhook perdeu."
pontosChave:
  - "Use cobrança com QR dinâmico e txid próprio, nunca a chave Pix solta."
  - "Gere o txid no seu sistema e grave antes de chamar o PSP."
  - "Webhook não é prova de pagamento: confirme consultando a API do PSP."
  - "Idempotência por endToEndId evita liberar o mesmo pedido duas vezes."
  - "Conciliação periódica pega o webhook que não chegou."
---
Pix mudou o jeito de cobrar no Brasil. O dinheiro cai na hora, a qualquer hora, e a pessoa paga com o app do banco que ela já usa. Pra quem tem um produto pequeno, como o RifaJá, que é um dos meus projetos, isso é ótimo: dá pra começar a cobrar sem maquininha e sem formulário de cartão.

Mas "aceitar Pix" e "integrar Pix direito" são coisas diferentes. Neste texto, eu explico o fluxo que considero o mínimo pra um checkout confiável, e os erros que fazem o suporte lotar de "paguei e não liberou".

## Chave solta não é integração

O jeito mais rápido de cobrar é mostrar a chave Pix na tela e pedir o comprovante. Funciona pra vender bolo pros vizinhos. Num sistema, é um problema: você não sabe qual pagamento é de qual pedido, a pessoa pode pagar o valor errado, e alguém precisa conferir extrato na mão.

O caminho certo é a **cobrança com QR dinâmico**. Você cria, via API do seu PSP (o banco ou a instituição de pagamento que você usa), uma cobrança com valor, prazo de expiração e um identificador seu, o `txid`. O PSP devolve o QR Code e o código "Pix Copia e Cola". Quando a pessoa paga, o pagamento chega amarrado àquele `txid`.

## O txid é seu, e nasce antes da cobrança

Na especificação da API Pix do Banco Central, o `txid` da cobrança imediata tem de 26 a 35 caracteres alfanuméricos. Eu gero esse identificador no meu sistema e gravo o pedido **antes** de chamar o PSP:

```typescript title="src/cobranca/criarCobranca.ts"
import { randomBytes } from 'node:crypto'

/** 32 caracteres hexadecimais, dentro da faixa de 26 a 35 da API Pix. */
export function novoTxid(): string {
  return randomBytes(16).toString('hex')
}

export async function criarCobranca(pedidoId: string, valorCentavos: number) {
  const txid = novoTxid()
  await db.cobrancas.insert({
    txid,
    pedidoId,
    valorCentavos,
    status: 'pendente',
    expiraEm: new Date(Date.now() + 30 * 60_000),
  })

  const cob = await psp.put(`/v2/cob/${txid}`, {
    calendario: { expiracao: 1800 },                   // 30 minutos, em segundos
    valor: { original: (valorCentavos / 100).toFixed(2) }, // "19.90"
    chave: process.env.PIX_CHAVE,                      // nunca no código
    solicitacaoPagador: `Pedido ${pedidoId}`,
  })

  return { txid, copiaECola: cob.pixCopiaECola }
}
```

Por que gravar antes? Porque, se o PSP responder e o seu banco cair logo depois, você tem uma cobrança viva no PSP que o seu sistema não conhece. Gravando antes, o pior caso é um registro "pendente" que expira sozinho. E o `PUT` com o `txid` no caminho é idempotente: se a chamada falhar por timeout, repetir com o mesmo `txid` não cria uma segunda cobrança.

> [!atencao] Valor em centavos
> Guarde dinheiro como inteiro em centavos. A API Pix recebe o valor como texto com duas casas decimais, então a conversão acontece só na borda. `0.1 + 0.2` em ponto flutuante não é `0.3`, e cobrança não é lugar pra descobrir isso.

## Expiração curta e status explícito

Cobrança com prazo curto (15 a 30 minutos funciona bem pra checkout) evita pagamento de um carrinho que a pessoa abandonou ontem e cujo preço ou estoque já mudou. No meu sistema, cada cobrança tem um status explícito, e só existem estas transições:

```text
pendente ──pagamento confirmado──▶ paga
pendente ──prazo passou──────────▶ expirada
paga     ──devolução feita───────▶ devolvida
```

Nada volta pra "pendente", e "paga" só vem de uma confirmação. Parece rígido, mas é isso que permite responder com segurança à pergunta "esse pedido foi pago?".

## Webhook: avise, mas não acredite

Quando o pagamento cai, o PSP chama um endpoint seu, o webhook, com os dados do Pix recebido: o `txid`, o valor, a data e o `endToEndId`, que é o identificador único daquela transação no sistema Pix.

Duas regras que eu sigo sem exceção:

1. **O webhook é só um aviso.** Antes de liberar qualquer coisa, consulto a cobrança na API do PSP e confiro status e valor. Assim, uma requisição forjada pro endpoint não libera pedido nenhum.
2. **O webhook pode chegar repetido, atrasado ou fora de ordem.** O processamento precisa ser idempotente.

```typescript title="src/cobranca/webhook.ts"
export async function processarPix(evento: { txid: string; endToEndId: string }) {
  // 1) confirma na fonte
  const cob = await psp.get(`/v2/cob/${evento.txid}`)
  if (cob.status !== 'CONCLUIDA') return 'ignorado'

  const local = await db.cobrancas.findOne({ txid: evento.txid })
  if (!local) return 'desconhecido'                     // loga e alerta
  const pago = Math.round(Number(cob.valor.original) * 100)
  if (pago !== local.valorCentavos) return 'valor-divergente'

  // 2) idempotência: índice único em endToEndId
  try {
    await db.pagamentos.insert({ endToEndId: evento.endToEndId, txid: evento.txid })
  } catch (e) {
    if (isDuplicateKey(e)) return 'repetido'            // já processado
    throw e
  }

  // 3) transição de estado condicional
  await db.cobrancas.update(
    { txid: evento.txid, status: 'pendente' },
    { status: 'paga', pagaEm: new Date() },
  )
  await liberarPedido(local.pedidoId)
  return 'ok'
}
```

O índice único no `endToEndId` é o coração da idempotência. Dois webhooks iguais chegando ao mesmo tempo disputam o mesmo insert, e só um vence. O update condicional (`status: 'pendente'`) garante que uma cobrança já paga, ou já expirada, não mude de estado por engano.

Responda o webhook rápido, com status 200, e deixe trabalho pesado, como enviar e-mail, pra uma fila. PSP que não recebe resposta tende a reenviar.

> [!dica] Proteja o endpoint
> Cada PSP tem o seu jeito de autenticar o webhook: certificado mútuo (mTLS), assinatura no cabeçalho ou um segredo na URL. Use o que ele oferecer. Mas, mesmo com a proteção, mantenha a regra de confirmar na API: defesa em camadas.

## Conciliação: o webhook que não chegou

Webhook falha. O seu servidor estava reiniciando, a rede piscou, o PSP teve um problema. Se o seu único caminho pra saber de um pagamento for o webhook, algum cliente vai pagar e não receber.

Por isso, roda uma conciliação periódica. A cada poucos minutos, ela pega as cobranças pendentes e consulta cada uma no PSP:

```typescript
const pendentes = await db.cobrancas.find({
  status: 'pendente',
  criadaEm: { $lt: minutosAtras(2) },
})
for (const c of pendentes) {
  const cob = await psp.get(`/v2/cob/${c.txid}`)
  if (cob.status === 'CONCLUIDA') {
    for (const pix of cob.pix ?? []) await processarPix({ txid: c.txid, endToEndId: pix.endToEndId })
  } else if (c.expiraEm < new Date()) {
    await db.cobrancas.update({ txid: c.txid, status: 'pendente' }, { status: 'expirada' })
  }
}
```

Repare que ela reaproveita a mesma função do webhook. Um caminho só pra marcar como paga, com a mesma idempotência, não importa por onde a informação chegou.

## Devolução e suporte

Pagamento em duplicidade e desistência acontecem. A API Pix tem devolução amarrada ao `endToEndId` do pagamento original, o que facilita rastrear. Eu registro cada devolução com motivo e valor, e a cobrança muda pra "devolvida".

E pro suporte, uma tela simples no admin que, dado um pedido, mostra o `txid`, o status, o `endToEndId` e o histórico de eventos resolve a maioria dos "paguei e não liberou" em segundos.

## Checklist antes do primeiro real

- Cobrança com QR dinâmico e `txid` gerado e gravado por você.
- Valor em centavos, inteiro, convertido só na borda.
- Expiração curta e status com transições explícitas.
- Webhook que confirma na API do PSP antes de liberar.
- Índice único no `endToEndId` e update condicional.
- Conciliação periódica reaproveitando a mesma função.
- Chaves, certificados e credenciais do PSP fora do código, no ambiente.
- Testes com o ambiente de homologação do PSP antes de ligar a produção.

Pix é simples pra quem paga. Pra quem cobra, a simplicidade vem desses detalhes.
