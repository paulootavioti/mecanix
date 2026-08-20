import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['tests/setup.ts'],
    globalSetup: ['tests/global-setup.ts'],
    // Os testes de isolamento compartilham um banco real; rodar em série
    // evita que o reset de um interfira no outro.
    fileParallelism: false,
    // O padrão do Vitest coleta qualquer *.spec.ts, o que inclui a suíte do
    // Playwright em e2e/. Ela falha na coleta, porque test.beforeEach do
    // Playwright não existe sob Vitest — e o resultado é `npm test` acusando
    // uma falha que não diz nada sobre o código. E2E roda por `npm run test:e2e`.
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
  },
});
