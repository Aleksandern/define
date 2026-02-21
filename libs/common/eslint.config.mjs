import baseConfig from '../../eslint.backend.config.mjs';

export default [
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      },
    },
  },
];


// import baseConfig from "../../eslint.config.mjs";

// export default [
//     ...baseConfig,
//     {
//         files: [
//             "**/*.json"
//         ],
//         rules: {
//             "@nx/dependency-checks": [
//                 "error",
//                 {
//                     ignoredFiles: [
//                         "{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}"
//                     ]
//                 }
//             ]
//         },
//         languageOptions: {
//             parser: await import("jsonc-eslint-parser")
//         }
//     },
//     {
//         ignores: [
//             "**/out-tsc"
//         ]
//     }
// ];
