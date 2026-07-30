import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "artifacts/**",
      "blob-report/**",
      "coverage/**",
      "dist/**",
      "node_modules/**",
      "playwright-report/**",
      "playwright/.cache/**",
      "playwright/.auth/**",
      "test-results/**",
      "vendor/**",
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // 型専用の import を明示し、実行時の import と区別する。
      "@typescript-eslint/consistent-type-imports": "error",

      // 値と誤解されうる void 式を防ぐ。
      // 短縮アロー関数形式のコールバックだけは許可する。
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        {
          ignoreArrowShorthand: true,
        },
      ],

      // 厳密等価演算子（=== / !==）を強制し、暗黙の型変換を避ける。
      eqeqeq: ["error", "always"],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,

      // アプリケーションコードでconsole APIを使用しない。
      "no-console": "error",

      // WordPressが提供するReactランタイムへ統一する。
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              allowTypeImports: true,
              message:
                "Reactの実行時APIは@wordpress/elementからimportしてください。",
            },
            {
              name: "react-dom",
              allowTypeImports: true,
              message: "WordPressのReactランタイムを使用してください。",
            },
            {
              name: "react-dom/client",
              allowTypeImports: true,
              message:
                "独自のReact rootを作らず、Block Editorツリーへ統合してください。",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["eslint.config.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  eslintConfigPrettier,
);
