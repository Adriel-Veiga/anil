//CONECTA E RECRIA O BANCO DE DADOS
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.join(__dirname, '..');
// Caminho para o arquivo do banco de dados
export const db = new Database(path.join(raiz, 'anil.db'));
db.pragma('foreign_keys = ON');

function garantirColuna(tabela: string, coluna: string, definicao: string): void {
  const colunas = db.prepare(`PRAGMA table_info(${tabela})`).all() as { name: string }[];
  if (colunas.length === 0) {
    return;
  }
  if (!colunas.some((item) => item.name === coluna)) {
    db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
  }
}

function garantirTiposOcorrencia(): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS tipos_ocorrencia (
      codigo VARCHAR(50) PRIMARY KEY,
      nome VARCHAR(100) NOT NULL,
      detalhe_operacional TEXT NOT NULL,
      recomendacao_operacional TEXT NOT NULL
    )`
  );
  const inserir = db.prepare(
    `INSERT OR IGNORE INTO tipos_ocorrencia (codigo, nome, detalhe_operacional, recomendacao_operacional)
     VALUES (?, ?, ?, ?)`
  );
  inserir.run(
    'PANE_TECNICA',
    'Pane técnica',
    'Falha técnica identificada na aeronave. Avaliação de manutenção em andamento para determinar o impacto na operação.',
    'Manter passageiros informados sobre a previsão e avaliar aeronave reserva ou reacomodação.'
  );
  inserir.run(
    'CONDICAO_METEOROLOGICA',
    'Condição meteorológica',
    'Teto baixo e rajadas acima do limite no aeroporto de destino. Janela de pouso prevista em 90 min.',
    'Avisar passageiros sobre ajuste de horário e manter o balcão informado.'
  );
  inserir.run(
    'ATRASO_TRIPULACAO',
    'Atraso de tripulação',
    'Apresentação da tripulação fora do horário previsto. A equipe está em deslocamento para a aeronave.',
    'Atualizar a previsão de partida e manter atendimento e operação informados.'
  );
  inserir.run(
    'CANCELAMENTO',
    'Cancelamento',
    'Voo cancelado por decisão operacional. Alternativas de reacomodação estão sendo avaliadas.',
    'Priorizar reacomodação e orientar passageiros sobre as opções disponíveis.'
  );
}

garantirColuna('voos', 'partida_prevista', 'TEXT');
garantirColuna('voos', 'chegada_prevista', 'TEXT');
garantirColuna('voos', 'atraso_minutos', 'INTEGER NOT NULL DEFAULT 0');
garantirColuna(
  'ocorrencias',
  'setores_destino',
  `TEXT NOT NULL DEFAULT '["MANUTENCAO","COMERCIAL_MALHA","ATENDIMENTO_SOLO"]'`
);
garantirTiposOcorrencia();

// Função para recriar o banco de dados a partir do arquivo schema.sql
export function recriarBanco(): void {
  db.pragma('foreign_keys = OFF');
  for (const tabela of ['atualizacoes', 'ocorrencias', 'passageiros_voos', 'tipos_ocorrencia', 'voos', 'usuarios', 'perfis']) {
    db.exec(`DROP TABLE IF EXISTS ${tabela}`);
  }
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(raiz, 'database', 'schema.sql'), 'utf-8'));
  garantirTiposOcorrencia();
}
