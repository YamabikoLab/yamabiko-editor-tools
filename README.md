# Yamabiko Editor Tools

サイト制作者向けのWordPressプラグインです。

ブロックやエディター拡張を通じて、Gutenbergでのコンテンツ制作をより直感的にします。

現在は **Core Table ブロックの行ドラッグ＆ドロップ（Table Reorder）** を中心に開発しています。テーブルの各行をドラッグして、編集画面上で直感的に並べ替えられます。

現在は開発中です。

## Table Reorder

Core Table ブロックの本文行をドラッグ＆ドロップで並べ替えるエディター拡張です。

- 行の左端に表示されるハンドルからドラッグして並べ替え
- SortableJS による自然な並べ替えアニメーション
- iframe / non-iframe エディターの両方に対応
- `rowspan` を含む縦結合行の不正な移動を制限
- Gutenberg のブロック属性へ並べ替え結果を反映し、Undo / Redo と連携

実装は [`src/editor-extensions/table-reorder/`](src/editor-extensions/table-reorder/) にあります。

## Install dependencies

```bash
npm ci
composer install
```

## Start development mode

```bash
npm start
```

The local WordPress development environment enables `SCRIPT_DEBUG`, and `wp-scripts start --hot` watches files under `src/` and rebuilds blocks when they change.

The local WordPress development environment, including its configuration, startup procedure, and plugin placement, is maintained in the separate [YamabikoLab/wp-dev](https://github.com/YamabikoLab/wp-dev) repository.

## Create a production build

```bash
npm run build
```

Build output is written to `build/`. The generated block manifest is loaded by `yamabiko-editor-tools.php`.

## Check the code

Run the standard Node.js quality checks with:

```bash
npm test
```

This runs formatting checks, JavaScript/TypeScript linting, CSS/SCSS linting, TypeScript type checking, and unit tests. It does not create a production build or run Playwright E2E tests.

Run the PHP checks separately:

```bash
composer lint:php
composer analyse:php
```

These commands only inspect files and do not rewrite them.

Apply automatic fixes separately when needed:

```bash
npm run format
npm run format:css
composer format:php
```

Review every automatic change before committing it.

When Plugin Check is installed in the WordPress environment provided by `YamabikoLab/wp-dev`, it can also be run as a complementary check:

```bash
wp plugin check yamabiko-editor-tools
```

Plugin Check does not replace the coding-standard commands above.

## Add a block

Create each block in its own directory under `src/blocks/` and include a `block.json` file.

```text
src/blocks/
└── notice/
    ├── block.json
    └── index.tsx
```

The build command discovers block metadata under `src/` and generates the files required for WordPress registration.

After building, activate **Yamabiko Editor Tools** in WordPress and confirm that the block is available in the block editor.

## ドキュメント

- [開発方針](docs/development/foundation.md)
- [ソース構成](docs/development/source-organization.md)
- [検証方法](docs/development/testing.md)
- [GitHub CLI](docs/development/github-cli.md)
- [リリース方法](docs/development/releasing.md)
