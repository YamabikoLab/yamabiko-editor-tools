# PLAN-283: Table Reorder 不要コード整理

## References

- Parent issue: #283
- Parent refactoring: #275
- Investigation result: #283 comment `5306191201`
- Knip introduction: #284 / PR #285
- Related refactoring: #269 / #271 / #276 / #278 / #281
- Validation guidance: `docs/development/testing.md`

## Goal

`src/editor-extensions/table-reorder/` 全体を対象に、#283 の調査結果で既存挙動を変えずに削除できることが確認できた低リスクの不要コードだけを整理する。

今回の目的は API surface を機械的に最小化することではない。production consumer、test consumer、DOM / CSS / ARIA、WordPress / Gutenberg、SortableJS の間接契約を維持したまま、役割を失った引数・計算・戻り値 property・公開 type / re-export・重複処理を除去する。

focused test の観測境界や明示的な内部契約として意味を持つ export / property は、削除効果が小さい限り本 Issue では維持する。ただし、production で不要な property を test の観測だけのために公開しており、同じ挙動を DOM 上の結果から直接確認できる場合は、production API を狭めて test を DOM query へ切り替える。

## Scope

### Included

- `createReorderGuidance()` の未使用 `sourceControl` を削除する。
- `RowMoveTargetsOptions.sourceControl` と、そのためだけの呼び出し側引数を削除する。
- `scrollKeyboardDestinationIntoView()` の未使用 `direction` / `nextInsertionIndex` を削除する。
- `nextInsertionIndex` を作るためだけに存在する `followingIndex` と余分な `getRowMoveInsertionIndex()` 呼び出しを削除する。
- `ReorderGuidanceUi.setPosition` を公開 surface から外し、内部 implementation としてだけ残す。
- `ReorderGuidancePosition` の export / facade re-export を削除し、module 内部型へ狭める。
- `onControlPointerDown()` 内の重複 `suppressBlockDrag()` を削除する。
- `RowControlEntry.handle` の未使用 property を削除する。
- `InsertionLine.element` の test 専用 property を削除し、`drag-ui.test.ts` は insertion line DOM を query して接続状態と `style.top` を検証する。
- repo 内 production consumer が型名を import していない次の type export を module private にする。
  - `InsertionLine`
  - `RowControlOptions`
  - `RowControls`
  - `RowMoveTargetsOptions`
  - `RowMoveConstraints`
  - `RowspanRange`
  - `MoveDirection`
- `controller/reorder-ui/index.ts` から不要な facade re-export を削除する。
  - `DESTINATION_CLASS`
  - `ReorderGuidancePosition`
  - `RowControlOptions`
  - `RowControls`
  - `RowMoveTargetsOptions`
- 上記変更に伴う import、型注釈、test fixture、互換コメントを必要最小限で整理する。
- `npm run knip` で #283 が対象とする既知の不要 export / exported type が解消したことを確認する。

### Not included

- `TableContext.table` の削除。
- `findBlockElement` の private 化。
- `DESTINATION_CLASS` 自体の private 化または削除。
- `SORTABLE_SCRIPT_ID` の private 化または削除。
- test harness だけが型として import している次の export の整理。
  - `SortableRuntime`
  - `SortableControllerOptions`
  - `UseTableReorderOptions`
  - `TableReorderHookResult`
- DOM / CSS / `data-*` / ARIA 契約の変更。
- SortableJS option / class 契約の変更。
- Gutenberg / WordPress integration の変更。
- keyboard / pointer / touch / drag の操作仕様変更。
- scroll / gesture / row move algorithm の再設計。
- controller session / lifecycle の再設計。
- module 境界の追加再編。
- 新しい abstraction、helper、state 管理ライブラリの導入。
- Knip の結果をゼロにするためだけの ignore 追加。

## Approach

### 1. 削除対象を「挙動に影響しないもの」に固定する

実装開始時点では、#283 の調査コメントで低リスクと判断済みの候補と、その後に個別確認して低リスクと判断した `InsertionLine.element` だけを対象にする。

本 Issue では「production consumer がない」という理由だけで削除しない。test seam、DOM / CSS / ARIA、Gutenberg、SortableJS の境界として意味を持つ候補は原則維持する。

一方、`InsertionLine.element` のように test が production の内部 DOM 参照を戻り値経由で取得するためだけの property は、production API に残さない。生成・表示・cleanup の結果を既存 DOM class から直接観測できる場合は、focused test を DOM query に変更して API surface を縮小する。

これにより、test の検証内容は維持しつつ、test 都合だけで production API を広げない。

### 2. 未使用引数と派生計算を入口から除去する

`createReorderGuidance()` の `sourceControl` は実装で参照されていないため、次を一つの変更単位として整理する。

```text
sortable-controller.ts
  └─ sourceControl を渡さない

row-move-targets.ts
  ├─ RowMoveTargetsOptions.sourceControl を削除
  └─ createReorderGuidance() へ sourceControl を渡さない

reorder-guidance.ts
  └─ createReorderGuidance(..., sourceControl?) を削除
```

`row-move-targets.test.ts` の fixture も、挙動を観測していない `sourceControl` だけ削除する。

同様に `scrollKeyboardDestinationIntoView()` は現在の `insertionIndex` だけで scroll 判定が完結しているため、未使用の `direction` / `nextInsertionIndex` を API から除去する。

その結果として不要になる `sortable-controller.ts` の `followingIndex` と、`nextInsertionIndex` 算出用の追加 `getRowMoveInsertionIndex()` 呼び出しも削除する。

`getNextValidRowMoveIndex()` 自体は keyboard 移動先探索で必要なため維持する。

### 3. guidance の公開 surface だけを縮小する

`ReorderGuidanceUi.setPosition` は外部 consumer がなく、position 更新は `createReorderGuidance()` 内の listener だけで完結している。

次の形に整理する。

```text
ReorderGuidanceUi
├─ element
├─ setHidden
└─ cleanup
```

内部の `setPosition()` は keyboard guidance の top / bottom 切り替えに必要なため削除しない。

`ReorderGuidancePosition` は export を外し、同 module 内でのみ使う private type とする。

### 4. controller / row control の明確な不要 surface を削る

`onControlPointerDown()` は `activateEntry()` の内部ですでに `suppressBlockDrag()` が実行されるため、その直後の重複呼び出しだけ削除する。

`RowControlEntry.handle` は外部 consumer がないため return property から外す。

ただし `.yamabiko-table-reorder-handle` DOM element 自体と、生成時の defensive check は CSS / Icon / UI 契約として必要なため維持する。

### 5. `InsertionLine.element` を test 専用 API から外す

`InsertionLine.element` は production consumer がなく、`drag-ui.test.ts` が insertion line の DOM 接続状態と `style.top` を直接確認するためだけに利用している。

production が必要とする `InsertionLine` の契約は次だけに狭める。

```text
InsertionLine
├─ hide
├─ show
└─ cleanup
```

`createInsertionLine()` が生成する `.yamabiko-table-reorder-insertion-line` DOM 自体、位置計算、scroll / resize listener、`hide()` / `show()` / `cleanup()` の挙動は変更しない。

`drag-ui.test.ts` は既存 class を `document.querySelector()` で取得し、次の既存 contract を引き続き確認する。

- create 後に insertion line が document に接続されている。
- `show()` 後および editor scroll 後に `style.top` が更新される。
- `cleanup()` 後に insertion line が document から削除されている。

このテストのために `INSERTION_LINE_CLASS` を新たに export しない。local focused test は既存 DOM class literal を selector として利用し、test 都合で production API を増やさない。

### 6. 実装内部専用 type の export を狭める

次の type は実装内部で必要だが、repo 内 production consumer が型名を import していないため、export keyword だけを外す。

```text
controller/drag-ui.ts
└─ InsertionLine

controller/reorder-ui/row-controls.ts
├─ RowControlOptions
└─ RowControls

controller/reorder-ui/row-move-targets.ts
└─ RowMoveTargetsOptions

controller/row-order.ts
└─ RowMoveConstraints

rowspan.ts
└─ RowspanRange

messages.ts
└─ MoveDirection
```

型そのものや runtime logic は変更しない。

### 7. `reorder-ui` facade の互換 re-export を整理する

#278 / #281 では責務分割・配置変更と consumer 依存整理を同時に行わないため、意図的に facade API を広く維持した。

#283 ではその互換期間を終え、現在の consumer が利用していない次の re-export を外す。

```text
DESTINATION_CLASS
ReorderGuidancePosition
RowControlOptions
RowControls
RowMoveTargetsOptions
```

`DESTINATION_CLASS` は facade からの再公開だけを外す。`row-move-targets.ts` 内の定数と destination DOM / CSS class は維持する。

## Architecture

今回の変更は module responsibility を再編しない。既存構造のまま、不要 surface だけを縮小する。

```text
use-table-reorder / interaction
          │
          ▼
sortable-controller.ts
          │
          ▼
controller/reorder-ui/index.ts  ← facade surface を必要分だけに縮小
          │
          ├─ row-controls.ts
          ├─ reorder-guidance.ts
          ├─ row-move-targets.ts
          └─ live-status.ts
```

依存方向や UI lifecycle の所有 module は変更しない。

## Implementation phases

### Phase 1: 未使用引数・派生計算の除去

- Outcome:
  - `sourceControl` 系 API と keyboard scroll の未使用引数・派生計算が消えている。
- Tasks:
  - `createReorderGuidance()` から `sourceControl` を削除する。
  - `RowMoveTargetsOptions.sourceControl` を削除する。
  - controller / row move targets / test fixture の引数を追従させる。
  - `scrollKeyboardDestinationIntoView()` から `direction` / `nextInsertionIndex` を削除する。
  - `followingIndex` と追加 `getRowMoveInsertionIndex()` 呼び出しを削除する。
- Validation:
  - guidance / row move targets / sortable controller の focused unit test。
  - keyboard destination scroll の既存挙動が変わらないことを既存 test で確認する。

### Phase 2: 不要な公開 property / facade API の縮小

- Outcome:
  - runtime behavior を変えずに、guidance / row control / drag UI / facade の不要 surface が減っている。
- Tasks:
  - `ReorderGuidanceUi.setPosition` を public return shape から削除する。
  - `ReorderGuidancePosition` を module private type にする。
  - `RowControlEntry.handle` を return shape から削除する。
  - `InsertionLine.element` を return shape から削除する。
  - `drag-ui.test.ts` の insertion line 観測を DOM query へ変更する。
  - `onControlPointerDown()` の重複 `suppressBlockDrag()` を削除する。
  - `reorder-ui/index.ts` の不要 re-export を削除する。
- Validation:
  - row control / guidance / drag UI / sortable controller の focused unit test。
  - handle DOM class、guidance top / bottom 更新、insertion line の表示・位置更新・cleanup、block drag suppression の既存挙動が維持されることを確認する。

### Phase 3: 実装内部専用 type export の縮小

- Outcome:
  - production consumer が名前利用していない実装内部 type が private になっている。
- Tasks:
  - `InsertionLine`、`RowControlOptions`、`RowControls`、`RowMoveTargetsOptions`、`RowMoveConstraints`、`RowspanRange`、`MoveDirection` から不要な `export` を外す。
  - import / re-export を必要最小限で追従する。
- Validation:
  - TypeScript typecheck。
  - unit test compile を含む `npm test`。

### Phase 4: Knip と全体回帰確認

- Outcome:
  - #283 が対象とする既知の Knip 検出結果が解消し、Table Reorder の既存挙動が維持されている。
- Tasks:
  - `npm run knip` を実行する。
  - 本 Issue 対象外の検出が残る場合は、理由を分類して PR に記録する。
  - Knip を通すためだけの ignore は追加しない。
  - application quality gate と build を実行する。
- Validation:
  - `npm run knip`
  - `npm test`
  - `npm run build`
  - `git diff --check origin/main...HEAD`

## Decisions and validation questions

### Decide before implementation

- なし。

#283 の調査結果と追加確認により、本計画で削除する低リスク候補は確定している。`InsertionLine.element` も test 専用 property として削除し、test は DOM query へ変更する方針で確定している。

### Validate during implementation

- `npm run knip` が #283 記載の既知の facade re-export / exported type を検出しなくなるか。
- type export を private 化した結果、見落としていた repo 内 consumer が typecheck で判明しないか。
- `sourceControl` / scroll 引数削除後も focused test が既存 UI / keyboard scroll contract を維持しているか。
- `InsertionLine.element` 削除後も DOM query に置き換えた focused test が insertion line の生成・位置更新・cleanup contract を同じ粒度で確認できるか。

新たに test seam や外部境界として意味を持つ consumer が見つかった候補は、無理に削除せず対象外へ戻す。

## Issue breakdown

本 Issue は小さな低リスク削除を一つの cleanup としてまとめて実装する。現時点では子 Issue に分割しない。

実装中に、次のような設計判断が必要な候補を改めて削除したくなった場合のみ #275 配下の follow-up Issue として切り出す。

- `TableContext.table`
- `findBlockElement` export
- test 専用定数 export
- test harness 専用 type export

## Validation

実装変更は TypeScript / JavaScript を含むため、`docs/development/testing.md` に従って次を実行する。

- `npm run knip`
  - #283 が対象とする既知の unused export / exported type が解消している。
- `npm test`
  - format、JS lint、CSS lint、typecheck、unit test が成功する。
- `npm run build`
  - production asset build が成功する。
- `git diff --check origin/main...HEAD`
  - whitespace error がない。

必要に応じて変更中は focused unit test を先に実行する。

UI / 操作仕様は変更しないため、新しい E2E シナリオ追加は完了条件にしない。既存 E2E の変更も行わない。

## Completion criteria

- #283 の調査結果で低リスクと判断した不要引数・計算・property・export / re-export・重複処理が整理されている。
- `sourceControl` と keyboard scroll の未使用引数が API から消えている。
- `followingIndex` と不要な追加 insertion index 計算が消えている。
- `ReorderGuidanceUi.setPosition` は公開されず、内部 position 更新は維持されている。
- `RowControlEntry.handle` は return shape から消えているが、handle DOM / CSS 契約は維持されている。
- `InsertionLine.element` は return shape から消え、`drag-ui.test.ts` は DOM query で生成・位置更新・cleanup を検証している。
- insertion line DOM class、位置計算、scroll / resize listener、`hide()` / `show()` / `cleanup()` の既存挙動が維持されている。
- `reorder-ui` facade の既知の不要 re-export が整理されている。
- 実装内部専用 type の不要 export が整理されている。
- `TableContext.table`、`findBlockElement`、その他の test seam 用 export は本 Issue で無理に削除していない。
- DOM / CSS / ARIA、WordPress / Gutenberg、SortableJS の既存契約が変わっていない。
- Table Reorder の keyboard / pointer / touch / drag / accessibility 挙動が変わっていない。
- `npm run knip` で本 Issue が扱う既知の検出結果が解消している。
- `npm test`、`npm run build`、`git diff --check origin/main...HEAD` が成功している。

## Notes

- Knip は削除判断の補助材料であり、runtime / DOM / CSS / ARIA / external library contract より優先しない。
- test だけが production property を利用している場合でも、自動的に削除するのではなく、同じ contract を公開 API なしで安全に観測できるか確認する。`InsertionLine.element` は DOM query で同じ contract を確認できるため削除対象とする。
- `InsertionLine.element` の代替として test 専用 export を追加しない。`drag-ui.test.ts` は既存 `.yamabiko-table-reorder-insertion-line` selector を直接利用する。
- `DESTINATION_CLASS` は CSS / destination DOM 契約として必要であり、削除するのは facade re-export だけである。
- `ReorderGuidancePosition` は型自体を消す必要はなく、module private に狭めるだけでよい。
- `void createNotice(...)`、`void preferencesActions.set(...)`、`void ensureSortableRuntime(...).then(...)` は intentional fire-and-forget であり、本 Issue の未使用 `void` 引数とは別物なので変更しない。