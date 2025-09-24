import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.spec.{js,ts}'],
    environment: 'node',
    globals: true,
    watch: false,
    passWithNoTests: false,
    reporters: 'basic',
  },
});
