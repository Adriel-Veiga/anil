//CONECTA E RECRIA O BANCO DE DADOS
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.join(__dirname, '..');
// Caminho para o arquivo do banco de dados
export const db = new Database(path.join(raiz, 'anil.db'));
db.pragma('foreign_keys = ON');
// Função para recriar o banco de dados a partir do arquivo schema.sql
export function recriarBanco(): void {
  db.pragma('foreign_keys = OFF');
  for (const tabela of ['atualizacoes', 'ocorrencias', 'passageiros_voos', 'voos', 'usuarios', 'perfis']) {
    db.exec(`DROP TABLE IF EXISTS ${tabela}`);
  }
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(raiz, 'database', 'schema.sql'), 'utf-8'));
}
