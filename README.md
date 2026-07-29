# yamabiko-blocks

WordPress公式イメージを中心に、複数の検証環境を同じComposeテンプレートから展開するための開発基盤です。

## 現在の実装範囲

Issue #1 の次の項目まで実装しています。

1. WordPress主体の共通Dockerfile
2. 共通Composeテンプレート
3. 環境操作スクリプト
4. VS Code標準機能によるDev Container接続環境の選択

WordPress初期セットアップ、XdebugのVS Code待受設定、最小プラグインなどは後続手順で追加します。

## 基準環境

`environments/wp702-default.env` は次の構成です。

- WordPress 7.0.2
- PHP 8.3 / Apache
- MariaDB 11.4
- Node.js 24.5.0
- Composer 2
- WP-CLI 2.12.0
- Xdebug 3.4.5
- URL: `http://127.0.0.1:8080`

## 環境操作

Docker EngineとDocker Compose v2が必要です。

```bash
./scripts/env.sh wp702-default config
./scripts/env.sh wp702-default up
./scripts/env.sh wp702-default status
./scripts/env.sh wp702-default logs
./scripts/env.sh wp702-default down
./scripts/env.sh wp702-default reset
```

`setup` コマンドの入口もありますが、実処理を担う `scripts/setup-wordpress.sh` はIssue #1の手順7で追加します。それまでは説明付きで終了します。

## Dev Containerで開く

独自の環境選択スクリプトや `.env` の書き換えは使用しません。環境ごとのDev Container設定を、VS Code Dev Containersの標準構成で管理します。

基準環境の設定は次です。

```text
.devcontainer/wp702-default/
├── devcontainer.json
└── compose.yaml
```

初回はVS Codeで次を実行します。

1. コマンドパレットを開く
2. `Dev Containers: Reopen in Container` を実行する
3. `Yamabiko Blocks: wp702-default` を選択する

接続後、別の環境設定が追加されていれば、次で切り替えます。

```text
Dev Containers: Switch Container
```

VS Codeは選択したComposeプロジェクトの `wordpress` サービスへ接続し、リポジトリを `/workspaces/yamabiko-blocks` として開きます。

`shutdownAction` は `none` です。VS Codeを閉じても検証環境は自動停止しません。停止するときは明示的に実行します。

```bash
./scripts/env.sh wp702-default down
```

## 環境の追加

新しい環境を追加するときは、次の2つを追加します。

1. `environments/<environment>.env`
2. `.devcontainer/<environment>/` の薄いDev Container設定

環境定義では少なくとも次を一意にします。

- `ENVIRONMENT_NAME`
- `COMPOSE_PROJECT_NAME`
- `WORDPRESS_PORT`
- `WORDPRESS_SITE_URL`

環境ごとの `compose.yaml` はDocker Compose標準の `include` と `env_file` で共通Composeを参照します。

```yaml
include:
  - path: ../../docker/compose.environment.yaml
    env_file: ../../environments/wp702-default.env
```

共通Compose、共通Dockerfile、`scripts/env.sh`、プラグインソースへ環境名ごとの分岐を追加する必要はありません。

詳細は [`environments/README.md`](environments/README.md) を参照してください。
