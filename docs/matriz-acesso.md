# Matriz de acesso por perfil

Cada perfil visualiza apenas o recorte da ocorrência relevante para a sua atuação.

| Campo da ocorrência | Manutenção/CCO | Atendimento/Comercial | Cliente |
|---|---|---|---|
| detalhe_tecnico (logs e status da aeronave) | Sim | Não | Não |
| recomendacao_operacional (remanejamento e suporte) | Sim | Sim | Não |
| mensagem_cliente (texto simplificado) | Sim | Sim | Sim |
| setores_destino (setores responsáveis) | Sim | Sim | Não |
| alerta_conexao e passageiros_em_risco | Não | Sim | Não |
| conexao_critica e orientação da própria conexão | Não | Não | Sim |
| atualizacoes (histórico interno) | Sim | Sim | Não |
| status da ocorrência | Sim | Sim | Sim |

## Princípios

- Acesso mínimo necessário: cada perfil recebe somente o que precisa.
- O perfil Cliente nunca recebe jargão técnico nem dados operacionais internos.
- Dados de passageiros e voos usados no projeto são fictícios.