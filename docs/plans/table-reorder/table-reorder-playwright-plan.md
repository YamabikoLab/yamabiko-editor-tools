# Table Reorder Playwright テスト実装プラン

## 1. 文書情報

| 項目 | 内容 |
|---|---|
| 対象Issue | #118 |
| 親Issue | #116 |
| 後続Issue | #119 |
| 対象 | `table-reorder-controller.tsx` リファクタリング前の Playwright E2E テスト整備 |
| 目的 | リファクタリング前の主要なユーザー操作を、必要最小限の実ブラウザテストで固定する |

## 2. 目的

`src/editor-extensions/table-reorder/table-reorder-controller.tsx` の責務分割に入る前に、Jestでは保証しにくい実ブラウザ上の振る舞いを Playwright で固定する。

本プランでは E2E を網羅テストにせず、#119 のリファクタリングで壊れやすい次の境界だけを防護柵として確認する。

- 並べ替えモード開始時のフォーカス
- キーボードによる開始、移動、確定、キャンセル
- DOM更新後の行順とフォーカス維持
- ポインターDnDによる基本的な行移動
- 長距離キーボード移動時の必要最小限のスクロール追従
- iframe / non-iframe の編集環境差

純粋ロジックや細かな境界条件は #117 の Jest テストを正とし、Playwright で重複して検証しない。

## 3. 基本方針

- ユーザーから見える振る舞いを検証する。
- テスト本数を増やしすぎず、主要フローを一つのシナリオへまとめる。
- `@wordpress/e2e-test-utils-playwright` が提供する fixture / helper を優先する。
- iframe / non-iframe の切り替えや canvas 取得を各テストへ散らさない。
- Gutenberg内部DOM、一時class、React state、dnd-kit内部状態へ過度に依存しない。
- 固定時間の `waitForTimeout()` でタイミング問題を隠さない。
- CSSアニメーションや座標の厳密値を完了条件にしない。
- テストのために本体仕様を変更しない。

## 4. 実装対象

### 4.1 Table Reorder E2E の共通準備

`tests/e2e/table-reorder.spec.ts` を基本とする。

必要な場合だけ、小さなテストヘルパーを `tests/e2e/` 配下へ切り出す。

共通化する候補は次のとおり。

1. 新規投稿を開く。
2. iframe / non-iframe を切り替える。
3. テスト用の Core Table ブロックを設定する。
4. 対象 editor canvas を取得する。
5. Table ブロックを選択する。
6. ブロックツールバーを表示する。
7. 「行を並べ替え」を有効にする。

共通化は重複を減らす範囲に留め、E2E専用の大きな抽象化層は作らない。

### 4.2 キーボード主要フロー

#### 対象環境

- iframe
- non-iframe

#### テストデータ

3〜4行程度の単純な `tbody` を持つ Table を使用する。

行は `Row 1`、`Row 2` のように、並び順を画面上の内容から判定できるデータにする。

#### 操作

1. 中間行のセルへフォーカスする。
2. 並べ替えモードをONにする。
3. 対応する本文行のハンドルへ初期フォーカスが移ることを確認する。
4. `Enter` でキーボード並べ替えを開始する。
5. `ArrowDown` または `ArrowUp` で一行移動する。
6. `Escape` でキャンセルする。
7. 行順が変更されていないことを確認する。
8. 対象行のハンドルへフォーカスが維持されていることを確認する。
9. 同じ行で再度キーボード並べ替えを開始する。
10. 一行移動する。
11. `Enter` または `Space` で確定する。
12. Table の実際の行順が変更されたことを確認する。
13. 移動した同じ行のハンドルへフォーカスが維持されていることを確認する。

#### このシナリオで固定する振る舞い

- 並べ替えモード開始時の初期フォーカス
- `Enter` / `Space` による開始と確定
- `ArrowUp` / `ArrowDown` による一行移動
- `Escape` によるキャンセル
- キャンセル時に行データを変更しないこと
- 確定時に実際の行データが変更されること
- DOM更新後も操作対象行のフォーカスを維持すること

### 4.3 ポインターDnD主要フロー

#### 対象環境

- iframe
- non-iframe

#### 操作

1. 単純な Table を表示する。
2. 並べ替えモードをONにする。
3. 中間行のハンドルからドラッグを開始する。
4. 別の本文行へ移動する。
5. ドロップする。
6. Table の実際の行順が変更されたことを確認する。

#### 検証方針

最終的な行順を主要な期待値とする。

次の内部表現は原則として検証しない。

- DragOverlay のDOM構造
- 一時的な `is-dragging` class
- `transform` / `opacity` の具体値
- insertion indicator の内部状態
- dnd-kit の source / target オブジェクト

Playwright のドラッグ操作が環境依存で不安定になる場合は、固定waitや内部イベント注入で無理に成立させず、原因を報告する。

### 4.4 長距離キーボード移動時のスクロール追従

#### 対象環境

まず iframe のみ1ケースとする。

non-iframe まで同じケースを複製するのは、環境差による回帰が実際に確認された場合に限る。

#### テストデータ

画面内に収まらない程度の行数を持つ Table を使用する。

目安は20〜30行程度とする。

#### 操作

1. 上部の行からキーボード並べ替えを開始する。
2. `ArrowDown` を複数回押して画面外の移動先へ進める。
3. 現在の移動先が viewport 内へ追従して表示されることを確認する。
4. 操作対象ハンドルのフォーカスが失われていないことを確認する。

#### 注意

座標やスクロール量の厳密値は確認しない。

「利用者が現在の移動先を確認でき、キーボード操作を継続できる」という振る舞いだけを固定する。

このケースがブラウザタイミングへ強く依存して安定しない場合は、本Issueで無理に残さず、原因と再現条件を報告する。

## 5. iframe / non-iframe のテスト範囲

| シナリオ | iframe | non-iframe |
|---|:---:|:---:|
| キーボード主要フロー | ✅ | ✅ |
| ポインターDnD主要フロー | ✅ | ✅ |
| 長距離スクロール追従 | ✅ | 原則省略 |

同じ振る舞いを確認するだけのケースを機械的に二重化しない。

## 6. セレクター方針

セレクターは次の優先順位で選ぶ。

1. role と accessible name
2. Table 内に表示される行内容
3. `@wordpress/e2e-test-utils-playwright` の helper
4. 安定した公開DOMが必要な場合のみ限定的な selector

次のような内部実装依存を、主要な期待値やテスト操作の中心にしない。

- `.is-keyboard-reordering`
- `.is-dragging`
- `data-table-reorder-row-id`
- React内部state
- 一時的な inline style
- dnd-kit 固有の内部DOM

ハンドルを識別する必要がある場合は、まず button role と accessible name を利用する。

## 7. #117 Jest テストとの境界

次の内容は原則として Playwright で細かく再検証せず、#117 の Jest テストへ任せる。

- keyboard reorder の細かな状態遷移
- insertion index の計算
- 先頭 / 末尾判定
- rowspan range の計算
- non-movable row の算出
- drag session の候補計算
- commit / cancel の純粋ロジック
- drag visuals の内部計算

Playwright では、それらを組み合わせた最終的なユーザー操作がブラウザ上で成立することだけを確認する。

## 8. 本Issueで追加しないテスト

次は #118 の必須範囲から外す。

- Tab / Shift+Tab の全パターン
- 先頭・末尾境界の全パターン
- rowspan 制約の全パターン
- `thead` / `tfoot` の網羅ケース
- Undo の詳細検証
- instruction UI のCSS値
- ARIA live region の文言全文一致
- DragOverlay の見た目
- insertion indicator の表示位置詳細
- full-width 固有の見た目
- hoverによるモード切替の網羅テスト
- セル編集復帰の全パターン
- reload直後のフォーカス特殊ケース
- Gutenberg内部DOM構造そのものの検証

既存不具合の再発防止として必須だと判明した場合は、理由を明示したうえで最小ケースだけ追加する。

## 9. 実装順序

1. 現在の `tests/e2e` と Playwright 設定を確認する。
2. `@wordpress/e2e-test-utils-playwright` で利用できる既存fixture / helperを確認する。
3. iframe / non-iframe 共通の最小準備を作る。
4. キーボード主要フローを iframe で成立させる。
5. 同じフローを non-iframe で確認する。
6. ポインターDnD主要フローを iframe で成立させる。
7. 同じフローを non-iframe で確認する。
8. 必要最小限の長距離スクロール追従ケースを iframe で追加する。
9. 重複したsetupや実装詳細依存を整理する。
10. 対象E2Eと既存の非破壊チェックを実行する。

## 10. 不具合を発見した場合

テストを通すために本体実装の仕様変更を行わない。

本Issueの目的は、現在の仕様に沿った主要な振る舞いを Playwright で固定することである。

実装中に次のいずれかを発見した場合は、期待値を都合よく変更したり本体を修正したりせず、再現条件と観測結果を報告する。

- 要件と現在の実装が一致していない
- iframe と non-iframe で振る舞いが異なる
- 現在の実装に既存不具合がある
- Playwright から安定して操作できないブラウザ依存がある
- テストを成立させるために本体修正が必要になる

必要であれば別Issueとして切り出し、#118 のスコープを膨らませない。

## 11. 検証

作業中は対象を絞って実行する。

```bash
npm run test:e2e -- tests/e2e/table-reorder.spec.ts
```

実装完了前に、該当する非破壊チェックを実行する。

```bash
npm run format:check
npm run lint:js
npm run lint:css
npm run typecheck
npm run test:unit
npm run build
git diff --check origin/main...HEAD
```

互換性のある `wp-dev` WordPress 環境が利用できる場合は、最後に全E2Eを確認する。

```bash
npm run test:e2e
```

環境依存で実行できないチェックがある場合は、未実行理由を明記する。

## 12. 完了条件

- [ ] キーボードの主要フローが必要最小限のE2Eで固定されている
- [ ] ポインターDnDの基本的な行移動がE2Eで固定されている
- [ ] 必要な範囲で iframe / non-iframe の両方を確認できている
- [ ] 必要最小限のスクロール追従・フォーカス維持を確認できている
- [ ] Jestで保証する内容との重複が抑えられている
- [ ] DOM内部実装や一時classへの過度な依存がない
- [ ] 固定waitや不安定な座標依存を追加していない
- [ ] #119 の責務分割後にも同じテストを回帰確認へ再利用できる
- [ ] 本Issueのために Table Reorder 本体の仕様変更を行っていない
