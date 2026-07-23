import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularProducao } from '../../server/services/calculation-service.js';

const recipiente = { id: 'bombona-azul', nome: 'Bombona Azul', taraKg: 6.4, cor: '#2563EB' };

test('calcula a produção usando unidades completas', () => {
  const resultado = calcularProducao({
    pesoBrutoKg: 20,
    gramaturaG: 50,
    recipiente,
    taxaRendimento: 0.95,
    politicaArredondamento: 'truncar'
  });
  assert.equal(resultado.pesoLiquidoKg, 13.6);
  assert.equal(resultado.quantidadeFinal, 258);
});

test('rejeita peso menor que a tara', () => {
  assert.throws(
    () => calcularProducao({ pesoBrutoKg: 5, gramaturaG: 50, recipiente, taxaRendimento: 0.95, politicaArredondamento: 'truncar' }),
    /Valor adicionado menor que a tara/
  );
});
