//DADOS FICTÍCIOS PARA TESTES
import { db, recriarBanco } from './banco';
import { gerarHash } from './seguranca';
import { gerarMensagemCliente } from './tradutor';

recriarBanco();

const senhaDemo = gerarHash('azul123');
const inserirUsuario = db.prepare(
  'INSERT INTO usuarios (nome, email, senha_hash, perfil_id) VALUES (?, ?, ?, ?)'
);
inserirUsuario.run('Carla Mendes (CCO)', 'cco@anil.test', senhaDemo, 1);
inserirUsuario.run('Rafael Lima (Atendimento)', 'atendimento@anil.test', senhaDemo, 2);
const clienteDiretoId = Number(inserirUsuario.run('Paula Souza (Voo Direto)', 'cliente_direto@anil.test', senhaDemo, 3).lastInsertRowid);
const clienteConexaoId = Number(inserirUsuario.run('Marina Costa (Com Conexão)', 'cliente_conexao@anil.test', senhaDemo, 3).lastInsertRowid);

const inserirVoo = db.prepare(
  `INSERT INTO voos (id, numero, origem, destino, status, partida_prevista, chegada_prevista, atraso_minutos)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
const chegadaPrincipal = new Date();
chegadaPrincipal.setUTCHours(17, 0, 0, 0);
const partidaPrincipal = new Date(chegadaPrincipal.getTime() - 2 * 60 * 60_000);
const partidaConexao = new Date(chegadaPrincipal.getTime() + 30 * 60_000);
const chegadaConexao = new Date(partidaConexao.getTime() + 90 * 60_000);
inserirVoo.run(1, 'AD1234', 'VCP', 'REC', 'ATRASADO', partidaPrincipal.toISOString(), chegadaPrincipal.toISOString(), 20);
inserirVoo.run(2, 'AD5678', 'REC', 'FOR', 'NORMAL', partidaConexao.toISOString(), chegadaConexao.toISOString(), 0);

const inserirPassageiroVoo = db.prepare('INSERT INTO passageiros_voos (usuario_id, voo_id) VALUES (?, ?)');
inserirPassageiroVoo.run(clienteDiretoId, 1);
inserirPassageiroVoo.run(clienteConexaoId, 1);
inserirPassageiroVoo.run(clienteConexaoId, 2);

db.prepare(
  `INSERT INTO ocorrencias (voo_id, tipo, status, detalhe_tecnico, recomendacao_operacional, mensagem_cliente, setores_destino)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
).run(
  1,
  'PANE_TECNICA',
  'EM_ANDAMENTO',
  'Falha no sensor de pressão do sistema hidráulico B (código HYD-B-204). Aeronave aguardando troca de componente; peça disponível no estoque de CNF, previsão de 3h.',
  'Reacomodar passageiros no voo AD1290 das 19h40 e oferecer voucher de alimentação.',
  gerarMensagemCliente('PANE_TECNICA', 'AD1234'),
  JSON.stringify(['MANUTENCAO', 'COMERCIAL_MALHA', 'ATENDIMENTO_SOLO'])
);

console.log('Banco recriado com dados fictícios.');
