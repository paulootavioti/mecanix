/**
 * Wizard de orçamento (§6) no navegador.
 *
 * Os passos 2 a 4 renderizam condicionalmente no cliente, então só um
 * navegador exercita o fluxo inteiro — as validações e o cálculo de margem
 * já têm teste unitário, aqui prova-se a fiação.
 */
import { test, expect, type Page } from '@playwright/test';

const EMAIL = 'rafael.souza@exemplo.com.br';
const SENHA = 'mecanix-dev';
const PLACA = 'RQK7D22';
const DOC = '12345678000199';

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(EMAIL);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/selecionar-oficina/);
}

test.beforeEach(async ({ page }) => {
  await entrar(page);
  await page.goto('/app/vertentes/orcamentos/novo');
});

test('bloqueia o avanço sem veículo buscado e explica por toast', async ({ page }) => {
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('status')).toContainText('Busque a placa');
  // Continua no passo 1.
  await expect(page.getByRole('button', { name: 'Buscar veículo' })).toBeVisible();
});

test('placa com menos de 5 caracteres mostra a mensagem do README', async ({ page }) => {
  await page.getByLabel('Placa', { exact: true }).fill('RQK7');
  await page.getByRole('button', { name: 'Buscar veículo' }).click();
  await expect(page.getByText('Informe uma placa válida')).toBeVisible();
});

test('busca a placa e mostra o histórico deste inquilino', async ({ page }) => {
  await page.getByLabel('Placa', { exact: true }).fill(PLACA);
  await page.getByRole('button', { name: 'Buscar veículo' }).click();
  await expect(page.getByText(/veículo encontrado ✓ \d+ OS anteriores/)).toBeVisible();
  await expect(page.getByText('Renavam')).toBeVisible();
});

test('percorre os quatro passos e gera a OS', async ({ page }) => {
  // Passo 1
  await page.getByLabel('Placa', { exact: true }).fill(PLACA);
  await page.getByRole('button', { name: 'Buscar veículo' }).click();
  await expect(page.getByText(/veículo encontrado/)).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Passo 2 — cliente da carteira desta oficina
  await page.getByLabel('CPF ou CNPJ', { exact: true }).fill(DOC);
  await page.getByRole('button', { name: 'Buscar cliente' }).click();
  await expect(page.getByText('cadastro desta oficina')).toBeVisible();
  await expect(page.getByText('Limite de crédito')).toBeVisible();

  // Bloqueio do passo 3 com carrinho vazio
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('toque nos itens ao lado')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('status')).toContainText('Adicione ao menos um item');

  // Passo 3 — adiciona um serviço e confere a linha de margem
  await page.getByRole('button', { name: 'Serviços' }).click();
  await page.getByRole('button', { name: /^Adicionar / }).first().click();
  await expect(page.getByText(/Custo hora R\$/)).toBeVisible();
  await expect(page.getByText(/margem estimada -?[\d,.]+%/)).toBeVisible();

  await page.getByRole('button', { name: 'Continuar' }).click();

  // Passo 4 — gera a OS e volta ao pátio
  await expect(page.getByText(/validade de 7 dias/)).toBeVisible();
  await page.getByRole('button', { name: 'Gerar OS e publicar no portal' }).click();
  await expect(page).toHaveURL(/\/app\/vertentes\/patio/, { timeout: 15_000 });
});

test('documento de outra oficina só devolve dados públicos', async ({ page }) => {
  // Documento cadastrado apenas no inquilino oficina-dois pela suíte de
  // unidade. Aqui, no vertentes, tem que cair na consulta pública.
  await page.getByLabel('Placa', { exact: true }).fill(PLACA);
  await page.getByRole('button', { name: 'Buscar veículo' }).click();
  await expect(page.getByText(/veículo encontrado/)).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.getByLabel('CPF ou CNPJ', { exact: true }).fill('98765432000188');
  await page.getByRole('button', { name: 'Buscar cliente' }).click();

  await expect(page.getByText('consulta pública · só dados cadastrais')).toBeVisible();
  await expect(page.getByText('SEGREDO COMERCIAL DO T2')).toHaveCount(0);
  await expect(page.getByText('Limite de crédito')).toHaveCount(0);
});
