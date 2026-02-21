import nx from "@nx/eslint-plugin";
import eslintPluginImportX from "eslint-plugin-import-x";
import modulesNewlines from "eslint-plugin-modules-newlines";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import stylistic from '@stylistic/eslint-plugin';

export default [
    ...nx.configs["flat/base"],
    ...nx.configs["flat/typescript"],
    ...nx.configs["flat/javascript"],
    eslintPluginImportX.flatConfigs.recommended,
    eslintPluginImportX.flatConfigs.typescript,
    {
        plugins: {
          '@stylistic': stylistic,
          'modules-newlines': modulesNewlines,
          'simple-import-sort': simpleImportSort,
        },
    },
    {
      "ignores": [
        "**/dist",
        "**/*.config.js",
        "jest.config.ts",
        "**/*.spec.ts",
        "**/*.test.ts",
        "node_modules",
        "**/vite.config.*.timestamp*",
        "**/vitest.config.*.timestamp*",
        "out-tsc",
        "dist",
        "webpack.config.js",
        "src/**/*.spec.ts",
        "src/**/*.test.ts",
        "eslint.config.js",
        "eslint.config.cjs",
        "eslint.config.mjs",
        "**/test-output",
        ".babelrc.js",
        "next-env.d.ts",
        "scripts/version.js"
      ]
    },
    {
        files: [
            "**/*.ts",
            "**/*.tsx",
            "**/*.js",
            "**/*.jsx"
        ],
        rules: {
            "@nx/enforce-module-boundaries": [
                "error",
                {
                    enforceBuildableLibDependency: true,
                    allow: [
                        "^.*/eslint(\\.base)?\\.config\\.[cm]?js$",
                        'appApi',
                        'appAdmin',
                        'appEmails',
                        'appMobile',
                        '@proj/*',
                        '@proj/mobile',
                        'libs/common/types'
                    ],
                    depConstraints: [
                        {
                            sourceTag: "*",
                            onlyDependOnLibsWithTags: [
                                "*"
                            ]
                        }
                    ]
                }
            ]
        }
    },
    {
        files: [
            "**/*.ts",
            "**/*.tsx",
            "**/*.cts",
            "**/*.mts",
            "**/*.js",
            "**/*.jsx",
            "**/*.cjs",
            "**/*.mjs"
        ],
        // Override or add rules here
        rules: {}
    }
];
