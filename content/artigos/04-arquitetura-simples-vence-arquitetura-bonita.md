---
titulo: "Arquitetura simples vence arquitetura bonita"
slug: arquitetura-simples-vence-arquitetura-bonita
linhaFina: "Microsserviço, fila e cache têm hora. Na maioria dos projetos, a hora ainda não chegou."
categoria: opiniao
tags:
  - arquitetura
  - carreira
ordem: 4
destaque: true
capa: arquitetura
resumo: "Uma arquitetura boa é a que o time consegue entender, testar e mudar sem medo, e não a que fica bonita no diagrama. Defendo começar com um monólito bem dividido, um banco só e deploy simples, e só adicionar fila, cache ou novos serviços quando um problema medido pedir."
pontosChave:
  - "Cada peça nova na arquitetura é algo a mais pra monitorar, versionar e manter."
  - "Um monólito com módulos bem separados é mais fácil de dividir depois do que juntar serviços."
  - "Fila, cache e microsserviço resolvem problemas específicos; sem o problema, só custam."
  - "Meça antes de otimizar: escala imaginária não é requisito."
  - "Arquitetura boa é a que deixa a próxima mudança barata."
---
Eu trabalho com software há tempo suficiente pra ter passado por Java, PHP com Laravel, Node, Python e Go no back-end, e por Vue, React e Angular no front. Em todas essas stacks, vi a mesma tentação aparecer: desenhar a arquitetura pro sistema que a gente imagina que vai ter daqui a cinco anos, e não pro que precisa entregar no mês que vem.

Pronto, falei: na maioria dos projetos, a arquitetura simples vence a arquitetura bonita. E não por preguiça. Por custo.

## Toda caixa no diagrama cobra aluguel

Um diagrama com API gateway, cinco microsserviços, um broker de mensagens, cache distribuído e um banco por serviço é lindo. Ele também significa, no mínimo:

- cinco pipelines de deploy, ou um pipeline bem mais complicado;
- versionamento de contrato entre serviços;
- rede no meio de chamadas que antes eram uma função, com timeout, retry e falha parcial;
- uma fila que precisa de monitoramento, de política de reprocessamento e de alguém que saiba o que fazer quando ela entope;
- logs espalhados, que pedem rastreamento distribuído pra entender uma única requisição.

Cada uma dessas coisas resolve um problema real. Mas, se você ainda não tem o problema, você só tem o custo. E o custo aparece todo dia: no tempo pra subir o ambiente local, no tempo pra entender um bug, no tempo pra alguém novo no time ficar produtivo.

## O monólito não é o vilão

"Monólito" virou palavrão, mas o problema nunca foi ter um processo só. O problema é o monólito **sem fronteiras internas**, em que qualquer arquivo importa qualquer outro e uma mudança no cadastro quebra o relatório financeiro.

Um monólito modular, com fronteiras claras, é outra coisa. Cada módulo tem a sua pasta, expõe poucas funções públicas e não mexe nas tabelas dos outros:

```text
src/
  cobranca/
    index.ts          # o que os outros módulos podem usar
    criarCobranca.ts
    webhook.ts
  pedidos/
    index.ts
    ...
  shared/
    db.ts
    logger.ts
```

E a regra é aplicada por ferramenta, não por boa vontade. No TypeScript, por exemplo, dá pra proibir import de arquivo interno de outro módulo com uma regra de lint:

```json title="regra do ESLint"
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": [{
        "group": ["@/*/*", "!@/*/index"],
        "message": "Importe só pelo index do módulo."
      }]
    }]
  }
}
```

Quando um módulo realmente precisar virar um serviço separado, porque escala diferente, porque tem um time só pra ele ou porque tem requisito de isolamento, a fronteira já existe. Você tira a pasta, coloca uma API na frente e pronto. O contrário, juntar serviços que foram separados cedo demais, é bem mais doloroso.

## "Mas e se crescer?"

Essa é a pergunta que mais justifica complexidade antecipada. E a resposta honesta é: se crescer, você vai ter dados pra decidir. Hoje você tem um palpite.

Um Postgres ou um MongoDB bem indexado, numa máquina modesta, aguenta muito mais do que a maioria dos produtos vai precisar por um bom tempo. Antes de colocar um cache na frente, vale olhar o plano da consulta:

```sql
EXPLAIN ANALYZE
SELECT id, titulo FROM pedidos
WHERE cliente_id = 42 AND status = 'pago'
ORDER BY criado_em DESC
LIMIT 20;

-- Seq Scan? Então o problema é índice, não falta de cache:
CREATE INDEX idx_pedidos_cliente_status_data
  ON pedidos (cliente_id, status, criado_em DESC);
```

Muitas vezes, o "precisamos de cache" é um índice que faltou. E um índice não precisa de invalidação, não fica inconsistente e não cai.

> [!dica] Escreva o gatilho, não a solução
> Em vez de construir a fila agora, anote no documento de arquitetura: "quando o envio de e-mail passar de X por minuto ou atrasar a resposta da API em mais de Y ms, mover pra uma fila". Você registra a decisão, define o critério e não paga o custo antes da hora.

## Quando a complexidade se paga

Não estou dizendo que fila, cache e serviço separado são ruins. Eles têm hora, e a hora é quando aparece um problema concreto que eles resolvem melhor do que a alternativa simples:

- **Fila**: quando uma tarefa é lenta, pode falhar e não precisa terminar dentro da requisição. Gerar um PDF, processar um vídeo, rodar uma IA. Neste blog, a síntese feita por IA roda num job em segundo plano exatamente por isso: leva uns dois minutos, e ninguém deveria esperar com a tela travada.
- **Cache**: quando a mesma leitura cara se repete muito e um dado um pouco velho é aceitável.
- **Serviço separado**: quando uma parte precisa escalar, ser implantada ou ser protegida de forma diferente do resto.

Repare que, em todos os casos, a justificativa começa com "quando". É uma resposta a um problema, não um ponto de partida.

## O teste da próxima mudança

O critério que eu uso pra avaliar uma arquitetura é simples: quanto custa a próxima mudança? Se adicionar um campo num formulário exige mexer em três serviços, publicar um evento novo e coordenar dois deploys, a arquitetura está cobrando caro. Se exige mexer num módulo, rodar os testes e subir, ela está fazendo o trabalho dela.

Algumas perguntas que ajudam:

1. Uma pessoa nova consegue subir o projeto local em menos de uma hora?
2. Dá pra entender o caminho de uma requisição lendo o código, sem abrir cinco dashboards?
3. O deploy é um comando?
4. Os testes rodam na sua máquina?
5. Quando algo quebra às três da manhã, quantos lugares você precisa olhar?

Se as respostas forem boas, a arquitetura é boa, mesmo que o diagrama tenha três caixas.

## A simplicidade dá trabalho

Tem uma ironia nisso tudo: arquitetura simples é mais difícil de fazer do que arquitetura complicada. Juntar peças da moda é fácil, e tem tutorial pra tudo. Difícil é olhar pro problema, cortar o que não é necessário e defender essa decisão numa reunião em que todo mundo quer usar a ferramenta nova.

Mas é esse corte que deixa o sistema vivo por anos. Comece simples, separe bem por dentro, meça, e deixe a complexidade entrar só quando ela trouxer um problema resolvido junto.
