import tseslint from 'typescript-eslint';
// import airbnbTs from './eslint/eslint.airbnb.mjs';
import { configs } from '@snowyyd/eslint-config';

import rulesConfig from './eslint.rules.config.mjs';
import baseConfig from './eslint.config.mjs';

const __dirname = import.meta.dirname;

const tsConfig = [
  ...baseConfig,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  // ...airbnbTs,
	...configs.airbnb,
	...configs.esm,
  ...rulesConfig,
  {
    ignores: [
      'node_modules',
      'dist',
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
  },
];

export default [
  ...tsConfig,
  {
  rules: {
    'simple-import-sort/imports': ['error', {
      'groups': [
      ['^react'],
      ['^@?\\w'],
      ['^(@define/common)(/.*|$)'],
      ['^(@define/client)(/.*|$)'],
      ['^(@define/react)(/.*|$)'],
      ['^(@define/web)(/.*|$)'],
      ['^(@define/webServer)(/.*|$)'],
      ['^\\u0000'],
      [
        '^\\.\\.(?!/?$)',
        '^\\.\\./?$'
      ],
      [
        '^\\./(?=.*/)(?!/?$)',
        '^\\.(?!/?$)',
        '^\\./?$'
      ],
      [
        '\\./.*\\.?(css)'
      ]
      ]
    }],

    'no-param-reassign': ["error", {
      "ignorePropertyModificationsForRegex": ["^current$"]
    }],

    'no-alert': 'off',

    'jsx-a11y/alt-text': 'off',

    '@next/next/no-html-link-for-pages': ['error', 'apps/web/pages'],

    'react/function-component-definition': ['error', {
      'namedComponents': ['function-declaration', 'function-expression', 'arrow-function'],
      'unnamedComponents': 'function-expression'
    }],
    'react/jsx-first-prop-new-line': ['error', 'multiline'],
    'react/jsx-max-props-per-line': [
      'error',
      { 'maximum': { 'single': 1, 'multi': 1 } }
    ],
    'react/react-in-jsx-scope': 'off',
    'react/require-default-props': 'off',
    'react/jsx-props-no-spreading': 'off',
    'react/jsx-filename-extension': 'off',
    'react/prop-types': 'off',
    'react/no-unstable-nested-components': 'off',
    'react/static-property-placement': 'off',
    'react/no-unused-class-component-methods': 'off',
    'react/display-name': 'off',
    'react/no-array-index-key': ['error'],
    'react/jsx-indent': ["error", 2],
    "react/jsx-indent-props": ["error", 2],
    'react/no-unknown-property': ['error'],
    // '@stylistic/jsx-indent': ["error", 2, {checkAttributes: true, indentLogicalExpressions: true}],
  },
  },
];
