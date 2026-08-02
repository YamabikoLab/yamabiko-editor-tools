# GitHub CLI

GitHub CLI（`gh`）を使用します。ローカル開発環境での導入方法は、分離された `YamabikoLab/wp-dev` リポジトリの手順に従ってください。

## 利用確認

```bash
gh --version
gh auth status
```

未認証の場合は、`gh` が利用できる端末で認証します。

```bash
gh auth login
```

通常はGitHub.com、HTTPS、ブラウザー認証を選択します。必要に応じてGitのHTTPS通信にも認証を設定します。

```bash
gh auth setup-git
```

## 認証情報

- トークンや認証済み設定をこのリポジトリまたは `YamabikoLab/wp-dev` リポジトリへコミットしない
- 認証情報の保存場所と管理方法は、利用している開発環境の手順に従う

通常のログアウトは次で行います。

```bash
gh auth logout
```

## よく使うコマンド

```bash
# Issueを表示
gh issue view <issue-number>

# PRを表示
gh pr view <pr-number>

# PR一覧を表示
gh pr list

# 手動検証ワークフローを実行
gh workflow run "PR Validation" --ref <branch-name>

# ワークフローの実行状況を確認
gh run list --workflow "PR Validation" --limit 10
```

必要な場合は`--repo YamabikoLab/yamabiko-editor-tools`を付けて対象リポジトリを明示します。
