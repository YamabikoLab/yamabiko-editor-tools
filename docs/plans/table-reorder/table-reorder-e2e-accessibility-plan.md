# PLAN-261: Table Reorder E2E アクセシビリティ UI・フォーカス・通知

## References

- Parent issue: #252
- Implementation issue: #261
- Merged-cell constraints: #259
- Data retention / Undo: #260
- Touch first-run UI follow-up: #382
- Test responsibility map: `docs/development/testing.md`
- E2E implementation instructions: `tests/e2e/AGENTS.md`
- Requirements: `docs/requirements/table-reorder/table-reorder-requirements.md`
- Accessibility requirements: `docs/requirements/table-reorder/table-reorder-accessibility-requirements.md`
- Design: `docs/design/table-reorder/table-reorder-design.md`
- Accessibility design: `docs/design/table-reorder/table-reorder-accessibility-design.md`

## Goal

Table Reorder が実 WordPress / Gutenberg / Chromium 環境でも、利用者が操作対象・操作状態・操作結果を見失わず、支援技術から必要な情報を確認できることを Playwright E2E で固定する。

本プランは #252 の方針に従い、アクセシビリティ実装の DOM 詳細や文言生成ロジックを網羅するテストにはしない。既存 Jest が担当するメッセージ選択、live region 更新ロジック、row control の DOM 構築などは重複して検証せず、実ブラウザ上で利用者が触れる UI とフォーカス、アクセシビリティツリー、通知の統合結果を代表シナリオで確認する。

主に次を E2E の責務とする。

- 行の並べ替え操作 UI の accessible name / role / state が対象行と操作内容を識別できること。
- キーボード、PC のドラッグ不要単一ポインター操作で、操作中・確定後・キャンセル後にフォーカス文脈が保たれること。
- 操作状態に応じた画面上の案内が表示・切り替えされること。
- live region から開始、移動先変更、確定、キャンセル、移動不能理由を確認できること。
- Table Reorder 自身の案内がフォーカス対象を完全に覆わないこと。
- 代表的なポインター操作 UI が必要な操作領域を持つこと。
- iframe / non-iframe で利用者向けの意味が変わらないこと。

Touch の初回 Table 操作、Toolbar フォーカス、初回 coachmark、Tooltip 非重複は #382 の責務とし、本 Issue では再テストしない。

## Scope

### Included

- `core/table` の代表 fixture を使った accessibility UI / focus / notification の実ブラウザ確認
- Toolbar の「Reorder rows / 行を並べ替え」の accessible name / role
- 移動可能な各 row control の button role と、現在位置・行内容を含む accessible name
- キーボード待機中と並べ替え中の画面上の案内
- PC 単一ポインターで移動対象を選択したときの操作中案内
- キーボード並べ替え開始時の live region 通知
- キーボードで有効な移動先が変わったときの live region 通知
- 有効位置へ確定したときの live region 通知と、移動後の同じ行へのフォーカス維持
- キャンセル時の live region 通知と、操作開始行へのフォーカス復元
- 先頭 / 末尾でそれ以上進めないときの移動不能通知
- `rowspan` によって移動できない行から入口を実行したときの理由通知
- 移動可能な本文行が存在しない Table での通知
- 代表的な row control / destination UI の操作領域
- 長い Table で、操作対象・移動先・案内のフォーカス文脈が表示追従後も失われないこと
- iframe / non-iframe の代表ケース

### Not included

- 各入力方式の基本的な行移動フローそのものの再テスト。#255、#256、#257、#258、#360 を正とする。
- `rowspan` / `colspan` の移動可否や禁止 insertion index の網羅。#259 と Jest を正とする。
- セル内容・属性・装飾の保持、Undo / Redo。#260 の責務とする。
- Touch 初回操作時のセル編集抑止、Table 選択、Toolbar フォーカス、Touch coachmark、Tooltip 非重複。#382 の責務とする。
- キーボード向け初回 coachmark の表示条件そのもの。起動・初回 UI の既存 E2E 責務と重複させない。
- PC pointer DnD / Touch DnD のアクセシビリティ情報を各ドラッグ操作ごとに反復確認すること。
- メッセージ formatter、翻訳分岐、live region DOM 更新の細かな分岐。既存 Jest を正とする。
- すべての行、入力方式、通常幅 / 全幅、iframe / non-iframe の直積網羅。
- Flexible Table Block の E2E。Core Table の #261 が完了した後に別途扱う。
- 製品コードの変更。

## Source-of-truth mapping

| Source of truth | Required behavior | #261 E2E observation |
| --- | --- | --- |
| A11Y-FR-05 / A11Y design §5.4, §6 | 操作中・操作後に文脈を失わない | 開始中は対象 row control にフォーカスを維持し、確定後は移動後の同じ行、キャンセル後は開始行へフォーカスがある |
| A11Y-FR-06 / §7.1 | フォーカスを視覚的に確認できる | focused row control が可視で、hover に依存せず存在する |
| A11Y-FR-07 / §7.2 | Table Reorder 自身の UI がフォーカス対象を完全に隠さない | focused control と guidance の bounding box が全面的に重ならず、長い Table の追従後も対象を確認できる |
| A11Y-FR-08 / §9 | 必要な操作案内を画面上で確認できる | 待機中、keyboard moving、PC destination selection の各状態で対応する guidance が表示・終了する |
| A11Y-FR-09 / §12 | 状態・結果・移動不能理由を支援技術から確認できる | live region から開始、destination change、確定、キャンセル、境界、rowspan 理由を確認できる |
| A11Y-FR-10 / §4, §11 | name / role / state を判別できる | row control が button として取得でき、accessible name に行番号と代表情報が含まれる |
| A11Y-FR-03 / §8 | ポインター UI に必要な操作領域がある | 代表 row control / destination target の bounding box が原則 24 × 24 CSS px 以上 |
| A11Y-FR-12 / §14 | iframe / non-iframe で意味を共通化する | 同じ locator / helper と user-visible assertion で代表シナリオが成立する |

## Approach

### 1. 専用 spec を追加し、既存操作 spec の責務を膨らませない

`tests/e2e/table-reorder-accessibility.spec.ts` を追加し、#261 固有の assertion をまとめる。

既存 `table-reorder-keyboard.spec.ts` や `table-reorder-pc-single-pointer.spec.ts` は入力方式の基本操作を正とするため、そこへ live region や accessible name の assertion を大量に追加しない。

ただし、既存 helper が同じ利用者操作を表している場合は再利用する。低レベル DOM traversal や製品内部 class への依存を新たに広げない。

### 2. accessible name / role は role locator で確認する

row control は `getByRole( 'button', { name: ... } )` または既存 `getRowControl()` を使い、次を確認する。

- button としてアクセシビリティツリーから取得できる。
- accessible name が現在の行番号と行内容の代表情報を含む。
- 行移動後は、新しい現在位置を反映した accessible name へ更新される。

DOM の `aria-label` 属性値そのものを主要 assertion にしない。利用者 / 支援技術から取得できる accessible name を観測する。

### 3. フォーカスは「同じ行を追跡できること」を確認する

キーボード操作では既存の代表シナリオを土台に、次を一つの統合フローで確認する。

1. Toolbar 入口から `Bravo` の row control へ入る。
2. `Enter` で開始する。
3. `ArrowDown` で有効な移動先を変更する。
4. 操作中も `Bravo` の row control にフォーカスが維持される。
5. `Space` で確定する。
6. 移動後の `Bravo` row control にフォーカスがある。
7. accessible name の行番号が移動後の位置へ更新される。

キャンセルは別の短いケースで、開始位置へ戻ることを確認する。

PC 単一ポインター操作では、handle click で対象を選んだ時点で対象 row control がフォーカス対象になり、確定 / キャンセル後にも同じ行を追跡できることを代表確認する。

### 4. live region はユーザー向け状態変化を順番に確認する

製品内部の notification 関数やイベント順序は assertion しない。

実ブラウザ上の live region を role / aria-live semantics で取得し、状態変化後に `expect(...).toContainText()` または `expect.poll()` で利用者向け通知を確認する。

代表シナリオは次とする。

- keyboard start: 対象行、現在位置、総行数
- keyboard destination change: 対象行、移動予定位置、総行数
- confirm: 対象行、移動元、移動先
- cancel: 対象行、維持された位置
- boundary: それ以上移動できない方向
- rowspan: 移動できない理由
- no movable rows: 並べ替え可能行が存在しないこと

テストは英語 / 日本語の両方を個別に重複実行せず、既存 E2E と同様に現在 locale のどちらでも一致する正規表現を使用する。

同一通知を連続して必要以上に繰り返さない仕様は、DOM 内部の更新回数ではなく、同じ境界キーを連打したときに利用者向け状態が不必要に増殖しないことを確認できる場合のみ E2E に含める。安定した user-visible assertion が作れない場合は Jest の責務に残す。

### 5. 操作案内は状態遷移で確認する

画面固定 guidance / tooltip は「文言が存在する」だけでなく、操作状態に合わせて切り替わることを確認する。

代表フロー:

- row control がキーボードフォーカスを受ける → `Enter / Space: start moving` が確認できる。
- keyboard moving 開始 → 待機中 tooltip が終了し、keyboard moving guidance が表示される。
- confirm / cancel → moving guidance が終了する。
- PC handle click → destination-selection guidance が表示される。
- destination selection 終了 → guidance が終了する。

初回 coachmark との非重複は #382 に任せるため、本 spec では関連 preference を明示的に dismissed にして開始する。

### 6. フォーカス遮蔽は geometry の代表ケースだけを測る

すべての viewport / browser size を網羅しない。

長い Table の既存 keyboard scroll scenario を参考に、対象 row control または insertion line と guidance の bounding box を取得し、Table Reorder の案内がフォーカス対象を完全に覆っていないことを代表ケースで確認する。

CSS の pixel-perfect な座標や特定の offset 値は assertion しない。

### 7. ターゲットサイズは代表 UI だけを測る

PC row control と destination target の代表一つについて bounding box を取得し、幅・高さが原則 24 CSS px 以上であることを確認する。

視覚アイコン自体のサイズではなく、実際に pointer input を受ける操作領域を測る。

Touch について同じ CSS contract を共有している場合は PC / Touch 双方を反復しない。異なる UI が使われている場合だけ Touch の代表 target を追加する。

### 8. `rowspan` 通知は #259 と責務を分ける

#259 は「移動できない」という制約そのものを確認する。

#261 では制約計算を再テストせず、既存 / 共通 fixture で `rowspan` 内の行から Toolbar の「Reorder rows」を実行したときに、フォーカスが Toolbar に留まり、live region / 一時通知から理由を確認できることだけを確認する。

同様に「移動可能な行がない Table」も、行可否計算ではなく利用者への情報提供だけを確認する。

### 9. iframe / non-iframe は横断マトリクスとして扱う

#252 の方針どおり、すべての accessibility ケースを両環境で複製しない。

`getEditorContext()` を使用し、少なくとも次の代表境界が iframe / non-iframe の双方で同じ意味になることを確認する。

- row control の accessible name / role
- Toolbar 入口から row control へのフォーカス
- confirm / cancel 後のフォーカス
- live region の開始または確定通知

実装時の `wp-dev` 対応バージョンで両編集環境を実行できる場合に横断検証する。環境差の切り替えを test 内部の製品実装へ持ち込まない。

## Expected test cases

### A. Accessible identity

1. Toolbar entry is exposed as a button named `Reorder rows / 行を並べ替え`.
2. Movable row controls are exposed as buttons with row number and row summary in the accessible name.
3. After a row move, the moved row control name reflects its new row number.

### B. Keyboard focus and notifications

4. Starting keyboard reorder keeps focus on the source row control and announces the moving row / position.
5. `ArrowDown` / `ArrowUp` changes the valid destination and announces the new target position without moving focus away from the source row control.
6. Confirming a move announces the old / new position and keeps focus on the moved row control.
7. Canceling announces cancellation and restores focus to the source row control without changing row order.
8. Pressing beyond the first / last available destination announces that the row cannot move farther.

### C. PC single-pointer focus and guidance

9. Clicking a row handle to choose a destination focuses the selected row control, announces the selection, and shows destination-selection guidance.
10. Confirm / cancel ends the destination-selection guidance and leaves focus on the same logical row.

### D. Unavailable operations

11. Entering reorder from a `rowspan`-blocked row keeps the Toolbar context and announces the reason the row cannot move.
12. Entering reorder for a Table with no movable body rows announces that no rows can be reordered.

### E. Visual accessibility integration

13. Keyboard idle guidance changes to moving guidance when reorder starts and disappears after confirm / cancel.
14. Representative row control / destination target has an operation area of at least 24 × 24 CSS px, unless the implementation intentionally relies on the WCAG spacing exception and that exception is separately testable.
15. In a long Table, keyboard movement keeps the current destination visible and Table Reorder guidance does not completely obscure the focused operation context.

## Implementation phases

### Phase 1: Accessibility identity and shared helpers

- Outcome: accessibility-specific spec skeleton and stable user-level locators are available.
- Tasks:
  - Add `tests/e2e/table-reorder-accessibility.spec.ts`.
  - Reuse `getEditorContext()`, `getRowControl()`, Table fixture helpers, and existing coachmark preference setup where applicable.
  - Add only the smallest helper needed to read live region text or operation geometry if no existing helper represents that user-observable behavior.
  - Add accessible identity cases.
- Validation:
  - Focused Playwright spec.
  - Existing keyboard / PC single-pointer specs remain unchanged in responsibility.

### Phase 2: Focus, guidance, and live-region integration

- Outcome: start / move / confirm / cancel flows verify focus and notification behavior end-to-end.
- Tasks:
  - Add keyboard focus + notification scenarios.
  - Add PC single-pointer focus + guidance representative scenario.
  - Assert operation guidance state transitions.
- Validation:
  - Focused accessibility spec.
  - Existing input-specific specs for regression.

### Phase 3: Unavailable operations and visual boundaries

- Outcome: failure reason, target size, and focus-obscuring boundaries are covered without duplicating movement logic.
- Tasks:
  - Reuse or add the smallest `rowspan` / no-movable-row fixture needed for notification cases.
  - Add representative target-size assertion.
  - Add long-table focus / guidance geometry assertion if not already sufficiently covered by the existing keyboard E2E.
  - If the existing keyboard long-table case already proves the #261 requirement, reference it instead of duplicating it.
- Validation:
  - Focused accessibility spec.
  - Full E2E suite in compatible `wp-dev` environment.

## Decisions and validation questions

### Decide before implementation

- None. The requirements and accessibility design already define the expected user-facing behavior.

### Validate during implementation

- Which current DOM node provides the stable live-region semantics that Playwright can query without depending on implementation-only class names.
- Whether row control / destination pointer hit areas are distinct from their visual icon elements and which node receives pointer input.
- Whether the existing long-table keyboard test already satisfies the focus-obscuring / tracking requirement strongly enough to avoid a duplicate #261 case.
- How the current `wp-dev` WordPress matrix exposes iframe / non-iframe environments for the representative cross-boundary checks.

## Validation

Implementation changes under `tests/e2e/` follow `docs/development/testing.md`.

- `npm test`
  - Expected: format, lint, typecheck, and Jest coverage succeed.
- `npm run build`
  - Expected: production build succeeds.
- `npm run test:e2e -- tests/e2e/table-reorder-accessibility.spec.ts`
  - Expected: focused #261 scenarios succeed in the compatible `wp-dev` environment.
- `npm run test:e2e`
  - Expected: existing E2E suites and #261 scenarios succeed together.
- `git diff --check origin/main...HEAD`
  - Expected: no whitespace errors.

The user will perform the final environment verification. Do not report E2E as successful unless it was actually run in the compatible `wp-dev` environment.

## Completion criteria

- [ ] Accessibility-specific E2E cases are implemented without turning Playwright into a duplicate of Jest.
- [ ] Row controls can be identified by user-facing role and accessible name, including row position and representative content.
- [ ] A moved row updates its accessible identity to the new position.
- [ ] Keyboard reorder keeps focus on the source row while active.
- [ ] Keyboard confirm keeps focus on the moved logical row.
- [ ] Keyboard cancel restores focus to the original logical row.
- [ ] PC destination selection preserves the selected row's focus context through confirm / cancel.
- [ ] Keyboard waiting / moving and PC destination-selection guidance are observable and switch with interaction state.
- [ ] Start, destination change, confirm, cancel, boundary, `rowspan` reason, and no-movable-row information are available through the browser-visible accessibility notification path.
- [ ] A representative pointer operation target satisfies the design target-size contract or the applicable spacing exception is explicitly justified.
- [ ] Table Reorder guidance does not completely obscure the focused operation context in the representative long-table scenario.
- [ ] Tests use user-observable UI / accessibility state rather than SortableJS internals or implementation event order.
- [ ] Fixed `waitForTimeout()` synchronization is not introduced.
- [ ] First-run Touch UI responsibilities remain in #382 and are not duplicated.
- [ ] Merged-cell constraint calculations remain in #259 / Jest and are not duplicated.
- [ ] Data retention / Undo remain in #260 and are not duplicated.
- [ ] iframe / non-iframe are handled as a representative cross-cutting matrix rather than a Cartesian product.
- [ ] Flexible Table Block E2E remains outside this Core Table implementation pass.

## Notes

- Prefer role / accessible name / visible guidance / focus / live-region text as final assertions.
- Product class names may be used narrowly when no semantic locator exists, but should not become the primary contract of #261 tests.
- Persistent keyboard / touch coachmark preferences must be set explicitly so first-run UI does not leak into unrelated #261 scenarios.
- Do not add product hooks or test-only attributes solely to make Playwright easier to automate.
