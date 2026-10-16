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
inserirUsuario.run('Paula Souza (Cliente)', 'cliente@anil.test', senhaDemo, 3);

const inserirVoo = db.prepare(
  'INSERT INTO voos (id, numero, origem, destino, status) VALUES (?, ?, ?, ?, ?)'
);
inserirVoo.run(1, 'AD1234', 'VCP', 'SDU', 'ATRASADO');
inserirVoo.run(2, 'AD5678', 'CNF', 'POA', 'NORMAL');

db.prepare('INSERT INTO passageiros_voos (usuario_id, voo_id) VALUES (?, ?)').run(3, 1);

db.prepare(
  `INSERT INTO ocorrencias (voo_id, tipo, status, detalhe_tecnico, recomendacao_operacional, mensagem_cliente)
   VALUES (?, ?, ?, ?, ?, ?)`
).run(
  1,
  'PANE_TECNICA',
  'EM_ANDAMENTO',
  'Falha no sensor de pressão do sistema hidráulico B (código HYD-B-204). Aeronave aguardando troca de componente; peça disponível no estoque de CNF, previsão de 3h.',
  'Reacomodar passageiros no voo AD1290 das 19h40 e oferecer voucher de alimentação.',
  gerarMensagemCliente('PANE_TECNICA', 'AD1234')
);

console.log('Banco recriado com dados fictícios.');
