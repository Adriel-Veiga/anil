# Anil

Software de comunicações operacionais.

Proposta de solução para a **Seletiva da Azul Linhas Aéreas**, com foco no **Tema 3: Comunicação Interáreas em Tempo Real**

## O problema

Durante uma ocorrência operacional, as informações existem de forma detalhada e técnica, mas distribuídas de maneira fragmentada. Áreas como o Centro de Controle Operacional (CCO), manutenção, comercial e atendimento operam com recortes distintos da mesma situação, o que gera dessincronia nas decisões. O cliente fica à margem do processo, sem receber informações estruturadas e claras sobre o que está acontecendo com o seu voo.

## A solução

O Anil é uma aplicação web que atua como hub centralizador de informações. A ocorrência é registrada uma única vez e redistribuída de forma contextualizada e simultânea, por meio de controle de perfis de acesso. Cada setor visualiza apenas o recorte relevante para a sua atuação:

| Perfil | O que enxerga |
|---|---|
| **Manutenção / CCO** | Detalhe técnico, recomendação operacional, mensagem enviada ao cliente e histórico de atualizações |
| **Atendimento / Comercial** | Tipo da ocorrência, recomendação operacional (remanejamento e suporte), mensagem ao cliente e histórico de atualizações |
| **Cliente** | Apenas o status do voo e uma mensagem simplificada, sem jargão técnico |

Para o perfil Cliente, um tradutor de jargão converte o tipo da ocorrência em uma mensagem tranquilizadora e informativa. A mensagem simplifica a linguagem, mas não esconde que há atraso ou cancelamento. A regra de visibilidade completa está em [`docs/matriz-acesso.md`](docs/matriz-acesso.md).

O CCO pode direcionar cada ocorrência para Manutenção, Comercial / Malha e/ou Atendimento Solo. Para passageiros com voos conectados no mesmo dia, o sistema calcula o tempo disponível após o atraso e sinaliza conexões abaixo de 40 minutos.

## Como funciona

```
Navegador (public/ + web/)  →  API Express (src/servidor.ts)  →  Banco SQLite
        desenha                  autentica e filtra por perfil      guarda os dados
```

1. O usuário faz login e o servidor devolve um token de sessão.
2. A tela consulta a API a cada 3 segundos e atualiza sozinha quando há novidade.
3. O servidor identifica o perfil pelo token e remove da resposta os campos que o perfil não pode ver. O filtro é feito **no servidor**, e não apenas na tela.

## Tecnologias

- **HTML5 e CSS3:** interface limpa e responsiva.
- **TypeScript e JavaScript:** lógica do servidor e do front-end, com tipagem estática (`strict`) para maior segurança no fluxo de dados.
- **Node.js e Express:** API REST.
- **SQL (SQLite):** modelagem do banco e gestão dos níveis de acesso.
- **Conceitos de IA e segurança:** tradutor de jargão por regras e modelos de mensagem, e boas práticas de tratamento de informações sensíveis, a partir das certificações Google AI Essentials e Sensibilização para a Segurança Digital (Cisco).


## Como executar localmente

Requisitos: **Node.js 20 ou superior**.

```bash
git clone https://github.com/Adriel-Veiga/anil.git
cd anil
npm install
npm run build:web
npm run seed
npm run dev
```

Acesse **http://localhost:3000**.

### Contas de demonstração

A senha de todas é `azul123` (apenas para o protótipo).

| Perfil | E-mail |
|---|---|
| Cliente (voo direto) | `cliente_direto@anil.test` |
| Cliente (com conexão) | `cliente_conexao@anil.test` |
| Atendimento | `atendimento@anil.test` |
| Manutenção / CCO | `cco@anil.test` |

Na tela de login, os botões de demonstração entram direto com cada perfil.

### Como ver o tempo real

1. Abra duas abas: uma como **Cliente** e outra como **Manutenção / CCO**.
2. Na aba do CCO, clique em **Simular ocorrência**.
3. Em até 3 segundos, a aba do Cliente mostra a nova mensagem sem recarregar.

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor em modo desenvolvimento (reinicia ao salvar) |
| `npm run seed` | Recria o banco com dados fictícios |
| `npm run build:web` | Compila o front-end (`web/` para `public/js/`) |
| `npm run build` | Compila servidor e front-end |
| `npm start` | Executa o servidor compilado |
| `npm run start:render` | Recria o banco e inicia o servidor (usado no deploy) |
| `npm test` | Roda os testes das regras de visibilidade |

## API

| Método e rota | Perfis | Descrição |
|---|---|---|
| `POST /api/login` | Todos | Autentica e devolve o token |
| `GET /api/ocorrencias` | Todos | Lista as ocorrências, já filtradas pelo perfil. O Cliente só recebe os voos dele |
| `POST /api/ocorrencias` | CCO | Cria uma ocorrência e gera a mensagem do cliente |
| `GET /api/tipos-ocorrencia` | CCO | Lista os tipos e modelos de detalhe/recomendação operacional |
| `GET /api/atualizacoes` | CCO, Atendimento | Histórico de atualizações de todas as ocorrências |
| `GET /api/ocorrencias/:id/atualizacoes` | CCO, Atendimento | Histórico de uma ocorrência |
| `POST /api/ocorrencias/:id/atualizacoes` | CCO, Atendimento | Registra uma atualização |

As rotas protegidas exigem o cabeçalho `Authorization: Bearer <token>`.

## Banco de dados

Sete tabelas, definidas em [`database/schema.sql`](database/schema.sql):

- `perfis` e `usuarios`: quem usa o sistema e com qual nível de acesso.
- `voos` e `passageiros_voos`: os voos e quais passageiros pertencem a cada um.
- `ocorrencias`: o evento operacional, com **uma versão do texto para cada público** (`detalhe_tecnico`, `recomendacao_operacional` e `mensagem_cliente`).
- `tipos_ocorrencia`: catálogo de modelos operacionais usados para preencher detalhe e recomendação ao selecionar um tipo no CCO.
- `atualizacoes`: histórico de andamento, com o autor de cada registro.

## Estrutura do repositório

```
anil/
├── database/    schema.sql (modelo do banco)
├── docs/        matriz de acesso por perfil
├── public/      index.html, css/ e js/ (gerado a partir de web/)
├── src/         servidor: API, banco, segurança, tradutor e regras de visibilidade
└── web/         código-fonte TypeScript do front-end
```

## Testes

```bash
npm test
```

Os testes automáticos verificam que o Cliente não recebe campos técnicos nem operacionais, que o Atendimento não recebe o detalhe técnico e que o CCO recebe todos os campos.

## Limitações do protótipo

- As sessões ficam em memória e não expiram por tempo. Se o servidor reinicia, é preciso entrar de novo.
- No ambiente de hospedagem gratuita o banco volta ao estado inicial a cada reinício.
- A atualização usa consulta periódica (polling a cada 3 s). Em produção, o caminho natural seria WebSocket ou Server-Sent Events.
- O tradutor de jargão usa modelos de mensagem por tipo de ocorrência. Uma evolução possível é integrar um modelo de linguagem, mantendo a mesma regra de visibilidade.
- Os botões de demonstração e a conta com senha fixa existem só para facilitar a avaliação.

## Autor

**Adriel Veiga**
