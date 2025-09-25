import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pluginQuery from '@tanstack/eslint-plugin-query';
import pluginRouter from '@tanstack/eslint-plugin-router';

import { includeIgnoreFile } from '@eslint/compat';
import pluginJs from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import pluginReact from 'eslint-plugin-react';
import tailwind from 'eslint-plugin-tailwindcss'; // Disabled due to Tailwind CSS v4 compatibility
import globals from 'globals';
import tseslint from 'typescript-eslint';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gitignorePath = path.resolve(__dirname, '.gitignore');

export default [
  includeIgnoreFile(gitignorePath),
  { files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'] },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat['jsx-runtime'],
  jsxA11y.flatConfigs.recommended,
  ...pluginRouter.configs['flat/recommended'],
  ...pluginQuery.configs['flat/recommended'],
  ...tailwind.configs['flat/recommended'], // Disabled due to Tailwind CSS v4 compatibility
  eslintConfigPrettier,
  {
    settings: {
      tailwindcss: {
        config: "tailwind.config.ts",
        callees: ["cn", "cva"],
      },
    },
    rules: {
      'react/no-unknown-property': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'jsx-a11y/alt-text': [
        'warn',
        {
          elements: ['img'],
          img: ['Image'],
        },
      ],
      'jsx-a11y/aria-props': 'warn',
      'jsx-a11y/aria-proptypes': 'warn',
      'jsx-a11y/aria-unsupported-elements': 'warn',
      'jsx-a11y/role-has-required-aria-props': 'warn',
      'jsx-a11y/role-supports-aria-props': 'warn',
      'react/jsx-no-target-blank': 'off',
      'react/no-children-prop': [
        'error',
        {
          allowFunctions: true,
        },
      ],
      // Custom rule to warn about potentially invalid Tailwind classes
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'JSXAttribute[name.name="className"] Literal[value=/\\s{2,}/]',
          message: 'Avoid multiple consecutive spaces in className',
        },
      ],
      // Disable class ordering since Prettier handles it
      'tailwindcss/classnames-order': 'off',
    },
  },
];
