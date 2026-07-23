import { api, ApiError } from './api.js';
import { analisarNumero, calcularLocal, limparDecimal } from './calculator.js';
import { abrirDialogo, elemento, fecharDialogo, limpar, normalizarCampoMaiusculo } from './dom.js';
import { diferencaFormatada, formatarDataHora, formatarPercentual, formatarPeso, formatarQuantidade } from './formatters.js';

const $ = (id) => document.getElementById(id);
const el = {
  statusConexao: $('status-conexao'),
  btnAtualizar: $('btn-atualizar'),
  btnConfiguracoes: $('btn-configuracoes'),
  painelResultado: $('painel-resultado'),
  resultadoRecipiente: $('resultado-recipiente'),
  resultadoValor: $('resultado-valor'),
  resultadoMensagem: $('resultado-mensagem'),
  listaRecipientes: $('lista-recipientes'),
  inputPeso: $('input-peso-bruto'),
  inputGramatura: $('input-gramatura'),
  erroPeso: $('erro-peso-bruto'),
  erroGramatura: $('erro-gramatura'),
  resumo: $('resumo-calculo'),
  resumoPeso: $('resumo-peso-bruto'),
  resumoTara: $('resumo-tara'),
  resumoLiquido: $('resumo-peso-liquido'),
  resumoRendimento: $('resumo-rendimento'),
  btnSalvar: $('btn-salvar'),
  btnCopiar: $('btn-copiar'),
  btnLimpar: $('btn-limpar'),
  buscaId: $('busca-produto-id'),
  btnLimparBusca: $('btn-limpar-busca'),
  historicoStatus: $('historico-status'),
  contadorHistorico: $('contador-historico'),
  listaHistorico: $('lista-historico'),
  dialogSalvar: $('dialog-salvar'),
  formSalvar: $('form-salvar'),
  salvarProduto: $('salvar-produto-id'),
  salvarEndereco: $('salvar-endereco'),
  salvarQuantidade: $('salvar-quantidade'),
  erroSalvarProduto: $('erro-salvar-produto'),
  erroSalvarEndereco: $('erro-salvar-endereco'),
  btnConfirmarSalvar: $('btn-confirmar-salvar'),
  dialogEditar: $('dialog-editar'),
  formEditar: $('form-editar'),
  editarId: $('editar-registro-id'),
  editarVersao: $('editar-registro-versao'),
  editarProduto: $('editar-produto-id'),
  editarEndereco: $('editar-endereco'),
  editarQuantidade: $('editar-quantidade'),
  editarOriginal: $('editar-original'),
  editarDiferenca: $('editar-diferenca'),
  erroEdicao: $('erro-edicao'),
  btnConfirmarEdicao: $('btn-confirmar-edicao'),
  dialogDetalhes: $('dialog-detalhes'),
  conteudoDetalhes: $('conteudo-detalhes'),
  dialogConfiguracoes: $('dialog-configuracoes'),
  selectTema: $('select-tema'),
  statusAdmin: $('status-admin'),
  adminLogin: $('admin-login'),
  inputPin: $('input-pin'),
  btnLoginAdmin: $('btn-login-admin'),
  erroPin: $('erro-pin'),
  adminPainel: $('admin-painel'),
  btnSairAdmin: $('btn-sair-admin'),
  adminRendimento: $('admin-rendimento'),
  adminArredondamento: $('admin-arredondamento'),
  btnSalvarFormula: $('btn-salvar-formula'),
  btnAdicionarRecipiente: $('btn-adicionar-recipiente'),
  listaAdminRecipientes: $('lista-admin-recipientes'),
  btnSalvarRecipientes: $('btn-salvar-recipientes'),
  btnLimparHistorico: $('btn-limpar-historico'),
  dialogConfirmacao: $('dialog-confirmacao'),
  confirmacaoTitulo: $('confirmacao-titulo'),
  confirmacaoMensagem: $('confirmacao-mensagem'),
  btnConfirmarAcao: $('btn-confirmar-acao'),
  toast: $('toast')
};

const estado = {
  configuracoes: null,
  recipientes: [],
  recipienteId: null,
  calculo: null,
  historico: [],
  busca: '',
  adminAutenticado: false,
  adminDados: null,
  confirmacao: null,
  carregandoHistorico: false
};

let temporizadorToast;
let temporizadorBusca;

function recipienteAtual() {
  return estado.recipientes.find((item) => item.id === estado.recipienteId) ?? null;
}

function exibirToast(mensagem, erro = false) {
  clearTimeout(temporizadorToast);
  el.toast.textContent = mensagem;
  el.toast.classList.toggle('error', erro);
  el.toast.classList.add('visible');
  temporizadorToast = setTimeout(() => el.toast.classList.remove('visible'), 3200);
}

function atualizarConexao(online, texto = online ? 'Online' : 'Offline') {
  el.statusConexao.classList.toggle('online', online);
  el.statusConexao.classList.toggle('offline', !online);
  el.statusConexao.querySelector('span:last-child').textContent = texto;
}

function tratarErro(erro, mensagemPadrao = 'Não foi possível concluir a operação.') {
  const mensagem = erro instanceof ApiError ? erro.message : mensagemPadrao;
  if (erro instanceof ApiError && erro.status === 0) atualizarConexao(false);
  exibirToast(mensagem, true);
  return mensagem;
}

function aplicarTema(tema) {
  let temaAplicado = tema;
  if (tema === 'system') temaAplicado = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = temaAplicado;
  document.querySelector('meta[name="theme-color"]').content = temaAplicado === 'dark' ? '#070B16' : '#EEF3F9';
}

function carregarTema() {
  const tema = localStorage.getItem('bombonacalc_tema') ?? 'dark';
  el.selectTema.value = tema;
  aplicarTema(tema);
}

function renderizarRecipientes() {
  limpar(el.listaRecipientes);
  for (const recipiente of estado.recipientes) {
    const selecionado = recipiente.id === estado.recipienteId;
    const botao = elemento('button', {
      classe: 'container-card',
      atributos: {
        type: 'button',
        role: 'radio',
        'aria-checked': selecionado,
        'aria-label': `${recipiente.nome}, tara ${formatarPeso(recipiente.taraKg)} quilogramas`
      }
    });
    botao.style.setProperty('--container-color', recipiente.cor);
    botao.append(
      elemento('span', { classe: 'container-swatch' }),
      elemento('span', {
        filhos: [
          elemento('strong', { texto: recipiente.nome }),
          elemento('small', { texto: `Tara ${formatarPeso(recipiente.taraKg)} kg` })
        ]
      })
    );
    botao.addEventListener('click', () => {
      estado.recipienteId = recipiente.id;
      renderizarRecipientes();
      atualizarCalculo();
    });
    el.listaRecipientes.append(botao);
  }
}

function limparErrosCalculo() {
  el.erroPeso.textContent = '';
  el.erroGramatura.textContent = '';
  el.inputPeso.closest('.field').classList.remove('has-error');
  el.inputGramatura.closest('.field').classList.remove('has-error');
}

function atualizarCalculo() {
  limparErrosCalculo();
  const recipiente = recipienteAtual();
  const calculo = calcularLocal({
    pesoBrutoKg: analisarNumero(el.inputPeso.value),
    gramaturaG: analisarNumero(el.inputGramatura.value),
    recipiente,
    configuracoes: estado.configuracoes ?? { taxaRendimento: 0.95, politicaArredondamento: 'truncar' }
  });
  estado.calculo = calculo.sucesso ? calculo : null;
  el.resultadoRecipiente.textContent = recipiente?.nome ?? '—';
  el.painelResultado.classList.toggle('has-error', !calculo.sucesso && Boolean(calculo.campo));

  if (!calculo.sucesso) {
    el.resultadoValor.textContent = '0';
    el.resultadoMensagem.textContent = calculo.mensagem;
    el.btnSalvar.disabled = true;
    el.btnCopiar.disabled = true;
    el.resumo.classList.add('is-hidden');
    if (calculo.campo === 'pesoBruto') {
      el.erroPeso.textContent = calculo.mensagem;
      el.inputPeso.closest('.field').classList.add('has-error');
    }
    if (calculo.campo === 'gramatura') {
      el.erroGramatura.textContent = calculo.mensagem;
      el.inputGramatura.closest('.field').classList.add('has-error');
    }
    return;
  }

  el.resultadoValor.textContent = formatarQuantidade(calculo.quantidade);
  el.resultadoMensagem.textContent = estado.configuracoes.politicaArredondamento === 'truncar'
    ? 'Resultado em unidades completas.'
    : 'Resultado com arredondamento convencional.';
  el.btnSalvar.disabled = false;
  el.btnCopiar.disabled = false;
  el.resumo.classList.remove('is-hidden');
  el.resumoPeso.textContent = `${formatarPeso(calculo.pesoBrutoKg)} kg`;
  el.resumoTara.textContent = `${formatarPeso(recipiente.taraKg)} kg`;
  el.resumoLiquido.textContent = `${formatarPeso(calculo.pesoLiquidoKg)} kg`;
  el.resumoRendimento.textContent = formatarPercentual(estado.configuracoes.taxaRendimento);
}

async function carregarBootstrap() {
  const dados = await api.bootstrap();
  estado.configuracoes = dados.configuracoes;
  estado.recipientes = dados.recipientes;
  if (!estado.recipientes.some((item) => item.id === estado.recipienteId)) {
    estado.recipienteId = estado.recipientes[0]?.id ?? null;
  }
  renderizarRecipientes();
  atualizarCalculo();
  atualizarConexao(true);
}

async function carregarHistorico({ silencioso = false } = {}) {
  if (estado.carregandoHistorico) return;
  estado.carregandoHistorico = true;
  if (!silencioso) el.historicoStatus.textContent = 'Atualizando registros...';
  try {
    const dados = await api.listarCalculos(estado.busca);
    estado.historico = dados.itens;
    renderizarHistorico();
    el.historicoStatus.textContent = estado.busca
      ? `Resultados cujo ID começa com “${estado.busca}”.`
      : 'Últimos cálculos salvos por todos os usuários.';
    atualizarConexao(true);
  } catch (erro) {
    el.historicoStatus.textContent = 'Não foi possível atualizar o histórico.';
    if (!silencioso) tratarErro(erro);
  } finally {
    estado.carregandoHistorico = false;
  }
}

function renderizarHistorico() {
  limpar(el.listaHistorico);
  el.contadorHistorico.textContent = String(estado.historico.length);
  if (!estado.historico.length) {
    el.listaHistorico.append(elemento('div', {
      classe: 'history-empty',
      texto: estado.busca ? 'Nenhum registro encontrado para esse ID.' : 'Nenhum cálculo salvo ainda.'
    }));
    return;
  }

  for (const registro of estado.historico) {
    const cartao = elemento('article', { classe: 'history-card' });
    const principal = elemento('button', { classe: 'history-card-main', atributos: { type: 'button' } });
    const produto = elemento('div', { classe: 'history-product' });
    produto.append(
      elemento('strong', { texto: registro.produtoId }),
      elemento('span', { texto: registro.endereco })
    );
    const meta = elemento('div', { classe: 'history-meta' });
    const ponto = elemento('span', { classe: 'history-container-dot' });
    ponto.style.setProperty('--container-color', registro.recipiente.cor);
    meta.append(
      ponto,
      elemento('span', { texto: registro.recipiente.nome }),
      elemento('span', { texto: '•' }),
      elemento('span', { texto: formatarDataHora(registro.criadoEm) })
    );
    if (registro.versao > 1) meta.append(elemento('span', { texto: `• Revisão ${registro.versao - 1}` }));
    produto.append(meta);

    const quantidade = elemento('div', { classe: 'history-quantity' });
    quantidade.append(
      elemento('strong', { texto: formatarQuantidade(registro.calculo.quantidadeFinal) }),
      elemento('span', { texto: 'unidades' })
    );
    principal.append(produto, quantidade);
    principal.addEventListener('click', () => abrirDetalhes(registro.id));

    const acoes = elemento('div', { classe: 'history-card-actions' });
    const editar = elemento('button', { texto: 'Editar', atributos: { type: 'button' } });
    const excluir = elemento('button', { texto: 'Excluir', atributos: { type: 'button' } });
    editar.addEventListener('click', () => abrirEdicao(registro));
    excluir.addEventListener('click', () => confirmarExclusao(registro));
    acoes.append(editar, excluir);
    cartao.append(principal, acoes);
    el.listaHistorico.append(cartao);
  }
}

function abrirSalvar() {
  if (!estado.calculo) return;
  el.formSalvar.reset();
  el.erroSalvarProduto.textContent = '';
  el.erroSalvarEndereco.textContent = '';
  el.salvarQuantidade.textContent = formatarQuantidade(estado.calculo.quantidade);
  abrirDialogo(el.dialogSalvar);
  queueMicrotask(() => el.salvarProduto.focus());
}

async function salvarCalculo(evento) {
  evento.preventDefault();
  if (!estado.calculo) return;
  normalizarCampoMaiusculo(el.salvarProduto);
  normalizarCampoMaiusculo(el.salvarEndereco);
  el.erroSalvarProduto.textContent = el.salvarProduto.value.trim() ? '' : 'Informe o ID do produto.';
  el.erroSalvarEndereco.textContent = el.salvarEndereco.value.trim() ? '' : 'Informe o endereço.';
  if (!el.salvarProduto.value.trim() || !el.salvarEndereco.value.trim()) return;

  el.btnConfirmarSalvar.disabled = true;
  try {
    await api.criarCalculo({
      produtoId: el.salvarProduto.value,
      endereco: el.salvarEndereco.value,
      recipienteId: estado.recipienteId,
      pesoBrutoKg: estado.calculo.pesoBrutoKg,
      gramaturaG: estado.calculo.gramaturaG
    });
    fecharDialogo(el.dialogSalvar);
    exibirToast('Cálculo salvo no histórico compartilhado.');
    await carregarHistorico({ silencioso: true });
  } catch (erro) {
    if (erro instanceof ApiError && erro.dados?.campos) {
      el.erroSalvarProduto.textContent = erro.dados.campos.produtoId ?? '';
      el.erroSalvarEndereco.textContent = erro.dados.campos.endereco ?? '';
    } else tratarErro(erro);
  } finally {
    el.btnConfirmarSalvar.disabled = false;
  }
}

function abrirEdicao(registro) {
  el.editarId.value = registro.id;
  el.editarVersao.value = String(registro.versao);
  el.editarProduto.value = registro.produtoId;
  el.editarEndereco.value = registro.endereco;
  el.editarQuantidade.value = String(registro.calculo.quantidadeFinal);
  el.editarOriginal.textContent = formatarQuantidade(registro.calculo.quantidadeCalculadaOriginal);
  el.editarDiferenca.textContent = diferencaFormatada(registro.calculo.quantidadeFinal, registro.calculo.quantidadeCalculadaOriginal);
  el.editarDiferenca.dataset.original = String(registro.calculo.quantidadeCalculadaOriginal);
  el.erroEdicao.textContent = '';
  abrirDialogo(el.dialogEditar);
  queueMicrotask(() => el.editarProduto.focus());
}

async function salvarEdicao(evento) {
  evento.preventDefault();
  normalizarCampoMaiusculo(el.editarProduto);
  normalizarCampoMaiusculo(el.editarEndereco);
  el.erroEdicao.textContent = '';
  el.btnConfirmarEdicao.disabled = true;
  try {
    await api.editarCalculo(el.editarId.value, {
      produtoId: el.editarProduto.value,
      endereco: el.editarEndereco.value,
      quantidadeFinal: Number(el.editarQuantidade.value),
      versao: Number(el.editarVersao.value)
    });
    fecharDialogo(el.dialogEditar);
    exibirToast('Registro atualizado. A revisão foi preservada.');
    await carregarHistorico({ silencioso: true });
  } catch (erro) {
    if (erro instanceof ApiError && erro.codigo === 'CONFLITO_DE_EDICAO') {
      el.erroEdicao.textContent = erro.message;
      await carregarHistorico({ silencioso: true });
    } else {
      el.erroEdicao.textContent = erro.message ?? 'Não foi possível salvar a edição.';
    }
  } finally {
    el.btnConfirmarEdicao.disabled = false;
  }
}

async function abrirDetalhes(id) {
  limpar(el.conteudoDetalhes);
  el.conteudoDetalhes.append(elemento('p', { texto: 'Carregando detalhes...' }));
  abrirDialogo(el.dialogDetalhes);
  try {
    const { registro } = await api.obterCalculo(id);
    renderizarDetalhes(registro);
  } catch (erro) {
    limpar(el.conteudoDetalhes);
    el.conteudoDetalhes.append(elemento('p', { classe: 'modal-error', texto: tratarErro(erro) }));
  }
}

function renderizarDetalhes(registro) {
  limpar(el.conteudoDetalhes);
  const grade = elemento('div', { classe: 'details-grid' });
  const detalhes = [
    ['ID do produto', registro.produtoId],
    ['Endereço', registro.endereco],
    ['Recipiente', registro.recipiente.nome],
    ['Tara utilizada', `${formatarPeso(registro.recipiente.taraKg)} kg`],
    ['Peso bruto', `${formatarPeso(registro.entrada.pesoBrutoKg)} kg`],
    ['Peso líquido', `${formatarPeso(registro.calculo.pesoLiquidoKg)} kg`],
    ['Gramatura', `${formatarPeso(registro.entrada.gramaturaG)} g`],
    ['Quantidade original', formatarQuantidade(registro.calculo.quantidadeCalculadaOriginal)],
    ['Quantidade atual', formatarQuantidade(registro.calculo.quantidadeFinal)],
    ['Criado em', formatarDataHora(registro.criadoEm)],
    ['Atualizado em', formatarDataHora(registro.atualizadoEm)],
    ['Versão do registro', String(registro.versao)]
  ];
  for (const [rotulo, valor] of detalhes) {
    grade.append(elemento('div', {
      classe: 'detail-item',
      filhos: [elemento('span', { texto: rotulo }), elemento('strong', { texto: valor })]
    }));
  }
  el.conteudoDetalhes.append(grade);

  const tituloRevisoes = elemento('h3', { texto: 'Histórico de revisões' });
  tituloRevisoes.style.marginTop = '8px';
  el.conteudoDetalhes.append(tituloRevisoes);
  const lista = elemento('div', { classe: 'revision-list' });
  if (!registro.revisoes?.length) {
    lista.append(elemento('p', { texto: 'Este registro ainda não foi editado.' }));
  } else {
    for (const revisao of registro.revisoes) {
      lista.append(elemento('div', {
        classe: 'revision-item',
        filhos: [
          elemento('strong', { texto: `Revisão ${revisao.numero} · ${formatarDataHora(revisao.alteradoEm)}` }),
          elemento('p', { texto: `${revisao.anterior.produtoId} / ${revisao.anterior.endereco} / ${revisao.anterior.quantidadeFinal} → ${revisao.atual.produtoId} / ${revisao.atual.endereco} / ${revisao.atual.quantidadeFinal}` })
        ]
      }));
    }
  }
  el.conteudoDetalhes.append(lista);
}

function confirmarExclusao(registro) {
  abrirConfirmacao({
    titulo: 'Excluir registro',
    mensagem: `O registro ${registro.produtoId} será removido do histórico visível.`,
    acao: async () => {
      await api.excluirCalculo(registro.id);
      exibirToast('Registro excluído.');
      await carregarHistorico({ silencioso: true });
    }
  });
}

function abrirConfirmacao({ titulo, mensagem, acao }) {
  estado.confirmacao = acao;
  el.confirmacaoTitulo.textContent = titulo;
  el.confirmacaoMensagem.textContent = mensagem;
  abrirDialogo(el.dialogConfirmacao);
}

async function executarConfirmacao() {
  if (!estado.confirmacao) return;
  el.btnConfirmarAcao.disabled = true;
  try {
    await estado.confirmacao();
    fecharDialogo(el.dialogConfirmacao);
  } catch (erro) {
    tratarErro(erro);
  } finally {
    estado.confirmacao = null;
    el.btnConfirmarAcao.disabled = false;
  }
}

function limparCampos() {
  el.inputPeso.value = '';
  el.inputGramatura.value = '';
  atualizarCalculo();
  el.inputPeso.focus();
}

async function copiarResultado() {
  if (!estado.calculo) return;
  try {
    await navigator.clipboard.writeText(String(estado.calculo.quantidade));
    exibirToast('Resultado copiado.');
  } catch {
    exibirToast('Não foi possível copiar o resultado.', true);
  }
}

async function abrirConfiguracoes() {
  abrirDialogo(el.dialogConfiguracoes);
  const status = await api.statusAdmin().catch(() => ({ autenticado: false }));
  estado.adminAutenticado = status.autenticado;
  renderizarEstadoAdmin();
  if (estado.adminAutenticado) await carregarAdmin();
}

function renderizarEstadoAdmin() {
  el.statusAdmin.textContent = estado.adminAutenticado ? 'Desbloqueado' : 'Bloqueado';
  el.statusAdmin.classList.toggle('unlocked', estado.adminAutenticado);
  el.adminLogin.classList.toggle('is-hidden', estado.adminAutenticado);
  el.adminPainel.classList.toggle('is-hidden', !estado.adminAutenticado);
}

async function loginAdmin() {
  el.erroPin.textContent = '';
  el.btnLoginAdmin.disabled = true;
  try {
    await api.loginAdmin(el.inputPin.value);
    el.inputPin.value = '';
    estado.adminAutenticado = true;
    renderizarEstadoAdmin();
    await carregarAdmin();
  } catch (erro) {
    el.erroPin.textContent = erro.message;
  } finally {
    el.btnLoginAdmin.disabled = false;
  }
}

async function logoutAdmin() {
  await api.logoutAdmin();
  estado.adminAutenticado = false;
  estado.adminDados = null;
  renderizarEstadoAdmin();
}

async function carregarAdmin() {
  estado.adminDados = await api.obterAdmin();
  el.adminRendimento.value = String(estado.adminDados.configuracoes.taxaRendimento);
  el.adminArredondamento.value = estado.adminDados.configuracoes.politicaArredondamento;
  renderizarAdminRecipientes();
}

function renderizarAdminRecipientes() {
  limpar(el.listaAdminRecipientes);
  for (const recipiente of estado.adminDados.recipientes) {
    const linha = elemento('div', { classe: 'admin-container-row', atributos: { 'data-id': recipiente.id } });
    const nome = elemento('input', { atributos: { type: 'text', value: recipiente.nome, 'aria-label': 'Nome do recipiente' } });
    const tara = elemento('input', { atributos: { type: 'number', min: '0', step: '0.001', value: recipiente.taraKg, 'aria-label': 'Tara em quilogramas' } });
    const cor = elemento('input', { atributos: { type: 'color', value: recipiente.cor, 'aria-label': 'Cor do recipiente' } });
    const ativoInput = elemento('input', { atributos: { type: 'checkbox', 'aria-label': 'Recipiente ativo' } });
    ativoInput.checked = recipiente.ativo;
    const ativo = elemento('label', { filhos: [ativoInput, document.createTextNode('Ativo')] });
    linha.append(nome, tara, cor, ativo);
    el.listaAdminRecipientes.append(linha);
  }
}

function adicionarRecipienteAdmin() {
  const id = `recipiente-${Date.now()}`;
  estado.adminDados.recipientes.push({ id, nome: 'Novo recipiente', taraKg: 0, cor: '#64748B', ativo: true, ordem: estado.adminDados.recipientes.length });
  renderizarAdminRecipientes();
}

function coletarRecipientesAdmin() {
  return [...el.listaAdminRecipientes.children].map((linha, ordem) => {
    const [nome, tara, cor, ativoLabel] = linha.children;
    return {
      id: linha.dataset.id,
      nome: nome.value.trim(),
      taraKg: Number(tara.value),
      cor: cor.value.toLocaleUpperCase('pt-BR'),
      ativo: ativoLabel.querySelector('input').checked,
      ordem
    };
  });
}

async function salvarFormula() {
  try {
    await api.salvarConfiguracoes({
      taxaRendimento: Number(el.adminRendimento.value),
      politicaArredondamento: el.adminArredondamento.value
    });
    await carregarBootstrap();
    exibirToast('Fórmula atualizada para todos os usuários.');
  } catch (erro) {
    tratarErro(erro);
  }
}

async function salvarRecipientes() {
  try {
    await api.salvarRecipientes(coletarRecipientesAdmin());
    await Promise.all([carregarAdmin(), carregarBootstrap()]);
    exibirToast('Recipientes atualizados para todos os usuários.');
  } catch (erro) {
    tratarErro(erro);
  }
}

function confirmarLimpezaHistorico() {
  abrirConfirmacao({
    titulo: 'Arquivar todo o histórico',
    mensagem: 'Todos os registros deixarão de aparecer para todos os usuários. Esta ação é administrativa.',
    acao: async () => {
      await api.limparHistorico();
      await carregarHistorico({ silencioso: true });
      exibirToast('Histórico arquivado.');
    }
  });
}

function configurarEventos() {
  el.inputPeso.addEventListener('input', () => { el.inputPeso.value = limparDecimal(el.inputPeso.value); atualizarCalculo(); });
  el.inputGramatura.addEventListener('input', () => { el.inputGramatura.value = limparDecimal(el.inputGramatura.value); atualizarCalculo(); });
  el.btnSalvar.addEventListener('click', abrirSalvar);
  el.formSalvar.addEventListener('submit', salvarCalculo);
  el.formEditar.addEventListener('submit', salvarEdicao);
  el.editarQuantidade.addEventListener('input', () => {
    el.editarDiferenca.textContent = diferencaFormatada(Number(el.editarQuantidade.value) || 0, Number(el.editarDiferenca.dataset.original));
  });
  el.btnCopiar.addEventListener('click', copiarResultado);
  el.btnLimpar.addEventListener('click', limparCampos);
  el.btnAtualizar.addEventListener('click', () => carregarHistorico());
  el.btnConfiguracoes.addEventListener('click', abrirConfiguracoes);
  el.btnLimparBusca.addEventListener('click', () => {
    el.buscaId.value = '';
    estado.busca = '';
    carregarHistorico();
    el.buscaId.focus();
  });
  el.buscaId.addEventListener('input', () => {
    normalizarCampoMaiusculo(el.buscaId);
    clearTimeout(temporizadorBusca);
    temporizadorBusca = setTimeout(() => {
      estado.busca = el.buscaId.value.trim();
      carregarHistorico();
    }, 320);
  });
  document.querySelectorAll('.uppercase-input').forEach((input) => {
    input.addEventListener('input', () => normalizarCampoMaiusculo(input));
  });
  document.querySelectorAll('[data-close-dialog]').forEach((botao) => {
    botao.addEventListener('click', () => fecharDialogo($(botao.dataset.closeDialog)));
  });
  [el.dialogSalvar, el.dialogEditar, el.dialogDetalhes, el.dialogConfiguracoes, el.dialogConfirmacao].forEach((dialogo) => {
    dialogo.addEventListener('click', (evento) => {
      if (evento.target === dialogo) fecharDialogo(dialogo);
    });
  });
  el.selectTema.addEventListener('change', () => {
    localStorage.setItem('bombonacalc_tema', el.selectTema.value);
    aplicarTema(el.selectTema.value);
  });
  el.btnLoginAdmin.addEventListener('click', loginAdmin);
  el.inputPin.addEventListener('keydown', (evento) => { if (evento.key === 'Enter') loginAdmin(); });
  el.btnSairAdmin.addEventListener('click', logoutAdmin);
  el.btnSalvarFormula.addEventListener('click', salvarFormula);
  el.btnAdicionarRecipiente.addEventListener('click', adicionarRecipienteAdmin);
  el.btnSalvarRecipientes.addEventListener('click', salvarRecipientes);
  el.btnLimparHistorico.addEventListener('click', confirmarLimpezaHistorico);
  el.btnConfirmarAcao.addEventListener('click', executarConfirmacao);
  window.addEventListener('online', () => { atualizarConexao(true); carregarHistorico({ silencioso: true }); });
  window.addEventListener('offline', () => atualizarConexao(false));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (el.selectTema.value === 'system') aplicarTema('system');
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) carregarHistorico({ silencioso: true });
  });
}

async function inicializar() {
  carregarTema();
  configurarEventos();
  atualizarConexao(navigator.onLine, navigator.onLine ? 'Conectando' : 'Offline');
  try {
    await Promise.all([carregarBootstrap(), carregarHistorico()]);
  } catch (erro) {
    tratarErro(erro, 'Não foi possível iniciar o sistema.');
    el.resultadoMensagem.textContent = 'Servidor indisponível. Tente atualizar a página.';
  }

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  setInterval(() => {
    if (!document.hidden && navigator.onLine && !document.querySelector('dialog[open]')) {
      carregarHistorico({ silencioso: true });
    }
  }, 30_000);
}

inicializar();
