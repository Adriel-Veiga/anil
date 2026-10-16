//INTERFACE DE LOGIN E DO PAINEL DE OCORRÊNCIAS
import { api, definirAoExpirar, definirSessao, obterSessao } from './api.js';
import { simularOcorrencia } from './simulacao.js';
const INTERVALO_MS = 3000;
const SENHA_DEMO = 'azul123'; // precisa ser a mesma usada no seed.ts
const NOMES_PERFIL = {
    MANUTENCAO_CCO: 'Manutenção / CCO',
    ATENDIMENTO_COMERCIAL: 'Atendimento / Comercial',
    CLIENTE: 'Cliente',
};
const TITULOS_PAINEL = {
    MANUTENCAO_CCO: 'Painel operacional',
    ATENDIMENTO_COMERCIAL: 'Painel de atendimento',
    CLIENTE: 'Acompanhe o seu voo',
};
const ROTULOS = {
    ABERTA: 'Aberta',
    EM_ANDAMENTO: 'Em andamento',
    RESOLVIDA: 'Resolvida',
    NORMAL: 'No horário',
    ATRASADO: 'Atrasado',
    CANCELADO: 'Cancelado',
    REACOMODADO: 'Reacomodado',
};
const NOMES_SETORES = {
    MANUTENCAO: 'Manutenção',
    COMERCIAL_MALHA: 'Comercial / Malha',
    ATENDIMENTO_SOLO: 'Atendimento Solo',
};
let ultimoEstado = '';
let temporizador;
let filtroSetor = 'TODOS';
//funções auxiliares para criar elementos HTML, buscar elementos existentes e formatar dados
function el(tag, classe = '', texto) {
    const elemento = document.createElement(tag);
    if (classe) {
        elemento.className = classe;
    }
    if (texto !== undefined) {
        elemento.textContent = texto;
    }
    return elemento;
}
function $(id) {
    const elemento = document.getElementById(id);
    if (!elemento) {
        throw new Error(`Elemento #${id} não encontrado`);
    }
    return elemento;
}
function entrada(id) {
    return $(id);
}
function rotulo(valor) {
    return ROTULOS[valor] ?? valor;
}
function formatarHora(valor) {
    // o SQLite grava CURRENT_TIMESTAMP em UTC ("AAAA-MM-DD HH:MM:SS")
    const texto = valor.includes('T') ? valor : valor.replace(' ', 'T');
    const data = new Date(texto.endsWith('Z') ? texto : `${texto}Z`);
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function mostrarAviso(texto) {
    const aviso = $('aviso');
    aviso.textContent = texto ?? '';
    aviso.hidden = texto === null;
}
//login, logout e carregamento do painel
async function entrar(email, senha) {
    const erro = $('erro-login');
    erro.hidden = true;
    try {
        const sessao = await api('/api/login', { metodo: 'POST', corpo: { email, senha } });
        definirSessao(sessao);
        abrirPainel(sessao);
    }
    catch (e) {
        erro.textContent = e instanceof Error ? e.message : 'Não foi possível entrar';
        erro.hidden = false;
    }
}
function abrirPainel(sessao) {
    $('tela-login').hidden = true;
    $('tela-painel').hidden = false;
    $('usuario').hidden = false;
    $('usuario-nome').textContent = sessao.nome;
    $('usuario-perfil').textContent = NOMES_PERFIL[sessao.perfil];
    $('titulo-painel').textContent = TITULOS_PAINEL[sessao.perfil];
    $('acoes').hidden = sessao.perfil !== 'MANUTENCAO_CCO';
    $('filtro-setor').hidden = sessao.perfil !== 'ATENDIMENTO_COMERCIAL';
    filtroSetor = 'TODOS';
    atualizarBotoesFiltro();
    ultimoEstado = '';
    window.clearInterval(temporizador);
    void carregar();
    temporizador = window.setInterval(() => void carregar(), INTERVALO_MS);
}
function sair() {
    window.clearInterval(temporizador);
    definirSessao(null);
    $('tela-painel').hidden = true;
    $('usuario').hidden = true;
    $('tela-login').hidden = false;
    $('lista').replaceChildren();
    mostrarAviso(null);
    entrada('senha').value = '';
}
//carregamento e renderização do painel
async function carregar() {
    const sessao = obterSessao();
    if (!sessao) {
        return;
    }
    try {
        const ocorrencias = await api('/api/ocorrencias');
        const atualizacoes = sessao.perfil === 'CLIENTE'
            ? {}
            : await api('/api/atualizacoes');
        mostrarAviso(null);
        $('ultima-atualizacao').textContent = `última verificação: ${new Date().toLocaleTimeString('pt-BR')}`;
        const estado = JSON.stringify({ ocorrencias, atualizacoes });
        const digitando = document.activeElement instanceof HTMLInputElement;
        if (estado === ultimoEstado || digitando) {
            return;
        }
        ultimoEstado = estado;
        renderizar(sessao.perfil, ocorrencias, atualizacoes);
    }
    catch {
        if (obterSessao()) {
            mostrarAviso('Não foi possível atualizar. Tentando novamente...');
        }
    }
}
function renderizar(perfil, ocorrencias, atualizacoes) {
    const lista = $('lista');
    lista.replaceChildren();
    const setorSelecionado = perfil === 'ATENDIMENTO_COMERCIAL' ? filtroSetor : 'TODOS';
    const visiveis = setorSelecionado === 'TODOS'
        ? ocorrencias
        : ocorrencias.filter((ocorrencia) => ocorrencia.setores_destino?.includes(setorSelecionado));
    if (visiveis.length === 0) {
        lista.append(el('p', 'vazio', 'Nenhuma ocorrência no momento.'));
        return;
    }
    for (const ocorrencia of visiveis) {
        lista.append(criarCartao(perfil, ocorrencia, atualizacoes[ocorrencia.id] ?? []));
    }
}
function atualizarBotoesFiltro() {
    document.querySelectorAll('[data-filtro-setor]').forEach((botao) => {
        botao.setAttribute('aria-pressed', String(botao.dataset.filtroSetor === filtroSetor));
    });
}
function secao(titulo, texto, classe = '') {
    const bloco = el('div', `secao ${classe}`.trim());
    bloco.append(el('h4', '', titulo), el('p', '', texto));
    return bloco;
}
function criarCartao(perfil, o, atualizacoes) {
    const cartao = el('article', 'cartao');
    const topo = el('div', 'cartao-topo');
    topo.append(el('h3', '', `Voo ${o.voo.numero} · ${o.voo.origem} → ${o.voo.destino}`), el('span', `selo ${o.voo.status.toLowerCase()}`, rotulo(o.voo.status)));
    cartao.append(topo);
    if (perfil !== 'CLIENTE' && o.setores_destino?.length) {
        const setores = el('div', 'setores-ocorrencia');
        for (const setor of o.setores_destino) {
            setores.append(el('span', 'selo setor', NOMES_SETORES[setor]));
        }
        cartao.append(setores);
    }
    cartao.append(secao('Situação da ocorrência', `${rotulo(o.status)} · aberta às ${formatarHora(o.criada_em)}`));
    // os campos abaixo só chegam do servidor se o perfil puder vê-los
    if (o.tipo !== undefined) {
        cartao.append(secao('Tipo', o.tipo.replaceAll('_', ' ')));
    }
    if (o.detalhe_tecnico !== undefined) {
        cartao.append(secao('Detalhe técnico', o.detalhe_tecnico, 'tecnico'));
    }
    if (o.recomendacao_operacional) {
        cartao.append(secao('Recomendação operacional', o.recomendacao_operacional));
    }
    if (perfil === 'ATENDIMENTO_COMERCIAL' && o.alerta_conexao) {
        const alerta = el('section', 'conexao-risco');
        alerta.append(el('h4', '', 'Passageiros em risco de conexão'), el('p', '', o.alerta_conexao));
        for (const passageiro of o.passageiros_em_risco ?? []) {
            alerta.append(el('p', 'passageiro-risco', `${passageiro.nome} · conexão ${passageiro.voo_conexao}`));
        }
        cartao.append(alerta);
    }
    const mensagemCliente = perfil === 'CLIENTE' && o.informacao_conexao
        ? o.mensagem_cliente?.replace(`\n\n${o.informacao_conexao}`, '') ?? null
        : o.mensagem_cliente;
    if (mensagemCliente) {
        const titulo = perfil === 'CLIENTE' ? 'Informação sobre o seu voo' : 'Mensagem enviada ao cliente';
        cartao.append(secao(titulo, mensagemCliente, 'cliente'));
    }
    if (perfil === 'CLIENTE' && o.conexao_critica && o.informacao_conexao) {
        const conexao = el('section', 'conexao-cliente');
        conexao.append(el('h4', '', 'Conexão em acompanhamento'), el('p', '', o.informacao_conexao));
        cartao.append(conexao);
    }
    if (perfil !== 'CLIENTE') {
        const bloco = el('div', 'atualizacoes');
        bloco.append(el('h4', '', 'Atualizações'));
        if (atualizacoes.length === 0) {
            bloco.append(el('p', 'vazio', 'Nenhuma atualização registrada.'));
        }
        for (const a of atualizacoes) {
            const item = el('p', 'atualizacao');
            item.append(el('strong', '', `${a.autor}: `), a.texto, el('small', '', ` · ${formatarHora(a.criada_em)}`));
            bloco.append(item);
        }
        bloco.append(criarFormAtualizacao(o.id));
        cartao.append(bloco);
    }
    return cartao;
}
function criarFormAtualizacao(ocorrenciaId) {
    const linha = el('div', 'form-linha');
    const campo = el('input');
    campo.type = 'text';
    campo.placeholder = 'Registrar atualização...';
    campo.maxLength = 300;
    campo.setAttribute('aria-label', 'Registrar atualização');
    const botao = el('button', '', 'Enviar');
    botao.type = 'button';
    botao.addEventListener('click', async () => {
        const texto = campo.value.trim();
        if (!texto) {
            return;
        }
        try {
            await api(`/api/ocorrencias/${ocorrenciaId}/atualizacoes`, { metodo: 'POST', corpo: { texto } });
            campo.value = '';
            campo.blur();
            await carregar();
        }
        catch (e) {
            mostrarAviso(e instanceof Error ? e.message : 'Falha ao registrar atualização');
        }
    });
    campo.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
            botao.click();
        }
    });
    linha.append(campo, botao);
    return linha;
}
async function criarOcorrencia(evento) {
    evento.preventDefault();
    const setoresDestino = [...document.querySelectorAll('#form-ocorrencia input[name="setoresDestino"]:checked')].map((campo) => campo.value);
    const detalheTecnico = $('detalhe-ocorrencia').value.trim();
    if (!detalheTecnico || setoresDestino.length === 0) {
        mostrarAviso('Informe o detalhe operacional e selecione ao menos um setor.');
        return;
    }
    try {
        await api('/api/ocorrencias', {
            metodo: 'POST',
            corpo: {
                vooId: Number(entrada('voo-ocorrencia').value),
                tipo: entrada('tipo-ocorrencia').value,
                detalheTecnico,
                recomendacaoOperacional: entrada('recomendacao-ocorrencia').value.trim(),
                setoresDestino,
            },
        });
        $('form-ocorrencia').reset();
        mostrarAviso(null);
        await carregar();
    }
    catch (e) {
        mostrarAviso(e instanceof Error ? e.message : 'Falha ao registrar ocorrência');
    }
}
// inicialização: registra eventos e verifica se há sessão válida na aba
function inicializar() {
    $('form-login').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const email = entrada('email').value.trim();
        const senha = entrada('senha').value;
        if (email && senha) {
            void entrar(email, senha);
        }
    });
    document.querySelectorAll('[data-email]').forEach((botao) => {
        botao.addEventListener('click', () => void entrar(botao.dataset.email ?? '', SENHA_DEMO));
    });
    document.querySelectorAll('[data-filtro-setor]').forEach((botao) => {
        botao.addEventListener('click', () => {
            const setor = botao.dataset.filtroSetor;
            if (setor === 'TODOS' || setor === 'MANUTENCAO' || setor === 'COMERCIAL_MALHA' || setor === 'ATENDIMENTO_SOLO') {
                filtroSetor = setor;
                atualizarBotoesFiltro();
                ultimoEstado = '';
                void carregar();
            }
        });
    });
    $('form-ocorrencia').addEventListener('submit', (evento) => void criarOcorrencia(evento));
    $('botao-sair').addEventListener('click', sair);
    $('botao-simular').addEventListener('click', async () => {
        try {
            await simularOcorrencia();
            await carregar();
        }
        catch (e) {
            mostrarAviso(e instanceof Error ? e.message : 'Falha ao simular ocorrência');
        }
    });
    // token recusado pelo servidor: volta ao login com aviso
    definirAoExpirar(() => {
        sair();
        const erro = $('erro-login');
        erro.textContent = 'Sessão expirada. Entre novamente.';
        erro.hidden = false;
    });
    // recarregou a página com sessão válida na aba: reabre o painel
    const sessao = obterSessao();
    if (sessao) {
        abrirPainel(sessao);
    }
}
inicializar();
