# Flexible Table Block対応 技術調査

Issue: #194

## 結論

Flexible Table Block 3.9.0へTable Reorderの行並べ替えを追加することは、現在の構成を大きく崩さずに実現できる見込みが高い。

SortableJS controller、drag UI、row order、table contextは基本的に共通利用できる。
一方で、対象blockの判定、body attributeの取得・commit、rowspan情報の読み取りはblock固有差分である。

これらの差分はHOCやcontrollerへ`if`分岐として追加するのではなく、**Adapter + Strategy方式**で共通処理から切り離す。

- Adapter: block固有attributesをTable Reorderが扱う共通形へ変換し、変更結果をblock固有形式へcommitする
- Strategy: `core/table`と`flexible-table-block/table`それぞれのAdapter実装を差し替え可能な処理として扱う
- Registry / Selector: block nameから利用するStrategyを一か所で選択する

```text
Gutenberg BlockEdit props
        │
        ▼
Adapter Registry / Selector
        │
        ├─ core/table
        │    └─ CoreTableAdapter
        │
        └─ flexible-table-block/table
             └─ FlexibleTableAdapter
        │
        ▼
Table Reorder共通形
        │
        ├─ rows
        ├─ rowspan constraints
        └─ commit callback
        │
        ▼
Table Reorder共通処理
├─ use-table-reorder.ts
├─ controller/
│  ├─ sortable-controller.ts
│  ├─ drag-ui.ts
│  ├─ row-order.ts
│  ├─ sortable-runtime.ts
│  └─ touch-press.ts
├─ rowspan.ts
└─ table-context.ts
```

Table Reorder本体は、対象がCore TableかFlexible Table Blockか、保存形式やrowspan property名が何かを知らない状態を維持する。

## 調査対象

- Yamabiko Editor Toolsの`main`
- Flexible Table Block 3.9.0
  - https://github.com/t-hamano/flexible-table-block/tree/v3.9.0

本調査はソースコード上の技術調査であり、WordPress editor上での実機検証は含めない。

## block name

Flexible Table Block 3.9.0のblock nameは次の通り。

```text
flexible-table-block/table
```

`src/block.json`で定義されている。

## editor DOM構造

Flexible Table Blockのeditorは、概ね次のDOMを描画する。

```html
<figure class="wp-block-flexible-table-block-table ...">
  <table>
    <thead>
      <tr>...</tr>
    </thead>
    <tbody>
      <tr>...</tr>
    </tbody>
    <tfoot>
      <tr>...</tr>
    </tfoot>
  </table>
</figure>
```

`head`、`body`、`foot`のうち空でないsectionだけが描画される。
Table Reorderが対象としている本文行は`tbody > tr`であり、Core Tableと同じDOM境界を利用できる。

セルは`th`または`td`として描画され、結合情報はHTMLの`rowSpan` / `colSpan`として出力される。

### table-context.ts

現在の`table-context.ts`はblock wrapperから最初の`table`と、その最初の`tbody`を取得している。
Flexible Table Blockも同じ構造を持つため、block elementを`clientId`から解決できればそのまま再利用できる。

また、`table-context.ts`はanchorのowning documentを優先し、対象blockが見つからない場合に`iframe[name="editor-canvas"]`へfallbackする。
この処理はblock nameに依存していないため、iframe / non-iframeのDOM解決も共通利用できる。

## attributes構造

Flexible Table Block 3.9.0はCore Tableと同様に、表を次の3 sectionで保持する。

```ts
{
  head: Row[],
  body: Row[],
  foot: Row[],
}
```

各行は次の形。

```ts
{
  cells: Cell[];
}
```

各cellはcontentやstyleに加えて結合情報を保持する。

```ts
{
  content: string;
  tag: 'td' | 'th';
  rowSpan?: string;
  colSpan?: string;
  // styles, className, id, headers, scope など
}
```

### Core Tableとの差分

重要な差分は結合セルattributeのproperty名である。

| 内容 | Core Table | Flexible Table Block |
| --- | --- | --- |
| 縦結合 | `rowspan` | `rowSpan` |
| 横結合 | `colspan` | `colSpan` |

Flexible Table Block自身の型定義でも、Core Table用型は`rowspan` / `colspan`、Flexible Table Block用型は`rowSpan` / `colSpan`として明確に分かれている。

## 行順変更の永続化

Flexible Table Blockはeditor内の編集処理で`setAttributes()`を利用して`head` / `body` / `foot`を更新している。
また、保存時は`attributes.body`を順番に`<tbody><tr>...</tr></tbody>`へ描画する。

そのため、本文行を丸ごと並べ替えるだけであれば、Table Reorderの現在のcommitと同じ形で次の更新が可能である。

```ts
setAttributes( {
  body: reorderedBody,
} );
```

行オブジェクトそのものを移動するため、cell content、style、class、scope、結合情報など行に含まれる情報も一緒に保持される。

Flexible Table Block内部ではセル結合など複雑な編集時にvirtual tableへ変換してから`toTableAttributes()`を利用しているが、単純な「既存body行の順序変更」では新しいセル構造を生成しないため、Table Reorder側からFlexible Table Block内部のvirtual table APIへ依存する必要はないと判断する。

## rowspan / colspan

### rowspan

現在の`rowspan.ts`は次の形だけを参照する。

```ts
cell.rowspan
```

Flexible Table Blockは`cell.rowSpan`を利用するため、現状のままでは縦結合行を検出できない。

したがって、`rowspan.ts`へFlexible Table Block固有propertyを直接追加するのではなく、各Adapterが共通形へ正規化する。

例:

```ts
type TableReorderRow = {
  source: unknown;
  cells: Array< {
    rowspan?: unknown;
  } >;
};
```

```text
CoreTableAdapter
  cell.rowspan
      │
      ▼
TableReorderRow[]
      ▲
      │
FlexibleTableAdapter
  cell.rowSpan
```

これにより、`getRowspanRanges()`、`getNonMovableRowIndices()`、`getForbiddenInsertionIndices()`の計算ロジックは共通利用できる。

既存の制約もそのまま適用できる。

- rowspan範囲内の行自体は移動不可
- rowspan範囲内部への挿入は不可
- rowspan範囲の直前・直後への挿入は可

### colspan

`colspan` / `colSpan`は1行内の列構造に影響するが、行を丸ごと移動する操作では縦方向の占有範囲を作らない。
そのため、現在のTable Reorderと同様に、colspanだけを理由とした追加の行移動制約は不要と判断する。

## 共通利用できる処理

| 処理 | 再利用 | 理由 |
| --- | --- | --- |
| `table-context.ts` | 可能 | `clientId`、`table`、`tbody`を使いblock name非依存 |
| `controller/sortable-controller.ts` | 可能 | `tbody`、行配列、制約、callbackだけを受け取る |
| `controller/drag-ui.ts` | 可能 | DOMの`tr`を対象としている |
| `controller/row-order.ts` | 可能 | 行データの具体型に依存しない |
| `controller/sortable-runtime.ts` | 可能 | block非依存 |
| `controller/touch-press.ts` | 可能 | DOM行indexと制約だけに依存 |
| `rowspan.ts`の計算ロジック | 可能 | Adapterが入力を共通形へ正規化すれば再利用可能 |
| `with-table-reorder.tsx` | 要変更 | block名を直接判定せずRegistry / SelectorからAdapterを取得する形へ変更する |
| `use-table-reorder.ts` | 要整理 | `body`、commit、rowspan抽出のCore Table前提をAdapter境界の外へ出す |

## Adapter + Strategyで吸収する差分

### 共通インターフェース

各block向けStrategyは同じAdapter interfaceを実装する。

```ts
type TableReorderAdapter = {
  blockName: string;
  getRows: ( attributes: Record< string, unknown > ) => TableReorderRow[] | null;
  commitRows: (
    setAttributes: ( attributes: Record< string, unknown > ) => void,
    rows: TableReorderRow[]
  ) => void;
};
```

実装時には型をさらに詰める。
重要なのは、Table Reorder本体がblock固有attributesへ直接触れない境界を作ることである。

### Strategy

同じinterfaceに対して、blockごとの処理を別実装として持つ。

```text
TableReorderAdapter
├─ CoreTableAdapter
│  ├─ attributes.bodyを読む
│  ├─ cell.rowspanを共通形へ変換する
│  └─ Core Table形式へcommitする
│
└─ FlexibleTableAdapter
   ├─ attributes.bodyを読む
   ├─ cell.rowSpanを共通形へ変換する
   └─ Flexible Table Block形式へcommitする
```

class継承は必須とせず、TypeScriptのinterfaceを満たすobject / function実装で十分とする。

### Registry / Selector

block nameによる判定は完全になくすのではなく、**Adapterを選択する一か所だけ**に閉じ込める。

```ts
const adapters = new Map( [
  [ 'core/table', coreTableAdapter ],
  [ 'flexible-table-block/table', flexibleTableAdapter ],
] );
```

```text
block name
   │
   ▼
Registry / Selector
   │
   ├─ CoreTableAdapter
   └─ FlexibleTableAdapter
```

`with-table-reorder.tsx`、`use-table-reorder.ts`、`rowspan.ts`、controllerなどへblock名ごとの`if` / `else if`を散らさない。

## 推奨実装方針

### 1. Adapter interfaceとRegistry / Selectorを導入する

最初にTable Reorderがblock固有処理へ要求する最小interfaceを定義する。

そのうえでblock nameからAdapter Strategyを取得するRegistry / Selectorを作る。
対象外blockではAdapterが見つからないため、Table Reorderを有効化しない。

### 2. CoreTableAdapterを作り、既存挙動を移す

Flexible Table Block対応を先に混ぜず、現在の`core/table`処理をAdapter経由へ移行する。

ここで次を確認する。

- Core Tableの現在の操作感を変えない
- `with-table-reorder.tsx`が`core/table`の詳細を知らない
- `use-table-reorder.ts`が`body`の保存形式を知らない
- controllerがblock名を知らない

この段階でAdapter境界が正しく機能することを確定する。

### 3. rowspan入力を共通形へ正規化する

Core Tableの`rowspan`とFlexible Table Blockの`rowSpan`を`rowspan.ts`自身で分岐しない。

各Adapterが`TableReorderRow[]`などの共通形へ変換し、`rowspan.ts`は共通形だけを受け取る。

これによりrowspan計算ロジックをblock非依存に保つ。

### 4. FlexibleTableAdapterを追加する

共通処理を変更せず、新しいStrategyとしてFlexible Table Block用AdapterをRegistryへ登録する。

```text
既存
core/table
   ↓
CoreTableAdapter

追加
flexible-table-block/table
   ↓
FlexibleTableAdapter
```

新しいblock対応で必要なのは原則としてAdapter実装とRegistry登録だけ、という状態を目標とする。

### 5. controllerへ渡す値は共通形を維持する

controllerはblock nameやattributes形式を知らない状態を維持する。

```text
Gutenberg BlockEdit props
        ↓
Adapter Registry / Selector
        ↓
Adapter Strategy
        ↓
共通 rows / rowspan constraints / commit callback
        ↓
use-table-reorder.ts
        ↓
sortable-controller.ts
```

### 6. Flexible Table Blockの内部APIへ依存しない

Flexible Table Blockの`toVirtualTable()`や`toTableAttributes()`などは、セル編集や結合操作のための内部実装である。
単純な行順変更ではblock attributesの`body`配列だけで完結できるため、これらをimportしたり複製したりしない。

これによりFlexible Table Block側の内部リファクタリングへの追従コストを抑えられる。

## 想定ファイル構成

実装時は、例えば次のようにblock固有処理をまとめる。

```text
src/editor-extensions/table-reorder/
├─ adapters/
│  ├─ types.ts
│  ├─ registry.ts
│  ├─ core-table.ts
│  └─ flexible-table.ts
├─ controller/
├─ with-table-reorder.tsx
├─ use-table-reorder.ts
├─ rowspan.ts
└─ table-context.ts
```

ファイル名や粒度は実装時に調整してよいが、責務は次の境界を維持する。

```text
Adapter / Strategy
  block固有データをどう読む・正規化する・書き戻すか

Table Reorder本体
  共通データをどう並べ替えるか
```

## 避ける実装

次のようにblock差分を共通処理へ直接追加しない。

```ts
if ( blockName === 'core/table' ) {
  // Core Table処理
} else if ( blockName === 'flexible-table-block/table' ) {
  // Flexible Table Block処理
}
```

特に次の場所へblock固有分岐を増やさない。

- `with-table-reorder.tsx`
- `use-table-reorder.ts`
- `rowspan.ts`
- `controller/`

block nameの判定が必要なのはRegistry / Selectorだけとする。

## リスクと実装時に確認する項目

ソースコード上では対応可能と判断できるが、実装Issueでは次をWordPress editor上で確認する。

- Flexible Table Block 3.9.0で通常表の行DnDが保存後も維持されること
- iframe / non-iframeの双方でblock / table / tbodyを解決できること
- `rowSpan`を含む表で既存の縦結合制約と同等に動作すること
- `colSpan`を含む行を丸ごと移動してもcell構造が壊れないこと
- Flexible Table Block独自の行選択UI・セル選択UIとTable Reorderのhover handle / touch操作が競合しないこと
- undo / redoで行順変更を戻せること
- 保存・再読込後もcell style、class、scope、rowSpan、colSpanが保持されること
- Core Table側の既存動作に回帰がないこと
- block固有分岐がRegistry / Selector以外へ散らばっていないこと

## 判断

Flexible Table Block対応は実装へ進めてよい。

実装は**Adapter + Strategy方式**とし、Core TableとFlexible Table Blockの違いをAdapter Strategyへ閉じ込める。

`with-table-reorder.tsx`へblock名分岐を直接追加したり、`rowspan.ts`へ`rowSpan`判定を足したりしない。
Registry / Selectorだけが対象blockに対応するStrategyを選択し、その下のTable Reorder本体は共通interfaceだけを見る構成とする。

これにより、今後別のTable blockへ対応する場合も、既存の並べ替えロジックへ分岐を追加するのではなく、新しいAdapter Strategyを追加する形で拡張できる。

## 次のIssue

実装は本Issueの対象外とし、別Issueで次を行う。

1. `TableReorderAdapter`共通interfaceを定義する
2. Adapter Registry / Selectorを導入する
3. `CoreTableAdapter`を作成し、現在のCore Table処理をAdapter経由へ移行する
4. rowspan入力をblock非依存の共通形へ正規化する
5. `FlexibleTableAdapter`を追加してRegistryへ登録する
6. `with-table-reorder.tsx` / `use-table-reorder.ts` / controllerをblock固有形式から切り離す
7. Core Tableの回帰確認とFlexible Table Block 3.9.0の動作確認を行う
