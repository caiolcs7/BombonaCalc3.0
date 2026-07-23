export const FORMULA_VERSION = 1;

export function calcularProducao({ pesoBrutoKg, gramaturaG, recipiente, taxaRendimento, politicaArredondamento }) {
  if (pesoBrutoKg < recipiente.taraKg) {
    const erro = new Error('Valor adicionado menor que a tara, insira um valor válido.');
    erro.codigo = 'PESO_MENOR_QUE_TARA';
    erro.campo = 'pesoBrutoKg';
    throw erro;
  }

  const pesoLiquidoKg = pesoBrutoKg - recipiente.taraKg;
  const quantidadeSemRendimento = (pesoLiquidoKg * 1000) / gramaturaG;
  const quantidadeComRendimento = quantidadeSemRendimento * taxaRendimento;
  const quantidadeFinal = politicaArredondamento === 'arredondar'
    ? Math.round(quantidadeComRendimento)
    : Math.floor(quantidadeComRendimento);

  return {
    pesoLiquidoKg,
    quantidadeSemRendimento,
    quantidadeComRendimento,
    quantidadeFinal,
    versaoFormula: FORMULA_VERSION
  };
}
