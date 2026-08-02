import parser from '@typescript-eslint/parser';
import plugin from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: [
      'dist/**/*',
      'dist-electron/**/*',
      'node_modules/**/*',
      'release/**/*',
      'src/features/presenter/store/presenterStore.ts',
      'src/features/presenter/store/slices/**/*.ts'
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': plugin,
      'react-hooks': reactHooks,
    },
    rules: {
      'no-restricted-imports': 'off', // Default off
      'react-hooks/rules-of-hooks': 'warn', // TODO: escalate to 'error' once legacy violations in rules-of-hooks are fixed (~34 files)
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['src/app/**/*.ts', 'src/app/**/*.tsx', 'src/features/hymns/**/*.ts', 'src/features/hymns/**/*.tsx', 'src/features/bible-browser/**/*.ts', 'src/features/bible-browser/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/features/presenter/store/presenterStore',
              message: 'Do not import from presenterStore directly in non-presenter features.',
            }
          ],
          patterns: [
            {
              group: ['*/presenterStore'],
              message: 'Do not import from presenterStore directly in non-presenter features.'
            }
          ]
        },
      ],
    }
  }
];
