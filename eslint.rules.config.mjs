import { defineConfig } from 'eslint/config';

import rulesAbBestPracticies from "eslint-config-airbnb-base/rules/best-practices";
import rulesAbErrors from "eslint-config-airbnb-base/rules/errors";
import rulesAnES6 from "eslint-config-airbnb-base/rules/es6";
import rulesAbImports from 'eslint-config-airbnb-base/rules/imports';
import rulesAbStyle from "eslint-config-airbnb-base/rules/style";
import rulesAbVariables from "eslint-config-airbnb-base/rules/variables";

const { rules: baseImportsRules } = rulesAbImports;
const { rules: baseBestPracticesRules } = rulesAbBestPracticies;
const { rules: baseErrorsRules } = rulesAbErrors;
const { rules: baseES6Rules } = rulesAnES6;
const { rules: baseStyleRules } = rulesAbStyle;
const { rules: baseVariablesRules } = rulesAbVariables;

export default defineConfig([{
  files: ['**/*.ts', '**/*.tsx'],

  rules: {
    'brace-style': 'off',
    '@stylistic/brace-style': baseStyleRules['brace-style'],

    camelcase: 'off',
    // The `@typescript-eslint/naming-convention` rule allows `leadingUnderscore` and `trailingUnderscore` settings. However, the existing `no-underscore-dangle` rule already takes care of this.
    '@typescript-eslint/naming-convention': [
      'error',
      // Allow camelCase variables (23.2), PascalCase variables (23.8), and UPPER_CASE variables (23.10)
      {
        selector: 'variable',
        format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
      },
      // Allow camelCase functions (23.2), and PascalCase functions (23.8)
      {
        selector: 'function',
        format: ['camelCase', 'PascalCase'],
      },
      // Airbnb recommends PascalCase for classes (23.3), and although Airbnb does not make TypeScript recommendations, we are assuming this rule would similarly apply to anything "type like", including interfaces, type aliases, and enums
      {
        selector: 'typeLike',
        format: ['PascalCase'],
      },
    ],

    // The TypeScript version also adds 3 new options, all of which should be
    // set to the same value as the base config
    'comma-dangle': 'off',
    '@stylistic/comma-dangle': [
      baseStyleRules['comma-dangle'][0],
      {
        ...baseStyleRules['comma-dangle'][1],
        enums: baseStyleRules['comma-dangle'][1].arrays,
        generics: baseStyleRules['comma-dangle'][1].arrays,
        tuples: baseStyleRules['comma-dangle'][1].arrays,
      },
    ],

    'comma-spacing': 'off',
    '@stylistic/comma-spacing': baseStyleRules['comma-spacing'],

    'default-param-last': 'off',
    '@typescript-eslint/default-param-last': baseBestPracticesRules['default-param-last'],

    'dot-notation': 'off',
    '@typescript-eslint/dot-notation': baseBestPracticesRules['dot-notation'],

    'func-call-spacing': 'off',
    '@stylistic/function-call-spacing': baseStyleRules['func-call-spacing'],

    indent: 'off',
    '@stylistic/indent': baseStyleRules.indent,

    'keyword-spacing': 'off',
    '@stylistic/keyword-spacing': baseStyleRules['keyword-spacing'],

    'lines-between-class-members': 'off',
    '@stylistic/lines-between-class-members': baseStyleRules['lines-between-class-members'],

    'no-array-constructor': 'off',
    '@typescript-eslint/no-array-constructor': baseStyleRules['no-array-constructor'],

    'no-dupe-class-members': 'off',
    '@typescript-eslint/no-dupe-class-members': baseES6Rules['no-dupe-class-members'],

    'no-empty-function': 'off',
    '@typescript-eslint/no-empty-function': baseBestPracticesRules['no-empty-function'],

    'no-extra-parens': 'off',
    '@stylistic/no-extra-parens': baseErrorsRules['no-extra-parens'],

    'no-extra-semi': 'off',
    '@stylistic/no-extra-semi': baseErrorsRules['no-extra-semi'],

    'no-implied-eval': 'off',
    'no-new-func': 'off',
    '@typescript-eslint/no-implied-eval': baseBestPracticesRules['no-implied-eval'],

    'no-loop-func': 'off',
    '@typescript-eslint/no-loop-func': baseBestPracticesRules['no-loop-func'],

    'no-magic-numbers': 'off',
    '@typescript-eslint/no-magic-numbers': baseBestPracticesRules['no-magic-numbers'],

    'no-redeclare': 'off',
    '@typescript-eslint/no-redeclare': baseBestPracticesRules['no-redeclare'],

    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': baseVariablesRules['no-shadow'],

    'space-before-blocks': 'off',
    '@stylistic/space-before-blocks': baseStyleRules['space-before-blocks'],

    'no-throw-literal': 'off',
    '@typescript-eslint/only-throw-error': baseBestPracticesRules['no-throw-literal'],

    'no-unused-expressions': 'off',
    '@typescript-eslint/no-unused-expressions': baseBestPracticesRules['no-unused-expressions'],

    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': baseVariablesRules['no-use-before-define'],

    'no-useless-constructor': 'off',
    '@typescript-eslint/no-useless-constructor': baseES6Rules['no-useless-constructor'],

    quotes: 'off',
    '@stylistic/quotes': baseStyleRules.quotes,

    semi: 'off',
    '@stylistic/semi': baseStyleRules.semi,

    'space-before-function-paren': 'off',
    '@stylistic/space-before-function-paren': baseStyleRules['space-before-function-paren'],

    'require-await': 'off',
    '@typescript-eslint/require-await': baseBestPracticesRules['require-await'],

    'no-return-await': 'off',
    '@typescript-eslint/return-await': [
      baseBestPracticesRules['no-return-await'],
      'in-try-catch',
    ],

    'space-infix-ops': 'off',
    '@stylistic/space-infix-ops': baseStyleRules['space-infix-ops'],

    'object-curly-spacing': 'off',
    '@stylistic/object-curly-spacing': baseStyleRules['object-curly-spacing'],

    // Append all JS/TS extensions to Airbnb 'import/extensions' rule
    // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/extensions.md
    'import-x/extensions': [
      baseImportsRules['import/extensions'][0],
      baseImportsRules['import/extensions'][1],
      {
        ...baseImportsRules['import/extensions'][2],
        cjs: 'never',
        ts: 'never',
        tsx: 'never',
        mts: 'never',
        cts: 'never',
      },
    ],

    // // Append all JS/TS extensions to Airbnb 'import/no-extraneous-dependencies' rule
    // // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-extraneous-dependencies.md
    // 'import-x/no-extraneous-dependencies': [
    //   baseImportsRules['import/no-extraneous-dependencies'][0],
    //   {
    //     ...baseImportsRules['import/no-extraneous-dependencies'][1],
    //     devDependencies: [
    //       ...baseImportsRules['import/no-extraneous-dependencies'][1].devDependencies.map(
    //         (devDep) => {
    //           let newDevDep = devDep;
    //           newDevDep = newDevDep.replace(/\.(js$|{js,jsx}$)/g, '.{js,jsx,mjs,cjs,ts,mts,cts}');
    //           newDevDep = newDevDep.replace(/{,\.js}$/g, '{,.js,.jsx,.mjs,.cjs,.ts,.mts,.cts}');
    //           return newDevDep;
    //         },
    //         [],
    //       ),
    //       // Add new eslint config file
    //       '**/eslint.config.{js,jsx,mjs,cjs,ts,mts,cts}',
    //     ],
    //   },
    // ],


















    '@stylistic/member-delimiter-style': ['error', {
      multiline: {
      delimiter: 'comma',
      requireLast: true,
      },

      singleline: {
      delimiter: 'semi',
      requireLast: false,
      },
    }],

    // Append all JS/TS extensions to Airbnb 'import/extensions' rule
    // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/extensions.md
    'import-x/extensions': [
      baseImportsRules['import/extensions'][0],
      baseImportsRules['import/extensions'][1],
      {
      ...baseImportsRules['import/extensions'][2],
      cjs: 'never',
      ts: 'never',
      tsx: 'never',
      mts: 'never',
      cts: 'never',
      jsx: 'never',
      '': 'never',
      },
    ],
    // 'import-x/no-extraneous-dependencies': ['error', {'devDependencies': true}],

    'import-x/no-extraneous-dependencies': ["error", {
      "devDependencies": true,
      "optionalDependencies": false,
      "peerDependencies": false,
      "packageDir": [
        import.meta.dirname,
      ],
      "whitelist": [
        "@libs/common",
        '@define/common',
        '@define/web',
      ],
    }],

    'import-x/order': 'off',
    'import-x/prefer-default-export': 'off',
    'import-x/no-named-as-default': 'off',
    'import-x/no-unresolved': 'off',
    'import-x/no-default-export': 'error',

    '@typescript-eslint/naming-convention': ['error', {
      selector: 'variable',
      format: ['camelCase', 'PascalCase', 'UPPER_CASE', 'snake_case'],
      leadingUnderscore: 'allow',
      trailingUnderscore: 'allow',
    }, {
      selector: 'function',
      format: ['camelCase', 'PascalCase'],
    }, {
      selector: 'typeLike',
      format: ['PascalCase'],
    }],

    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', {
      args: 'all',
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    }],

    'no-empty-function': 'off',
    '@typescript-eslint/no-empty-function': ['error', {
      'allow': [],
    }],

    '@typescript-eslint/no-floating-promises': ['error'],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-restricted-types': [
      'error',
      {
        types: {
          Omit: {
            message: 'Prefer `OmitStrict`.',
            suggest: ['Omit', 'OmitStrict'],
          },
        },
      },
    ],

    'no-restricted-syntax': ['error', {
      selector: 'ForInStatement',
      message: 'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
    }, {
      selector: 'ForOfStatement',
      message: 'iterators/generators require regenerator-runtime, which is too heavyweight for this guide to allow them. Separately, loops should be avoided in favor of array iterations.',
    }, {
      selector: 'LabeledStatement',
      message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
    }, {
      selector: 'WithStatement',
      message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
    }, {
      selector: 'IfStatement > ExpressionStatement > AssignmentExpression',
      message: 'Avoid assignmenting in a single line if statement. It\'s not good for maintaining and understanding',
    }],

    'padding-line-between-statements': ['error', {
      blankLine: 'always',
      prev: 'case',
      next: '*',
    }, {
      blankLine: 'always',
      prev: 'default',
      next: '*',
    }, {
      blankLine: 'never',
      prev: 'multi-case',
      next: '*',
    }, {
      blankLine: 'always',
      prev: '*',
      next: ['return', 'switch', 'for'],
    }],

    'no-restricted-exports': ['error', {
      restrictedNamedExports: ['then'],
    }],

    'no-underscore-dangle': ['error', {
      allow: ['_id'],
      allowAfterThis: false,
      allowAfterSuper: false,
      enforceInMethodNames: true,
    }],

    'no-void': ['error', {
      allowAsStatement: true,
    }],

    'sort-imports': ['off', {
      ignoreCase: false,
      ignoreDeclarationSort: false,
      ignoreMemberSort: false,
      allowSeparatedGroups: false,
      memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
    }],

    'sort-imports-es6-autofix/sort-imports-es6': 'off',
    'simple-import-sort/exports': 'error',

    'object-curly-newline': ['error', {
      ObjectExpression: {
      minProperties: 2,
      multiline: true,
      consistent: true,
      },

      ObjectPattern: {
      minProperties: 2,
      multiline: true,
      consistent: true,
      },

      ImportDeclaration: {
      minProperties: 2,
      multiline: true,
      consistent: true,
      },

      ExportDeclaration: {
      minProperties: 2,
      multiline: true,
      consistent: true,
      },
    }],
    'object-property-newline': ['error', {
      allowMultiplePropertiesPerLine: false,
    }],

    'modules-newlines/import-declaration-newline': 'warn',
    'modules-newlines/export-declaration-newline': 'warn',

    '@stylistic/max-len': ['error', {
      code: 170,
    }],
    'class-methods-use-this': 'off',
    'no-undef': 'off',

    'no-restricted-globals': 'off',
    },
  },
]);
