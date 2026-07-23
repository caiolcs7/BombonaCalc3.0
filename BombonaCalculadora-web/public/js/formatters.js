export function formatarPeso(valor) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(valor);
}

export function formatarQuantidade(valor) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(valor);
}

export function formatarPercentual(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 2 }).format(valor);
}

export function formatarDataHora(valor) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
}

export function diferencaFormatada(atual, original) {
  const diferenca = Number(atual) - Number(original);
  return `${diferenca > 0 ? '+' : ''}${formatarQuantidade(diferenca)}`;
}
