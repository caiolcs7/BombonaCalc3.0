import test from 'node:test';
import assert from 'node:assert/strict';
import { criarTokenAdmin, validarTokenAdmin, compararPin } from '../../server/security.js';

const segredo = 'segredo-de-testes-com-mais-de-trinta-e-dois-caracteres';

test('cria e valida sessão administrativa assinada', () => {
  const token = criarTokenAdmin({ segredo, duracaoMinutos: 10 });
  assert.equal(validarTokenAdmin(token, segredo), true);
  assert.equal(validarTokenAdmin(`${token}x`, segredo), false);
});

test('compara PIN sem conversão numérica', () => {
  assert.equal(compararPin('3007', '3007'), true);
  assert.equal(compararPin('03007', '3007'), false);
});
