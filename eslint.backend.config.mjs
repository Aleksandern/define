import {
  configs as configsTS,
} from 'typescript-eslint';
import { defineConfig } from "eslint/config";

import { configs } from '@snowyyd/eslint-config';

import rulesConfig from './eslint.rules.config.mjs';
import baseConfig from './eslint.config.mjs';

const __dirname = import.meta.dirname;

const tsConfig = [
  ...baseConfig,
  ...configsTS.recommendedTypeChecked,
  ...configsTS.stylisticTypeChecked,
	...configs.airbnb,
	...configs.esm,
  ...rulesConfig,
  {
    languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir: __dirname,
        },
      },
  }
];

export default defineConfig([
    ...tsConfig,
  {
    rules: {
      "simple-import-sort/imports": ["error", {
        "groups": [
        ["^@nest"],
        ["^@?\\w"],
        ["^(@define/common)(/.*|$)"],
        ["^(@define/entities)(/.*|$)"],
        ["^(@define/client)(/.*|$)"],
        ["^(@define/common)(/.*|$)"],
        ["^@appApi?\\w"],
        ["^(@appApi)(/app/.*|$)"],
        ["^\\u0000"],
        ["^\\.\\.(?!/?$)", "^\\.\\./?$"],
        [
          "^\\./(?=.*/)(?!/?$)",
          "^\\.(?!/?$)",
          "^\\./?$"
        ]
        ]
      }],
    },
  },
]);
