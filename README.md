# Yamabiko Blocks

WordPressブロックエディターの構造編集を改善するプラグインです。

現在は、複数のWordPress検証環境を同じDockerfileとComposeテンプレートから展開できる開発基盤、および最小プラグインを整備しています。ブロックやエディター機能はまだ実装していません。

## 現在の実装範囲

- WordPress公式イメージを基盤とした共通Dockerfile
- WordPressとMariaDBの共通Composeテンプレート
- 環境ごとの薄いDev Container設定
- VS Code Dev Containers標準機能による環境の起動・再構築・切り替え
- `app/`をWordPressプラグインとしてbind mount
- WordPress、DB、Codex、GitHub CLI設定の環境単位での永続化
- 開発用`php.ini`とXdebug設定
- Node.js、Composer、WP-CLI、Docker CLI、GitHub CLI、Codex CLI、`logcut`
- Codex通知音フックとCodexデータのバックアップ・復元
- 最小プラグインと、後続機能が従う開発契約

## 基準環境

`wp702-default`は次の構成です。

| 項目 | バージョン・設定 |
| --- | --- |
| WordPress | 7.0.2 |
| PHP | 8.3 / Apache |
| MariaDB | 12.3 |
| Node.js | 24.5.0 |
| Composer | 2.8 |
| WP-CLI | 2.12.0 |
| Xdebug | 3.4.5 |
| Codex CLI | 0.145.0 |
| URL | `http://127.0.0.1:8080` |
| タイムゾーン | `Asia/Tokyo` |
| ロケール | `ja_JP.UTF-8` |

## 必要なもの

- Docker Engine
- Docker Compose v2
- Visual Studio Code
- VS Code Dev Containers拡張機能

Windowsでは、WSL2上のリポジトリをVS Codeで開く構成を想定しています。

## Dev Containerを開く

環境の起動と切り替えには、独自スクリプトやルート`.env`の書き換えを使用しません。環境ごとのDev Container設定をVS Codeの標準機能から選択します。

初回は次の手順で開きます。

1. VS Codeでリポジトリを開く
2. コマンドパレットを開く
3. `Dev Containers: Reopen in Container`を実行する
4. `Yamabiko Blocks: wp702-default`を選択する

VS Codeは`db`と`wordpress`サービスを起動し、`wordpress`サービスへ`www-data`ユーザーで接続します。ワークスペースは次の場所です。

```text
/workspaces/yamabiko-blocks
```

別の環境が追加されている場合は、次のコマンドで切り替えます。

```text
Dev Containers: Switch Container
```

設定やDockerfileを変更した後は、用途に応じて次を使用します。

```text
Dev Containers: Rebuild Container
Dev Containers: Rebuild Container Without Cache
```

## WordPressを開く

コンテナ起動後、次へアクセスします。

```text
http://127.0.0.1:8080
```

初回はWordPressのインストール画面が表示されます。`environments/wp702-default.env`にあるサイトURL、管理者情報、エディターモードは将来のセットアップ自動化用であり、現時点では自動適用されません。

プラグインソースの`app/`は、コンテナ内の次の場所へ直接mountされます。

```text
/var/www/html/wp-content/plugins/yamabiko-blocks
```

WordPress管理画面で「Yamabiko Blocks」を有効化してください。

## 環境の停止と初期化

`shutdownAction`は`none`です。VS Codeを閉じたりローカルウィンドウへ戻したりしても、Compose環境は自動停止しません。

停止はVS CodeのDocker拡張機能から対象Composeプロジェクトを停止するか、リポジトリルートでDocker Compose標準コマンドを実行します。

```bash
docker compose -f .devcontainer/wp702-default/compose.yaml down
```

Compose設定を確認する場合は次を実行します。

```bash
docker compose -f .devcontainer/wp702-default/compose.yaml config
```

WordPress、DB、Codex、GitHub CLI設定を含む環境データを完全に削除して初期化する場合は、volumeも削除します。

```bash
docker compose -f .devcontainer/wp702-default/compose.yaml down --volumes
```

> `--volumes`を付けると、WordPress本体・アップロード・DB・Codexセッション・GitHub CLI認証など、その環境の永続データが削除されます。

## 永続化されるデータ

環境ごとにCompose project名が異なるため、次のnamed volumeも環境単位で分離されます。

| Volume | 保存内容 |
| --- | --- |
| `wordpress_data` | WordPress本体、テーマ、アップロードなど |
| `db_data` | MariaDBデータ |
| `codex_data` | Codexの認証・設定・セッション |
| `gh_config` | GitHub CLIの認証・設定 |

`app/`とリポジトリ全体はhost側からbind mountされるため、ソースコードはnamed volumeには保存されません。

## PHP設定

開発用設定は次のファイルで管理します。

```text
.devcontainer/shared/php/php.ini
.devcontainer/shared/php/xdebug.ini
```

`php.ini`はコンテナ内で`zz-development.ini`として読み込まれ、WordPress公式イメージの既定値より後から適用されます。主な設定は次のとおりです。

- `memory_limit = 1024M`
- `upload_max_filesize = 256M`
- `post_max_size = 300M`
- エラー表示とログを有効化
- OPcacheを有効化し、開発中のファイル変更を即時検出
- realpath cacheの保持時間を無効化

反映状況はコンテナ内で確認できます。

```bash
php --ini
php -r 'echo ini_get("memory_limit"), PHP_EOL;'
php -r 'echo ini_get("upload_max_filesize"), PHP_EOL;'
php -r 'echo ini_get("post_max_size"), PHP_EOL;'
```

## Xdebug

Xdebugはポート`9003`で、明示的なtriggerがあるリクエストだけをデバッグします。

1. VS Codeの「実行とデバッグ」から`Listen for Xdebug`を開始する
2. ブラウザー拡張機能、Cookie、クエリーパラメーターなどで`XDEBUG_TRIGGER`を有効にする
3. WordPressへアクセスする

CLIでは次のようにtriggerできます。

```bash
XDEBUG_TRIGGER=1 php path/to/script.php
```

コンテナ内のプラグインpathは、VS Code上の`app/`へmappingされています。

## CodexとGitHub CLI

Codexのデータは`/var/www/.codex`、GitHub CLIの設定は`/var/www/.config/gh`へ保存され、それぞれnamed volumeで永続化されます。

Codexの静的hook設定はイメージ内を正本とし、コンテナ起動時に`CODEX_HOME`へ同期されます。VS Code統合ターミナルを開くとTTYが自動記録され、Codexの権限要求、tool実行前、応答終了時に通知音を鳴らします。

### Codexデータのバックアップ

コンテナ内で次を実行します。

```bash
bash .devcontainer/shared/scripts/ai-tool-data.sh --backup
```

バックアップは既定で次へ作成されます。

```text
.devcontainer/shared/scripts/ai-tool-data-backup.tar.gz
```

同名ファイルがある場合は上書きしません。バックアップには認証情報やセッションが含まれる可能性があるため、公開・共有・コミットしないでください。

Dev Container作成後の`postCreateCommand`では、バックアップが存在し、復元先に既存データがない場合に限って自動復元します。手動で復元する場合は次を実行します。

```bash
bash .devcontainer/shared/scripts/ai-tool-data.sh --restore
```

## シェル補助

Dev Container作成時にBash設定が追加され、次の移動コマンドを利用できます。

| コマンド | 移動先 |
| --- | --- |
| `cdw` | ワークスペースルート |
| `cdapp` | `app/` |
| `cdwp` | WordPressルート |
| `cdplugins` | WordPressプラグインディレクトリ |
| `cdthemes` | WordPressテーマディレクトリ |
| `cduploads` | WordPress uploadsディレクトリ |

## 環境の追加

新しい環境では、共通Dockerfileや共通Composeを複製せず、次のファイルだけを追加します。

```text
environments/<environment-name>.env
.devcontainer/<environment-name>/compose.yaml
.devcontainer/<environment-name>/devcontainer.json
```

手順は次のとおりです。

1. `environments/wp702-default.env`を複製する
2. ファイル名と`ENVIRONMENT_NAME`を一致させる
3. `COMPOSE_PROJECT_NAME`を一意にする
4. 未使用の`WORDPRESS_PORT`を選び、`WORDPRESS_SITE_URL`も合わせる
5. WordPressイメージ、DB情報、UID/GID、timezone、localeを必要に応じて変更する
6. `.devcontainer/wp702-default/`を複製し、環境名、表示名、参照するenvファイルを変更する
7. `docker compose -f .devcontainer/<environment-name>/compose.yaml config`で構成を確認する
8. `Dev Containers: Reopen in Container`または`Dev Containers: Switch Container`で環境を選択する

環境ごとの`compose.yaml`は、Docker Compose標準の`include`と`env_file`で共通Composeを参照します。

```yaml
include:
  - path: ../../docker/compose.environment.yaml
    env_file: ../../environments/wp702-default.env
```

環境追加時に、共通Compose、共通Dockerfile、プラグインソースへ環境名ごとの分岐を追加する必要はありません。

## ディレクトリ構成

```text
.
├── .devcontainer/
│   ├── shared/                  # 全環境共通のDockerfile・設定・スクリプト
│   └── wp702-default/           # 基準環境のDev Container設定
├── .vscode/                     # Chrome・Xdebugの起動設定
├── app/                         # WordPressプラグインソース
├── docker/                      # 共通Composeテンプレート
├── docs/
│   ├── development/             # 開発全体の契約
│   └── plans/                   # 機能計画テンプレート
├── environments/                # 環境ごとの変数定義
├── AGENTS.md                    # AI開発時の作業規約
└── README.md
```

## 開発方針

開発全体の境界、命名、WordPressライフサイクル、セキュリティ、アクセシビリティ、依存関係の方針は、次を参照してください。

- [`docs/development/foundation.md`](docs/development/foundation.md)
- [`docs/plans/TEMPLATE.md`](docs/plans/TEMPLATE.md)

Docker socketをコンテナへmountしているため、Dev Container内のプロセスはhost Dockerを操作できる強い権限を持ちます。この構成はローカル開発用途に限定してください。
