//ROTAS, LOGIN E AUTENTICAÇÃO(SERVIDOR)
import express from 'express';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { db } from './banco';
import { verificarSenha } from './seguranca';
import { filtrarOcorrencia } from './visibilidade';
import { gerarMensagemCliente } from './tradutor';
import type { LinhaOcorrencia, PerfilNome, Sessao } from './tipos';

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
  SELECT o.*, v.numero AS voo_numero, v.origem, v.destino, v.status AS voo_status
  FROM ocorrencias o JOIN voos v ON v.id = o.voo_id`;

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

  res.json(linhas.map((linha) => filtrarOcorrencia(linha, sessao.perfil)));
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
  const { vooId, tipo, detalheTecnico, recomendacaoOperacional } = (req.body ?? {}) as {
    vooId?: unknown;
    tipo?: unknown;
    detalheTecnico?: unknown;
    recomendacaoOperacional?: unknown;
  };

  if (typeof vooId !== 'number' || typeof tipo !== 'string' || typeof detalheTecnico !== 'string' || !detalheTecnico.trim()) {
    res.status(400).json({ erro: 'Dados inválidos' });
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
      `INSERT INTO ocorrencias (voo_id, tipo, detalhe_tecnico, recomendacao_operacional, mensagem_cliente)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(vooId, tipo, detalheTecnico, recomendacao, gerarMensagemCliente(tipo, voo.numero));

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
