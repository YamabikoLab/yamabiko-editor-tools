# Yamabiko Editor Tools

サイト制作者向けのWordPressプラグインです。

ブロックやエディター拡張を通じて、Gutenbergでのコンテンツ制作における課題を補完します。最初のテーマとして、文書構造とアウトラインの改善に取り組みます。

現在は開発中です。

## 開発を始める

必要なもの:

- Docker Engine
- Docker Compose 2.20.0以上
- Visual Studio Code
- VS Code Dev Containers拡張機能

VS Codeでリポジトリを開き、コマンドパレットから `Dev Containers: Reopen in Container` を実行して `Yamabiko Editor Tools: wp702-default` を選択します。

コンテナ内で次を実行します。

```bash
cd app
npm ci
composer install
npm run build
```

WordPressは `http://127.0.0.1:8080` で開きます。

## 配布用ZIPを生成する

コンテナ内で次を実行します。

```bash
cd app
npm run plugin-zip
```

`build/` の生成後、`app/yamabiko-editor-tools.zip` が作成されます。

公開時は、バージョンタグを作成するとGitHub ActionsがZIPを生成し、GitHub Releaseへ添付します。手順は[リリース方法](docs/development/releasing.md)を参照してください。

## ドキュメント

- [開発方針](docs/development/foundation.md)
- [ソース構成](docs/development/source-organization.md)
- [検証方法](docs/development/testing.md)
- [GitHub CLI](docs/development/github-cli.md)
- [リリース方法](docs/development/releasing.md)
