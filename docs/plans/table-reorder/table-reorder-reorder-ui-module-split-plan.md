# PLAN-278: Table Reorder reorder-ui.ts 責務分割

## References

- Parent issue: #278
- Parent refactoring: #275
- Current implementation: `src/editor-extensions/table-reorder/controller/reorder-ui.ts`
- Main consumer: `src/editor-extensions/table-reorder/controller/sortable-controller.ts`
- React / Gutenberg consumer: `src/editor-extensions/table-reorder/use-table-reorder.ts`
- Current focused tests: `src/editor-extensions/table-reorder/controller/reorder-ui.test.ts`
- Source organization: `docs/development/source-organization.md`

## Goal

`controller/reorder-ui.ts` に集中している複数種類の UI / DOM lifecycle を、既存 API と既存挙動を維持したまま責務単位の module へ分割する。

今回の目的はロジックの再設計ではなく、現在すでに独立している変更理由をファイル境界へ反映することである。`sortable-controller.ts` や `use-table-reorder.ts` から見える API は一度に変更せず、`reorder-ui.ts` を薄い facade として残して内部構造だけを整理する。

最終的に、行 control、操作 guidance、single-pointer 移動先、live status をそれぞれ個別に変更・テストしやすい構造にする。

## Scope

### Included

- 現在の `reorder-ui.ts` の export と利用箇所を確認し、互換契約を固定する。
- `row-controls.ts` を追加し、行 control lifecycle と代表テキスト取得、control event propagation 抑止を移動する。
- `reorder-guidance.ts` を追加し、操作 guidance と keyboard destination scroll を移動する。
- `row-move-targets.ts` を追加し、single-pointer / touch の移動先 UI lifecycle を移動する。
- `live-status.ts` を追加し、owning document ごとの live status lifecycle を移動する。
- `reorder-ui.ts` は既存 import 境界を維持する facade として残す。
- `yamabiko-table-reorder-description` class を live status node に引き続き付与し、既存の visually-hidden CSS 契約を維持する。
- 既存テストで不足する明確な回帰契約だけ focused test を追加する。
- 分割後、テストを責務単位へ移す価値がある場合のみ test file を整理する。

### Not included

- Table Reorder の UI / 操作仕様変更。
- keyboard / pointer / touch / drag session logic の再設計。
- `sortable-controller.ts` の interaction state や session state の再設計。
- `useTableReorder` lifecycle / state の整理。
- React renderer、ARIA helper、style helper などへの追加細分化。
- touch gesture 判定アルゴリズムの変更。
- keyboard scroll アルゴリズムの変更。
- event propagation 方針の変更。
- Tooltip / accessible name / description / pressed state の仕様変更。
- 新しい UI framework、state library、generic `shared` / `utils` / `helpers` module の導入。
- リファクタリングと無関係な機能追加。

## Approach

### 1. `reorder-ui.ts` の公開契約を先に固定する

分割前に、現在 `reorder-ui.ts` から公開されている API と利用側を確認する。

主な公開契約は次とする。

```text
reorder-ui.ts
├─ HANDLE_ZONE_CLASS
├─ DESTINATION_CLASS
├─ RowControlEntry / RowControls / RowControlOptions
├─ ReorderGuidancePosition / ReorderGuidanceUi
├─ RowMoveTargetsOptions / RowMoveTargetsUi
├─ getRowRepresentativeText()
├─ announceLiveStatus()
├─ createReorderGuidance()
├─ scrollKeyboardDestinationIntoView()
├─ createRowControls()
├─ createRowMoveTargets()
└─ stopRowControlInteractionPropagation()
```

`sortable-controller.ts` と `use-table-reorder.ts` は最初の分割ではこの facade を引き続き import する。内部 module への直接 import へ切り替えることは今回の完了条件にしない。

これにより、責務分割と consumer 側の依存整理を同時に行わず、変更の軸を一つに絞る。

### 2. `row-controls.ts` へ行 control lifecycle を移動する

`row-controls.ts` は、Table の各 movable row に付与する row control の生成から cleanup までを所有する。

移動対象:

- `HANDLE_ZONE_CLASS`
- `HANDLE_CLASS`
- `DESCRIPTION_CLASS` のうち row control description 用の利用
- `HANDLE_GUTTER_PX`
- `MAX_ROW_LABEL_LENGTH`
- `descriptionSequence`
- `RowControlEntry`
- `RowControls`
- `RowControlOptions`
- `getRowRepresentativeText()`
- `createRowControls()`
- `stopRowControlInteractionPropagation()`

責務:

- native button / handle の生成
- React root / WordPress Tooltip の描画
- accessible name / pointer description / keyboard description
- `aria-pressed`
- focus / blur による Tooltip と description 切り替え
- hover / touch mode の visibility
- first cell の `position` / `paddingInlineStart` 調整と復元
- control に関連する event propagation の抑止
- React root、DOM、listener、style の cleanup

`createRowControls()` の内部構造は今回さらに分割しない。React renderer、ARIA、style を別 helper へ抽出すると変更範囲が広がるため、ファイル単位の責務分割に留める。

### 3. `reorder-guidance.ts` へ viewport guidance を移動する

`reorder-guidance.ts` は、操作中にユーザーが現在位置と移動先を把握するための viewport 関連 UI を所有する。

移動対象:

- `GUIDANCE_CLASS`
- `KEYBOARD_SCROLL_MARGIN_PX`
- `GUIDANCE_VIEWPORT_OFFSET_PX`
- `ReorderGuidancePosition`
- `ReorderGuidanceUi`
- `createReorderGuidance()`
- `scrollKeyboardDestinationIntoView()`

責務:

- guidance element の生成
- top / bottom position の切り替え
- resize / scroll への追従
- keydown での guidance position 更新
- keyboard destination が viewport 外へ出た場合の必要最小限の scroll
- listener / DOM cleanup

keyboard scroll は単独 module には分けない。どちらも「操作中の viewport 追従」という同じ変更理由を持つため、同一 module にまとめる。

### 4. `row-move-targets.ts` へ single-pointer destination UI を移動する

`row-move-targets.ts` は、pointer / touch で row control を選択した後に一時表示する destination UI の lifecycle を所有する。

移動対象:

- `DESTINATION_CLASS`
- `CANCEL_CLASS`
- `POINTER_TAP_THRESHOLD_PX`
- `RowMoveTargetsOptions`
- `RowMoveTargetsUi`
- `createRowMoveTargets()`

責務:

- destination button の生成
- touch cancel button の生成
- destination の accessible label
- click / pointer event
- swipe を tap と誤判定しないための touch gesture 判定
- resize / scroll による target position 更新
- guidance との lifecycle 接続
- listener / DOM / guidance cleanup

`createRowMoveTargets()` は `createReorderGuidance()` と `getRowRepresentativeText()` を下位 module から利用する。

依存方向は次のように保つ。

```text
row-move-targets.ts
├─> reorder-guidance.ts
└─> row-controls.ts
```

逆方向の依存は作らない。

### 5. `live-status.ts` へ status announcement を移動する

`live-status.ts` は owning document ごとの支援技術向け status announcement を所有する。

移動対象:

- `LIVE_STATUS_CLASS`
- `liveStatusByDocument`
- `announceLiveStatus()`

責務:

- document ごとの status node 生成・再利用
- `role="status"`
- `aria-live="polite"`
- `aria-atomic="true"`
- 同一文言を再通知できるよう一度空にして microtask で再設定する処理
- disconnected node の再生成

現在 status node は次の 2 class を持つ。

```text
yamabiko-table-reorder-description
yamabiko-table-reorder-live-status
```

分割後も `yamabiko-table-reorder-description` を必ず維持する。これは `editor.scss` の visually-hidden 表示契約であり、`DESCRIPTION_CLASS` の所有場所を変更した結果として class が外れることを許容しない。

このためだけに共通 constants module は追加しない。必要なら同じ literal class name をそれぞれの責務 module で保持する。小さな重複より依存方向が不明瞭な抽象化を避ける。

### 6. `reorder-ui.ts` を facade に縮小する

責務移動後の `reorder-ui.ts` は、既存 consumer 向けの export 集約だけを行う薄い facade とする。

概念形:

```ts
export { announceLiveStatus } from './live-status';
export {
	createReorderGuidance,
	scrollKeyboardDestinationIntoView,
	type ReorderGuidancePosition,
	type ReorderGuidanceUi,
} from './reorder-guidance';
export {
	createRowControls,
	getRowRepresentativeText,
	HANDLE_ZONE_CLASS,
	stopRowControlInteractionPropagation,
	type RowControlEntry,
	type RowControlOptions,
	type RowControls,
} from './row-controls';
export {
	createRowMoveTargets,
	DESTINATION_CLASS,
	type RowMoveTargetsOptions,
	type RowMoveTargetsUi,
} from './row-move-targets';
```

実際の export 文は lint / typecheck と既存 import 利用に合わせて最小化する。

facade 自体に新しい lifecycle や logic は持たせない。

### 7. テストは契約を維持しつつ責務単位へ整理する

Phase 1 では、既存 `reorder-ui.test.ts` と controller tests が何を保証しているかを確認する。

最低限維持する契約:

#### row controls

- movable row のみに control が生成される。
- row representative text が維持される。
- hover mode では同時に表示される control が 1 件に制限される。
- `aria-pressed` が session 状態と同期する。
- focus / blur で pointer / keyboard description が切り替わる。
- Tooltip を利用し native `title` を付与しない。
- cleanup で生成 DOM、React root、listener、cell style が復元される。

#### live status

- owning document 内で status node が 1 件だけ再利用される。
- 最新 announcement が設定される。
- status node が `yamabiko-table-reorder-description` と `yamabiko-table-reorder-live-status` の両 class を持つ。
- `role` / `aria-live` / `aria-atomic` が維持される。

#### guidance

- guidance の生成・表示切り替え・cleanup が維持される。
- resize / scroll / keydown listener が cleanup される。
- keyboard destination scroll の既存境界を変更しない。

#### row move targets

既存 controller tests で十分に覆われていない場合のみ focused test を追加し、次を固定する。

- valid target のみ button を生成する。
- accessible label が維持される。
- touch cancel が callback を呼ぶ。
- threshold を超える pointer move 後の click は確定として扱わない。
- cleanup 後に target / guidance / listener が残らない。

テストファイルは最初から機械的に 4 分割しない。責務移動後に test の意図が明確になる場合のみ、`row-controls.test.ts` / `reorder-guidance.test.ts` / `row-move-targets.test.ts` / `live-status.test.ts` へ整理する。

## Architecture

分割後の責務境界:

```text
controller/
│
├─ sortable-controller.ts
│    └─ interaction / session orchestration
│
├─ reorder-ui.ts
│    └─ existing public facade only
│
├─ row-controls.ts
│    ├─ row control lifecycle
│    ├─ representative row text
│    └─ control propagation boundary
│
├─ reorder-guidance.ts
│    ├─ operation guidance lifecycle
│    └─ keyboard destination scroll
│
├─ row-move-targets.ts
│    └─ pointer / touch destination UI lifecycle
│
└─ live-status.ts
     └─ assistive-technology status lifecycle
```

依存方向:

```text
sortable-controller.ts
        │
        v
   reorder-ui.ts
   facade only
        │
        ├──────────────> row-controls.ts
        ├──────────────> reorder-guidance.ts
        ├──────────────> row-move-targets.ts
        └──────────────> live-status.ts

row-move-targets.ts
   ├──────────────> row-controls.ts
   └──────────────> reorder-guidance.ts
```

`row-controls.ts` / `reorder-guidance.ts` / `live-status.ts` は相互に依存しない。

## Implementation phases

### Phase 1: current contract inventory

Outcome:

- 分割前に、`reorder-ui.ts` の公開 API、consumer、既存回帰契約が明確になる。

Tasks:

- `sortable-controller.ts` / `use-table-reorder.ts` の `reorder-ui.ts` import を確認する。
- `reorder-ui.test.ts` と controller tests の relevant assertions を確認する。
- live status の visually-hidden class 契約を focused assertion で固定する。
- row move target の tap / swipe / cleanup 契約が不足している場合のみ focused test を追加する。
- 新しい abstraction が必要になっていないことを確認する。

Validation:

- Phase 1 で追加した test を含め、既存 unit tests が Green になる。

### Phase 2: split row controls and live status

Outcome:

- 行 control と live status が独立 module へ移り、facade 経由の既存 API が維持される。

Tasks:

- `row-controls.ts` を追加する。
- row control 関連 implementation / types / constants を移動する。
- `live-status.ts` を追加する。
- `announceLiveStatus()` と document-scoped state を移動する。
- `reorder-ui.ts` から facade export する。
- live status node の `yamabiko-table-reorder-description` class を維持する。

Validation:

- row control / live status focused tests が Green になる。
- `sortable-controller.ts` / `use-table-reorder.ts` の import を変更せず既存 tests が Green になる。

### Phase 3: split guidance and row move targets

Outcome:

- viewport guidance と single-pointer destination UI がそれぞれ独立 module へ移る。

Tasks:

- `reorder-guidance.ts` を追加する。
- guidance / keyboard scroll implementation と types を移動する。
- `row-move-targets.ts` を追加する。
- destination UI / cancel / pointer gesture / positioning implementation と types を移動する。
- `row-move-targets.ts` から `row-controls.ts` / `reorder-guidance.ts` への一方向依存を維持する。
- `reorder-ui.ts` から facade export する。

Validation:

- guidance / row move target focused tests と controller tests が Green になる。
- keyboard / pointer / touch の既存 session tests が Green になる。

### Phase 4: facade and test organization cleanup

Outcome:

- `reorder-ui.ts` が export 集約だけの薄い facade になり、責務ごとの source boundary が明確になる。

Tasks:

- `reorder-ui.ts` に logic が残っていないことを確認する。
- 循環依存がないことを確認する。
- test file の分割が読みやすさを改善する場合のみ責務単位へ移動する。
- Table Reorder README の file / responsibility 一覧が実装とずれる場合は同じ変更で更新する。
- 不要になった import / duplicate type declaration を整理する。

Validation:

- `npm test`
- `npm run build`
- `git diff --check origin/main...HEAD`
- manual smoke check: hover / keyboard / pointer / touch の代表操作で UI と announcement が変わっていないことを確認する。

## Decisions and validation questions

### Decide before implementation

- `reorder-ui.ts` は今回削除せず facade として残す。
- consumer 側を直接新 module import へ切り替えることは今回行わない。
- generic constants / helpers module は追加しない。
- `createRowControls()` 内部の React / ARIA / style 細分化は行わない。
- touch gesture と keyboard scroll のアルゴリズムは変更しない。

### Validate during implementation

- `row-move-targets.ts` の focused test が現状不足しているか。controller tests で十分なら重複 test は増やさない。
- test file を責務単位に分割した方が意図が明確になるか。単なるファイル数増加になる場合は既存 test file を維持する。
- `DESCRIPTION_CLASS` の文字列重複を許容した方が依存が明確か。今回の規模では shared constants module を作らないことを優先する。

## Issue breakdown

Plan review 後、必要なら次の実装単位で child issue 化する。

- [ ] Phase 1: current contract inventory / focused regression tests
- [ ] Phase 2: `row-controls.ts` / `live-status.ts` extraction
- [ ] Phase 3: `reorder-guidance.ts` / `row-move-targets.ts` extraction
- [ ] Phase 4: facade / tests / README cleanup

4 Phase を必ず別 Issue にする必要はない。実装時の差分サイズとレビュー容易性を見て、Phase 2 と Phase 3 を独立 PR にする価値がある場合のみ分割する。

## Validation

Implementation 完了時の標準 validation:

- `npm test`
  - Expected: format / JS lint / CSS lint / typecheck / unit tests がすべて成功する。
- `npm run build`
  - Expected: production assets が正常に生成される。
- `git diff --check origin/main...HEAD`
  - Expected: whitespace error がない。
- manual check: hover-capable editor
  - Expected: row control の hover / keyboard focus / Tooltip / keyboard reorder が既存と同じ。
- manual check: pointer destination selection
  - Expected: destination UI / guidance / cancel / commit が既存と同じ。
- manual check: touch reorder mode
  - Expected: tap / scroll gesture / destination selection / cancel が既存と同じ。
- manual check: assistive announcement
  - Expected: live status が visually hidden のまま支援技術向け status として更新される。

この PR 自体は implementation plan のみを追加するため、アプリケーション validation は実施対象外とする。実装時の検証はユーザーが実施する。

## Completion criteria

- `row-controls.ts` が row control lifecycle を所有している。
- `reorder-guidance.ts` が guidance / keyboard scroll を所有している。
- `row-move-targets.ts` が pointer / touch destination UI lifecycle を所有している。
- `live-status.ts` が document-scoped live status lifecycle を所有している。
- `reorder-ui.ts` は既存 API を再 export する薄い facade になっている。
- `sortable-controller.ts` / `use-table-reorder.ts` から見える既存 import contract が維持されている。
- hover / keyboard / pointer / touch の UI・操作仕様が変わっていない。
- Tooltip / ARIA / focus / live status の既存挙動が維持されている。
- live status node が `yamabiko-table-reorder-description` class を維持している。
- cleanup 後に生成 DOM、listener、React root、変更した cell style が残らない。
- module 間に循環依存がない。
- 不要な新規 abstraction が導入されていない。
- 実装時の applicable validation が成功する。

## Notes

- #278 の Issue 本文をこの計画の要件上の正本とする。
- #276 の `useTableReorder` lifecycle / state 整理とは独立して進める。双方が同時進行しても、今回の変更は `controller/reorder-ui.ts` の内部 module boundary に限定する。
- `sortable-controller.ts` 側の session refactoring を同時に行わない。責務分割の PR で interaction logic の変更が混ざると回帰原因を切り分けにくくなるためである。
