# Yamabiko Editor Tools

サイト制作者向けのWordPressプラグインです。

Gutenbergの編集体験をより直感的にするエディター拡張を開発しています。現在は **Core Table ブロックの行ドラッグ＆ドロップ（Table Reorder）** を中心に開発しています。

> [!WARNING]
> 現在開発中です。仕様や動作は今後変更される可能性があります。

## Table Reorder

Core Table ブロックの本文行をドラッグ＆ドロップで並べ替える機能です。

- PCでは行の左端に表示されるハンドルからドラッグして並べ替え
- タッチ端末では並べ替えモード中の行ハンドルをドラッグして並べ替え、タップで移動先を選択
- SortableJSによる自然な並べ替え
- iframe / non-iframe エディターの両方に対応
- `rowspan` を含む縦結合行の不正な移動を制限
- 並べ替え結果をGutenbergのブロック属性へ反映

## 動作環境

- WordPress 6.8以上
- PHP 8.1以上

## インストール

1. [GitHub Releases](https://github.com/YamabikoLab/yamabiko-editor-tools/releases)から、配布用の `yamabiko-editor-tools.zip` をダウンロードします。
2. WordPress管理画面の「プラグイン」→「新規プラグインを追加」→「プラグインのアップロード」からZIPをアップロードします。
3. **Yamabiko Editor Tools** を有効化します。

## 不具合・要望の報告

不具合報告と機能要望は、[GitHub Issues](https://github.com/YamabikoLab/yamabiko-editor-tools/issues)で受け付けています。

セキュリティ上の問題は公開Issueへ投稿せず、[セキュリティポリシー](SECURITY.md)に従って非公開で報告してください。

現時点では、外部からのPull Requestは受け付けていません。

## ライセンス

[GNU General Public License v2.0 or later](LICENSE)で公開します。

## 開発者向け

実装は [`src/editor-extensions/table-reorder/`](src/editor-extensions/table-reorder/) にあります。

### 依存関係をインストール

```bash
npm ci
composer install
```

### 開発モードを開始

```bash
npm start
```

ローカルのWordPress開発環境では `SCRIPT_DEBUG` が有効になり、`wp-scripts start --hot` が Table Reorder のソースを監視して再ビルドします。

ローカルWordPress開発環境の設定、起動手順、プラグイン配置は、別リポジトリの [YamabikoLab/wp-dev](https://github.com/YamabikoLab/wp-dev) で管理しています。

### 本番ビルドを作成

```bash
npm run build
```

ビルド結果は `build/` に出力され、Table Reorder の JavaScript / CSS と SortableJS ランタイムが生成されます。

### コードを検証

Node.jsの標準品質チェックを実行します。

```bash
npm test
```

フォーマット、JavaScript / TypeScript、CSS / SCSS、型、単体テストを確認します。本番ビルドとPlaywright E2Eテストは含まれません。

PHPのチェックは別に実行します。

```bash
composer lint:php
composer analyse:php
```

これらのコマンドはファイルを書き換えません。自動修正は必要に応じて個別に実行します。

```bash
npm run format
npm run format:css
composer format:php
```

自動修正後は、コミット前に変更内容を確認してください。

[YamabikoLab/wp-dev](https://github.com/YamabikoLab/wp-dev) が提供するWordPress環境にPlugin Checkをインストールしている場合は、補助チェックとして次も実行できます。

```bash
wp plugin check yamabiko-editor-tools
```

Plugin Checkは、上記のコーディング標準チェックの代替ではありません。

### 開発ドキュメント

- [開発方針](docs/development/foundation.md)
- [ソース構成](docs/development/source-organization.md)
- [検証方法](docs/development/testing.md)
- [GitHub CLI](docs/development/github-cli.md)
- [リリース方法](docs/development/releasing.md)

