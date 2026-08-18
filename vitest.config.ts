import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['tests/setup.ts'],
    // Os testes de isolamento compartilham um banco real; rodar em série
    // evita que o reset de um interfira no outro.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
