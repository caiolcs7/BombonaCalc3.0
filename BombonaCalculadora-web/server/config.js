import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raizProjeto = path.resolve(__dirname, '..');

function lerBooleano(valor, padrao = false) {
  if (valor === undefined) return padrao;
  return ['1', 'true', 'yes', 'sim'].includes(String(valor).toLowerCase());
}

function lerInteiro(valor, padrao) {
  const numero = Number.parseInt(valor, 10);
  return Number.isFinite(numero) ? numero : padrao;
}

export function obterConfiguracao() {
  const ambiente = process.env.NODE_ENV ?? 'development';
  const producao = ambiente === 'production';
  const sessionSecret = process.env.SESSION_SECRET ?? 'desenvolvimento-apenas-altere-em-producao-123456';

  if (producao && sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET deve possuir pelo menos 32 caracteres em produção.');
  }

  return {
    ambiente,
    producao,
    porta: lerInteiro(process.env.PORT, 8080),
    host: process.env.HOST ?? '0.0.0.0',
    adaptadorBanco: process.env.DATABASE_ADAPTER ?? (process.env.DATABASE_URL ? 'postgres' : 'memory'),
    databaseUrl: process.env.DATABASE_URL ?? '',
    databaseSsl: lerBooleano(process.env.DATABASE_SSL, producao),
    adminPin: process.env.ADMIN_PIN ?? '3007',
    sessionSecret,
    sessaoAdminMinutos: lerInteiro(process.env.ADMIN_SESSION_MINUTES, 10),
    trustProxy: lerBooleano(process.env.TRUST_PROXY, false),
    diretorioPublico: path.join(raizProjeto, 'public'),
    caminhoMigracoes: path.join(raizProjeto, 'database', 'migrations')
  };
}
