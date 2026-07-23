import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarMaiusculo, validarCriacaoCalculo, validarEdicaoCalculo } from '../../server/validation.js';

test('normaliza ID e endereço para letras maiúsculas', () => {
  assert.equal(normalizarMaiusculo('  prod-abc  '), 'PROD-ABC');
  assert.equal(normalizarMaiusculo('rua a  10'), 'RUA A 10');
});

test('normaliza identificação na criação', () => {
  const dados = validarCriacaoCalculo({
    produtoId: 'prod-10',
    endereco: 'a-01',
    recipienteId: 'galao',
    pesoBrutoKg: 10,
    gramaturaG: 50
  });
  assert.equal(dados.produtoId, 'PROD-10');
  assert.equal(dados.endereco, 'A-01');
});

test('exige versão na edição concorrente', () => {
  assert.throws(() => validarEdicaoCalculo({ produtoId: 'A', endereco: 'B', quantidadeFinal: 10 }), /Revise/);
});
