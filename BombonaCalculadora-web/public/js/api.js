export class ApiError extends Error {
  constructor(mensagem, { status = 0, codigo = 'ERRO_REDE', dados = null } = {}) {
    super(mensagem);
    this.name = 'ApiError';
    this.status = status;
    this.codigo = codigo;
    this.dados = dados;
  }
}

function obterClienteId() {
  const chave = 'bombonacalc_cliente_id';
  let id = localStorage.getItem(chave);
  if (!id) {
    id = `web-${crypto.randomUUID()}`;
    localStorage.setItem(chave, id);
  }
  return id;
}

async function requisicao(caminho, opcoes = {}) {
  const headers = new Headers(opcoes.headers ?? {});
  headers.set('Accept', 'application/json');
  headers.set('X-Client-Id', obterClienteId());
  if (opcoes.body !== undefined) headers.set('Content-Type', 'application/json');

  let resposta;
  try {
    resposta = await fetch(caminho, {
      ...opcoes,
      credentials: 'same-origin',
      headers,
      body: opcoes.body === undefined ? undefined : JSON.stringify(opcoes.body)
    });
  } catch (erro) {
    throw new ApiError('Não foi possível conectar ao servidor.', { dados: erro });
  }

  const dados = resposta.status === 204 ? null : await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new ApiError(dados?.erro?.mensagem ?? 'A operação não pôde ser concluída.', {
      status: resposta.status,
      codigo: dados?.erro?.codigo ?? 'ERRO_API',
      dados: dados?.erro ?? dados
    });
  }
  return dados;
}

export const api = {
  bootstrap: () => requisicao('/api/bootstrap'),
  listarCalculos: (produtoId = '') => requisicao(`/api/calculos?produtoId=${encodeURIComponent(produtoId)}&limite=100`),
  obterCalculo: (id) => requisicao(`/api/calculos/${encodeURIComponent(id)}`),
  criarCalculo: (dados) => requisicao('/api/calculos', { method: 'POST', body: dados }),
  editarCalculo: (id, dados) => requisicao(`/api/calculos/${encodeURIComponent(id)}`, { method: 'PATCH', body: dados }),
  excluirCalculo: (id) => requisicao(`/api/calculos/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  restaurarCalculo: (id) => requisicao(`/api/calculos/${encodeURIComponent(id)}/restaurar`, { method: 'POST' }),
  statusAdmin: () => requisicao('/api/admin/sessao'),
  loginAdmin: (pin) => requisicao('/api/admin/sessao', { method: 'POST', body: { pin } }),
  logoutAdmin: () => requisicao('/api/admin/sessao', { method: 'DELETE' }),
  obterAdmin: () => requisicao('/api/admin/configuracao'),
  salvarConfiguracoes: (dados) => requisicao('/api/admin/configuracoes', { method: 'PUT', body: dados }),
  salvarRecipientes: (recipientes) => requisicao('/api/admin/recipientes', { method: 'PUT', body: { recipientes } }),
  limparHistorico: () => requisicao('/api/admin/calculos', { method: 'DELETE' })
};
