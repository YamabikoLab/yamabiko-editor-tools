# PLAN-414: PR Validation に Playwright E2E を追加する

## References

- Parent issue: #414
- Requirements: `docs/requirements/table-reorder/table-reorder-requirements.md`
- Design: `docs/design/table-reorder/table-reorder-design.md`

## Goal

Core Table を対象に整備済みの Playwright E2E を PR Validation の品質ゲートとして実行し、実 WordPress / Gutenberg / Chromium の統合回帰を検知できるようにする。

## Scope

### Included

- PR Validation に独立した E2E job を追加する。
- CI 専用の最小 WordPress / MariaDB 環境を Docker Compose で起動する。
- WordPress を WP-CLI で初期化し、Yamabiko Editor Tools を有効化する。
- Playwright 1.62.1 の公式 Docker image で既存 E2E を実行する。
- 失敗時の Playwright report / trace / screenshot / video を artifact として保存する。
- CI とローカル開発環境の責務を開発ドキュメントへ反映する。

### Not included

- Flexible Table Block E2E の追加。
- Android E2E の追加。
- 複数 WordPress バージョンや iframe / non-iframe の常時 matrix 化。
- `wp-dev` の CI 用 image 配布基盤の追加。
- 製品コードや既存 E2E シナリオの変更。

## Approach

ローカル WordPress 環境の正本は引き続き `YamabikoLab/wp-dev` とする。一方、GitHub-hosted Actions では外部リポジトリの Dev Container を build せず、CI に必要な最小構成だけをこのリポジトリの `tests/e2e/compose.ci.yaml` に定義する。

WordPress 7.1.0 / PHP 8.3、MariaDB 12.3、WP-CLI 2.12.0 を固定する。Playwright は `package.json` の `@playwright/test` 1.62.1 と一致する `mcr.microsoft.com/playwright:v1.62.1-noble` を使い、CI ごとの `playwright install --with-deps chromium` を避ける。

## Architecture

- `.github/workflows/pr-validation.yml`
  - Node / PHP と独立した E2E job を起動する。
  - npm dependencies と production build を準備する。
  - Docker Compose で WordPress / DB を起動する。
  - WP-CLI で WordPress 初期化と plugin activation を行う。
  - Playwright 公式 image から E2E を実行する。
  - 失敗 artifact を保存し、最後に Docker resources を破棄する。
- `tests/e2e/compose.ci.yaml`
  - MariaDB、WordPress、WP-CLI の CI 専用最小構成を定義する。
  - repository root を plugin directory へ read-only bind mount する。
- `docs/development/testing.md`
  - GitHub-hosted PR Validation の E2E 実行境界を記録する。

## Implementation phases

### Phase 1: CI WordPress environment

- Outcome: GitHub Actions runner 上で再現可能な WordPress 環境を起動できる。
- Tasks:
  - CI 用 Docker Compose を追加する。
  - DB healthcheck と HTTP readiness polling を利用する。
  - WP-CLI で WordPress を初期化し plugin を有効化する。
- Validation:
  - Docker Compose の構文と service 定義を確認する。

### Phase 2: Playwright E2E job

- Outcome: PR Validation から既存 E2E を実行できる。
- Tasks:
  - E2E job を Node / PHP と独立して追加する。
  - Playwright 1.62.1 公式 image を利用する。
  - `workers: 1` の既存設定を維持する。
  - 失敗 artifact と cleanup を追加する。
- Validation:
  - GitHub-hosted Actions を最終的な CI 判定とする。

### Phase 3: Documentation

- Outcome: ローカル E2E と CI E2E の責務が明確になる。
- Tasks:
  - `docs/development/testing.md` を更新する。
- Validation:
  - 記載内容が実際の workflow / compose と一致していることを確認する。

## Decisions and validation questions

### Decide before implementation

- Playwright browser は独自 cache ではなく公式 Docker image を使う。
- CI WordPress 環境は `wp-dev` image の都度 build ではなく公式 image の組み合わせで構成する。
- E2E job は Node / PHP job から独立させる。
- 最初の CI 対象は代表 WordPress 環境 1 つに限定する。

### Validate during implementation

- Docker image pull を含む E2E job の総実行時間が許容範囲か。
- GitHub-hosted runner 上で WordPress readiness と WP-CLI 初期化が安定するか。
- 失敗時 artifact が調査に十分か。

## Issue breakdown

- [x] #414 を単一の実装単位として扱う。

## Validation

- `git diff --check origin/main...HEAD`
- `npm test`
- `npm run build`
- GitHub-hosted PR Validation の E2E job

実際の E2E 実行検証は GitHub-hosted Actions を正とし、利用者が実施する。

## Completion criteria

- PR Validation に独立 E2E job がある。
- WordPress / DB / WP-CLI の CI 環境が再現可能である。
- Playwright browser の毎回 install を行わない。
- 既存 Core Table E2E を実行する構成になっている。
- 失敗 artifact と cleanup が定義されている。
- 開発ドキュメントが構成と一致している。

## Notes

CI 専用 Compose はローカル WordPress 開発環境の代替ではない。ローカル開発では引き続き `wp-dev` を利用する。
