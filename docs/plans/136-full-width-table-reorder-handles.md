# PLAN-136: 全幅 Table の並べ替えハンドル位置修正

## References

- Parent issue: #136
- Requirements: Issue #136
- Design: Existing table-reorder implementation

## Goal

全幅 Table で明示的に行の並べ替えモードを開始した後も、キーボード操作によって行ハンドルが表示領域外へ移動しないようにする。

## Scope

### Included

- 全幅 Table の回帰を検出する Playwright E2E テスト
- 調査で特定した、行ハンドルの位置ずれだけを修正する最小の実装変更
- 関連する既存テストと品質チェック

### Not included

- Issue #136 で確認されていないキーボード並べ替え機能の変更
- 通常幅 Table の動作変更

## Approach

先に全幅 Table の並べ替えモードで、初期フォーカス後と `Tab`、`Shift+Tab`、`Enter`、`Space` の後にハンドルが画面内かつ対象行の位置にあることを検証する E2E テストを追加する。現行実装で失敗することを確認してから、DOM、フォーカス、座標を観察して原因を限定する。回帰テストの期待値は修正後に変更せず、実装側で GREEN にする。

## Implementation phases

### Phase 1: 回帰の固定と原因特定

- Outcome: 現象を再現する E2E テストと、FAIL 時の DOM・フォーカス・座標の観察結果
- Tasks: 全幅 Table の明示的な並べ替えモードを操作するテストを追加し、現行実装で実行する
- Validation: 追加したテストが FAIL し、失敗内容から表示位置の問題を確認できる

### Phase 2: 最小修正と検証

- Outcome: ハンドルがキーボード操作後も適切な位置に残る
- Tasks: 原因となる位置計算または全幅時の座標系だけを修正する
- Validation: 同じ回帰 E2E テストが PASS し、既存 E2E と Node.js 品質チェックが成功する

## Validation

- `npm run test:e2e -- tests/e2e/table-reorder/keyboard.spec.ts --grep "full-width"`: 修正前は FAIL、修正後は PASS
- `npm run test:e2e`: 既存の通常幅・iframe・non-iframe を含む E2E が PASS
- `npm test`: JavaScript / TypeScript / SCSS の品質チェックが PASS
- `npm run build`: 本番ビルドが成功
- `git diff --check origin/main...HEAD`: 変更行の空白エラーがない

## Completion criteria

- 全幅 Table の回帰 E2E が修正前に不具合を検出し、修正後に変更なしで PASS する
- キーボード操作後もハンドルが画面内で対象行に対応する位置にある
- 通常幅と既存の iframe / non-iframe 動作に回帰がない
