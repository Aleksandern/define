import { defineConfig } from 'eslint/config';

import baseConfig from "../../eslint.backend.config.mjs";

export default defineConfig([
    ...baseConfig,
    {
        languageOptions: {
          parserOptions: {
            projectService: true,
            tsconfigRootDir: import.meta.dirname
          },
        },
    },
]);
