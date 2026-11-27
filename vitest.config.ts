import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Todos os testes compartilham um Postgres real; rodam em série para não disputar dados.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
