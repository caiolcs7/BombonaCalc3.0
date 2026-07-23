import crypto from 'node:crypto';

const RECIPIENTES_PADRAO = [
  { id: 'bombona-azul', nome: 'Bombona Azul', taraKg: 6.4, cor: '#2563EB', ativo: true, ordem: 0 },
  { id: 'bombona-marrom', nome: 'Bombona Marrom', taraKg: 9.2, cor: '#8B5A2B', ativo: true, ordem: 1 },
  { id: 'caixa-vermelha', nome: 'Caixa Vermelha', taraKg: 3, cor: '#EF4444', ativo: true, ordem: 2 },
  { id: 'galao', nome: 'Galão', taraKg: 1, cor: '#06B6D4', ativo: true, ordem: 3 }
];

function clonar(valor) {
  return structuredClone(valor);
}

function ordenar(registros) {
  return registros.sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
}

export class RepositorioMemoria {
  constructor() {
    this.configuracoes = { taxaRendimento: 0.95, politicaArredondamento: 'truncar' };
    this.recipientes = clonar(RECIPIENTES_PADRAO);
    this.calculos = new Map();
    this.revisoes = new Map();
  }

  async inicializar() {}
  async encerrar() {}

  async obterBootstrap() {
    return {
      configuracoes: clonar(this.configuracoes),
      recipientes: clonar(this.recipientes.filter((item) => item.ativo).sort((a, b) => a.ordem - b.ordem))
    };
  }

  async listarCalculos({ produtoId = '', limite = 50 }) {
    const termo = produtoId.toLocaleUpperCase('pt-BR');
    const itens = ordenar([...this.calculos.values()].filter((item) => {
      return !item.excluidoEm && (!termo || item.produtoId.startsWith(termo));
    })).slice(0, limite);
    return clonar(itens);
  }

  async obterCalculo(id) {
    const registro = this.calculos.get(id);
    if (!registro || registro.excluidoEm) return null;
    return {
      ...clonar(registro),
      revisoes: clonar(this.revisoes.get(id) ?? [])
    };
  }

  async obterRecipiente(id) {
    const recipiente = this.recipientes.find((item) => item.id === id && item.ativo);
    return recipiente ? clonar(recipiente) : null;
  }

  async obterConfiguracoes() {
    return clonar(this.configuracoes);
  }

  async criarCalculo(dados) {
    const agora = new Date().toISOString();
    const registro = {
      id: dados.id ?? crypto.randomUUID(),
      produtoId: dados.produtoId,
      endereco: dados.endereco,
      recipiente: clonar(dados.recipiente),
      entrada: clonar(dados.entrada),
      calculo: clonar(dados.calculo),
      versao: 1,
      criadoPorCliente: dados.criadoPorCliente,
      atualizadoPorCliente: dados.criadoPorCliente,
      criadoEm: agora,
      atualizadoEm: agora,
      excluidoEm: null
    };
    this.calculos.set(registro.id, registro);
    this.revisoes.set(registro.id, []);
    return clonar(registro);
  }

  async atualizarCalculo(id, { produtoId, endereco, quantidadeFinal, versao, clienteId }) {
    const atual = this.calculos.get(id);
    if (!atual || atual.excluidoEm) return { tipo: 'nao_encontrado' };
    if (atual.versao !== versao) return { tipo: 'conflito', atual: clonar(atual) };

    const agora = new Date().toISOString();
    const anterior = {
      produtoId: atual.produtoId,
      endereco: atual.endereco,
      quantidadeFinal: atual.calculo.quantidadeFinal,
      versao: atual.versao
    };

    atual.produtoId = produtoId;
    atual.endereco = endereco;
    atual.calculo.quantidadeFinal = quantidadeFinal;
    atual.versao += 1;
    atual.atualizadoEm = agora;
    atual.atualizadoPorCliente = clienteId;

    const revisao = {
      id: crypto.randomUUID(),
      numero: atual.versao - 1,
      alteradoPorCliente: clienteId,
      alteradoEm: agora,
      anterior,
      atual: {
        produtoId,
        endereco,
        quantidadeFinal,
        versao: atual.versao
      }
    };
    this.revisoes.get(id).unshift(revisao);
    return { tipo: 'atualizado', registro: clonar(atual) };
  }

  async excluirCalculo(id, clienteId) {
    const atual = this.calculos.get(id);
    if (!atual || atual.excluidoEm) return false;
    atual.excluidoEm = new Date().toISOString();
    atual.atualizadoPorCliente = clienteId;
    return true;
  }

  async restaurarCalculo(id, clienteId) {
    const atual = this.calculos.get(id);
    if (!atual || !atual.excluidoEm) return false;
    atual.excluidoEm = null;
    atual.atualizadoEm = new Date().toISOString();
    atual.atualizadoPorCliente = clienteId;
    return true;
  }

  async obterAdministracao() {
    return {
      configuracoes: clonar(this.configuracoes),
      recipientes: clonar(this.recipientes.sort((a, b) => a.ordem - b.ordem))
    };
  }

  async salvarConfiguracoes(configuracoes) {
    this.configuracoes = clonar(configuracoes);
    return clonar(this.configuracoes);
  }

  async salvarRecipientes(recipientes) {
    this.recipientes = clonar(recipientes);
    return clonar(this.recipientes);
  }

  async limparCalculos() {
    const agora = new Date().toISOString();
    for (const registro of this.calculos.values()) registro.excluidoEm = agora;
  }
}
