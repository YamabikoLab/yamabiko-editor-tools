# Flexible Table Block対応 技術調査

Issue: #194

## 結論

Flexible Table Block 3.9.0へTable Reorderの行並べ替えを追加することは、現在の構成を大きく崩さずに実現できる見込みが高い。

SortableJS controller、drag UI、row order、table contextは基本的に共通利用できる。
一方で、対象blockの判定、body attributeの取得・commit、rowspan情報の読み取りはblock固有差分としてadapterへ分離するのが適切である。

```text
Table Reorder共通処理
├─ controller/
│  ├─ sortable-controller.ts
│  ├─ drag-ui.ts
│  ├─ row-order.ts
│  ├─ sortable-runtime.ts
│  └─ touch-press.ts
├─ table-context.ts
└─ block adapter
   ├─ core/table
   └─ flexible-table-block/table
```

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

したがって、`rowspan.ts`へFlexible Table Block固有propertyを直接追加するのではなく、adapterが共通形へ正規化する構成が望ましい。

例:

```ts
type TableReorderRow = {
  cells: Array< {
    rowspan?: unknown;
  } >;
};
```

```text
core/table adapter
  cell.rowspan
      ↓
共通 rowspan representation
      ↑
flexible-table-block/table adapter
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
| `rowspan.ts`の計算ロジック | 可能 | 入力を共通形へ正規化すれば再利用可能 |
| `with-table-reorder.tsx` | 要変更 | 現在`core/table`だけを有効化している |
| `use-table-reorder.ts` | 要整理 | `body`、commit、rowspan抽出がCore Table前提で結合している |

## adapterで吸収する差分

block adapterは少なくとも次の責務を持たせる。

```ts
type TableReorderAdapter = {
  blockName: string;
  getRows: ( attributes: Record< string, unknown > ) => unknown[] | null;
  getRowspanBody: ( attributes: Record< string, unknown > ) => unknown;
  commitRows: (
    setAttributes: ( attributes: Record< string, unknown > ) => void,
    rows: unknown[]
  ) => void;
};
```

実装時には型をさらに詰めるが、境界として必要なのは次の3点である。

1. このblockをTable Reorder対象とするか
2. 並べ替える本文行をどう取得するか
3. block固有attributesへどうcommitし、rowspanをどう読み取るか

Core Table固有処理とFlexible Table Block固有処理をHOCやcontrollerへ直接分岐として増やさない。

## 推奨実装方針

### 1. block adapterを導入する

`core/table` adapterを先に作り、現在の挙動をadapter経由へ移す。
その後`flexible-table-block/table` adapterを追加する。

### 2. controllerへ渡す値は現在の共通形を維持する

controllerはblock nameやattributes形式を知らない状態を維持する。

```text
Gutenberg BlockEdit props
        ↓
block adapter
        ↓
rows / rowspan constraints / commit callback
        ↓
use-table-reorder.ts
        ↓
sortable-controller.ts
```

### 3. Flexible Table Blockの内部APIへ依存しない

Flexible Table Blockの`toVirtualTable()`や`toTableAttributes()`などは、セル編集や結合操作のための内部実装である。
単純な行順変更ではblock attributesの`body`配列だけで完結できるため、これらをimportしたり複製したりしない。

これによりFlexible Table Block側の内部リファクタリングへの追従コストを抑えられる。

## リスクと実装時に確認する項目

ソースコード上では対応可能と判断できるが、実装Issueでは次をWordPress editor上で確認する。

- Flexible Table Block 3.9.0で通常表の行DnDが保存後も維持されること
- iframe / non-iframeの双方でblock / table / tbodyを解決できること
- `rowSpan`を含む表で既存の縦結合制約と同等に動作すること
- `colSpan`を含む行を丸ごと移動してもcell構造が壊れないこと
- Flexible Table Block独自の行選択UI・セル選択UIとTable Reorderのhover handle / touch操作が競合しないこと
- undo / redoで行順変更を戻せること
- 保存・再読込後もcell style、class、scope、rowSpan、colSpanが保持されること

## 判断

Flexible Table Block対応は実装へ進めてよい。

ただし、`with-table-reorder.tsx`へblock名分岐を直接追加し、`rowspan.ts`へ`rowSpan`判定を足すだけの実装にはしない。
今後別のTable blockへ拡張できるよう、今回をblock adapter導入の境界として扱う。

## 次のIssue

実装は本Issueの対象外とし、別Issueで次を行う。

- Table Reorderのblock adapter導入
- 現在のCore Table処理をadapter経由へ移行
- Flexible Table Block adapter追加
- Flexible Table Block 3.9.0での動作確認
