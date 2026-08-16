# PLAN-276: Table Reorder useTableReorder 副作用境界整理

## References

- Parent issue: #276
- Parent refactoring: #275
- Current implementation: `src/editor-extensions/table-reorder/use-table-reorder.ts`
- Gutenberg adapter: `src/editor-extensions/table-reorder/with-table-reorder.tsx`
- Controller: `src/editor-extensions/table-reorder/controller/sortable-controller.ts`
- Related plan: `docs/plans/table-reorder/table-reorder-commit-row-move-plan.md`

## Goal

`use-table-reorder.ts` に集中している interaction / UI state、SortableJS controller lifecycle、Gutenberg 接続を整理し、複数の `useEffect` の実行順序を追わないと安全性を判断できない状態を減らす。

既存の hover / keyboard / pointer / touch の UI・操作仕様は変更せず、まず `useTableReorder` の lifecycle を characterization test で固定する。その結果を基準に controller lifecycle と interaction / UI state をそれぞれ明確な責務境界へ分離し、`useTableReorder` 自体は Gutenberg の `setAttributes` / notices / HOC 向け state・操作を接続する orchestration layer として残す。

## Scope

### Included

- `useTableReorder` の lifecycle characterization test を追加する。
- `commit → setAttributes({ body }) → body 更新 → controller cleanup / 再生成 → focus 復元` を主要な回帰契約として固定する。
- controller の生成・破棄・再生成、pending focus、遅延 microtask の生存管理を専用 custom hook へ分離する。
- hover capability、input modality、touch reorder mode、coachmark / preferences を interaction / UI state の custom hook へ整理する。
- coachmark visibility は、イベントとして保持する必要がないものを既存 state / preference からの derived state へ寄せる。
- `useTableReorder` には Gutenberg notices、`setAttributes()`、HOC 向け公開 API の組み立てを残す。
- 既存の `requestRowControlFocus()` / `toggleTouchReorderMode()` / coachmark dismiss API とその挙動を維持する。
- 現行の iframe / non-iframe 両方を扱う `resolveTableContext()` の境界を維持する。

### Not included

- Table Reorder の UI / 操作仕様変更。
- SortableJS controller 内部の keyboard / pointer / drag session 再設計。
- `commitRowMove()` 周辺の再設計。
- 新しい state machine ライブラリや状態管理ライブラリの導入。
- coachmark 文言、アクセシビリティ仕様、preference key の変更。
- `with-table-reorder.tsx` の描画構造の再設計。
- generic な `shared/` / `utils/` / `helpers/` ディレクトリの追加。
- リファクタリングと無関係な機能追加。

## Approach

### 1. 現行 hook を直接 characterization test する

分割前に `useTableReorder` 自体を描画する最小 test harness を用意し、controller factory と Gutenberg store 境界を mock する。

テストでは controller の内部実装を再検証せず、hook から見た lifecycle のみを観測する。

主な観測点は次とする。

- `createSortableController()` の生成回数と渡された `interactionMode`
- 生成済み controller の `destroy()`
- controller の `focusRowControlAt()` / `focusRowControl()`
- controller option の `onCommit()` callback
- `setAttributes({ body })`
- props の `body` 差し替え後に作られる新 controller
- microtask flush 前後の controller 生存状態

`queueMicrotask()` の内部実装そのものを assertion するのではなく、遅延生成・遅延 cleanup が最終的に正しい controller だけを残すことを外部挙動で固定する。

### 2. Phase 1 で固定する controller lifecycle

最低限、次のケースを固定する。

#### controller 生成

- `enabled=true` かつ hover capable の場合、`interactionMode='hover'` で controller が生成される。
- touch device では block 選択だけでは controller を生成せず、touch reorder mode を有効化した時点で `interactionMode='touch'` の controller が生成される。
- `enabled=false` では controller を生成しない。
- hover mode では現行実装どおり block selection 自体を controller 生存条件にしないことを固定する。

#### body 更新と再生成

- 既存 controller がある状態で `body` が変わると旧 controller が cleanup 対象になり、新しい `body` を使う controller が生成される。
- 旧 controller の遅延 cleanup が、新しく生成された controller の ref / 操作対象を消さない。

#### commit と focus 復元

主要 characterization test は次の流れを 1 本のシナリオとして確認する。

```text
controller A onCommit(reorderedBody, focusRowIndex)
  → setAttributes({ body: reorderedBody })
  → test harness が body prop を reorderedBody へ更新
  → controller A cleanup
  → controller B 生成
  → controller B.focusRowControlAt(focusRowIndex)
```

- `focusRowIndex` が指定された commit では、新 controller の `focusRowControlAt()` がその index で呼ばれる。
- `focusRowControlAt()` が成功した場合、pending focus は消費され、後続の不要な controller 再生成で再適用されない。
- `focusRowIndex` なしの commit では focus 復元を要求しない。

#### stale effect / unmount

- controller 作成 microtask が走る前に effect が cleanup された場合、古い effect 由来の controller が操作対象として残らない。
- 作成と cleanup が近接しても、disposed 済み effect 由来の controller は破棄される。
- unmount 時に生成済み controller が destroy される。

### 3. controller lifecycle を専用 custom hook へ分離する

Phase 1 が Green になった後、controller lifecycle は `use-table-reorder-controller.ts` の custom hook へ分離する。

概念的な責務は次とする。

```text
useTableReorderController
  ├─ controllerRef
  ├─ pendingFocusRowIndexRef
  ├─ controller creation / cleanup
  ├─ body / mode 変更後の再生成
  ├─ queueMicrotask / disposed の生存管理
  ├─ commit 時の pending focus 受け取り
  └─ 新 controller への focus 復元
```

この hook は controller を外へ公開せず、`useTableReorder` が必要とする狭い command API のみ返す。

概念形:

```ts
const { focusRowControl } = useTableReorderController( {
	anchorRef,
	body,
	clientId,
	enabled,
	interactionMode,
	onBodyCommit,
} );
```

実際の型名・引数名は実装時に現行コードへ合わせて最小化する。

#### controller hook が所有するもの

- `controllerRef`
- `pendingFocusRowIndexRef`
- runtime URL 解決
- `resolveTableContext()` を使った controller 作成条件
- rowspan range から controller option を構成する処理
- `queueMicrotask()` / `disposed`
- controller `destroy()`
- controller callback の `focusRowIndex` 保持と再生成後の `focusRowControlAt()`

#### controller hook が所有しないもの

- WordPress notice API
- coachmark / preferences
- hover / keyboard / pointer の入力判定 state
- touch reorder mode state
- HOC 向け toolbar state
- `setAttributes` 自体

Gutenberg との境界を残すため、親の `useTableReorder` が `onBodyCommit(reorderedBody)` を `setAttributesRef.current({ body: reorderedBody })` へ接続する。controller hook は Gutenberg の `setAttributes` を直接知らない。

`focusRowControl()` は現行 controller の戻り値をそのまま親へ返し、`current-row-not-movable` / `no-movable-rows` に対する notice 判断は `useTableReorder` に残す。

### 4. interaction / UI state を専用 custom hook へ整理する

Phase 1 で確認した selection / hover / touch mode の実際の境界を保ったまま、`use-table-reorder-interaction.ts` へ次をまとめる。

```text
useTableReorderInteraction
  ├─ hover capability
  ├─ keyboard / pointer input modality
  ├─ touch reorder mode
  ├─ keyboard coachmark preference
  ├─ touch coachmark preference
  ├─ coachmark dismiss
  └─ controller 用 interactionMode の導出
```

入力イベント監視は現在と同じ owning document 群を対象とし、iframe / non-iframe の挙動を維持する。

#### state の整理方針

`isKeyboardCoachmarkVisible` / `isTouchCoachmarkVisible` は独立した「永続状態」ではなく、既存 state と preference から算出できる範囲を derived state にする。

目標形は概ね次の関係とする。

```text
keyboard coachmark visible
  = enabled
  && isSelected
  && isHoverCapable
  && inputModality === keyboard
  && !keyboardCoachmarkDismissed

touch coachmark visible
  = enabled
  && isSelected
  && !isHoverCapable
  && !isTouchReorderMode
  && !touchCoachmarkDismissed
```

ただし Phase 1 の characterization test で、現行挙動に「単なる導出では表現できない一時状態」が確認された場合は、その状態だけ明示的 state として残す。derived state 化のために UI 挙動を変えない。

`isTouchReorderMode` はユーザー操作で切り替わる実 state として維持する。selection 解除または hover capable への切り替えで touch mode を終了する処理は interaction hook 内へ閉じ込め、coachmark visibility state を別 effect から相互 reset する構造は持ち込まない。

入力方式は boolean の `isKeyboardInput` より意図が明確になる場合、`'keyboard' | 'pointer'` の小さな modality 値へ整理する。新しい state machine は導入しない。

### 5. `useTableReorder` を orchestration layer に縮小する

分離後の `useTableReorder` は次だけを接続する。

```text
interaction hook
  └─ interactionMode / toolbar state / coachmark state
             │
             v
useTableReorder  ← Gutenberg setAttributes / notices
             │
             v
controller hook
  └─ create / destroy / commit lifecycle / focus restoration
```

親 hook に残す責務:

- `anchorRef`
- latest `createNotice` / `setAttributes` callback の接続
- controller commit を `setAttributes({ body })` へ変換
- `focusRowControl()` の結果を WordPress notice / live status へ変換
- touch mode を開始できない場合の no-movable-rows notice / announcement
- `TableReorderHookResult` の公開形を維持した組み立て

`with-table-reorder.tsx` から見える `TableReorderHookResult` は原則変更しない。内部ファイル分割のために HOC 側へ lifecycle 責務を押し戻さない。

### 6. 分離後も Phase 1 の tests を契約として残す

Phase 1 の characterization test は一時的な scaffolding として削除せず、分離後の orchestration regression test として維持する。

抽出した custom hook の内部実装を細かく再テストするより、まず `useTableReorder` の外部契約が変わっていないことを優先する。抽出後に分岐が複雑で単体確認の価値が高い場合のみ、各 custom hook の focused test を追加する。

## Architecture

### `use-table-reorder.ts`

責務:

- Table Reorder React 側の orchestration
- Gutenberg callback / notice 接続
- HOC 向け公開 API の維持

依存方向:

```text
with-table-reorder.tsx
        │
        v
use-table-reorder.ts
   ├─> use-table-reorder-interaction.ts
   └─> use-table-reorder-controller.ts
             │
             v
      controller/sortable-controller.ts
```

### `use-table-reorder-interaction.ts`

責務:

- hover / input modality / touch mode
- coachmark preference と visibility
- `interactionMode` 導出

非責務:

- SortableJS controller lifecycle
- notices
- `setAttributes`

### `use-table-reorder-controller.ts`

責務:

- SortableJS controller lifecycle
- body / mode 変更時の cleanup / 再生成
- pending focus と再生成後の focus 復元
- stale microtask の破棄

非責務:

- coachmark / preferences
- Gutenberg notices
- toolbar UI

## Implementation phases

### Phase 1: lifecycle characterization tests

Outcome:

- 現行 `useTableReorder` の副作用順序と controller 生存条件が、実装分割前にテストで固定される。

Tasks:

- `src/editor-extensions/table-reorder/use-table-reorder.test.ts` を追加する。
- hook を mount / rerender / unmount できる最小 test harness を用意する。
- WordPress data / preferences、`matchMedia`、`resolveTableContext()`、`createSortableController()` を lifecycle 観測に必要な範囲だけ mock する。
- hover mode での controller 生成を固定する。
- touch mode の開始 / 終了による controller 生成・cleanup を固定する。
- `enabled=false` の非生成を固定する。
- `body` 更新時の旧 controller cleanup と新 controller 生成を固定する。
- `onCommit(reorderedBody, focusRowIndex)` から `setAttributes`、body rerender、新 controller、focus 復元までを 1 本の主要 characterization test で固定する。
- stale effect / stale cleanup が新 controller を壊さないケースを固定する。
- unmount destroy を固定する。

Validation:

- 新規 `use-table-reorder.test.ts` を単独実行して Green を確認する。
- この Phase では production code の lifecycle を変更しない。

### Phase 2: controller lifecycle の分離

Outcome:

- controller の生成・破棄・再生成と pending focus が `useTableReorder` の UI state から分離される。

Tasks:

- `use-table-reorder-controller.ts` を追加する。
- `controllerRef` / `pendingFocusRowIndexRef` / `queueMicrotask()` / `disposed` を専用 hook へ移す。
- runtime URL / table context / rowspan constraints から controller を作る現在の条件を維持する。
- controller の `onCommit()` で focus index を lifecycle hook 内に保持し、body commit は親 callback へ渡す。
- 新 controller 生成後の `focusRowControlAt()` と pending focus 消費を lifecycle hook 内へ閉じ込める。
- controller へ対する toolbar command は狭い `focusRowControl()` API として返す。
- `useTableReorder` 側の notices と `setAttributes` 接続は維持する。

Validation:

- Phase 1 characterization tests が Green のままであることを確認する。
- controller lifecycle に必要な追加 edge case が見つかった場合のみ focused test を補う。

### Phase 3: interaction / coachmark state の整理

Outcome:

- hover / input / touch mode / coachmark の相互 reset effect が減り、controller lifecycle と独立して読める。

Tasks:

- `use-table-reorder-interaction.ts` を追加する。
- hover capability と document input listeners を interaction hook へ移す。
- keyboard / pointer 入力方式を boolean または小さな modality 値として interaction hook 内へ閉じ込める。
- touch reorder mode と selection / hover change 時の終了条件を interaction hook 内にまとめる。
- keyboard / touch coachmark preferences と dismiss 処理を interaction hook へ移す。
- `isKeyboardCoachmarkVisible` / `isTouchCoachmarkVisible` は Phase 1 で固定した挙動を維持できる範囲で derived state 化する。
- visibility のためだけに state を相互 reset する effect を削除する。
- `interactionMode` を interaction hook の出力として導出する。

Validation:

- Phase 1 characterization tests が Green のままであることを確認する。
- selection / hover / touch reorder mode の切り替えで controller lifecycle が変わっていないことを確認する。
- coachmark preference / dismiss の既存挙動を focused test で確認する。

### Phase 4: orchestration 整理と全体検証

Outcome:

- `useTableReorder` が interaction hook、controller hook、Gutenberg 接続を組み合わせる薄い orchestration layer になる。

Tasks:

- `use-table-reorder.ts` に残った state / effect を見直し、Gutenberg 接続と公開 API に不要なものが残っていないことを確認する。
- `TableReorderHookResult` と `with-table-reorder.tsx` の既存利用形を維持する。
- 分離後の依存方向が interaction → orchestration ← controller になり、interaction hook から controller hook を直接操作しないことを確認する。
- 重複した table context / notice / preference 処理が生じていないか確認し、必要最小限だけ整理する。

Validation:

- Table Reorder 関連 unit tests
- `npm run typecheck`
- 最終 repository validation

## Decisions and validation questions

### Decide before implementation

Issue #276 と現行実装から、次を本 plan の方針として固定する。

- `useTableReorder` は最終 orchestration layer として残す。
- controller lifecycle は専用 custom hook に分離する。
- interaction / UI state も専用 custom hook にまとめる。
- generic helper / shared module にはしない。React lifecycle と effect を所有するため custom hook が責務に合う。
- controller hook は `setAttributes` / notices / preferences を直接知らない。
- interaction hook は SortableJS controller を直接知らない。
- `TableReorderHookResult` は原則変更しない。
- `queueMicrotask()` / `disposed` の非同期方式そのものは Phase 2 で必要以上に再設計しない。まず専用境界へ閉じ込める。
- preference key と persisted value は変更しない。

### Validate during implementation

- Phase 1 の test harness は既存依存だけで十分か確認し、test utility dependency は追加しないことを優先する。
- keyboard coachmark visibility を完全な derived state にできるかは、focus dismiss / preference store 更新タイミングを characterization test で確認して決める。既存挙動を変えるなら明示 state を残す。
- controller hook の public command API は `focusRowControl()` 1つで十分か、実装時の実利用から確認する。controller object / ref 自体は公開しない。
- `resolveTableContext()` を interaction listener 用と controller creation 用にそれぞれ呼ぶ現行境界は、無理に共有して lifecycle coupling を増やさない。

## Issue breakdown

本 Issue は段階的にレビューできるため、実装時は Issue 本文の Phase と同じ順序で進める。

- [ ] Phase 1: `useTableReorder` lifecycle characterization tests
- [ ] Phase 2: controller lifecycle custom hook 分離
- [ ] Phase 3: interaction / coachmark state custom hook + derived state 整理
- [ ] Phase 4: orchestration 整理 + 全体検証

子 Issue を作る場合も、この plan を正本として Phase 単位を実装境界にする。実装プランのレビュー前には子 Issue を先に細分化しない。

## Validation

実装時は狭い test から進め、各 Phase で characterization tests を Green に保つ。

Focused checks:

```bash
npm run test:unit -- use-table-reorder.test.ts
npm run typecheck
```

Table Reorder 関連の既存 controller tests も、controller 接続変更後の回帰確認として実行する。

最終 handoff 前:

```bash
npm test
npm run build
git diff --check origin/main...HEAD
```

手動検証はユーザーが実施する。

## Completion criteria

- `useTableReorder` の主要 lifecycle が characterization test で固定されている。
- hover mode / touch mode / disabled の controller 生存条件が固定されている。
- `body` 更新時に旧 controller が cleanup され、新 controller が生成される。
- `commit → setAttributes → body 更新 → controller 再生成 → focus 復元` が regression test で保護されている。
- stale effect / stale cleanup が新 controller を残さない、または破壊しないことが保護されている。
- unmount で controller が destroy される。
- controller lifecycle が専用 custom hook に閉じ込められている。
- `controllerRef` / `pendingFocusRowIndexRef` / `queueMicrotask()` / `disposed` が interaction / UI state 管理から分離されている。
- interaction / UI state が controller lifecycle と別の custom hook へ整理されている。
- coachmark visibility のためだけの相互 reset effect が削減されている。
- derived state 化した状態が既存 UI 挙動を変えていない。
- `useTableReorder` が Gutenberg `setAttributes` / notices / HOC 向け API を接続する orchestration layer として残っている。
- `TableReorderHookResult` の既存利用形が維持されている。
- hover / keyboard / pointer / touch の既存操作仕様が変わっていない。
- iframe / non-iframe の既存 table context 解決が維持されている。
- preference key / persisted behavior が変わっていない。
- 既存 tests と追加 tests が Green。
- lint / typecheck / build 等の repository validation が Green。

## Notes

このリファクタリングの目的は hook を細かく分けること自体ではなく、変更時に追う副作用の範囲を小さくすること。

Phase 1 の characterization tests を設計のガードレールとし、Phase 2 / 3 ではその境界を壊さない範囲だけを抽出する。新しい abstraction が現行挙動を説明するより複雑になる場合は、抽出量を減らして `useTableReorder` に orchestration 責務として残す。