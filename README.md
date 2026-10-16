# Anil
Software de comunicação operacional

## O problema

Durante uma ocorrência operacional, as informações existem de forma detalhada e técnica, mas distribuídas de maneira fragmentada. Áreas como o Centro de Controle Operacional (CCO), manutenção, comercial e atendimento operam com recortes distintos da mesma situação, o que gera dessincronia nas decisões. O cliente fica à margem do processo, sem receber informações estruturadas e claras sobre o que está acontecendo com o seu voo.

## Tecnologias

- **HTML5 e CSS3:** interface limpa e responsiva.
- **TypeScript e JavaScript:** lógica do servidor e do front-end, com tipagem estática (`strict`) para maior segurança no fluxo de dados.
- **Node.js e Express:** API REST.
- **SQL (SQLite):** modelagem do banco e gestão dos níveis de acesso.
- **Conceitos de IA e segurança:** tradutor de jargão por regras e modelos de mensagem, e boas práticas de tratamento de informações sensíveis, a partir das certificações Google AI Essentials e Sensibilização para a Segurança Digital (Cisco).


## Como executar localmente

Requisitos: **Node.js 20 ou superior**.

```bash
git clone https://github.com/Adriel-Veiga/azul-sync.git
cd azul-sync
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
| Cliente | `cliente@azulsync.test` |
| Atendimento | `atendimento@azulsync.test` |
| Manutenção / CCO | `cco@azulsync.test` |

Na tela de login, os botões de demonstração entram direto com cada perfil.

### Como ver o tempo real

1. Abra duas abas: uma como **Cliente** e outra como **Manutenção / CCO**.
2. Na aba do CCO, clique em **Simular ocorrência**.
3. Em até 3 segundos, a aba do Cliente mostra a nova mensagem sem recarregar.

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
