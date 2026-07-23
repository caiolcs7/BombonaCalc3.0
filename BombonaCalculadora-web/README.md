# BombonaCalc Web 4.0.1

Sistema web multiusuário para cálculo industrial por tara. O frontend e a API são entregues pelo mesmo serviço Node.js e os registros compartilhados ficam em PostgreSQL.

## O que mudou

- Nova identidade visual aplicada ao cabeçalho, favicon e ícones instaláveis do PWA.
- Interface escura refeita, com superfícies grafite-azuladas, destaques vibrantes e sem cartões brancos no modo escuro.
- Histórico compartilhado entre todos os usuários.
- Busca exclusivamente pelo ID do produto.
- ID do produto e Endereço convertidos para maiúsculas durante a digitação e novamente no servidor.
- Salvamento e edição centralizados no backend.
- Quantidade original preservada após edições.
- Histórico de revisões.
- Controle otimista de concorrência para impedir que duas pessoas sobrescrevam a mesma versão do registro.
- PIN administrativo validado no servidor. O valor solicitado é `3007`.
- Taras, recipientes, rendimento e arredondamento compartilhados.
- PostgreSQL com índices para ID e data.
- Exclusão lógica dos registros.
- Limitação de tentativas de PIN e de gravações.
- Cabeçalhos de segurança e cookie administrativo `HttpOnly`.
- Testes unitários, de API e Playwright em desktop e mobile.
- Docker, Docker Compose, Render Blueprint e GitHub Actions.

## Arquitetura

```text
Navegador/PWA
    │
    ├── arquivos estáticos
    └── /api
          │
          ▼
Node.js HTTP Server
          │
          ▼
PostgreSQL
```

O modo `memory` existe somente para desenvolvimento e testes. Em produção, use PostgreSQL.

## Requisitos

- Node.js 22 ou superior. Node.js 24 LTS é recomendado para produção.
- PostgreSQL 15 ou superior, ou Docker.

## Executar rapidamente sem banco

```bash
npm install
npm run dev
```

O comando usa um repositório em memória. Os dados são perdidos ao reiniciar.

Acesse:

```text
http://localhost:8080
```

## Executar com PostgreSQL

1. Copie as variáveis:

```bash
cp .env.example .env
```

2. Configure `DATABASE_URL` e uma `SESSION_SECRET` longa.

3. Instale e migre:

```bash
npm install
npm run db:migrate
npm start
```

O Node não carrega `.env` automaticamente neste projeto. Em desenvolvimento, use:

```bash
node --env-file=.env server/migrate.js
node --env-file=.env server/index.js
```

## Docker Compose

```bash
docker compose up --build
```

A aplicação ficará em `http://localhost:8080`.

Antes de produção, altere obrigatoriamente a `SESSION_SECRET`. O PIN permanece `3007` conforme solicitado, mas pode ser alterado com `ADMIN_PIN` sem modificar o código.

## Publicação a partir do GitHub

Este projeto **não pode ser publicado somente no GitHub Pages**, porque possui API e banco de dados. O GitHub armazena o código; um provedor executa o container e o PostgreSQL.

### Render

O arquivo `render.yaml` cria:

- Um Web Service usando o `Dockerfile`.
- Um banco PostgreSQL.
- Migrações automáticas antes de iniciar o servidor.

Fluxo:

1. Crie um repositório no GitHub.
2. Envie todos os arquivos deste projeto.
3. No Render, escolha **New Blueprint**.
4. Conecte o repositório.
5. Confirme os serviços do `render.yaml`.
6. Aguarde o health check `/api/health` ficar saudável.

### Outros provedores

O mesmo Dockerfile pode ser usado em Railway, Fly.io, Azure Container Apps, Google Cloud Run ou VPS. O provedor precisa fornecer `DATABASE_URL`, armazenamento persistente do PostgreSQL e HTTPS.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---:|---|
| `DATABASE_ADAPTER` | Produção | Use `postgres`. |
| `DATABASE_URL` | Produção | String de conexão PostgreSQL. |
| `DATABASE_SSL` | Não | Use `true` quando o provedor exigir SSL. |
| `ADMIN_PIN` | Não | Padrão solicitado: `3007`. |
| `SESSION_SECRET` | Produção | Segredo aleatório com no mínimo 32 caracteres. |
| `ADMIN_SESSION_MINUTES` | Não | Duração da sessão administrativa. Padrão: 10. |
| `TRUST_PROXY` | Não | Use `true` atrás de proxy confiável. |
| `PORT` | Não | Porta HTTP. Padrão: 8080. |

## Banco e concorrência

Cada registro possui uma coluna `version`. Ao editar, o navegador envia a versão que carregou. O backend bloqueia a linha durante a transação e rejeita a edição com HTTP `409` caso outra pessoa já tenha atualizado o registro.

Essa estratégia evita perda silenciosa de dados em uso simultâneo.

## Busca

A API aceita apenas:

```text
GET /api/calculos?produtoId=PROD-
```

A busca usa o início do ID. Endereço, recipiente e quantidade não fazem parte da pesquisa.

## Maiúsculas

A regra existe em três camadas:

1. Conversão visual durante a digitação.
2. Normalização no JavaScript antes do envio.
3. Normalização e restrição no backend/banco.

Portanto, chamadas externas à API também são gravadas em maiúsculas.

## Testes

### Unitários e API

```bash
npm test
```

### Navegador

```bash
npx playwright install chromium
npm run test:e2e
```

Os testes cobrem desktop e mobile, salvamento, maiúsculas, busca por ID, edição e preservação do valor original.

### Todos

```bash
npm run test:all
```

## CI no GitHub

O workflow `.github/workflows/ci.yml` executa:

- Verificação de sintaxe.
- Testes unitários.
- Testes da API.
- Testes Playwright no Chromium.

## Segurança operacional

O PIN `3007` é curto e conhecido. A API aplica limitação de tentativas e mantém a sessão em cookie assinado, mas para uma aplicação exposta publicamente recomenda-se colocar o site atrás de login corporativo, VPN, Cloudflare Access ou autenticação individual por operador.

O backend já foi estruturado para que essa autenticação possa ser adicionada sem reescrever o cálculo e o banco.
