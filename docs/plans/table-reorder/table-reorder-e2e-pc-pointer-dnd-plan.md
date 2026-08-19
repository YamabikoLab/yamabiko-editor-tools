# PLAN-255: Table Reorder E2E PC ポインター DnD

## References

- Parent issue: #252
- Implementation issue: #255
- Test responsibility map: `docs/development/testing.md`
- Requirements: `docs/requirements/table-reorder/table-reorder-requirements.md`
- Accessibility requirements: `docs/requirements/table-reorder/table-reorder-accessibility-requirements.md`
- Design: `docs/design/table-reorder/table-reorder-design.md`
- Accessibility design: `docs/design/table-reorder/table-reorder-accessibility-design.md`

## Goal

PC の行ハンドルを実際にドラッグして本文行を並べ替える一連の流れが、実 WordPress / Gutenberg / Chromium 環境で成立することを Playwright E2E で固定する。

本プランは #252 の方針に従い、E2E を網羅テストにしない。Jest ですでに扱える移動計算や細かな境界条件は重複して検証せず、実ブラウザのポインター入力、行ハンドル、ドラッグ中の移動先、確定後の編集内容が接続される代表シナリオを対象とする。

## Scope

### Included

- hover 可能な PC 環境での行ハンドルからのドラッグ開始
- 有効な別位置へのドラッグとドロップによる行順更新
- ドラッグ中に有効な挿入位置が視覚的に示されることの代表確認
- 元と同じ位置へ戻した場合に行順を変更しないことの代表確認
- セルからのドラッグでは行並べ替えを開始しないことの代表確認
- `rowspan` 範囲外の移動可能行が、結合範囲全体を越えて移動できることの代表確認
- `rowspan` 範囲内の移動不能行に通常の移動可能ハンドルを提供しないことの代表確認
- `colspan` だけを含む移動可能行を通常どおりドラッグできることの代表確認
- iframe / non-iframe の両方で PC ポインター DnD が成立すること
- `core/table` を基準にした代表シナリオ

### Not included

- 行ハンドルのクリックによるドラッグ不要の移動先選択フロー（#256）
- キーボードによる開始・移動・確定・キャンセル（#257）
- タッチ環境のドラッグ操作（#258）
- データ保持の詳細な属性・装飾パターンの網羅
- Undo / Redo の E2E（後続分類で扱う）
- live region の文言や通知順序
- 行ハンドルの target size の数値検証
- ドラッグ UI の CSS 座標、opacity、transform など実装詳細
- SortableJS の内部 state やイベント発火順序の直接検証
- Core Table / Flexible Table Block、iframe / non-iframe、通常幅 / 全幅、結合セル有無の全組み合わせ網羅
- Flexible Table Block を E2E のためだけに新規導入・セットアップすること

## Approach

### 実ブラウザのポインター操作を検証する

Playwright では `mouse` を使って、利用者が行ハンドルを掴み、別の行位置まで移動して離す操作を再現する。

主要な期待値は次とする。

1. hover した移動可能行に行ハンドルが現れる。
2. 行ハンドルからドラッグを開始できる。
3. ドラッグ中に現在の有効な挿入位置を利用者が確認できる。
4. 有効な別位置でドロップすると、編集内容上の行順が変わる。
5. 元と同じ位置または無効な操作では、編集内容上の行順が変わらない。

ドラッグの成立判定を SortableJS の class 名や内部 callback へ依存させず、最終的な Gutenberg の編集内容を正とする。

### Jest と責務を重複させない

Jest は移動計算、`rowspan` 境界、controller の pointer 分岐、drag UI state などを担当している。

Playwright では細かな移動候補を全列挙せず、次の統合境界だけを確認する。

- Gutenberg 内の実 DOM で行ハンドルをポインター操作できること
- 実ブラウザのドラッグ入力が controller と接続されること
- ドラッグ中の移動先表示が実画面へ反映されること
- ドロップ結果が Gutenberg の Table データへ反映されること
- iframe / non-iframe の editor canvas 差を越えて同じ操作が成立すること

## Test structure

基本ファイルは次とする。

- `tests/e2e/table-reorder-pointer-dnd.spec.ts`

#255 の範囲では大きな page object 層を新設しない。複数シナリオで繰り返す処理だけ、小さな helper として同ファイル内または既存 E2E helper へ寄せる。

候補:

- editor canvas 内の対象行を取得する helper
- 対象行を hover して行ハンドルを取得する helper
- 行ハンドルの中心から対象行間まで mouse drag する helper
- Table の現在行順を利用者向けテキストから読み取る helper

既存の #253 E2E helper で同じ責務を扱える場合は再利用し、重複 helper を増やさない。

## Test data

### `basicTableContent`

3〜4行の Core Table を使い、各行を `Alpha`, `Bravo`, `Charlie`, `Delta` のように識別可能にする。

用途:

- 中間行を先頭または末尾へ移動する代表 DnD
- 元位置へ戻す no-op
- セル操作と行ハンドル操作の分離

### `mergedTableContent`

必要最小限の結合セルだけを含む Table を使う。

要件:

- `rowspan` 範囲内の移動不能行を識別できる。
- `rowspan` 範囲外に、結合範囲全体を越えて移動できる通常行を置く。
- `colspan` だけを含む移動可能行を1行含める。
- 結合セル以外の装飾や複雑なセル内容は入れない。

## Implementation phases

### Phase 1: PC DnD の共通準備を整える

Outcome:

- 各シナリオが同じ方法で Table、行、行ハンドルを取得し、実 mouse drag を実行できる。

Tasks:

- `tests/e2e/table-reorder-pointer-dnd.spec.ts` を追加する。
- `basicTableContent` と `mergedTableContent` を定義する。
- `admin.createNewPost()` と `editor.setContent()` を使い、各テストを独立させる。
- iframe / non-iframe の editor canvas 取得は `@wordpress/e2e-test-utils-playwright` の既存 fixture / helper を優先する。
- 行ハンドルは role / accessible name など利用者向けの semantic locator を優先して取得する。
- drag helper は固定時間の `waitForTimeout()` を使わず、対象要素の bounding box と Playwright の mouse 操作で構成する。

Validation:

- spec が既存 E2E 構成に収まり、環境分岐を各テストへ散らさない。
- helper が SortableJS 固有の class 名や内部 state を前提にしない。

### Phase 2: 基本 DnD の確定結果を固定する

Outcome:

- PC の行ハンドルからドラッグし、有効な別位置へドロップすると行順が更新されることを固定する。

Scenario:

1. `basicTableContent` を設定する。
2. 移動対象行へ hover して行ハンドルを表示する。
3. 行ハンドルからドラッグを開始する。
4. 別の有効な行間までポインターを移動する。
5. ドラッグ中に移動先表示が現れることを代表的に確認する。
6. ドロップする。
7. Table の編集内容から行順が期待どおり変わったことを確認する。

Validation policy:

- ドラッグ中表示は「移動先を利用者が確認できる状態」を検証し、CSS の具体値は固定しない。
- 最終判定は表示だけでなく、Gutenberg の Table 内容の行順で行う。

### Phase 3: 無効・非 DnD 操作でデータが変わらないことを固定する

Outcome:

- PC の通常編集と DnD の入口が分離され、無効な操作で行順が変わらないことを固定する。

Representative scenarios:

- 行ハンドルを掴んだ後、元と同じ位置へ戻してドロップしても行順が変わらない。
- セル本文から通常の pointer 操作を行っても行並べ替えが開始されず、行順が変わらない。

Validation policy:

- pointer controller の内部状態は検証しない。
- 最終的に Table 内容の行順が変化していないことを確認する。

### Phase 4: 結合セル境界の代表 DnD を固定する

Outcome:

- 実ブラウザの DnD でも、通常要件で定義された `rowspan` / `colspan` の代表制約が維持されることを固定する。

Representative scenarios:

1. `rowspan` 範囲内の移動不能行には、通常の移動可能ハンドルが提供されないことを確認する。
2. `rowspan` 範囲外の通常行を、結合範囲全体を越えた有効位置へドラッグし、正常に確定できることを確認する。
3. `colspan` だけを含む移動可能行を有効位置へドラッグし、正常に確定できることを確認する。

Validation policy:

- `rowspan` の全境界パターンは Jest に留める。
- E2E では「移動不能行」「結合範囲越え」「colspan 行」の各代表1ケースに絞る。

### Phase 5: iframe / non-iframe の境界を確認する

Outcome:

- PC ポインター DnD の代表シナリオが iframe / non-iframe の両環境で成立する。

Tasks:

- Phase 2 の基本 DnD を両環境で確認する。
- 環境差による locator / mouse 座標取得の違いは helper 層で吸収する。
- 結合セルなどの追加シナリオまで両環境へ機械的に複製しない。

Validation:

- iframe / non-iframe のどちらでも同じ利用者操作と確定結果になる。

## Validation

実装時は、次を確認する。

- `npm test`
- `npm run build`
- `npm run test:e2e` または対象 spec の実行
- `git diff --check origin/main...HEAD`

E2E は互換性のある `wp-dev` 環境で実施する。手動環境検証は Issue 担当者が iframe / non-iframe の両方で行い、結果を PR に記録する。

## Completion criteria

- PC の行ハンドルから実 mouse drag を開始できる。
- 有効な別位置へのドロップで Table の行順が更新される。
- ドラッグ中の有効な挿入位置を利用者が確認できる代表ケースがある。
- 元位置への no-op と、セルからの通常操作で行順が変わらない代表ケースがある。
- `rowspan` の移動不能行、結合範囲越え、`colspan` 行について代表ケースがある。
- 基本 DnD が iframe / non-iframe の両方で成立する。
- #256 / #257 / #258 の責務を取り込まず、PC ポインター DnD に限定されている。
- Jest で十分な細かな境界条件を Playwright へ重複させていない。
