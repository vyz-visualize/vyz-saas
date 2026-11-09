import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Áreas isoladas: só a LP ((marketing)) usa as seções de marketing e o motion pesado.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/app/(marketing)/**", "src/features/marketing/**", "src/components/motion/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/marketing", "@/features/marketing/*", "@/components/motion", "@/components/motion/*"],
              message: "Só a área (marketing) importa features/marketing e components/motion.",
            },
          ],
        },
      ],
    },
  },
  // A LP e as páginas públicas não carregam nada do painel nem do assistente VYZ.
  {
    files: ["src/app/(marketing)/**/*.{ts,tsx}", "src/features/marketing/**/*.{ts,tsx}", "src/app/(publico)/**/*.{ts,tsx}", "src/app/(auth)/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/agent", "@/features/agent/*", "@/features/workspace/AppShell"],
              message: "O assistente VYZ e o app shell são só do painel.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // app nativo (Expo) tem o próprio lint
    "apps/**",
  ]),
]);

export default eslintConfig;
