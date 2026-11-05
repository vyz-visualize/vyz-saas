import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@vyz/shared": fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // com a máquina ocupada, os testes que varrem o gerador simulado chegam a 3 s
    testTimeout: 15_000,
  },
});
