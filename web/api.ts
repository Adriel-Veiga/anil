/// API PARA O FRONT
import type { Perfil, Sessao } from './tipos.js';

const CHAVE_SESSAO = 'anil-sessao';
const PERFIS: Perfil[] = ['MANUTENCAO_CCO', 'ATENDIMENTO_COMERCIAL', 'CLIENTE'];

let aoExpirar: () => void = () => {};

// registra o que fazer quando o servidor recusar o token (401)
export function definirAoExpirar(funcao: () => void): void {
  aoExpirar = funcao;
}

// sessionStorage: uma sessão por aba, então dá para ter Cliente e CCO lado a lado
export function definirSessao(sessao: Sessao | null): void {
  try {
    if (sessao) {
      sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
    } else {
      sessionStorage.removeItem(CHAVE_SESSAO);
    }
  } catch {
    // armazenamento indisponível: segue sem persistir
  }
}

export function obterSessao(): Sessao | null {
  try {
    const valor = sessionStorage.getItem(CHAVE_SESSAO);
    if (!valor) {
      return null;
    }
    const dados: unknown = JSON.parse(valor);
    if (typeof dados === 'object' && dados !== null) {
      const { token, nome, perfil } = dados as Record<string, unknown>;
      if (
        typeof token === 'string' &&
        typeof nome === 'string' &&
        typeof perfil === 'string' &&
        PERFIS.includes(perfil as Perfil)
      ) {
        return { token, nome, perfil: perfil as Perfil };
      }
    }
    sessionStorage.removeItem(CHAVE_SESSAO);
  } catch {
    // conteúdo inválido ou armazenamento indisponível
  }
  return null;
}

interface Opcoes {
  metodo?: string;
  corpo?: unknown;
}
// faz a requisição para o servidor e retorna o JSON decodificado
export async function api<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const sessao = obterSessao();
  const cabecalhos = new Headers({ Accept: 'application/json' });
  if (opcoes.corpo !== undefined) {
    cabecalhos.set('Content-Type', 'application/json');
  }
  if (sessao) {
    cabecalhos.set('Authorization', `Bearer ${sessao.token}`);
  }

  const init: RequestInit = { method: opcoes.metodo ?? 'GET', headers: cabecalhos };
  if (opcoes.corpo !== undefined) {
    init.body = JSON.stringify(opcoes.corpo);
  }

  const resposta = await fetch(caminho, init);

  if (!resposta.ok) {
    // 401 com sessão guardada = token inválido (ex.: servidor reiniciou)
    if (resposta.status === 401 && sessao) {
      aoExpirar();
    }
    const dados: unknown = await resposta.json().catch(() => null);
    const mensagem = (dados as { erro?: string } | null)?.erro ?? `Erro ${resposta.status}`;
    throw new Error(mensagem);
  }
  return (await resposta.json()) as T;
}