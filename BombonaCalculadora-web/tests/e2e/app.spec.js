import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Produção por peso' })).toBeVisible();
});

test('exibe a nova identidade visual no cabeçalho', async ({ page }) => {
  const logo = page.locator('.brand-logo');
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('src', '/assets/logo-bombonacalc.png');
});

test('salva ID e endereço em maiúsculas e encontra pela busca de ID', async ({ page }, testInfo) => {
  const produto = `PRODUTO-${testInfo.project.name.toUpperCase()}`;
  await page.getByLabel('Peso bruto').fill('20');
  await page.getByLabel('Gramatura').fill('50');
  await expect(page.locator('#resultado-valor')).toHaveText('258');
  await page.getByRole('button', { name: 'Salvar cálculo' }).click();

  const dialogo = page.locator('#dialog-salvar');
  await dialogo.getByLabel('ID do produto').fill(produto.toLowerCase());
  await dialogo.getByLabel('Endereço').fill('a-01');
  await expect(dialogo.getByLabel('ID do produto')).toHaveValue(produto);
  await expect(dialogo.getByLabel('Endereço')).toHaveValue('A-01');
  await dialogo.getByRole('button', { name: 'Confirmar salvamento' }).click();

  await expect(page.getByText(produto, { exact: true }).first()).toBeVisible();
  await page.getByLabel('Buscar histórico pelo ID do produto').fill(produto.slice(0, -2).toLowerCase());
  await expect(page.getByLabel('Buscar histórico pelo ID do produto')).toHaveValue(produto.slice(0, -2));
  await expect(page.getByText(produto, { exact: true }).first()).toBeVisible();
});

test('edita quantidade mantendo o valor original', async ({ page }, testInfo) => {
  const produto = `EDIT-${testInfo.project.name.toUpperCase()}`;
  await page.getByLabel('Peso bruto').fill('20');
  await page.getByLabel('Gramatura').fill('50');
  await page.getByRole('button', { name: 'Salvar cálculo' }).click();
  const salvar = page.locator('#dialog-salvar');
  await salvar.getByLabel('ID do produto').fill(produto);
  await salvar.getByLabel('Endereço').fill('b-02');
  await salvar.getByRole('button', { name: 'Confirmar salvamento' }).click();

  const card = page.locator('.history-card').filter({ hasText: produto }).first();
  await card.getByRole('button', { name: 'Editar' }).click();
  const editar = page.locator('#dialog-editar');
  await expect(editar.locator('#editar-original')).toHaveText('258');
  await editar.getByLabel('Quantidade final').fill('250');
  await editar.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(card).toContainText('250');
});

test('modo escuro não usa superfície branca', async ({ page }) => {
  const cores = await page.evaluate(() => {
    const estilos = getComputedStyle(document.documentElement);
    return { fundo: estilos.getPropertyValue('--bg').trim(), superficie: estilos.getPropertyValue('--surface').trim() };
  });
  expect(cores.fundo).toBe('#070b16');
  expect(cores.superficie).toBe('#0d1424');
});
