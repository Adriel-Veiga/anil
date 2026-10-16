//TIPOS DE DADOS USADOS NO FRONT-END
export type Perfil = 'MANUTENCAO_CCO' | 'ATENDIMENTO_COMERCIAL' | 'CLIENTE';
export type StatusOcorrencia = 'ABERTA' | 'EM_ANDAMENTO' | 'RESOLVIDA';
export type StatusVoo = 'NORMAL' | 'ATRASADO' | 'CANCELADO' | 'REACOMODADO';
export type SetorDestino = 'MANUTENCAO' | 'COMERCIAL_MALHA' | 'ATENDIMENTO_SOLO';

export interface PassageiroEmRisco {
  nome: string;
  voo_conexao: string;
}

export interface Voo {
  numero: string;
  origem: string;
  destino: string;
  status: StatusVoo;
}

export interface Ocorrencia {
  id: number;
  status: StatusOcorrencia;
  voo: Voo;
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

export interface Atualizacao {
  id: number;
  texto: string;
  criada_em: string;
  autor: string;
}

export interface Sessao {
  token: string;
  nome: string;
  perfil: Perfil;
}

export interface TipoOcorrencia {
  codigo: string;
  nome: string;
  detalhe_operacional: string;
  recomendacao_operacional: string;
}