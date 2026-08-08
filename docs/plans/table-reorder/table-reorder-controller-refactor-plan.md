# PLAN-119: Table Reorder Controller 責務分割

## References

- Issue: https://github.com/YamabikoLab/yamabiko-editor-tools/issues/119
- Parent issue: https://github.com/YamabikoLab/yamabiko-editor-tools/issues/116
- Jest preparation: https://github.com/YamabikoLab/yamabiko-editor-tools/issues/117
- Playwright preparation: https://github.com/YamabikoLab/yamabiko-editor-tools/issues/118
- Base plan: `docs/plans/table-reorder/table-reorder-plan.md`
- Accessibility plan: `docs/plans/table-reorder/table-reorder-accessibility-plan.md`
- Current controller: `src/editor-extensions/table-reorder/table-reorder-controller.tsx`

## Goal

`table-reorder-controller.tsx` に集中している責務を、既存の外部挙動を変えずに整理する。

リファクタリング後の `TableReorderController` は、Table Reorder の各責務を直接実装する巨大な単一コンポーネントではなく、DOM同期、キーボード操作、ポインターDnDなどの担当を接続し、React描画を組み立てる薄い統合層とする。

既存の `keyboard-reorder.ts`、`drag-session.ts`、`rowspan.ts`、`reorder.ts`、`drag-visuals.ts` は純粋ロジックまたは既存の専用責務として維持し、今回のリファクタリングで同じロジックを別実装へ置き換えない。

## Preconditions

実装着手前に次を満たす。

- #117 の Jest テスト整備が完了していること。
- #118 の Playwright テスト整備が完了し、主要なユーザー操作をリファクタリング前の振る舞いとして固定できていること。
- `npm run test` が成功すること。
- `npm run test:e2e` の対象ケースが成功すること。

このプラン文書自体の作成は #118 完了前でも可能だが、controller の実装変更は #118 完了後に開始する。

## Scope

### Included

- `table-reorder-controller.tsx` 内の責務整理。
- Gutenberg固有のDOM探索、DOM再同期、位置計測、監視処理の局所化。
- キーボード並べ替えのReact/Gutenberg接続処理の分離。
- ポインターDnDのReact/dnd-kit接続処理の分離。
- DragOverlay用行描画の分離。
- React state と ref の所有者を明確化し、明らかな重複状態を整理する。
- 既存のフォーカス復元、スクロール、live region、`rowspan`制約、Undo / Redo、hover、全幅対応の維持。
- iframe / non-iframe の既存動作維持。

### Not included

- Table Reorder の新機能追加。
- UIや操作仕様の変更。
- dnd-kit APIやライブラリの置き換え。
- 独自state machineや新しい状態管理ライブラリの導入。
- `keyboard-reorder.ts`、`drag-session.ts`、`rowspan.ts`、`reorder.ts` の全面再設計。
- 汎用DOM監視基盤や汎用フォーカス管理基盤の新設。
- 1責務1ファイルを目的とした過度な細分化。
- #118 完了前の controller 実装変更。

## Current responsibilities

現在の `table-reorder-controller.tsx` は主に次を同時に担当している。

1. Tableブロック、`table`、`tbody`、行DOMの探索。
2. データ行とDOM行を結び付ける行ID管理。
3. `MutationObserver` による行DOM再同期。
4. `ResizeObserver`、scroll、resize による行位置再計測。
5. portal用コンテナの生成と破棄。
6. dnd-kit `PointerSensor` の設定。
7. ポインターDnDの開始、候補更新、確定、cleanup。
8. キーボード並べ替えの開始、移動、確定、キャンセル。
9. `rowspan` 禁止位置の通知。
10. ハンドルのフォーカス復元。
11. 移動候補へのスクロール。
12. live region の通知と重複抑止。
13. DragOverlay のDOM複製。
14. 挿入位置とドラッグ中表示の描画。
15. `SortableRow` 群の描画。

これらのうち、React描画以外の orchestration が一つのコンポーネントへ集中していることを今回の整理対象とする。

## Responsibility boundaries

### 1. Gutenberg DOM同期と行レイアウト

候補: `use-table-reorder-dom.ts`

担当する。

- `clientId` から対象ブロックDOMを取得する。
- `table` / `tbody` / 本文行DOMを取得する。
- Tableデータ行とDOM行を対応付け、一貫した行IDを管理する。
- `rows` を生成する。
- 行ごとの `top`、`left`、`width`、`height` を計測する。
- `MutationObserver` でGutenbergによるDOM再生成を検知する。
- `ResizeObserver`、scroll、resize で位置を再計測する。
- ドラッグ中にDOM再同期を抑止し、終了後に再同期できる入口を提供する。
- portalコンテナの生成と破棄を担当する。
- 全幅Table Reorderの有効化とcleanupを、DOMライフサイクルと同じ場所で管理する。
- セルへの pointerdown で並べ替えモードを終了する既存挙動を維持する。

担当しない。

- DnDの移動可否判定。
- キーボードキーの意味判定。
- body の並べ替え確定。
- live region のメッセージ文言。

このhookを Gutenberg DOMライフサイクル依存の主な境界とし、controller やDnD hooksが `MutationObserver` や `ResizeObserver` を直接扱わない構造を目指す。

### 2. キーボード並べ替え

候補: `use-keyboard-reorder.ts`

担当する。

- `Enter` / `Space` による開始と確定。
- `ArrowUp` / `ArrowDown` による移動先変更。
- `Escape` によるキャンセル。
- 既存 `keyboard-reorder.ts` を使った移動方向と移動先の算出。
- 既存 `drag-session.ts` を使った開始、候補更新、確定。
- キーボード操作中の状態管理。
- ポインターDnDを一時的に無効化するための状態を controller へ返す。
- キーボード操作に直接付随するフォーカス復元とスクロール。
- 開始、移動、完了、キャンセル、禁止理由の live region 通知。
- `rowspan` 禁止時の既存Snackbar通知の呼び出し。

担当しない。

- `MutationObserver` / `ResizeObserver`。
- 行DOMのID採番。
- PointerSensorイベント。
- JSX描画。

フォーカス管理とlive regionは今回さらに `focus-manager.ts` や `announcer.ts` へ分割しない。キーボード操作の制御フローから切り離すことで引数と共有stateが増える場合は、`use-keyboard-reorder.ts` 内に留める。

### 3. ポインターDnD

候補: `use-pointer-reorder.ts`

担当する。

- `onDragStart`。
- `onDragMove` / `onDragOver`。
- `onDragEnd`。
- drag session のライフサイクル。
- ドラッグ開始時点の行スナップショット。
- ポインター位置から挿入位置を算出する処理。
- `drag-visuals.ts` を使った候補表示。
- 禁止位置での既存Snackbar通知。
- commit後のdnd-kit overlay cleanup待ち。
- cleanup完了後のDOM再同期要求。

担当しない。

- 行DOMの監視と通常時の再計測。
- キーボードイベント。
- JSX描画。
- `body` の並べ替えアルゴリズムそのもの。

`drag-session.ts` と `drag-visuals.ts` は既存の責務を維持し、このhookはそれらとReact/dnd-kitイベントを接続するアダプターとする。

### 4. DragOverlay描画

候補: `drag-row-overlay.tsx`

現在 controller 内にある `DragRowOverlay` を独立した表示コンポーネントへ移す。

担当する。

- 元行DOMの複製。
- table / tbody / row の必要最小限のDOM構造再現。
- cell幅と行高の反映。
- `id`、`contenteditable`、`tabindex` の除去。
- overlay要素の参照通知。

この抽出では表示結果を変更しない。

### 5. TableReorderController

`table-reorder-controller.tsx` に残す。

- propsを受け取る。
- `rowspan` ranges / non-movable rows の既存判定を接続する。
- 各hookを呼び出す。
- dnd-kit sensors と各handlerを `DragDropProvider` へ渡す。
- `SortableRow` を描画する。
- insertion indicator を描画する。
- `DragOverlay` と `DragRowOverlay` を描画する。
- portalとlive regionを配置する。

controller は各担当の実装詳細を持たず、必要な値とcallbackを接続する統合層とする。

## Proposed file layout

```text
src/editor-extensions/table-reorder/
├─ table-reorder-controller.tsx
├─ use-table-reorder-dom.ts
├─ use-keyboard-reorder.ts
├─ use-pointer-reorder.ts
├─ drag-row-overlay.tsx
│
├─ drag-session.ts
├─ drag-visuals.ts
├─ keyboard-reorder.ts
├─ reorder.ts
├─ rowspan.ts
├─ sortable-row.tsx
└─ ...
```

初期分割では新規ファイルを上記4ファイル程度に抑える。

実装中に小さな共通型の共有が必要になっても、単独ファイルを作るより既存の最も自然な所有者からexportすることを優先する。複数の新規モジュールから同じ型へ依存し、循環依存を避けるために必要な場合だけ型専用ファイルを検討する。

## State ownership

### 原則

stateとrefの整理は、責務抽出と同時に全面的に書き換えない。

まず既存状態を担当モジュールへ移動し、所有者が明確になった後でのみ重複を減らす。

### React state

React描画へ直接反映される値はstateを基本とする。

例:

- 行一覧。
- 行位置。
- active row。
- keyboard reorder の表示状態。
- live message。
- insertion indicator。

### ref

イベントハンドラや非同期DOM処理から最新値を同期的に読む必要があり、それ自体の変更では再描画を必要としない値はrefを基本とする。

例:

- handle DOM elements。
- drag session。
- drag中の行スナップショット。
- overlay DOM element。
- pending focus ID。
- observer / cleanup callback。

### state / ref 重複

`rows` / `rowsRef` や `keyboardReorder` / `keyboardReorderRef` のような組み合わせは、抽出先で利用箇所を確認してから整理する。

削除するためだけにrefを削除しない。イベントコールバックが古いclosureを参照しないためにrefが必要なら維持する。

逆に、同じ責務内でstateだけで安全に表現できることが明確になった場合は重複refを削除する。

## Cross-hook contracts

### 原則

責務分割後も mutable ref を複数hookへそのまま渡す構造にはしない。

- mutable ref は原則として単一の責務が所有する。
- 他責務が必要とする場合は、生のrefではなく用途を限定した callback または読み取り値を渡す。
- keyboard と pointer は、それぞれ独立した drag session と行スナップショットを所有する。現在の `dragSession` / `dragRows` を両者で共有し続けない。
- DOM再同期は `useTableReorderDom` が所有し、他責務は `requestRowsReconciliation()` のような明示的な入口から依頼する。
- hook同士を直接呼び合わず、`TableReorderController` が narrow な値とcallbackを接続する。

### 現在の共有refの移動先

| 現在の値 | 分割後の主な所有者 | hook間の契約 |
|---|---|---|
| `handleElements` | `TableReorderController` | Reactで描画するハンドル登録をcontrollerが所有し、keyboardには `focusHandle(id)`、PointerSensorには activator取得callbackだけを渡す。生のMapは渡さない。 |
| `isDragging` | `usePointerReorder` | Pointer DnD固有状態として閉じ込める。`useTableReorderDom` はこのrefを読まない。 |
| `dragSession` | keyboard / pointer 各hook | `useKeyboardReorder` と `usePointerReorder` がそれぞれ独立したsessionを所有する。 |
| `dragRows` | keyboard / pointer 各hook | 操作開始時の行スナップショットは各hookが独立して所有する。 |
| `dragVisuals` | `usePointerReorder` | ポインター候補表示のライフサイクルとcleanupをPointer DnD側へ閉じ込める。 |
| `hasShownForbiddenNotice` | 各操作hook | 通知の重複抑止が必要な責務ごとに所有し、keyboardとpointerで共有refにしない。 |
| `pendingFocusId` | `useKeyboardReorder` | DOM同期後のフォーカス復元もkeyboard orchestrationの一部として所有する。必要なハンドル操作は `focusHandle(id)` callbackを使う。 |
| `overlayElement` | `usePointerReorder` | `DragRowOverlay` へ `onElementChange` callbackを渡し、cleanup待ちに必要な要素参照はPointer DnD側で所有する。 |
| `scheduleRowsUpdate` | `useTableReorderDom` | 共有refは廃止し、`requestRowsReconciliation()` のような明示的callbackを返す。 |
| `stopWaitingForDragCleanup` | `usePointerReorder` | dnd-kit cleanup待ちの開始・停止をPointer DnD内に閉じ込める。 |

`rowsRef`、行ID用WeakMap、observer、portal containerなどGutenberg DOM同期に必要なmutable値は `useTableReorderDom` 内部へ移す。`keyboardReorderRef`、announcement重複抑止などキーボード操作に閉じる値は `useKeyboardReorder` が所有する。

### DOM再同期とPointer DnDの契約

現在最も絡まりやすい「ドラッグ中は再同期を抑止し、cleanup後に再同期する」処理は次の契約で接続する。

1. `useTableReorderDom` が再同期スケジューラと「再同期を一時保留する状態」を内部で所有する。
2. `useTableReorderDom` は用途を限定した `suspendRowsReconciliation()`、`resumeRowsReconciliation()`、`requestRowsReconciliation()` 相当のcallbackを返す。実際の命名は実装時に多少調整してよいが、生のrefは公開しない。
3. `usePointerReorder` は有効なdrag開始時に再同期をsuspendする。
4. commit / cancel後はdnd-kit overlay cleanup完了までsuspendを維持する。
5. cleanup完了後にresumeし、必要な行再同期をrequestする。
6. unmountや途中終了でもsuspend状態が残らないcleanupを必ず持つ。
7. `usePointerReorder` の `isDragging` はPointer DnD内部だけで使い、DOM hookの抑止判定にrefそのものを渡さない。

Keyboard reorderはPointer DnDのcleanup待ちを共有せず、commit後に必要な場合だけ `requestRowsReconciliation()` を呼ぶ。

## Implementation order

### Step 0: Baseline

実装前に #117 / #118 のテストを基準として現状を確認する。

- `npm run test`
- `npm run test:e2e`

既存失敗がある場合は #119 の変更と混在させず、先に原因を記録する。

### Step 1: `DragRowOverlay` を抽出する

最も独立している表示コンポーネントから移動する。

- ロジック変更なし。
- DOM構造変更なし。
- class名変更なし。
- 抽出後にテスト実行。

### Step 2: DOM同期を `useTableReorderDom` へ抽出する

Gutenberg固有タイミング依存を最初に controller の外へ出す。

- 行ID管理。
- rows / rowPositions。
- observer群。
- portal container。
- full-width cleanup。
- ドラッグ中再同期抑止と終了後再同期。

この段階ではDnD制御を変更しない。

抽出後に `npm run test` と関連E2Eを実行する。

### Step 3: キーボード操作を `useKeyboardReorder` へ抽出する

現在の `onHandleKeyDown` を中心に移動する。

- start。
- move。
- commit。
- cancel。
- focus / scroll。
- announcement。

既存 `keyboard-reorder.ts` と `drag-session.ts` のロジックは変更しない。

抽出後にJestとキーボード系E2Eを実行する。

### Step 4: Pointer DnDを `usePointerReorder` へ抽出する

- drag start。
- drag target update。
- drag end。
- visual cleanup。
- dnd-kit cleanup待ち。

既存 `drag-session.ts` と `drag-visuals.ts` は変更しないことを基本とする。

抽出後にJestとポインター系E2Eを実行する。

### Step 5: state / ref の重複を整理する

各責務の所有者が確定してから行う。

- 重複しているstate/refを列挙する。
- 本当に両方必要かを利用箇所単位で確認する。
- 不要と判断できるものだけ削除する。
- 大規模な状態モデル変更は行わない。

このStepは責務分割に必要な範囲だけとし、独立した改善へ発展する場合は別Issueへ分ける。

### Step 6: Controllerを薄い統合層として確認する

最後に `table-reorder-controller.tsx` が主として次だけを担っていることを確認する。

- props / derived values。
- hooks接続。
- dnd-kit provider。
- portal / JSX描画。

行DOM監視やDnD状態遷移の詳細がcontrollerへ残っている場合は、その責務の所有先が本当にcontrollerである必要があるか見直す。

## Validation strategy

### 各Stepで実施

可能な限り一度に全責務を移動せず、各Stepでテスト可能な状態を維持する。

最低限:

```bash
npm run test
```

#118 で整備されたE2Eについては、変更した責務に対応する代表ケースをStepごとに実行する。

### 最終確認

```bash
npm run test
npm run test:e2e
```

特に次の外部挙動を確認する。

- 並べ替えモードON時の初期フォーカス。
- Tab / Shift+Tab の代表的フォーカス移動。
- Enter / Space での開始と確定。
- ArrowUp / ArrowDownによる移動。
- Escapeキャンセル。
- ポインターDnD。
- Undo / Redo。
- 連続移動時のUndo履歴単位。
- `rowspan`分断拒否。
- hoverでのハンドル表示 / 非表示。
- セル編集への復帰。
- 通常幅 / 全幅。
- iframe / non-iframe。
- 必要なスクロール追従とフォーカス維持。

## Guardrails for Codex

Codexへ実装を依頼する際は次を明示する。

1. このプランの責務境界と実装順を基準にする。
2. 外部挙動を変更しない。
3. 新機能を追加しない。
4. 既存の純粋ロジックを再実装しない。
5. 一度に全面的なstate管理を書き換えない。
6. 独自state machineや追加ライブラリを導入しない。
7. 小さな関数ごとのファイル分割を目的化しない。
8. 既存テストを実装都合で弱めない。
9. テスト失敗をリファクタリングに合わせて期待値変更する前に、外部挙動の回帰か確認する。
10. #119 の範囲外の改善を見つけた場合は、同じPRへ追加せず別Issue候補として報告する。

## Expected outcome

実装完了後は、controller を読むだけで全てのタイミング処理や状態遷移を追う必要がなくなる。

責務ごとの期待状態は次の通り。

| 領域 | 主な所有者 |
|---|---|
| Gutenberg DOM同期・位置計測 | `use-table-reorder-dom.ts` |
| キーボード並べ替え orchestration | `use-keyboard-reorder.ts` |
| ポインターDnD orchestration | `use-pointer-reorder.ts` |
| DragOverlay表示 | `drag-row-overlay.tsx` |
| 並べ替え純粋ロジック | 既存 `keyboard-reorder.ts` / `drag-session.ts` / `reorder.ts` / `rowspan.ts` |
| 統合とReact描画 | `table-reorder-controller.tsx` |

ファイル数や行数そのものを完了条件にはしない。controller の責務集中が緩和され、Gutenberg固有DOM依存と操作ごとの状態遷移の所有者が明確になっていることを優先する。

## Completion criteria

- [ ] #118 のPlaywrightテスト整備完了後に実装を開始している。
- [ ] `DragRowOverlay` の責務がcontrollerから分離されている。
- [ ] 行DOM取得、再同期、位置計測、observer管理が局所化されている。
- [ ] キーボード並べ替えの orchestration がcontrollerから分離されている。
- [ ] ポインターDnDの orchestration がcontrollerから分離されている。
- [ ] controller が統合と描画を中心とする構造になっている。
- [ ] 既存の純粋ロジックが不要に再実装されていない。
- [ ] state / ref の所有者が整理されている。
- [ ] hook間でmutable refを直接共有せず、narrowなcallback / valueで接続されている。
- [ ] DOM再同期とPointer DnD cleanupの契約が実装されている。
- [ ] 新しい過剰な抽象化やライブラリを導入していない。
- [ ] `npm run test` が成功する。
- [ ] `npm run test:e2e` が成功する。
- [ ] 主要なTable Reorder操作に回帰がない。
