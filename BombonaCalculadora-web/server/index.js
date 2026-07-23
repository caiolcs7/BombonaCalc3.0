import http from 'node:http';
import { criarAplicacao } from './app.js';
import { obterConfiguracao } from './config.js';
import { RepositorioMemoria } from './repositories/memory-repository.js';
import { RepositorioPostgres } from './repositories/postgres-repository.js';

const configuracao = obterConfiguracao();
const repositorio = configuracao.adaptadorBanco === 'postgres'
  ? new RepositorioPostgres(configuracao)
  : new RepositorioMemoria();

await repositorio.inicializar();
const servidor = http.createServer(criarAplicacao({ repositorio, configuracao }));

servidor.listen(configuracao.porta, configuracao.host, () => {
  console.log(`BombonaCalc 4.0 disponível em http://${configuracao.host}:${configuracao.porta}`);
  console.log(`Banco: ${configuracao.adaptadorBanco}`);
  if (configuracao.producao && configuracao.adminPin === '3007') {
    console.warn('Aviso: ADMIN_PIN ainda está usando o valor padrão 3007.');
  }
});

async function encerrar(sinal) {
  console.log(`Recebido ${sinal}. Encerrando...`);
  servidor.close(async () => {
    await repositorio.encerrar();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => encerrar('SIGTERM'));
process.on('SIGINT', () => encerrar('SIGINT'));
