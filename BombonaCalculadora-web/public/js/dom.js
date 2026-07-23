export function elemento(tag, { classe = '', texto = '', atributos = {}, filhos = [] } = {}) {
  const item = document.createElement(tag);
  if (classe) item.className = classe;
  if (texto !== '') item.textContent = texto;
  for (const [chave, valor] of Object.entries(atributos)) {
    if (valor !== null && valor !== undefined) item.setAttribute(chave, String(valor));
  }
  for (const filho of filhos) item.append(filho);
  return item;
}

export function limpar(elementoAlvo) {
  elementoAlvo.replaceChildren();
}

export function abrirDialogo(dialogo) {
  if (!dialogo.open) dialogo.showModal();
}

export function fecharDialogo(dialogo) {
  if (dialogo.open) dialogo.close();
}

export function normalizarCampoMaiusculo(input) {
  const inicio = input.selectionStart;
  const fim = input.selectionEnd;
  input.value = input.value.toLocaleUpperCase('pt-BR');
  if (inicio !== null && fim !== null) input.setSelectionRange(inicio, fim);
}
