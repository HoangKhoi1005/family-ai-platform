import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import hooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '.npm-cache/**',
      '.worktrees/**',
      '.superpowers/**',
      '**/next-env.d.ts',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': hooks },
    rules: { ...hooks.configs.recommended.rules },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@family/database', '@family/database/*'],
              message: 'Database is server-only; web/contracts/domain/ui must not import it.',
            },
          ],
        },
      ],
    },
    files: ['apps/web/**/*.{ts,tsx}', 'packages/{domain,contracts,ui}/**/*.{ts,tsx}'],
  },
  prettier,
);
