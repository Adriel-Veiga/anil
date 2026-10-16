//CORTA OS CAMIMNNHOS CONFORME O PERFIL DO USUÁRIO
import { MENSAGEM_CONEXAO_CRITICA } from './tradutor';
import type { ContextoConexao, LinhaOcorrencia, OcorrenciaVisivel, PerfilNome, SetorDestino } from './tipos';

const SETORES_VALIDOS: SetorDestino[] = ['MANUTENCAO', 'COMERCIAL_MALHA', 'ATENDIMENTO_SOLO'];

function setoresDestino(serializados: string): SetorDestino[] {
  try {
    const valores: unknown = JSON.parse(serializados);
    return Array.isArray(valores)
      ? valores.filter((valor): valor is SetorDestino => SETORES_VALIDOS.includes(valor))
      : [];
  } catch {
    return [];
  }
}

// Filtra os campos de uma ocorrência com base no perfil do usuário
export function filtrarOcorrencia(
  o: LinhaOcorrencia,
  perfil: PerfilNome,
  conexao?: ContextoConexao
): OcorrenciaVisivel {
  const base: OcorrenciaVisivel = {
    id: o.id,
    status: o.status,
    voo: { numero: o.voo_numero, origem: o.origem, destino: o.destino, status: o.voo_status },
    mensagem_cliente: o.mensagem_cliente,
    criada_em: o.criada_em,
  };

  if (perfil === 'CLIENTE') {
    const critica = conexao?.critica ?? false;
    return {
      ...base,
      mensagem_cliente: critica && o.mensagem_cliente
        ? `${o.mensagem_cliente}\n\n${MENSAGEM_CONEXAO_CRITICA}`
        : o.mensagem_cliente,
      conexao_critica: critica,
      ...(critica ? { informacao_conexao: MENSAGEM_CONEXAO_CRITICA } : {}),
    };
  }
  if (perfil === 'ATENDIMENTO_COMERCIAL') {
    return {
      ...base,
      tipo: o.tipo,
      recomendacao_operacional: o.recomendacao_operacional,
      setores_destino: setoresDestino(o.setores_destino_json),
      ...(conexao?.critica
        ? {
            conexao_critica: true,
            alerta_conexao: alertaConexao(conexao),
            passageiros_em_risco: conexao.passageiros,
          }
        : {}),
    };
  }
  return {
    ...base,
    tipo: o.tipo,
    recomendacao_operacional: o.recomendacao_operacional,
    detalhe_tecnico: o.detalhe_tecnico,
    setores_destino: setoresDestino(o.setores_destino_json),
  };
}

function alertaConexao(conexao: ContextoConexao): string {
  const quantidade = conexao.passageiros.length;
  const voos = [...new Set(conexao.passageiros.map((passageiro) => passageiro.voo_conexao))].join(', ');
  const passageiros = quantidade === 1 ? 'passageiro' : 'passageiros';
  return `ALERTA DE CONEXÃO: ${quantidade} ${passageiros} em risco de perda no voo ${voos}. Sugestão: Reacomodar preventivamente no voo AD1290 e emitir voucher de alimentação.`;
}
