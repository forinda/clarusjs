// ESLint on this site's .tscl components (#305): core rules on each <script>, and the template rules of clarusjs check.
import clarusjs from '@clarusjs/eslint-plugin'
import { noInlineStyle } from './src/lint/no-inline-style.ts'

export default [
  ...clarusjs.configs.recommended,
  {
    files: ['**/*.tscl'],
    settings: { clarusjs: { lintRules: [noInlineStyle] } },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'smart'],
      'no-self-compare': 'error',
      'no-unreachable': 'error',
      'clarusjs/template': 'error',
    },
  },
]
