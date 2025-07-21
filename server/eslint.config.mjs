import { fixupPluginRules } from '@eslint/compat';
import js from '@eslint/js';
import eslintPrettierConfig from 'eslint-config-prettier';
import drizzlePlugin from 'eslint-plugin-drizzle';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: { js },
    extends: ['js/recommended'],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: { globals: globals.node },
  },
  tseslint.configs.recommended,
  eslintPrettierConfig,
  {
    plugins: {
      drizzle: fixupPluginRules(drizzlePlugin),
    },
  },
]);
