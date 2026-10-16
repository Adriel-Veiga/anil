import test from 'node:test';
import assert from 'node:assert/strict';
import { conexaoCritica } from './conexoes';
import { filtrarOcorrencia } from './visibilidade';
import type { ContextoConexao, LinhaOcorrencia } from './tipos';

const exemplo: LinhaOcorrencia = {
  id: 1,
  voo_id: 1,
  tipo: 'PANE_TECNICA',
  status: 'ABERTA',
  detalhe_tecnico: 'Falha no sensor hidráulico (código HYD-B-204)',
  recomendacao_operacional: 'Reacomodar passageiros no próximo voo',
  mensagem_cliente: 'Seu voo precisa de uma verificação adicional.',
  criada_em: '2026-10-01 10:00:00',
  voo_numero: 'AD1234',
  origem: 'VCP',
  destino: 'REC',
  voo_status: 'ATRASADO',
  partida_prevista: '2026-10-01T08:00:00.000Z',
  chegada_prevista: '2026-10-01T10:00:00.000Z',
  atraso_minutos: 20,
  setores_destino_json: '["MANUTENCAO","ATENDIMENTO_SOLO"]',
};

const contextoConexaoCritica: ContextoConexao = {
  critica: true,
  passageiros: [{ nome: 'Marina Costa', voo_conexao: 'AD5678' }],
};

test('cliente não recebe campos técnicos nem operacionais', () => {
  const r = filtrarOcorrencia(exemplo, 'CLIENTE', contextoConexaoCritica);
  assert.equal(r.detalhe_tecnico, undefined);
  assert.equal(r.recomendacao_operacional, undefined);
  assert.equal(r.tipo, undefined);
  assert.equal(r.setores_destino, undefined);
  assert.ok(r.mensagem_cliente);
  assert.equal(r.conexao_critica, true);
  assert.ok(r.informacao_conexao);
  assert.match(r.mensagem_cliente ?? '', /Acompanhamento da sua conexão em Recife/);
});

test('cliente sem conexão recebe mensagem padrão e flag falsa', () => {
  const r = filtrarOcorrencia(exemplo, 'CLIENTE');
  assert.equal(r.conexao_critica, false);
  assert.equal(r.informacao_conexao, undefined);
  assert.equal(r.mensagem_cliente, exemplo.mensagem_cliente);
});

test('atendimento não recebe o detalhe técnico', () => {
  const r = filtrarOcorrencia(exemplo, 'ATENDIMENTO_COMERCIAL');
  assert.equal(r.detalhe_tecnico, undefined);
  assert.ok(r.recomendacao_operacional);
  assert.deepEqual(r.setores_destino, ['MANUTENCAO', 'ATENDIMENTO_SOLO']);
});

test('atendimento recebe alerta e passageiros em risco, sem detalhe técnico', () => {
  const r = filtrarOcorrencia(exemplo, 'ATENDIMENTO_COMERCIAL', contextoConexaoCritica);
  assert.equal(r.detalhe_tecnico, undefined);
  assert.match(r.alerta_conexao ?? '', /1 passageiro em risco.*AD5678/);
  assert.deepEqual(r.passageiros_em_risco, contextoConexaoCritica.passageiros);
});

test('CCO recebe todos os campos', () => {
  const r = filtrarOcorrencia(exemplo, 'MANUTENCAO_CCO');
  assert.ok(r.detalhe_tecnico);
  assert.ok(r.recomendacao_operacional);
  assert.deepEqual(r.setores_destino, ['MANUTENCAO', 'ATENDIMENTO_SOLO']);
});

test('conexão considera atraso e aplica limite estrito de 40 minutos', () => {
  const chegada = '2026-10-01T10:00:00.000Z';
  assert.equal(conexaoCritica(chegada, '2026-10-01T10:30:00.000Z', 0), true);
  assert.equal(conexaoCritica(chegada, '2026-10-01T10:50:00.000Z', 11), true);
  assert.equal(conexaoCritica(chegada, '2026-10-01T10:50:00.000Z', 0), false);
  assert.equal(conexaoCritica('data inválida', '2026-10-01T10:30:00.000Z', 0), false);
});