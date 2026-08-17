# PLAN-268: Table Reorder Flexible Table Block対応

## References

- Parent issue: #268
- Investigation result: #268 comment `5311329162`
- Previous investigation: #194
- Superseded design: #201
- Requirements: `docs/requirements/table-reorder/table-reorder-sortablejs-requirements.md`
- Current integration: `src/editor-extensions/table-reorder/with-table-reorder.tsx`
- Current hook: `src/editor-extensions/table-reorder/use-table-reorder.ts`
- Current controller hook: `src/editor-extensions/table-reorder/use-table-reorder-controller.ts`
- Current rowspan constraints: `src/editor-extensions/table-reorder/rowspan.ts`
- Current table context: `src/editor-extensions/table-reorder/table-context.ts`
- Current row controls: `src/editor-extensions/table-reorder/controller/reorder-ui/row-controls.ts`

## Goal

現在のCore Table向けTable Reorderを維持したまま、Flexible Table Blockの本文行でも既存のpointer / touch / keyboardによる行並べ替えを利用できるようにする。

block固有差分は薄いsupport境界へ閉じ込め、将来Core Table本体に同等の行D&Dが実装された場合には、`core/table`向けsupportだけを外せる構造にする。

## Scope

### Included

- `core/table`と`flexible-table-block/table`をTable Reorderの対応blockとして扱う。
- blockごとのrowspan property差分を薄いsupport境界で吸収する。
  - Core Table: `rowspan`
  - Flexible Table Block: `rowSpan`
- Core Table固有のblock判定をsupport境界へ移す。
- rowspan制約計算からblock固有property名の直接依存を外す。
- controller lifecycleへ渡す制約をblock非依存の入力に整理する。
- touch reorder modeの一時横スクロール補正から`.wp-block-table`直接依存を外す。
- Flexible Table Blockの`attributes.body`を既存と同じ行配列の並べ替え結果としてcommitする。
- Flexible Table Block固有UIとの競合を実ブラウザーで確認し、必要な場合だけ最小限調整する。
- Core Tableの既存操作・アクセシビリティ・rowspan制約を維持する。

### Not included

- 列の並べ替え。
- Flexible Table Block本体の変更。
- Flexible Table Block内部のvirtual table APIへの依存。
- Adapter + Strategy + Registryのような汎用フレームワークの導入。
- blockごとに差分がない`body`取得・`setAttributes( { body } )`まで別Strategyへ分離すること。
- Core Table本体に将来追加されるかもしれないD&Dとの自動切替。

## Approach

調査結果では、現在確認できる主要なblock差分はblock nameとrowspan property名であり、本文行は両blockとも`attributes.body`として保持される。

そのため、旧#201のAdapter + Strategy案は採用せず、対応blockの差分だけを返す薄いsupport境界を追加する。

概念例:

```ts
type TableReorderBlockSupport = {
	rowspanProperty: string;
};

getTableReorderBlockSupport( 'core/table' );
// { rowspanProperty: 'rowspan' }

getTableReorderBlockSupport( 'flexible-table-block/table' );
// { rowspanProperty: 'rowSpan' }
```

具体的な型名・関数名・ファイル名は実装時に既存命名へ合わせて調整してよい。ただし、support境界に将来用途の設定を先回りして追加しない。

`rowspan.ts`はblock nameを知らず、呼び出し側から渡されたproperty名または同等の最小入力だけを使ってrowspan範囲を計算する。

`use-table-reorder.ts`でrowspan範囲とcontroller向け制約を組み立て、`use-table-reorder-controller.ts`は可能な限りblock attribute形式を知らない状態にする。

Flexible Table Blockの行順commitは、行オブジェクト自体を書き換えず、既存と同様に`body`配列の順序だけを変更して`setAttributes( { body: reorderedBody } )`を利用する。実装ではFlexible Table Block内部の`toVirtualTable()` / `toTableAttributes()`へ依存しない。

## Architecture

### BlockEdit接続

`with-table-reorder.tsx`

- block nameからsupportを取得する。
- supportがないblockでは従来どおり元の`BlockEdit`だけを描画する。
- 対応blockでは`body`とsupport情報を`useTableReorder()`へ渡す。
- `core/table` / `flexible-table-block/table`の個別分岐をHOC内へ散らさない。

### Block support

新しい薄いsupport境界を`src/editor-extensions/table-reorder/`配下へ置く。

責務:

- 対応block nameの判定。
- rowspan property差分の提供。

責務に含めないもの:

- controller lifecycle。
- DOM探索。
- 行順計算。
- notice / announcement。
- Flexible Table Block内部API呼び出し。

### Rowspan constraints

`rowspan.ts`

- row / cellsの走査とrowspan範囲計算は既存ロジックを維持する。
- `cell.rowspan`の固定参照だけを外し、supportから決まるpropertyを参照する。
- `getNonMovableRowIndices()` / `getForbiddenInsertionIndices()`は変更不要を基本とする。

### React / controller境界

`use-table-reorder.ts`

- supportに応じてrowspan範囲を計算する。
- touch modeの移動可能行判定とcontroller作成で同じ制約情報を使う。

`use-table-reorder-controller.ts`

- block固有property名を解釈しない。
- 可能なら呼び出し側で算出済みの`nonMovableRowIndices` / `forbiddenInsertionIndices`を受け取る。
- controller生成・cleanup・focus復元という現在の責務を維持する。

### DOM / row controls

`table-context.ts`

- `[data-block="clientId"]`からblock elementを解決し、その配下の`table` / 最初の`tbody`を取得する現在の方式を維持する。
- Flexible Table Block専用selectorは追加しない。

`controller/reorder-ui/row-controls.ts`

- touch reorder modeの一時横スクロール補正で`.wp-block-table`を探索しない。
- 既に解決済みのblock elementを利用するなど、block種類に依存しないDOM境界へ変更する。
- Core Tableで現在行っているinline styleの保存・復元は維持する。

## Implementation phases

### Phase 1: Core Tableを薄いsupport境界へ移す

- Outcome:
  - Core Tableの挙動を変えず、block固有差分がsupport境界に集約される。
- Tasks:
  - support定義と取得関数を追加する。
  - `core/table`と`rowspan`の対応を登録する。
  - `with-table-reorder.tsx`の直接`core/table`判定をsupport取得へ置き換える。
  - `rowspan.ts`の`cell.rowspan`固定参照を外す。
  - `use-table-reorder.ts`から算出済み制約をcontroller hookへ渡せる形に整理する。
  - `.wp-block-table`直接依存をblock非依存のDOM参照へ変更する。
- Validation:
  - Core Tableの既存unit testを維持する。
  - supportの対応block / 非対応block判定をunit testで確認する。
  - `rowspan`を使った既存制約が変わらないことをunit testで確認する。
  - PC / touch / keyboardの既存Core Table操作を実ブラウザーで回帰確認する。

### Phase 2: Flexible Table Block supportを追加する

- Outcome:
  - Flexible Table Blockの`tbody`本文行で既存Table Reorderを利用できる。
- Tasks:
  - `flexible-table-block/table`をsupportへ追加する。
  - rowspan propertyとして`rowSpan`を指定する。
  - `attributes.body`を既存controllerへ渡し、並べ替え後は`setAttributes( { body: reorderedBody } )`でcommitする。
  - Core TableとFlexible Table Blockのためにcontroller / row-order / table-contextへblock別分岐を追加しない。
- Validation:
  - supportがFlexible Table Blockを正しく識別するunit testを追加する。
  - `rowSpan`を含むbodyから既存と同じ意味のrowspan制約が得られるunit testを追加する。
  - 通常表でpointer / touch / keyboardの行並べ替えを確認する。

### Phase 3: Flexible Table Block固有UIとの統合を確認する

- Outcome:
  - Flexible Table Block固有UIとTable Reorderを同時に利用しても操作・表示・accessible nameが破綻しない。
- Tasks:
  - `.ftb-row-selector`、row inserter / remover、section label表示中の操作を確認する。
  - 先頭列が狭い表とtouch reorder modeの一時横スクロール補正を確認する。
  - `.ftb-table-cell-label`などの補助UI文字列がTable Reorderの行accessible nameへ不要に混入しないか確認する。
  - 問題が再現した場合だけ、既存UI抽出処理へ最小限の除外条件を追加する。
- Validation:
  - `show_control_button`有効時でも両方の操作入口が利用できる。
  - pointer / touch / keyboardのeventがFlexible Table Block側のcell / row選択を誤発火させない。
  - 行ラベルが利用者向けの表内容を代表し、Flexible Table Blockの操作ラベルを不要に読み上げない。

### Phase 4: 回帰・保存・結合セルを確認する

- Outcome:
  - 両blockでTable Reorderの既存契約を維持し、保存後も表構造が壊れない。
- Tasks:
  - Core TableとFlexible Table Blockを同じビルドで確認する。
  - iframe / non-iframeの両環境を確認する。
  - rowspan / colspanを含む表を確認する。
  - Undo / Redoと保存・再読込を確認する。
- Validation:
  - Core Tableの既存挙動に回帰がない。
  - Flexible Table Blockで行順が保存・再読込後も維持される。
  - `styles`、`className`、`scope`、`rowSpan`、`colSpan`など行内cell属性が並べ替えで失われない。
  - rowspan範囲内の行を移動できず、範囲を分断する位置へ移動できない。
  - colspanだけを含む行は行単位でそのまま移動できる。

## Decisions and validation questions

### Decide before implementation

追加の設計判断は不要。

#268の調査結果により、次を実装前提とする。

- Adapter + Strategy + Registryは導入しない。
- block差分は薄いsupport境界へ集約する。
- `body`取得・commitは両blockで共通のまま扱う。
- Flexible Table Block内部のvirtual table APIへ依存しない。
- Core Tableを先にsupport境界へ移し、その後Flexible Table Blockを追加する。

### Validate during implementation

- Flexible Table Blockで`setAttributes( { body: reorderedBody } )`だけのcommitがUndo / Redo、保存・再読込まで正常に機能すること。
- touch reorder modeの一時横スクロール補正をblock element基準にした場合、Core TableとFlexible Table Blockの双方で表示・cleanupが正常なこと。
- Flexible Table Block固有の行操作UIとTable Reorder handleがpointer / touch / keyboardで競合しないこと。
- Flexible Table Blockの補助UI文字列が行accessible nameへ混入する場合、どのDOMを除外するのが最小か。

## Issue breakdown

プランレビュー後、実装は次の2単位へ分割する。

- [ ] Core Tableを薄いblock support境界へ移行し、既存挙動を維持する。
- [ ] Flexible Table Block supportを追加し、固有UI・保存・結合セルを統合検証する。

Phase 3 / Phase 4で軽微な調整が必要な場合は、原則としてFlexible Table Block support側の実装Issue内で扱う。別Issueに分けるのは、独立してレビューすべき規模へ広がった場合だけとする。

## Validation

実装時は`docs/development/testing.md`を正本として、変更内容に応じて次を実行する。

- `npm test`
  - Expected: format / ESLint / Stylelint / TypeScript / unit testがすべて成功する。
- `npm run build`
  - Expected: production assetsを正常に生成できる。
- `git diff --check origin/main...HEAD`
  - Expected: whitespace errorがない。

対象unit testでは少なくとも次を確認する。

- `core/table`が`rowspan` supportを取得する。
- `flexible-table-block/table`が`rowSpan` supportを取得する。
- 非対応blockはTable Reorderを起動しない。
- Core Table形式のrowspan制約計算が維持される。
- Flexible Table Block形式のrowSpanから同等の制約が計算される。
- controller / row-orderの既存テストがblock追加によって変更不要、またはblock固有知識を追加せず維持できる。

実ブラウザーでは少なくとも次を確認する。

- Core Table: pointer / touch / keyboard。
- Flexible Table Block: pointer / touch / keyboard。
- Flexible Table Block: `show_control_button`有効時。
- 両block: rowspan / colspan。
- 両block: iframe / non-iframe。
- Flexible Table Block: Undo / Redo、保存・再読込。
- 狭い先頭列: touch reorder mode開始・終了時の一時横スクロールとstyle復元。

## Completion criteria

- `core/table`と`flexible-table-block/table`でTable Reorderを利用できる。
- block nameとrowspan property差分が薄いsupport境界に集約されている。
- controller / row-order / table-contextにFlexible Table Block専用分岐が追加されていない。
- `.wp-block-table`への直接依存がTable Reorderの共通UI処理から除去されている。
- Core Tableの既存pointer / touch / keyboard / accessibility / rowspan制約に回帰がない。
- Flexible Table Blockでpointer / touch / keyboardが利用できる。
- Flexible Table Blockの行操作UIとTable Reorderが実用上競合しない。
- Flexible Table BlockのrowSpan制約がCore Tableと同じ意味で適用される。
- Undo / Redo、保存・再読込後も行順とcell属性が維持される。
- 将来Core Table対応を廃止するとき、`core/table` supportとCore固有テストを中心に削除でき、Flexible Table Blockや共通controllerの再設計を必要としない。

## Notes

- Flexible Table Blockの現行`main`を調査時点の対象とする。実装開始時にblock name / `body` / `rowSpan`の契約が変わっていないかだけ再確認する。
- Flexible Table Block本家の公開内部実装をコピーせず、WordPressのBlockEdit props、block attributes、editor DOMという既存境界だけを利用する。
- 実機でしか確定できないUI競合は設計を止める未決事項ではなく、Phase 3の検証項目として扱う。
