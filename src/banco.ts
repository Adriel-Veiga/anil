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

garantirColuna('voos', 'partida_prevista', 'TEXT');
garantirColuna('voos', 'chegada_prevista', 'TEXT');
garantirColuna('voos', 'atraso_minutos', 'INTEGER NOT NULL DEFAULT 0');
garantirColuna(
  'ocorrencias',
  'setores_destino',
  `TEXT NOT NULL DEFAULT '["MANUTENCAO","COMERCIAL_MALHA","ATENDIMENTO_SOLO"]'`
);

// Função para recriar o banco de dados a partir do arquivo schema.sql
export function recriarBanco(): void {
  db.pragma('foreign_keys = OFF');
  for (const tabela of ['atualizacoes', 'ocorrencias', 'passageiros_voos', 'voos', 'usuarios', 'perfis']) {
    db.exec(`DROP TABLE IF EXISTS ${tabela}`);
  }
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(raiz, 'database', 'schema.sql'), 'utf-8'));
}
