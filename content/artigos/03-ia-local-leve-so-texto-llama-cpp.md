---
titulo: "Homelab do zero, parte 3: IA local leve, só texto, com llama.cpp e sem GPU"
slug: ia-local-leve-so-texto-llama-cpp
linhaFina: "Um modelo de 4B parâmetros em CPU gera a síntese dos posts deste blog. Os números reais, as escolhas e o que eu deixei de fora."
categoria: tutorial
tags:
  - ia
  - homelab
  - docker
ordem: 1
destaque: true
capa: ia
serie: homelab-do-zero
serieOrdem: 3
resumo: "A síntese dos posts deste blog é gerada por um modelo de 4B parâmetros rodando só em CPU no servidor de casa. Com llama.cpp, quantização Q3_K_M, saída presa num JSON schema e limite de 3 GB, um post de 929 palavras leva uns 2 minutos e 20 segundos, e a IA dorme quando fica parada."
pontosChave:
  - "Pra resumir texto, um modelo pequeno e só de texto basta; multimodal é peso morto."
  - "Qwen3-4B em Q3_K_M ocupa uns 2 GB em disco e teve pico de 2,9 GB de RAM."
  - "JSON schema no llama.cpp força a resposta no formato certo."
  - "Fila em segundo plano: dois minutos de espera não incomodam ninguém."
  - "Com --sleep-idle-seconds, a memória volta pros outros apps quando a IA para."
---
Todo post deste blog tem, no topo, uma síntese curta e alguns pontos-chave. Eu queria que uma IA escrevesse o primeiro rascunho disso, mas com três condições: nada sai do meu servidor, nada de API paga e nada de GPU, porque o servidor de casa não tem uma. E, principalmente, a IA não pode atrapalhar os outros apps que rodam na mesma máquina.

Esta é a última parte da série **Homelab do zero**. Aqui eu conto como ficou, com os números que eu medi de verdade.

## Primeiro, o tamanho do problema

Resumir um texto é uma tarefa bem mais estreita do que conversar sobre qualquer assunto, escrever código ou descrever imagens. O modelo recebe o post, devolve duas ou três frases e uma lista curta. Não precisa de visão, não precisa de áudio, não precisa de 70 bilhões de parâmetros.

Isso muda a escolha. Modelos multimodais carregam componentes extras que, pra esse uso, só ocupam memória. Eu fui direto em modelos **só de texto**, pequenos, com boa qualidade em português e licença tranquila.

## Por que llama.cpp

O [llama.cpp](https://github.com/ggml-org/llama.cpp) roda modelos no formato GGUF em CPU, com muita otimização, e vem com o `llama-server`, um servidor HTTP com uma API compatível com a da OpenAI. Na prática, o app chama `/v1/chat/completions` como chamaria qualquer provedor, só que o endereço é um container na rede interna.

Ele também tem uma imagem Docker oficial, o que encaixa no resto do homelab:

```yaml title="docker-compose.yml"
services:
  llm:
    image: ghcr.io/ggml-org/llama.cpp:server-b12627   # versão fixa, nada de :latest
    command: >
      -m /models/Qwen3-4B-Instruct-2507-Q3_K_M.gguf
      --host 0.0.0.0 --port 8080
      -t 3 -tb 3 -c 5120 -np 1
      --reasoning off --no-repack --cache-ram 0
      --sleep-idle-seconds 120
    volumes: [llm-models:/models:ro]
    deploy: { resources: { limits: { memory: 3g, cpus: '3' } } }
    networks: [internal]   # sem porta no host e sem internet
```

Algumas flags explicadas:

- `-t 3 -tb 3`: três threads pra gerar e pra processar o prompt, casando com o limite de 3 CPUs do container. Sobra CPU pro resto do servidor.
- `-c 5120 -np 1`: janela de contexto de 5.120 tokens e um pedido por vez. Contexto maior custa memória, e eu não preciso de mais.
- `--reasoning off`: sem a etapa de "pensar em voz alta". Pra resumo, ela só gasta tempo.
- `--sleep-idle-seconds 120`: depois de dois minutos sem pedidos, o servidor descarrega o modelo e libera a RAM. No próximo pedido, carrega de novo.

## A escolha do modelo, com números

Antes de decidir, testei vários modelos com o mesmo post de 929 palavras, o mesmo prompt e o mesmo schema. Entre os que eu comparei estavam Qwen3 de 1,7B e de 4B, Llama 3.2 3B e Gemma 3 1B. Fiquei com o **Qwen3-4B-Instruct-2507**, na quantização **Q3_K_M**, que ocupa uns 2 GB em disco. Ele deu o melhor equilíbrio entre qualidade do texto em português e memória.

O plano B foi o Gemma 3 1B. Ele é bem mais rápido e cabe em 1 GB, mas tinha um defeito que, pra mim, eliminava: escrevia a síntese em terceira pessoa, do tipo "O autor explica que…". A síntese de um blog pessoal precisa soar como o autor.

No servidor de casa, que é onde importa, os números ficaram assim:

- Post de 929 palavras: cerca de **2 minutos e 20 segundos** do pedido à resposta.
- Pico de memória do `llama-server`: cerca de **2,9 GB**, dentro do limite de 3 GB.
- Mesmo no pico, o servidor ficou com pelo menos 3,3 GB livres pros outros apps.
- Velocidade: perto de 24 tokens por segundo lendo o post e 3 tokens por segundo escrevendo.
- Ocioso, depois do sono: uns 80 MB.

> [!info] Por que 2 minutos está ótimo
> A síntese não é gerada enquanto alguém espera na frente da tela. Ela vira um job numa fila, roda em segundo plano e aparece no admin quando fica pronta. Pra esse fluxo, dois minutos são irrelevantes. Se fosse um chat, a história seria outra.

## Forçando o formato da resposta

Modelo pequeno às vezes responde com um texto antes do JSON, esquece um campo ou inventa outro. Em vez de torcer, eu passo um **JSON schema** no pedido. O llama.cpp converte o schema numa gramática e só deixa o modelo gerar tokens que respeitam o formato:

```typescript title="src/lib/llm/prompt.ts"
export const SUMMARY_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', minLength: 120, maxLength: 600 },
    keyPoints: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: { type: 'string', maxLength: 200 },
    },
  },
  required: ['summary', 'keyPoints'],
  additionalProperties: false,
} as const

const body = {
  messages,
  temperature: 0.2,
  max_tokens: 450,
  response_format: {
    type: 'json_schema',
    json_schema: { name: 'sintese', schema: SUMMARY_JSON_SCHEMA },
  },
}
```

O schema tem uma folga em relação às regras do blog (a síntese final precisa ter entre 160 e 400 caracteres). Depois que a resposta chega, o app valida de novo com as regras de verdade, limpa markdown e emojis que escaparem, e só então grava. Temperatura baixa, 0,2, porque resumo não é lugar de criatividade.

## O prompt

O prompt de sistema é curto e cheio de proibições, porque é isso que funciona com modelo pequeno:

```text
Você é o editor do blog "Pronto, Falei!". Sua única tarefa é resumir o post
que o usuário enviar, em português do Brasil.
Regras:
- Use somente informações que estão no texto. Não invente fatos, números,
  nomes nem opiniões.
- Mantenha a voz do autor: primeira pessoa, direta, sem rodeios.
- Responda apenas com o JSON no formato pedido.
```

Os blocos de código do post viram um marcador `[código]` antes de ir pro modelo. Código ocupa muitos tokens e não ajuda a resumir a ideia do texto. Post muito longo é dividido em partes; cada parte é resumida e, no fim, os resumos parciais viram um só.

## IA propõe, eu reviso

A síntese gerada nunca vai direto pro ar. Ela entra no post marcada como "origem: IA", e o post só pode ser publicado depois que eu marco "síntese revisada". Se a IA falhar ou demorar demais, existe um plano C sem modelo nenhum: um resumo extrativo, que pega as frases mais representativas do próprio texto.

Isso parece burocracia, mas é o que torna o uso de um modelo pequeno seguro. Ele faz o trabalho chato do primeiro rascunho, e eu fico com a palavra final.

> [!dica] Comece pelo teste, não pelo modelo
> Antes de escolher, escreva um script que roda o mesmo texto em vários modelos e anota tempo, pico de RAM e o resultado. Meia hora de teste economiza semanas usando o modelo errado.

## O que eu deixei de fora, de propósito

- **GPU**: o servidor não tem, e pra esse volume não faz falta.
- **Modelo multimodal**: não leio imagem nem áudio, então não pago a memória.
- **Porta no host**: o modelo só é acessível pela rede interna do Compose.
- **Internet no container**: a rede interna não tem saída. Um serviço separado baixa o arquivo do modelo uma vez e confere o SHA-256.
- **Modelo no git**: o arquivo de 2 GB fica num volume do Docker, nunca no repositório.

## Fechando a série

Nas três partes do **Homelab do zero**, o servidor de casa virou um lugar confiável pra rodar projetos: portas organizadas, healthcheck e limite em tudo, túnel em vez de porta aberta, backup que já foi restaurado e, agora, uma IA local que cabe em 3 GB e dorme quando não tem trabalho.

Nenhuma dessas peças é exótica. O ganho está em juntar coisas simples e medir antes de decidir.
