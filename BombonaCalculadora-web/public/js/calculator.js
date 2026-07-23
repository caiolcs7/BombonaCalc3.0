export function analisarNumero(valor) {
  const texto = String(valor ?? '').trim().replace(/\s+/g, '');
  if (!texto) return null;
  const limpo = texto.replace(/[^0-9,.-]/g, '');
  if (!limpo || !/[0-9]/.test(limpo)) return Number.NaN;

  const negativo = limpo.startsWith('-');
  const corpo = limpo.replace(/-/g, '');
  const ultimaVirgula = corpo.lastIndexOf(',');
  const ultimoPonto = corpo.lastIndexOf('.');
  let normalizado;

  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    const decimal = ultimaVirgula > ultimoPonto ? ',' : '.';
    const milhar = decimal === ',' ? '.' : ',';
    normalizado = corpo.replaceAll(milhar, '').replace(decimal, '.');
  } else if (ultimaVirgula >= 0 || ultimoPonto >= 0) {
    const separador = ultimaVirgula >= 0 ? ',' : '.';
    const partes = corpo.split(separador);
    normalizado = partes.length === 2
      ? `${partes[0]}.${partes[1]}`
      : `${partes.slice(0, -1).join('')}.${partes.at(-1)}`;
  } else {
    normalizado = corpo;
  }

  const numero = Number(`${negativo ? '-' : ''}${normalizado}`);
  return Number.isFinite(numero) ? numero : Number.NaN;
}

export function limparDecimal(valor) {
  const limpo = String(valor ?? '').replace(/[^0-9,.-]/g, '');
  const sinal = limpo.startsWith('-') ? '-' : '';
  const corpo = limpo.replace(/-/g, '');
  const ultimoSeparador = Math.max(corpo.lastIndexOf(','), corpo.lastIndexOf('.'));
  if (ultimoSeparador < 0) return `${sinal}${corpo}`;
  const inteiro = corpo.slice(0, ultimoSeparador).replace(/[,.]/g, '');
  const decimal = corpo.slice(ultimoSeparador + 1).replace(/[,.]/g, '');
  return `${sinal}${inteiro},${decimal}`;
}

export function calcularLocal({ pesoBrutoKg, gramaturaG, recipiente, configuracoes }) {
  if (pesoBrutoKg === null || gramaturaG === null) {
    return { sucesso: false, mensagem: 'Preencha o peso bruto e a gramatura.' };
  }
  if (!Number.isFinite(pesoBrutoKg) || pesoBrutoKg < 0) {
    return { sucesso: false, campo: 'pesoBruto', mensagem: 'Informe um peso bruto válido.' };
  }
  if (!Number.isFinite(gramaturaG) || gramaturaG <= 0) {
    return { sucesso: false, campo: 'gramatura', mensagem: 'A gramatura deve ser maior que zero.' };
  }
  if (!recipiente) {
    return { sucesso: false, mensagem: 'Selecione um recipiente válido.' };
  }
  if (pesoBrutoKg < recipiente.taraKg) {
    return { sucesso: false, campo: 'pesoBruto', mensagem: 'Valor adicionado menor que a tara, insira um valor válido.' };
  }

  const pesoLiquidoKg = pesoBrutoKg - recipiente.taraKg;
  const bruto = ((pesoLiquidoKg * 1000) / gramaturaG) * configuracoes.taxaRendimento;
  const quantidade = configuracoes.politicaArredondamento === 'arredondar' ? Math.round(bruto) : Math.floor(bruto);
  return { sucesso: true, quantidade, pesoLiquidoKg, pesoBrutoKg, gramaturaG };
}
