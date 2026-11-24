---
titulo: "Homelab do zero, parte 1: Umbrel, Docker e Cloudflare Tunnel sem abrir porta no roteador"
slug: homelab-do-zero-umbrel-docker-cloudflare-tunnel
linhaFina: "Como eu subo apps próprios num servidor de casa e publico na internet sem expor o IP nem mexer no roteador."
categoria: tutorial
tags:
  - homelab
  - docker
ordem: 2
destaque: true
capa: homelab
serie: homelab-do-zero
serieOrdem: 1
resumo: "Rodo meus apps num servidor em casa com Umbrel e Docker Compose, cada um com porta reservada, healthcheck e limite de memória. Pra publicar, uso Cloudflare Tunnel: a conexão sai do servidor, então não abro porta no roteador nem exponho meu IP."
pontosChave:
  - "Umbrel já é Docker por baixo: dá pra rodar apps próprios com Compose ao lado dos da loja."
  - "Reserve um bloco de portas por projeto e anote, pra nunca brigar com outro app."
  - "Healthcheck, depends_on e limite de memória evitam que um app derrube o servidor."
  - "Cloudflare Tunnel publica o site com conexão de saída, sem port forwarding."
  - "Banco, storage e IA ficam numa rede interna, sem porta no host."
---
Eu gosto de ter os meus projetos rodando numa máquina que está aqui em casa, em Brasília, e não numa conta de nuvem que cobra por hora. Não é purismo: pra projeto pessoal e produto pequeno, um servidor doméstico bem configurado resolve, custa pouco por mês e me ensina mais do que qualquer painel bonito.

Este blog, por exemplo, roda assim. Esta série, **Homelab do zero**, é o caminho que eu sigo pra colocar um app de pé em casa e publicar na internet. Nesta primeira parte: o servidor, o Docker e o túnel. Na parte 2, backup de verdade. Na parte 3, IA local leve.

## Por que Umbrel

O [Umbrel](https://umbrel.com) é um sistema pra servidor doméstico com uma loja de apps. O que me interessa nele é simples: por baixo, tudo é Docker. Cada app da loja é um conjunto de containers, e você tem acesso por SSH à máquina. Então dá pra instalar coisas com um clique quando faz sentido e, ao lado, rodar os meus próprios projetos com `docker compose`, do jeito que eu rodaria em qualquer VPS.

A primeira coisa que eu faço é entrar por SSH e conferir o que já está rodando:

```bash
ssh umbrel@umbrel.local
docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
```

Essa lista é importante porque o servidor não é só meu projeto. Tem app da loja, tem outros projetos meus. Qualquer coisa nova precisa conviver com o que já existe.

## Regra 1: cada projeto tem o seu bloco de portas

Parece bobagem, mas é a causa número um de dor de cabeça em homelab: dois apps querendo a mesma porta. Eu reservo um bloco por projeto e anoto num arquivo de texto no próprio servidor. Este blog, por exemplo, ficou com a faixa 3130–3135. O app principal escuta na 3130 e o resto da faixa fica livre pros serviços que ainda vão chegar.

E só o que precisa ser acessado de fora do Docker ganha porta no host. Banco de dados, storage de imagens e a IA local não ganham. Eles ficam numa rede interna do Compose, que nem tem saída pra internet:

```yaml title="docker-compose.yml"
services:
  app:
    image: meu-app:latest
    ports: ['3130:3000']        # a única porta publicada
    networks: [internal, default]

  mongo:
    image: mongo:8.0.38
    networks: [internal]        # sem porta no host

networks:
  internal:
    internal: true              # sem rota pra internet
```

Com `internal: true`, o container do banco não consegue nem fazer uma requisição pra fora. Se alguém um dia conseguir rodar algo lá dentro, não tem pra onde mandar.

## Regra 2: nada sobe sem healthcheck

O Compose sobe os containers na ordem que você manda, mas "container iniciado" não quer dizer "serviço pronto". O banco pode levar alguns segundos pra aceitar conexão, e o app quebra se tentar conectar antes. A solução é declarar um healthcheck em cada serviço e usar `depends_on` com condição:

```yaml
services:
  app:
    depends_on:
      mongo: { condition: service_healthy }
    healthcheck:
      test: ['CMD', 'wget', '-qO-', 'http://127.0.0.1:3000/api/health']
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 40s

  mongo:
    healthcheck:
      test: ['CMD', 'mongosh', '--quiet', '--eval', 'db.adminCommand("ping").ok']
      interval: 10s
      retries: 10
```

E no deploy eu uso `--wait`, que faz o comando só terminar quando tudo estiver saudável. Se algo não ficar saudável, o comando falha, e eu fico sabendo na hora, não quando alguém tentar abrir o site:

```bash
docker compose -f docker-compose.prod.yml --env-file ../.env up -d --build --wait
```

## Regra 3: limite de memória em tudo

Servidor doméstico tem pouca RAM e muita coisa rodando. Um app com vazamento de memória, ou um modelo de IA carregando, pode empurrar a máquina pro swap e deixar tudo lento. Por isso cada serviço tem um teto:

```yaml
services:
  app:
    deploy: { resources: { limits: { memory: 768m, cpus: '1.5' } } }
  llm:
    deploy: { resources: { limits: { memory: 3g, cpus: '3' } } }
```

O Docker Compose aplica esses limites mesmo fora do Swarm. Se o serviço passar do teto, quem morre é ele, e não o servidor inteiro. Com `restart: unless-stopped`, ele volta sozinho.

> [!dica] Segredos fora do git
> O arquivo `.env` com senhas fica no servidor, um nível acima do código, com permissão 600. O repositório só tem um `.env.example` com os nomes das variáveis. O script de deploy gera as senhas na primeira vez, sem imprimir nada na tela.

## Publicando na internet sem abrir porta

Até aqui o app está acessível na rede de casa. Pra publicar com domínio e HTTPS, o caminho clássico seria abrir a porta 443 no roteador, apontar o DNS pro IP de casa e cuidar de certificado. Eu não gosto de nenhuma dessas três coisas: o IP residencial muda, expõe a minha localização aproximada e deixa a máquina de casa recebendo tráfego direto da internet.

O [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/) inverte a lógica. Um programa chamado `cloudflared` roda no servidor e abre uma conexão de **saída** até a Cloudflare. Quando alguém acessa o domínio, a Cloudflare manda a requisição por esse túnel que já está aberto. O roteador não precisa de nenhuma regra nova, e o DNS aponta pra Cloudflare, não pra minha casa.

Rodando como container, fica assim:

```yaml title="docker-compose.tunnel.yml"
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    command: tunnel --no-autoupdate run
    environment:
      TUNNEL_TOKEN: ${TUNNEL_TOKEN:?}
    restart: unless-stopped
```

O token vem do painel da Cloudflare, quando você cria o túnel, e vai pro `.env` como qualquer outro segredo. No painel, você diz qual hostname vai pra qual serviço interno, por exemplo `meudominio.dev` indo pra `http://localhost:3130`. Se preferir configurar por arquivo, as regras são uma lista em que a última pega tudo o que sobrou:

```yaml title="config.yml"
tunnel: <id-do-tunel>
credentials-file: /etc/cloudflared/<id-do-tunel>.json
ingress:
  - hostname: meudominio.dev
    service: http://localhost:3130
  - hostname: www.meudominio.dev
    service: http://localhost:3130
  - service: http_status:404
```

O HTTPS fica por conta da Cloudflare, na borda. Entre a Cloudflare e o servidor, o tráfego passa dentro do túnel.

> [!atencao] O app precisa saber o próprio endereço
> Atrás de um túnel ou proxy, o app recebe a requisição de um intermediário. Configure a URL pública (no Next.js, algo como `NEXT_PUBLIC_SERVER_URL`) pra que links absolutos, feeds, sitemap e Open Graph saiam com o domínio certo, e não com `localhost`. Decida também se o `www` redireciona pro domínio principal ou o contrário, e faça isso num lugar só.

## E o acesso administrativo?

O site público passa pelo túnel. Já o SSH, o console do storage e outras telas administrativas eu não publico. Pra isso eu uso uma VPN do tipo mesh, que me deixa acessar o servidor de qualquer lugar como se eu estivesse na rede de casa. A regra é: o que é público vai pelo túnel; o que é só meu fica na VPN.

## O checklist que eu sigo

Toda vez que um projeto novo vai pro servidor, eu passo por esta lista:

1. Conferir os containers e portas que já existem.
2. Reservar e anotar o bloco de portas do projeto.
3. Publicar só a porta do app; o resto vai pra rede interna.
4. Healthcheck em todos os serviços e `depends_on` com `service_healthy`.
5. Limite de memória e CPU em todos os serviços.
6. Segredos no `.env` do servidor, fora do git, com permissão 600.
7. Deploy com `--wait` e, depois, conferir que os outros apps continuam iguais.
8. Túnel pro domínio e HTTPS na borda.

Nada disso é sofisticado, e esse é o ponto. Um homelab que você consegue manter sozinho num fim de semana vale mais do que um cluster bonito que ninguém entende.

Na parte 2, vou falar da coisa que mais gente esquece: backup. Não o backup que roda, mas o backup que você já restaurou pelo menos uma vez.
