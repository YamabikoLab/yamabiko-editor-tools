# yamabiko-blocks

WordPress公式イメージを中心に、複数の検証環境を同じComposeテンプレートから展開するための開発基盤です。

## 現在の実装範囲

Issue #1 の次の項目まで実装しています。

1. WordPress主体の共通Dockerfile
2. 共通Composeテンプレート
3. 環境操作スクリプト

Dev Containerの接続環境選択、WordPress初期セットアップ、最小プラグインなどは後続手順で追加します。

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

## 環境の追加

`environments/wp702-default.env` をコピーし、少なくとも次を環境ごとに一意にします。

- `ENVIRONMENT_NAME`
- `COMPOSE_PROJECT_NAME`
- `WORDPRESS_PORT`
- `WORDPRESS_SITE_URL`

例:

```bash
cp environments/wp702-default.env environments/wp683-iframe.env
./scripts/env.sh wp683-iframe config
./scripts/env.sh wp683-iframe up
```

新しい環境を追加しても、Composeテンプレートや `scripts/env.sh` に条件分岐を追加する必要はありません。

詳細は [`environments/README.md`](environments/README.md) を参照してください。
