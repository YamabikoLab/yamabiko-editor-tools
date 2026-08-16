# PLAN-271: Table Reorder commitRowMove 集約

## References

- Parent issue: #271
- Related state refactor: #269 / #270
- Current implementation: `src/editor-extensions/table-reorder/controller/sortable-controller.ts`
- Related tests:
  - `src/editor-extensions/table-reorder/controller/sortable-controller.test.ts`
  - `src/editor-extensions/table-reorder/controller/sortable-controller-keyboard.test.ts`
  - `src/editor-extensions/table-reorder/controller/sortable-controller-pointer.test.ts`

## Goal

keyboard / single pointer / SortableJS drag の各経路に重複している行移動の確定処理を、`commitRowMove()` 相当の小さな内部 helper へ集約する。

共通化するのは no-op 判定、移動可否判定、`reorderRows()`、commit announcement、`onCommit()` までの「commit の核」だけとし、keyboard / pointer / drag 固有の session・UI・DOM cleanup は各 caller に残す。

UI仕様・操作仕様を変えず、#269 / #270 で整理した `ReorderSession` / `DragSnapshot` の責務境界と、現在の cleanup-before-commit の副作用順序を維持する。

## Scope

### Included

- `sortable-controller.ts` 内に `commitRowMove()` 相当の内部 helper を導入する。
- keyboard / pointer / 通常 drag の commit 判定と `reorderRows()` / commit announcement / `onCommit()` を helper 経由へ統一する。
- helper の戻り値を「commit が成立したか」を表す `boolean` とする。
- `rowLabel` を helper の必須引数とする。
- keyboard / pointer からは既存どおり `focusRowIndex = newIndex` を渡し、通常 drag では focus index を渡さない。
- helper 抽出前に、keyboard / pointer の cleanup-before-commit を保護する characterization test を必要最小限追加する。
- 通常 drag では、既存の「DOM 順を復元してから commit する」テストを副作用順序の保護として継続利用する。
- 既存の no-op、rowspan 制約、拒否された SortableJS lifecycle、focus、announcement の挙動を維持する。

### Not included

- keyboard / pointer / drag の cleanup 自体の共通化。
- `ReorderSession` / `DragSnapshot` の再設計。
- controller のクラス化。
- Strategy Pattern / Template Method Pattern などの新しい構造導入。
- `sortable-controller.ts` の入力方式ごとのファイル分割。
- UI文言やアクセシビリティ仕様の変更。
- keyboard / pointer / drag の操作仕様変更。
- SortableJS の置き換え。

## Approach

### 1. 先に副作用順序を characterization test で固定する

今回の重要な契約は、最終状態だけでなく **`onCommit()` が呼ばれた瞬間に入力方式固有の cleanup が完了していること**。

helper 抽出によって commit 呼び出し位置を誤って前倒ししないよう、keyboard / pointer の成功 commit を対象に `onCommit` mock callback 内で cleanup 状態を確認する。

keyboard では少なくとも次を確認する。

- `aria-pressed="false"`
- keyboard guidance が DOM から cleanup 済み
- insertion line が `hide()` 済みで非表示
- insertion line の DOM 削除自体は要求しない

pointer では少なくとも次を確認する。

- destination UI が削除済み
- `aria-pressed="false"`

通常 drag は、既存の「元の DOM 順を復元してから reordered rows を commit する」テストで同じ目的を保護できるため、同内容の characterization test は追加しない。

### 2. `commitRowMove()` の責務を最小限に固定する

`createSortableController()` 内に、概念的に次の入力を受ける helper を置く。

```ts
commitRowMove({
	oldIndex,
	newIndex,
	rowLabel,
	focusRowIndex,
});
```

実際の型・引数名は現行コードへ合わせて必要最小限にする。

helper が担当する処理は次だけとする。

1. `rows` の存在確認
2. `isNoopRowMove()`
3. `isRowMoveAllowed()`
4. `reorderRows()`
5. commit announcement
6. `onCommit()`

helper の契約は次とする。

- `true`: `reorderRows()` が成功し、commit announcement と `onCommit()` まで実行した
- `false`: `rows` 不在 / no-op / 移動不許可 / `reorderRows()` 不成立などで commit しなかった
- `false` の場合も cancel announcement / focus 復帰 / guidance 復帰 / session cleanup は行わない
- helper は `session` を変更しない
- `rowLabel` は必須で、label 不在を helper 内の境界ケースとして扱わない
- `focusRowIndex` は optional とし、keyboard / pointer と通常 drag の既存差異だけを表現する

### 3. keyboard caller を helper へ置き換える

`finishKeyboardSession()` では現在の順序を維持する。

1. keyboard session をローカル変数へ退避
2. guidance cleanup
3. insertion line `hide()`
4. `aria-pressed=false`
5. `session = idle`
6. active entry / block drag cleanup
7. commit 要求時だけ `commitRowMove()` を呼ぶ
8. helper が `true` なら終了
9. helper が `false` または cancel なら、既存の caller 側処理を実行

commit 不成立時の既存挙動を維持する。

- commit 要求が no-op / 不許可でも cancel announcement は出さない
- touch guidance を復帰する
- starting control へ focus を戻す
- explicit cancel の場合だけ cancel announcement を出す

### 4. pointer caller を helper へ置き換える

`finishSinglePointerSession()` でも cleanup-before-commit を維持する。

1. pointer session をローカル変数へ退避
2. destination targets UI cleanup
3. `aria-pressed=false`
4. `session = idle`
5. active entry / block drag cleanup
6. `newIndex` がある場合だけ `commitRowMove()` を呼ぶ
7. helper が `true` なら終了
8. helper が `false` または destination 未指定なら、既存の cancellation / focus 処理を caller 側で行う

`announceCancellation` の既存条件は helper へ持ち込まず、そのまま caller 側に残す。

### 5. 通常 drag `onEnd` を helper へ置き換える

通常 drag の `onEnd` は `session.kind === 'dragging'` だった場合だけ commit 対象とし、keyboard session 中に到達する拒否済み SortableJS lifecycle から helper を呼ばない。

通常 drag では現行の cleanup / DOM 復元順を保つ。

- insertion line cleanup
- `session = idle`
- click suppression 更新
- drag DOM を元の順序へ復元
- fallback / drag snapshot / active entry / block drag 等の既存 cleanup
- 有効な `oldIndex` / `newIndex` と `DragSnapshot` がある場合だけ `commitRowMove()` を呼ぶ

`DragSnapshot.rowLabel` を helper の必須 `rowLabel` として渡す。

通常 drag は `focusRowIndex` を渡さず、現行の `onCommit( reorderedRows )` 相当の挙動を保つ。

### 6. 重複削除後に caller 固有処理だけが残っていることを確認する

抽出後、次が keyboard / pointer / drag の各 caller に重複して残っていないことを確認する。

- `isNoopRowMove()`
- `isRowMoveAllowed()`
- `reorderRows()`
- commit announcement
- `onCommit()`

一方、次は意図的に caller 側へ残す。

- keyboard guidance / insertion line / focus / cancel announcement
- pointer destination UI / focus / cancel announcement
- SortableJS / fallback / drag DOM / snapshot cleanup
- session lifecycle

## Architecture

### `commitRowMove()`

責務:

- 行移動 commit の共通判定とデータ更新だけを担当する
- announcement と `onCommit()` を commit 成立時の不可分な末尾処理として扱う

依存:

- `rows`
- `constraints`
- `announce()`
- `getMoveCommittedAnnouncement()`
- `isNoopRowMove()`
- `isRowMoveAllowed()`
- `reorderRows()`
- `onCommit()`

非責務:

- `session`
- focus
- guidance
- destination UI
- insertion line lifecycle
- drag DOM / fallback cleanup
- cancel announcement

### Callers

`finishKeyboardSession()`、`finishSinglePointerSession()`、通常 drag `onEnd` は、それぞれ自身の終了処理を完了した後に `commitRowMove()` を呼ぶ。

```text
keyboard cleanup ─┐
pointer cleanup  ─┼─> commitRowMove(...)
drag cleanup     ─┘

commitRowMove(...)
  ├─ rows / no-op / constraint checks
  ├─ reorderRows()
  ├─ commit announcement
  └─ onCommit()
```

## Implementation phases

### Phase 1: Baseline と characterization test の追加

Outcome:

- helper 抽出前の cleanup-before-commit 順序をテストで固定する。

Tasks:

- `sortable-controller-keyboard.test.ts` の成功 commit テストを、`onCommit` callback 内で cleanup 状態を assertion できる形へ追加または最小限拡張する。
- keyboard callback 内で `aria-pressed=false`、guidance cleanup、insertion line 非表示を確認する。
- `sortable-controller-pointer.test.ts` の成功 commit テストを、`onCommit` callback 内で destination UI cleanup と `aria-pressed=false` を確認できる形へ追加または最小限拡張する。
- 通常 drag の DOM restore-before-commit 既存テストが引き続き存在することを確認する。

Validation:

- 追加した対象テストだけを実行し、helper 抽出前に Green であることを確認する。

### Phase 2: `commitRowMove()` を導入して keyboard を移行

Outcome:

- helper の契約をコード上で確立し、keyboard の重複 commit 処理を削除する。

Tasks:

- `commitRowMove()` を `createSortableController()` 内へ追加する。
- `rowLabel` 必須、`focusRowIndex` optional、戻り値 `boolean` の契約にする。
- `finishKeyboardSession()` の cleanup 順を維持したまま helper 呼び出しへ置き換える。
- commit 不成立時の cancel announcement / focus / guidance の既存差異を caller 側に残す。

Validation:

- keyboard controller tests を実行する。
- characterization test が Green のままであることを確認する。
- no-op commit、rowspan 制約、cancel、focus、拒否された Sortable lifecycle の既存 tests が Green であることを確認する。

### Phase 3: pointer を移行

Outcome:

- pointer の commit 核を helper へ統一し、pointer 固有の cancellation / focus 契約を維持する。

Tasks:

- `finishSinglePointerSession()` の重複判定 / reorder / commit announcement / `onCommit()` を helper 呼び出しへ置き換える。
- `announceCancellation` は caller 側に残す。
- helper の戻り値で「commit 成立なら終了」「不成立なら既存 cancellation / focus 処理へ続く」を表現する。

Validation:

- pointer controller tests を実行する。
- characterization test が Green のままであることを確認する。
- touch / hover の cancel、destination UI、focus、pointer -> dragging cleanup の既存 tests が Green であることを確認する。

### Phase 4: 通常 drag を移行

Outcome:

- 3経路すべてが同じ commit 核を利用し、drag 固有 lifecycle は独立したままになる。

Tasks:

- 通常 drag `onEnd` の commit 判定 / reorder / announcement / `onCommit()` を helper 呼び出しへ置き換える。
- `completedSnapshot.rowLabel` を必須 `rowLabel` として渡す。
- 通常 drag では `focusRowIndex` を渡さない。
- keyboard 中に拒否された Sortable lifecycle では helper を呼ばない条件を維持する。
- DOM restore-before-commit の順序を変更しない。

Validation:

- `sortable-controller.test.ts` と keyboard の拒否 lifecycle test を実行する。
- DOM restore-before-commit test が Green のままであることを確認する。
- drag no-op / constraint / cleanup / restart の既存挙動を確認する。

### Phase 5: 重複確認と全体検証

Outcome:

- commit の核が1か所に集約され、caller には入力方式固有の終了処理だけが残る。

Tasks:

- `sortable-controller.ts` 内で `isNoopRowMove()` / `isRowMoveAllowed()` / `reorderRows()` / commit announcement / `onCommit()` の commit 経路重複が解消されていることを確認する。
- helper が session lifecycle や cancel 系副作用を扱っていないことを確認する。
- 不要になった条件分岐やローカル変数だけを最小限整理する。

Validation:

- controller 関連 unit tests
- `npm run typecheck`
- 最終 handoff 前のリポジトリ標準チェック

## Decisions and validation questions

### Decide before implementation

Issue #271 で次の方針は確定済みとし、実装中に再設計しない。

- helper は controller 内部の小さな関数とし、クラスや strategy object を導入しない。
- `rowLabel` は必須。
- helper は `boolean` を返す。
- helper は session lifecycle / cleanup / focus / cancel announcement を扱わない。
- keyboard / pointer は `focusRowIndex = newIndex`、通常 drag は focus index なし。
- cleanup-before-commit の順序を維持する。

### Validate during implementation

- `commitRowMove()` の最小引数形が object parameter と個別引数のどちらが読みやすいかは、現行コードへ適用した時点で判断する。ただし責務や契約は変えない。
- characterization test は既存テストを拡張するか新規 `it` を追加するか、重複が最小になる方を選ぶ。
- 通常 drag の snapshot 存在保証は既存 tests で十分か確認し、不足する場合のみ必要最小限の regression test を追加する。

## Issue breakdown

本Issueは controller 内の限定的なリファクタリングであり、子Issueへ分割せず1PRで実施する。

- [ ] Phase 1: cleanup-before-commit characterization tests
- [ ] Phase 2: `commitRowMove()` 導入 + keyboard 移行
- [ ] Phase 3: pointer 移行
- [ ] Phase 4: normal drag 移行
- [ ] Phase 5: 重複確認 + 全体検証

## Validation

実装時は狭いテストから進め、各 phase を Green にしてから次へ進む。

Focused checks:

```bash
npm run test:unit -- sortable-controller-keyboard.test.ts
npm run test:unit -- sortable-controller-pointer.test.ts
npm run test:unit -- sortable-controller.test.ts
npm run typecheck
```

最終 handoff 前:

```bash
npm test
npm run build
git diff --check origin/main...HEAD
```

手動検証はユーザーが実施する。

## Completion criteria

- keyboard / pointer の cleanup-before-commit characterization test が `onCommit` callback 内で副作用順序を保護している。
- keyboard characterization test が guidance cleanup、insertion line 非表示、`aria-pressed="false"` を commit 時点で確認している。
- pointer characterization test が destination UI cleanup、`aria-pressed="false"` を commit 時点で確認している。
- keyboard / pointer / 通常 drag の commit 判定・`reorderRows()`・commit announcement・`onCommit()` が `commitRowMove()` 経由になっている。
- no-op / 移動可否判定が3経路に重複していない。
- `commitRowMove()` は commit 成立時のみ `true`、不成立時は `false` を返す。
- `rowLabel` が helper の必須引数になっている。
- commit 成立時は commit announcement と `onCommit()` が必ず実行される。
- commit 不成立時の cancel announcement / focus / guidance / session cleanup は helper が行わない。
- keyboard / pointer / drag 固有の cleanup が各 caller に残っている。
- keyboard / pointer / drag の cleanup 完了後に helper が呼ばれ、既存の `onCommit()` 副作用順序が維持されている。
- keyboard 中に拒否された SortableJS lifecycle から commit されない。
- keyboard / pointer の focus・announcement 挙動が変わっていない。
- 通常 drag で DOM を元の順序へ復元してから commit する挙動が変わっていない。
- `rowspan` を含む既存の移動制約が維持されている。
- controller 関連 tests と typecheck が Green。
- 最終的な repository validation が Green。

## Notes

このリファクタリングの目的は抽象化そのものではなく、移動ルールの変更時に keyboard / pointer / drag の一部だけ修正漏れするリスクを減らすこと。

#269 / #270 で session lifecycle の責務境界はすでに整理されているため、本Issueではその境界を維持し、commit の核だけを薄く1か所へ寄せる。
