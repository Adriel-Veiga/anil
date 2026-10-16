const CHAVE_SESSAO = 'anil-sessao';
const PERFIS = ['MANUTENCAO_CCO', 'ATENDIMENTO_COMERCIAL', 'CLIENTE'];
let aoExpirar = () => { };
// registra o que fazer quando o servidor recusar o token (401)
export function definirAoExpirar(funcao) {
    aoExpirar = funcao;
}
// sessionStorage: uma sessão por aba, então dá para ter Cliente e CCO lado a lado
export function definirSessao(sessao) {
    try {
        if (sessao) {
            sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
        }
        else {
            sessionStorage.removeItem(CHAVE_SESSAO);
        }
    }
    catch {
        // armazenamento indisponível: segue sem persistir
    }
}
export function obterSessao() {
    try {
        const valor = sessionStorage.getItem(CHAVE_SESSAO);
        if (!valor) {
            return null;
        }
        const dados = JSON.parse(valor);
        if (typeof dados === 'object' && dados !== null) {
            const { token, nome, perfil } = dados;
            if (typeof token === 'string' &&
                typeof nome === 'string' &&
                typeof perfil === 'string' &&
                PERFIS.includes(perfil)) {
                return { token, nome, perfil: perfil };
            }
        }
        sessionStorage.removeItem(CHAVE_SESSAO);
    }
    catch {
        // conteúdo inválido ou armazenamento indisponível
    }
    return null;
}
// faz a requisição para o servidor e retorna o JSON decodificado
export async function api(caminho, opcoes = {}) {
    const sessao = obterSessao();
    const cabecalhos = new Headers({ Accept: 'application/json' });
    if (opcoes.corpo !== undefined) {
        cabecalhos.set('Content-Type', 'application/json');
    }
    if (sessao) {
        cabecalhos.set('Authorization', `Bearer ${sessao.token}`);
    }
    const init = { method: opcoes.metodo ?? 'GET', headers: cabecalhos };
    if (opcoes.corpo !== undefined) {
        init.body = JSON.stringify(opcoes.corpo);
    }
    const resposta = await fetch(caminho, init);
    if (!resposta.ok) {
        // 401 com sessão guardada = token inválido (ex.: servidor reiniciou)
        if (resposta.status === 401 && sessao) {
            aoExpirar();
        }
        const dados = await resposta.json().catch(() => null);
        const mensagem = dados?.erro ?? `Erro ${resposta.status}`;
        throw new Error(mensagem);
    }
    return (await resposta.json());
}
