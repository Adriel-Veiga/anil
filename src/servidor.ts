//ROTAS, LOGIN E AUTENTICAÇÃO(SERVIDOR)
import express from 'express';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { db } from './banco';
import { verificarSenha } from './seguranca';
import { conexaoCritica } from './conexoes';
import { filtrarOcorrencia } from './visibilidade';
import { gerarMensagemCliente } from './tradutor';
import type { ContextoConexao, LinhaOcorrencia, PerfilNome, PassageiroEmRisco, Sessao, SetorDestino } from './tipos';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const sessoes = new Map<string, Sessao>();
// Autenticação e autorização
function autenticar(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  const sessao = token ? sessoes.get(token) : undefined;
  if (!sessao) {
    res.status(401).json({ erro: 'Não autenticado' });
    return;
  }
  res.locals.sessao = sessao;
  next();
}
// Função para exigir perfis específicos
function exigirPerfil(...perfis: PerfilNome[]): express.RequestHandler {
  return (_req, res, next) => {
    const sessao = res.locals.sessao as Sessao;
    if (!perfis.includes(sessao.perfil)) {
      res.status(403).json({ erro: 'Acesso negado para este perfil' });
      return;
    }
    next();
  };
}
// Rota de login
app.post('/api/login', (req, res) => {
  const { email, senha } = (req.body ?? {}) as { email?: unknown; senha?: unknown };
  if (typeof email !== 'string' || typeof senha !== 'string') {
    res.status(400).json({ erro: 'Informe e-mail e senha' });
    return;
  }
  const usuario = db
    .prepare(
      `SELECT u.id, u.nome, u.senha_hash, p.nome AS perfil
       FROM usuarios u JOIN perfis p ON p.id = u.perfil_id
       WHERE u.email = ?`
    )
    .get(email) as { id: number; nome: string; senha_hash: string; perfil: PerfilNome } | undefined;

  if (!usuario || !verificarSenha(senha, usuario.senha_hash)) {
    res.status(401).json({ erro: 'Credenciais inválidas' });
    return;
  }
  const token = randomBytes(24).toString('hex');
  sessoes.set(token, { usuarioId: usuario.id, nome: usuario.nome, perfil: usuario.perfil });
  res.json({ token, nome: usuario.nome, perfil: usuario.perfil });
});
// Rota de logout
const SELECT_OCORRENCIAS = `
  SELECT o.*, o.setores_destino AS setores_destino_json,
         v.numero AS voo_numero, v.origem, v.destino, v.status AS voo_status,
         v.partida_prevista, v.chegada_prevista, v.atraso_minutos
  FROM ocorrencias o JOIN voos v ON v.id = o.voo_id`;

interface LinhaConexao {
  usuario_id: number;
  nome: string;
  voo_conexao: string;
  chegada_prevista: string;
  atraso_minutos: number;
  partida_conexao: string;
}

const SETORES_VALIDOS: SetorDestino[] = ['MANUTENCAO', 'COMERCIAL_MALHA', 'ATENDIMENTO_SOLO'];
const SETORES_PADRAO = [...SETORES_VALIDOS];

function buscarConexoesCriticas(vooId: number, usuarioId?: number): ContextoConexao {
  const filtroUsuario = usuarioId === undefined ? '' : 'AND pv1.usuario_id = ?';
  const parametros = usuarioId === undefined ? [vooId] : [vooId, usuarioId];
  const conexoes = db.prepare(
    `SELECT pv1.usuario_id, u.nome, v2.numero AS voo_conexao,
            v1.chegada_prevista, v1.atraso_minutos, v2.partida_prevista AS partida_conexao
     FROM passageiros_voos pv1
     JOIN usuarios u ON u.id = pv1.usuario_id
     JOIN voos v1 ON v1.id = pv1.voo_id
     JOIN passageiros_voos pv2 ON pv2.usuario_id = pv1.usuario_id AND pv2.voo_id <> pv1.voo_id
     JOIN voos v2 ON v2.id = pv2.voo_id
     WHERE pv1.voo_id = ? ${filtroUsuario}
       AND v1.destino = v2.origem
       AND date(v1.chegada_prevista) = date(v2.partida_prevista)
       AND v2.partida_prevista >= v1.chegada_prevista
     ORDER BY pv1.usuario_id, v2.partida_prevista`
  ).all(...parametros) as LinhaConexao[];

  const vistos = new Set<number>();
  const passageiros: PassageiroEmRisco[] = [];
  for (const conexao of conexoes) {
    if (vistos.has(conexao.usuario_id)) {
      continue;
    }
    vistos.add(conexao.usuario_id);
    if (conexaoCritica(conexao.chegada_prevista, conexao.partida_conexao, conexao.atraso_minutos)) {
      passageiros.push({ nome: conexao.nome, voo_conexao: conexao.voo_conexao });
    }
  }
  return { critica: passageiros.length > 0, passageiros };
}

type AtualizacaoComOcorrencia = {
  ocorrencia_id: number;
  id: number;
  texto: string;
  criada_em: string;
  autor: string;
};
// Rota para obter ocorrências
app.get('/api/ocorrencias', autenticar, (_req, res) => {
  const sessao = res.locals.sessao as Sessao;
  const linhas = (
    sessao.perfil === 'CLIENTE'
      ? db
          .prepare(
            `${SELECT_OCORRENCIAS}
             WHERE o.voo_id IN (SELECT voo_id FROM passageiros_voos WHERE usuario_id = ?)
             ORDER BY o.id DESC`
          )
          .all(sessao.usuarioId)
      : db.prepare(`${SELECT_OCORRENCIAS} ORDER BY o.id DESC`).all()
  ) as LinhaOcorrencia[];

  res.json(linhas.map((linha) => {
    const conexao = sessao.perfil === 'CLIENTE' || sessao.perfil === 'ATENDIMENTO_COMERCIAL'
      ? buscarConexoesCriticas(linha.voo_id, sessao.perfil === 'CLIENTE' ? sessao.usuarioId : undefined)
      : undefined;
    return filtrarOcorrencia(linha, sessao.perfil, conexao);
  }));
});

app.get('/api/atualizacoes', autenticar, exigirPerfil('MANUTENCAO_CCO', 'ATENDIMENTO_COMERCIAL'), (_req, res) => {
  const linhas = db
    .prepare(
      `SELECT a.ocorrencia_id, a.id, a.texto, a.criada_em, u.nome AS autor
       FROM atualizacoes a JOIN usuarios u ON u.id = a.autor_id
       ORDER BY a.ocorrencia_id, a.id`
    )
    .all() as AtualizacaoComOcorrencia[];
  const atualizacoes: Record<number, Omit<AtualizacaoComOcorrencia, 'ocorrencia_id'>[]> = {};
  for (const { ocorrencia_id, ...atualizacao } of linhas) {
    (atualizacoes[ocorrencia_id] ??= []).push(atualizacao);
  }
  res.json(atualizacoes);
});
// Rota para criar uma nova ocorrência
app.post('/api/ocorrencias', autenticar, exigirPerfil('MANUTENCAO_CCO'), (req, res) => {
  const { vooId, tipo, detalheTecnico, recomendacaoOperacional, setoresDestino } = (req.body ?? {}) as {
    vooId?: unknown;
    tipo?: unknown;
    detalheTecnico?: unknown;
    recomendacaoOperacional?: unknown;
    setoresDestino?: unknown;
  };

  if (typeof vooId !== 'number' || typeof tipo !== 'string' || typeof detalheTecnico !== 'string' || !detalheTecnico.trim()) {
    res.status(400).json({ erro: 'Dados inválidos' });
    return;
  }
  const setores = setoresDestino === undefined ? SETORES_PADRAO : setoresDestino;
  if (
    !Array.isArray(setores) ||
    setores.length === 0 ||
    setores.some((setor) => typeof setor !== 'string' || !SETORES_VALIDOS.includes(setor as SetorDestino))
  ) {
    res.status(400).json({ erro: 'Selecione ao menos um setor válido' });
    return;
  }
  const voo = db.prepare('SELECT numero FROM voos WHERE id = ?').get(vooId) as { numero: string } | undefined;
  if (!voo) {
    res.status(404).json({ erro: 'Voo não encontrado' });
    return;
  }
  const recomendacao = typeof recomendacaoOperacional === 'string' ? recomendacaoOperacional : null;
  const resultado = db
    .prepare(
      `INSERT INTO ocorrencias (voo_id, tipo, detalhe_tecnico, recomendacao_operacional, mensagem_cliente, setores_destino)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      vooId,
      tipo,
      detalheTecnico,
      recomendacao,
      gerarMensagemCliente(tipo, voo.numero),
      JSON.stringify([...new Set(setores as SetorDestino[])])
    );

  res.status(201).json({ id: Number(resultado.lastInsertRowid) });
});
// Rota para obter atualizações de uma ocorrência específica
app.get(
  '/api/ocorrencias/:id/atualizacoes',
  autenticar,
  exigirPerfil('MANUTENCAO_CCO', 'ATENDIMENTO_COMERCIAL'),
  (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ erro: 'Id inválido' });
      return;
    }
    const lista = db
      .prepare(
        `SELECT a.id, a.texto, a.criada_em, u.nome AS autor
         FROM atualizacoes a JOIN usuarios u ON u.id = a.autor_id
         WHERE a.ocorrencia_id = ? ORDER BY a.id`
      )
      .all(id);
    res.json(lista);
  }
);

app.post(
  '/api/ocorrencias/:id/atualizacoes',
  autenticar,
  exigirPerfil('MANUTENCAO_CCO', 'ATENDIMENTO_COMERCIAL'),
  (req, res) => {
    const id = Number(req.params.id);
    const { texto } = (req.body ?? {}) as { texto?: unknown };
    if (!Number.isInteger(id) || typeof texto !== 'string' || !texto.trim()) {
      res.status(400).json({ erro: 'Dados inválidos' });
      return;
    }
    const existe = db.prepare('SELECT id FROM ocorrencias WHERE id = ?').get(id);
    if (!existe) {
      res.status(404).json({ erro: 'Ocorrência não encontrada' });
      return;
    }
    const sessao = res.locals.sessao as Sessao;
    db.prepare('INSERT INTO atualizacoes (ocorrencia_id, autor_id, texto) VALUES (?, ?, ?)').run(
      id,
      sessao.usuarioId,
      texto
    );
    res.status(201).json({ ok: true });
  }
);
// Inicia o servidor
const PORTA = Number(process.env.PORT) || 3000;
app.listen(PORTA, () => {
  console.log(`Anil rodando em http://localhost:${PORTA}`);
});
