//TIPOS DE DADOS E INTERFACES
export type PerfilNome = 'MANUTENCAO_CCO' | 'ATENDIMENTO_COMERCIAL' | 'CLIENTE';
export type StatusOcorrencia = 'ABERTA' | 'EM_ANDAMENTO' | 'RESOLVIDA';
export type StatusVoo = 'NORMAL' | 'ATRASADO' | 'CANCELADO' | 'REACOMODADO';
export type SetorDestino = 'MANUTENCAO' | 'COMERCIAL_MALHA' | 'ATENDIMENTO_SOLO';

export interface PassageiroEmRisco {
  nome: string;
  voo_conexao: string;
}

export interface ContextoConexao {
  critica: boolean;
  passageiros: PassageiroEmRisco[];
}

export interface LinhaOcorrencia {
  id: number;
  voo_id: number;
  tipo: string;
  status: StatusOcorrencia;
  detalhe_tecnico: string;
  recomendacao_operacional: string | null;
  mensagem_cliente: string | null;
  criada_em: string;
  voo_numero: string;
  origem: string;
  destino: string;
  voo_status: StatusVoo;
  partida_prevista: string | null;
  chegada_prevista: string | null;
  atraso_minutos: number;
  setores_destino_json: string;
}

export interface OcorrenciaVisivel {
  id: number;
  status: StatusOcorrencia;
  voo: { numero: string; origem: string; destino: string; status: StatusVoo };
  mensagem_cliente: string | null;
  criada_em: string;
  tipo?: string;
  recomendacao_operacional?: string | null;
  detalhe_tecnico?: string;
  setores_destino?: SetorDestino[];
  conexao_critica?: boolean;
  informacao_conexao?: string;
  alerta_conexao?: string;
  passageiros_em_risco?: PassageiroEmRisco[];
}

export interface Sessao {
  usuarioId: number;
  nome: string;
  perfil: PerfilNome;
}
