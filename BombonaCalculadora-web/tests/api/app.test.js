import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { criarAplicacao } from '../../server/app.js';
import { RepositorioMemoria } from '../../server/repositories/memory-repository.js';

async function criarServidor() {
  const repositorio = new RepositorioMemoria();
  await repositorio.inicializar();
  const configuracao = {
    sessionSecret: 'segredo-de-testes-com-mais-de-trinta-e-dois-caracteres',
    sessaoAdminMinutos: 10,
    adminPin: '3007',
    producao: false,
    trustProxy: false,
    diretorioPublico: new URL('../../public', import.meta.url).pathname
  };
  const servidor = http.createServer(criarAplicacao({ repositorio, configuracao }));
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const endereco = servidor.address();
  return {
    repositorio,
    baseUrl: `http://127.0.0.1:${endereco.port}`,
    fechar: () => new Promise((resolve) => servidor.close(resolve))
  };
}

async function json(url, opcoes = {}) {
  const resposta = await fetch(url, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Id': 'teste-cliente-1234',
      ...(opcoes.headers ?? {})
    },
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined
  });
  return { resposta, dados: await resposta.json() };
}

test('salva em maiúsculas e busca somente pelo ID', async (t) => {
  const app = await criarServidor();
  t.after(app.fechar);

  const criacao = await json(`${app.baseUrl}/api/calculos`, {
    method: 'POST',
    body: { produtoId: 'prod-abc', endereco: 'a-01', recipienteId: 'galao', pesoBrutoKg: 10, gramaturaG: 50 }
  });
  assert.equal(criacao.resposta.status, 201);
  assert.equal(criacao.dados.registro.produtoId, 'PROD-ABC');
  assert.equal(criacao.dados.registro.endereco, 'A-01');

  await json(`${app.baseUrl}/api/calculos`, {
    method: 'POST',
    body: { produtoId: 'OUTRO-10', endereco: 'PROD-ABC', recipienteId: 'galao', pesoBrutoKg: 10, gramaturaG: 50 }
  });

  const busca = await json(`${app.baseUrl}/api/calculos?produtoId=prod-a`);
  assert.equal(busca.resposta.status, 200);
  assert.equal(busca.dados.itens.length, 1);
  assert.equal(busca.dados.itens[0].produtoId, 'PROD-ABC');
});

test('detecta conflito quando duas pessoas editam a mesma versão', async (t) => {
  const app = await criarServidor();
  t.after(app.fechar);
  const criacao = await json(`${app.baseUrl}/api/calculos`, {
    method: 'POST',
    body: { produtoId: 'P-1', endereco: 'A-1', recipienteId: 'galao', pesoBrutoKg: 10, gramaturaG: 50 }
  });
  const id = criacao.dados.registro.id;

  const primeira = await json(`${app.baseUrl}/api/calculos/${id}`, {
    method: 'PATCH',
    body: { produtoId: 'P-1', endereco: 'A-2', quantidadeFinal: 170, versao: 1 }
  });
  assert.equal(primeira.resposta.status, 200);

  const segunda = await json(`${app.baseUrl}/api/calculos/${id}`, {
    method: 'PATCH',
    body: { produtoId: 'P-1', endereco: 'A-3', quantidadeFinal: 169, versao: 1 }
  });
  assert.equal(segunda.resposta.status, 409);
  assert.equal(segunda.dados.erro.codigo, 'CONFLITO_DE_EDICAO');
});

test('PIN administrativo é validado no servidor', async (t) => {
  const app = await criarServidor();
  t.after(app.fechar);
  const login = await json(`${app.baseUrl}/api/admin/sessao`, { method: 'POST', body: { pin: '3007' } });
  assert.equal(login.resposta.status, 200);
  assert.match(login.resposta.headers.get('set-cookie'), /HttpOnly/);
});
