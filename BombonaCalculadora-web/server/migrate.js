import fs from 'node:fs/promises';
import path from 'node:path';
import { obterConfiguracao } from './config.js';

const configuracao = obterConfiguracao();

if (configuracao.adaptadorBanco !== 'postgres') {
  console.log('Migrações ignoradas: DATABASE_ADAPTER não é postgres.');
  process.exit(0);
}

const { Client } = await import('pg');
const cliente = new Client({
  connectionString: configuracao.databaseUrl,
  ssl: configuracao.databaseSsl ? { rejectUnauthorized: false } : false
});

await cliente.connect();
try {
  await cliente.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const arquivos = (await fs.readdir(configuracao.caminhoMigracoes))
    .filter((arquivo) => arquivo.endsWith('.sql'))
    .sort();

  for (const arquivo of arquivos) {
    const aplicado = await cliente.query('SELECT 1 FROM schema_migrations WHERE version = $1', [arquivo]);
    if (aplicado.rowCount) continue;
    const sql = await fs.readFile(path.join(configuracao.caminhoMigracoes, arquivo), 'utf8');
    await cliente.query('BEGIN');
    try {
      await cliente.query(sql);
      await cliente.query('INSERT INTO schema_migrations (version) VALUES ($1)', [arquivo]);
      await cliente.query('COMMIT');
      console.log(`Migração aplicada: ${arquivo}`);
    } catch (erro) {
      await cliente.query('ROLLBACK');
      throw erro;
    }
  }
} finally {
  await cliente.end();
}
