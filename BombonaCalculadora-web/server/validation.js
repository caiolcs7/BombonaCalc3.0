const HEX_COR = /^#[0-9A-F]{6}$/;
const POLITICAS = new Set(['truncar', 'arredondar']);

export class ErroValidacao extends Error {
  constructor(mensagem, campos = {}) {
    super(mensagem);
    this.name = 'ErroValidacao';
    this.campos = campos;
  }
}

export function normalizarMaiusculo(valor, limite = 80) {
  return String(valor ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('pt-BR')
    .slice(0, limite);
}

export function normalizarClienteId(valor) {
  const id = String(valor ?? '').trim().slice(0, 100);
  return /^[A-Za-z0-9._:-]{8,100}$/.test(id) ? id : 'cliente-nao-identificado';
}

export function validarCriacaoCalculo(corpo) {
  const produtoId = normalizarMaiusculo(corpo.produtoId, 60);
  const endereco = normalizarMaiusculo(corpo.endereco, 100);
  const recipienteId = String(corpo.recipienteId ?? '').trim();
  const pesoBrutoKg = Number(corpo.pesoBrutoKg);
  const gramaturaG = Number(corpo.gramaturaG);
  const campos = {};

  if (!produtoId) campos.produtoId = 'Informe o ID do produto.';
  if (!endereco) campos.endereco = 'Informe o endereço.';
  if (!recipienteId) campos.recipienteId = 'Selecione um recipiente.';
  if (!Number.isFinite(pesoBrutoKg) || pesoBrutoKg < 0) campos.pesoBrutoKg = 'Informe um peso válido.';
  if (!Number.isFinite(gramaturaG) || gramaturaG <= 0) campos.gramaturaG = 'Informe uma gramatura maior que zero.';

  if (Object.keys(campos).length) throw new ErroValidacao('Revise os campos informados.', campos);
  return { produtoId, endereco, recipienteId, pesoBrutoKg, gramaturaG };
}

export function validarEdicaoCalculo(corpo) {
  const produtoId = normalizarMaiusculo(corpo.produtoId, 60);
  const endereco = normalizarMaiusculo(corpo.endereco, 100);
  const quantidadeFinal = Number(corpo.quantidadeFinal);
  const versao = Number(corpo.versao);
  const campos = {};

  if (!produtoId) campos.produtoId = 'Informe o ID do produto.';
  if (!endereco) campos.endereco = 'Informe o endereço.';
  if (!Number.isInteger(quantidadeFinal) || quantidadeFinal < 0) campos.quantidadeFinal = 'Informe uma quantidade inteira válida.';
  if (!Number.isInteger(versao) || versao < 1) campos.versao = 'A versão do registro é inválida.';

  if (Object.keys(campos).length) throw new ErroValidacao('Revise os campos informados.', campos);
  return { produtoId, endereco, quantidadeFinal, versao };
}

export function validarConfiguracoes(corpo) {
  const taxaRendimento = Number(corpo.taxaRendimento);
  const politicaArredondamento = String(corpo.politicaArredondamento ?? '');
  if (!Number.isFinite(taxaRendimento) || taxaRendimento <= 0 || taxaRendimento > 1) {
    throw new ErroValidacao('O rendimento deve estar entre 0,01 e 1,00.');
  }
  if (!POLITICAS.has(politicaArredondamento)) {
    throw new ErroValidacao('Política de arredondamento inválida.');
  }
  return { taxaRendimento, politicaArredondamento };
}

export function validarRecipientes(corpo) {
  if (!Array.isArray(corpo.recipientes) || corpo.recipientes.length === 0 || corpo.recipientes.length > 30) {
    throw new ErroValidacao('Informe de 1 a 30 recipientes.');
  }

  const ids = new Set();
  const recipientes = corpo.recipientes.map((item, indice) => {
    const id = String(item.id ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60);
    const nome = String(item.nome ?? '').trim().slice(0, 80);
    const taraKg = Number(item.taraKg);
    const cor = normalizarMaiusculo(item.cor, 7);
    const ativo = item.ativo !== false;

    if (!id || ids.has(id)) throw new ErroValidacao(`Recipiente ${indice + 1}: identificador inválido ou repetido.`);
    if (!nome) throw new ErroValidacao(`Recipiente ${indice + 1}: informe o nome.`);
    if (!Number.isFinite(taraKg) || taraKg < 0 || taraKg > 9999) throw new ErroValidacao(`Recipiente ${indice + 1}: tara inválida.`);
    if (!HEX_COR.test(cor)) throw new ErroValidacao(`Recipiente ${indice + 1}: cor inválida.`);
    ids.add(id);
    return { id, nome, taraKg, cor, ativo, ordem: indice };
  });

  if (!recipientes.some((item) => item.ativo)) throw new ErroValidacao('Ao menos um recipiente deve permanecer ativo.');
  return recipientes;
}
