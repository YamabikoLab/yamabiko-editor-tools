# GitHub CLI

開発用Dev Containerには、GitHub CLI（`gh`）を公式APTリポジトリから導入します。
CI専用の軽量イメージには、ワークフロー内で必要な場合を除いて導入しません。

## 利用確認

Dev Containerをrebuildした後、次を実行します。

```bash
gh --version
gh auth status
```

未認証の場合、`gh auth status`は非ゼロで終了します。
`gh --version`が成功すれば、GitHub CLI自体は利用できます。

## 認証

認証情報やトークンをDockerfile、Dockerイメージ、Git管理対象へ埋め込んでは
いけません。Dev Container内で実行時に認証します。

```bash
gh auth login
```

通常は次を選択します。

1. `GitHub.com`
2. `HTTPS`
3. ブラウザーを使った認証

認証後、状態を確認します。

```bash
gh auth status
```

必要に応じて、GitのHTTPS通信にもGitHub CLIの認証を使用します。

```bash
gh auth setup-git
```

ログアウトする場合は次を実行します。

```bash
gh auth logout
```

## 認証状態の永続化

Dev Containerでは`GH_CONFIG_DIR=/var/www/.config/gh`を設定し、
`gh_config` Docker volumeをマウントします。

そのため、通常のDev Container再オープンやrebuildでは認証状態が維持されます。

このvolumeには認証情報が含まれます。共有、公開、リポジトリへのコピー、
不要なバックアップへの混入を避け、秘密情報として扱ってください。

### 認証volumeだけを削除する

先にDev Containerを停止し、`gh_config`に対応する実際のvolume名を確認します。

```bash
docker volume ls --filter label=com.docker.compose.volume=gh_config
```

表示されたvolume名を指定して削除します。

```bash
docker volume rm <gh-config-volume-name>
```

Composeのプロジェクト名が`yamabiko-blocks`の場合、volume名は通常
`yamabiko-blocks_gh_config`のようになります。ただし、実際の名前は必ず
`docker volume ls`で確認してください。

認証情報だけを削除する目的で、次を実行してはいけません。

```bash
docker compose down -v
```

このコマンドは、同じCompose構成に含まれるデータベースやWordPressデータなど、
他のvolumeも削除する可能性があります。

## セキュリティ境界

- `GH_TOKEN`や`GITHUB_TOKEN`をDockerfileへ記述しない
- トークンを`.env`へ保存する場合もGit管理対象にしない
- 認証済み設定をリポジトリへコピーしない
- `~/.config/gh`や`GH_CONFIG_DIR`の内容をDockerイメージへ`COPY`しない
- コマンド出力やログへトークンを表示しない
- PCやDocker volumeを共有、譲渡、廃棄する前にログアウトするか、
  `gh_config` volumeだけを削除する

## よく使う例

```bash
# Issueを表示
gh issue view 4

# PR一覧を表示
gh pr list

# 現在のブランチに対応するPRを表示
gh pr view

# 手動ワークフローを実行
gh workflow run "Pre-merge CI" --ref <branch-name>

# 実行状況を確認
gh run list --workflow "Pre-merge CI" --limit 10

# 最新実行の詳細を表示
gh run view

# 実行完了まで監視
gh run watch

# Rulesetを確認
gh api repos/{owner}/{repo}/rulesets --paginate
```

リポジトリを明示する必要がある場合は、各コマンドへ
`--repo YamabikoLab/yamabiko-blocks`を付けます。
