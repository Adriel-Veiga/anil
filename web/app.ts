//INTERFACE DE LOGIN E DO PAINEL DE OCORRÊNCIAS
import { api, definirAoExpirar, definirSessao, obterSessao } from './api.js';
import { simularOcorrencia } from './simulacao.js';
import type { Atualizacao, Ocorrencia, Perfil, Sessao, SetorDestino, TipoOcorrencia } from './tipos.js';

const INTERVALO_MS = 3000;
const SENHA_DEMO = 'azul123'; // precisa ser a mesma usada no seed.ts

const NOMES_PERFIL: Record<Perfil, string> = {
  MANUTENCAO_CCO: 'Manutenção / CCO',
  ATENDIMENTO_COMERCIAL: 'Atendimento / Comercial',
  CLIENTE: 'Cliente',
};

const TITULOS_PAINEL: Record<Perfil, string> = {
  MANUTENCAO_CCO: 'Painel operacional',
  ATENDIMENTO_COMERCIAL: 'Painel de atendimento',
  CLIENTE: 'Acompanhe o seu voo',
};

const ROTULOS: Record<string, string> = {
  ABERTA: 'Aberta',
  EM_ANDAMENTO: 'Em andamento',
  RESOLVIDA: 'Resolvida',
  NORMAL: 'No horário',
  ATRASADO: 'Atrasado',
  CANCELADO: 'Cancelado',
  REACOMODADO: 'Reacomodado',
};

const NOMES_SETORES: Record<SetorDestino, string> = {
  MANUTENCAO: 'Manutenção',
  COMERCIAL_MALHA: 'Comercial / Malha',
  ATENDIMENTO_SOLO: 'Atendimento Solo',
};

let ultimoEstado = '';
let temporizador: number | undefined;
let filtroSetor: SetorDestino | 'TODOS' = 'TODOS';
let tiposOcorrencia: TipoOcorrencia[] = [];

//funções auxiliares para criar elementos HTML, buscar elementos existentes e formatar dados

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  classe = '',
  texto?: string
): HTMLElementTagNameMap[K] {
  const elemento = document.createElement(tag);
  if (classe) {
    elemento.className = classe;
  }
  if (texto !== undefined) {
    elemento.textContent = texto;
  }
  return elemento;
}

function $(id: string): HTMLElement {
  const elemento = document.getElementById(id);
  if (!elemento) {
    throw new Error(`Elemento #${id} não encontrado`);
  }
  return elemento;
}

function entrada(id: string): HTMLInputElement {
  return $(id) as HTMLInputElement;
}

function rotulo(valor: string): string {
  return ROTULOS[valor] ?? valor;
}

function formatarHora(valor: string): string {
  // o SQLite grava CURRENT_TIMESTAMP em UTC ("AAAA-MM-DD HH:MM:SS")
  const texto = valor.includes('T') ? valor : valor.replace(' ', 'T');
  const data = new Date(texto.endsWith('Z') ? texto : `${texto}Z`);
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function mostrarAviso(texto: string | null): void {
  const aviso = $('aviso');
  aviso.textContent = texto ?? '';
  aviso.hidden = texto === null;
}

//login, logout e carregamento do painel

async function entrar(email: string, senha: string): Promise<void> {
  const erro = $('erro-login');
  erro.hidden = true;
  try {
    const sessao = await api<Sessao>('/api/login', { metodo: 'POST', corpo: { email, senha } });
    definirSessao(sessao);
    abrirPainel(sessao);
  } catch (e) {
    erro.textContent = e instanceof Error ? e.message : 'Não foi possível entrar';
    erro.hidden = false;
  }
}

function abrirPainel(sessao: Sessao): void {
  $('tela-login').hidden = true;
  $('tela-painel').hidden = false;
  $('usuario').hidden = false;
  $('usuario-nome').textContent = sessao.nome;
  $('usuario-perfil').textContent = NOMES_PERFIL[sessao.perfil];
  $('titulo-painel').textContent = TITULOS_PAINEL[sessao.perfil];
  $('botao-ocorrencia').hidden = sessao.perfil !== 'MANUTENCAO_CCO';
  $('acoes').hidden = sessao.perfil !== 'MANUTENCAO_CCO';
  $('filtro-setor').hidden = sessao.perfil !== 'ATENDIMENTO_COMERCIAL';
  filtroSetor = 'TODOS';
  atualizarBotoesFiltro();
  ultimoEstado = '';
  window.clearInterval(temporizador);
  void carregar();
  temporizador = window.setInterval(() => void carregar(), INTERVALO_MS);
}

function sair(): void {
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

async function carregar(): Promise<void> {
  const sessao = obterSessao();
  if (!sessao) {
    return;
  }
  try {
    const ocorrencias = await api<Ocorrencia[]>('/api/ocorrencias');
    const atualizacoes = sessao.perfil === 'CLIENTE'
      ? {}
      : await api<Record<number, Atualizacao[]>>('/api/atualizacoes');
    mostrarAviso(null);
    $('ultima-atualizacao').textContent = `última verificação: ${new Date().toLocaleTimeString('pt-BR')}`;

    const estado = JSON.stringify({ ocorrencias, atualizacoes });
    const digitando = document.activeElement instanceof HTMLInputElement;
    if (estado === ultimoEstado || digitando) {
      return;
    }
    ultimoEstado = estado;
    renderizar(sessao.perfil, ocorrencias, atualizacoes);
  } catch {
    if (obterSessao()) {
      mostrarAviso('Não foi possível atualizar. Tentando novamente...');
    }
  }
}

function renderizar(
  perfil: Perfil,
  ocorrencias: Ocorrencia[],
  atualizacoes: Record<number, Atualizacao[]>
): void {
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

function atualizarBotoesFiltro(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-filtro-setor]').forEach((botao) => {
    botao.setAttribute('aria-pressed', String(botao.dataset.filtroSetor === filtroSetor));
  });
}

function secao(titulo: string, texto: string, classe = ''): HTMLElement {
  const bloco = el('div', `secao ${classe}`.trim());
  bloco.append(el('h4', '', titulo), el('p', '', texto));
  return bloco;
}

function criarCartao(perfil: Perfil, o: Ocorrencia, atualizacoes: Atualizacao[]): HTMLElement {
  const cartao = el('article', 'cartao');

  const topo = el('div', 'cartao-topo');
  topo.append(
    el('h3', '', `Voo ${o.voo.numero} · ${o.voo.origem} → ${o.voo.destino}`),
    el('span', `selo ${o.voo.status.toLowerCase()}`, rotulo(o.voo.status))
  );
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

function criarFormAtualizacao(ocorrenciaId: number): HTMLElement {
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
    } catch (e) {
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

async function criarOcorrencia(evento: Event): Promise<void> {
  evento.preventDefault();
  const setoresDestino = [...document.querySelectorAll<HTMLInputElement>(
    '#form-ocorrencia input[name="setoresDestino"]:checked'
  )].map((campo) => campo.value);
  const detalheTecnico = ($('detalhe-ocorrencia') as HTMLTextAreaElement).value.trim();
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
    ($('form-ocorrencia') as HTMLFormElement).reset();
    ($('modal-ocorrencia') as HTMLDialogElement).close();
    mostrarAviso(null);
    await carregar();
  } catch (e) {
    mostrarAviso(e instanceof Error ? e.message : 'Falha ao registrar ocorrência');
  }
}

async function abrirModalOcorrencia(): Promise<void> {
  try {
    if (tiposOcorrencia.length === 0) {
      tiposOcorrencia = await api<TipoOcorrencia[]>('/api/tipos-ocorrencia');
      const seletorTipo = $('tipo-ocorrencia') as HTMLSelectElement;
      for (const tipo of tiposOcorrencia) {
        const opcao = document.createElement('option');
        opcao.value = tipo.codigo;
        opcao.textContent = tipo.nome;
        seletorTipo.append(opcao);
      }
    }
    ($('form-ocorrencia') as HTMLFormElement).reset();
    ($('modal-ocorrencia') as HTMLDialogElement).showModal();
    mostrarAviso(null);
  } catch (e) {
    mostrarAviso(e instanceof Error ? e.message : 'Não foi possível carregar os tipos de ocorrência');
  }
}

// inicialização: registra eventos e verifica se há sessão válida na aba

function inicializar(): void {
  $('form-login').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const email = entrada('email').value.trim();
    const senha = entrada('senha').value;
    if (email && senha) {
      void entrar(email, senha);
    }
  });

  document.querySelectorAll<HTMLButtonElement>('[data-email]').forEach((botao) => {
    botao.addEventListener('click', () => void entrar(botao.dataset.email ?? '', SENHA_DEMO));
  });

  document.querySelectorAll<HTMLButtonElement>('[data-filtro-setor]').forEach((botao) => {
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

  $('botao-ocorrencia').addEventListener('click', () => void abrirModalOcorrencia());
  $('botao-fechar-modal').addEventListener('click', () => {
    ($('modal-ocorrencia') as HTMLDialogElement).close();
  });
  $('tipo-ocorrencia').addEventListener('change', () => {
    const tipo = tiposOcorrencia.find((item) => item.codigo === ($('tipo-ocorrencia') as HTMLSelectElement).value);
    ($('detalhe-ocorrencia') as HTMLTextAreaElement).value = tipo?.detalhe_operacional ?? '';
    entrada('recomendacao-ocorrencia').value = tipo?.recomendacao_operacional ?? '';
  });

  $('botao-sair').addEventListener('click', sair);

  $('botao-simular').addEventListener('click', async () => {
    try {
      await simularOcorrencia();
      await carregar();
    } catch (e) {
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