# PLAN-49: Table Reorder

## References

- Parent issue: https://github.com/YamabikoLab/yamabiko-editor-tools/issues/49
- Plan update issue: https://github.com/YamabikoLab/yamabiko-editor-tools/issues/61
- Requirements: `docs/requirements/table-reorder/table-reorder-requirements.md`
- Design: `docs/design/table-reorder/table-reorder-design.md`
- Source organization: `docs/development/source-organization.md`
- Plan template: `docs/plans/TEMPLATE.md`
- dnd-kit: https://dndkit.com/
- Sortable: https://dndkit.com/concepts/sortable/
- DragOverlay: https://dndkit.com/react/components/drag-overlay/

## Goal

コアTableブロックの保存形式を変更せず、`tbody`内の本文行をドラッグハンドルによるポインターDnDで安全に並べ替えられるようにする。

通常のセル編集と行の並べ替えを分離し、並べ替えモード中だけドラッグハンドルを表示する。有効な移動を確定したときだけTableブロックの`body`属性を一回更新し、一回のUndoで移動前へ戻せるようにする。

投稿エディターがiframeまたは非iframeのどちらで動作する場合も、選択中Tableブロックが描画されている編集領域を基準に、同じ機能要件を満たす。

要件定義書と基本設計書に書かれていない製品仕様は追加しない。

## Scope

### Included

- コアTableブロックを対象とする非ブロックのエディター拡張。
- `tbody`内の本文行を一行単位で並べ替えるDnD。
- 並べ替えモードの開始と終了。
- 本文行の左側に表示するドラッグハンドル。
- ポインターDnD。
- dnd-kitのSortableとDragOverlay。
- セル内容、セル属性、装飾、セル順序および`colspan`を保持した行配列の並べ替え。
- `rowspan`範囲に含まれる行の移動禁止。
- `rowspan`範囲の途中への挿入禁止。
- `rowspan`範囲を越える移動の禁止。
- 禁止された操作で表データを変更しない処理。
- 一回の移動試行につき一回だけ行う画面通知。
- 一回の確定につき一回だけTableブロック属性を更新する処理。
- iframe・非iframeの編集領域を基準としたDOM取得、座標計算、イベント、ObserverおよびDnD表示。
- focused unit test、ビルド確認、ブラウザー上の手動確認。

### Not included

- キーボードによる行の並べ替え。
- 上下移動ボタン。
- 列の並べ替え。
- 複数行の同時移動。
- 結合セルを含む行グループ全体の移動。
- 行の複製。
- CSVの入出力。
- 値による自動ソート。
- `thead`または`tfoot`の行移動。
- ヘッダー、本文、フッターをまたぐ移動。
- コアTableブロックの保存属性または保存HTMLの変更。
- iframe・非iframeで異なる操作や製品仕様。
- 将来利用を想定した汎用DnD基盤、共通API、拡張ポイント。
- 実装用Issueの作成。

## Approach

### 1. コアTableブロックへの接続

`editor.BlockEdit`フィルターでコアTableブロックの編集コンポーネントをラップする。

- `props.name === 'core/table'`のときだけTable Reorderを追加する。
- 元のBlockEditはそのまま描画し、コアTableのセル編集、行・列操作および保存処理を再実装しない。
- Tableブロックが選択されたときにブロックツールバーへ「行を並べ替え」を表示する。
- 並べ替えモードはReactの一時状態として保持し、ブロック属性へ追加しない。
- 通常時はハンドル、Sensor、SortableおよびDragOverlayを描画しない。

### 2. 非ブロックエントリーとアセット読込み

`src/editor-extensions/table-reorder/`をowning directoryとする。

現在の`@wordpress/scripts`によるブロック自動ビルドを維持しながら、Table Reorder用の非ブロックエントリーを一つ追加する。実装前に現在のプロジェクト構成と`@wordpress/scripts`の公開機能を確認し、次を満たす最小構成にする。

- 既存Noticeブロックの自動ビルドと`blocks-manifest.php`生成を維持する。
- Table Reorderのエントリーを`src/editor-extensions/table-reorder/index.tsx`とする。
- 生成されたJS、CSSおよびasset PHPをブロックエディターだけで読み込む。
- `build/`は生成物として扱い、編集またはコミットしない。
- Table Reorder専用のPHPクラスや汎用アセット管理層は追加しない。

### 3. dnd-kitの構成

実装開始時に公式ドキュメントとインストール可能な安定版を確認し、同じAPI系列で次を構成する。

- `DndContext`
- `PointerSensor`
- `useSensors` / `useSensor`
- `SortableContext`
- `useSortable`
- `DragOverlay`
- 縦方向の並べ替えに必要なstrategy

パッケージは公式ドキュメントに対応する`@dnd-kit/core`と`@dnd-kit/sortable`を基本とし、直接importする公式パッケージだけを`package.json`へ追加する。バージョンは実装時点の安定版を`package-lock.json`へ固定し、ベータ版や内部APIは使用しない。

`arrayMove`を使用する場合も、`rowspan`検証後の有効な確定処理だけで呼ぶ。DnD中のTableブロック属性更新には使用しない。

dnd-kitの一時的な並べ替え表示と、コアTableブロックの永続データ更新を分離する。

- ドラッグ中はdnd-kitのtransform、active、overなどの一時状態だけを更新する。
- `attributes.body`はドロップ確定まで変更しない。
- 無効候補へのoptimistic sortingを抑止する。
- 無効、no-op、キャンセルでは行配列を更新しない。
- 有効なドロップ時だけ開始時の`body`から次の配列を生成する。

### 4. iframe・非iframeの編集領域

Table Reorderは、選択中Tableブロックの要素を編集領域の起点とする。

- 対象要素の`ownerDocument`を編集領域の`document`として扱う。
- `ownerDocument.defaultView`を編集領域の`window`として扱う。
- グローバルな`document`または`window`が常に編集領域を表すとは仮定しない。
- 本文行の検索、行位置の測定、イベント登録およびObserver登録は対象の編集領域へ限定する。
- ドラッグハンドル、挿入位置およびDnD中の表示は対象Tableと同じ座標系で扱う。
- ブロックツールバーと並べ替え状態はWordPressの公開APIとReactの状態で連携し、iframe内外のDOMを直接結合しない。
- 非iframe環境では同じ処理がメイン文書を対象として動作する。
- 並べ替えモード終了、対象ブロック変更またはコンポーネント破棄時に、対象編集領域へ登録したイベントとObserverを解除する。

### 5. 並べ替えモード

「行を並べ替え」を押したときに次を行う。

1. 並べ替えモードを開始する。
2. 現在の`attributes.body`を参照する。
3. 選択中Tableブロックの要素から編集領域を取得する。
4. 対象ブロック内の`tbody > tr`を取得する。
5. `rowspan`範囲と各行の移動可否を計算する。
6. 本文行に対応するドラッグハンドルを表示する。

「並べ替えを終了」を押したときに次を行う。

1. DnD中であれば確定せずキャンセルする。
2. DnD開始時の行順序を維持し、`setAttributes`を呼ばない。
3. 移動元、現在のドロップ候補、その有効・無効状態、確定可能な移動先、開始時順序および通知済み状態を破棄する。
4. 対象編集領域へ登録したイベントとObserverを解除する。
5. ドラッグハンドルを非表示にする。
6. 通常のTable編集へ戻す。

確定済みの行順序は維持する。

### 6. ドラッグハンドルとSortableの接続

各本文行に対応する一時IDを並べ替えモード内で生成する。IDは保存しない。

- 各行に対応するUIへ`useSortable({ id, disabled })`を接続する。
- `setNodeRef`は各sortable行の測定対象へ接続する。
- 移動可能な行では、`setActivatorNodeRef`、`listeners`および`attributes`をドラッグハンドルへ接続する。
- DnDはハンドルからだけ開始する。
- `rowspan`範囲に含まれる行は`useSortable`を`disabled`にし、dnd-kitの`listeners`を接続しない。
- 移動できない行のハンドルは、ポインター操作を受け取れる状態を維持し、DnD開始前に規定エラーを表示する。
- 無効ハンドルの主ボタン`pointerdown`時に`setPointerCapture(event.pointerId)`でpointer captureを取得する。
- `pointerup`、`pointercancel`または`lostpointercapture`で通知済み状態をリセットする。
- pointer captureを保持している場合は`releasePointerCapture(event.pointerId)`で解除する。
- ハンドル外でポインターを離した場合も、一回の移動試行を確実に終了する。
- 並べ替えモード終了またはアンマウント時にも、保持中のpointer captureを解除して開始前試行の状態を破棄する。
- ヘッダー行とフッター行へハンドルを追加しない。

コアTableの保存用行データへDnD用ID、クラスまたは属性を追加しない。

### 7. Table表示とハンドルUI

コアTableの編集UIは元のBlockEditへ任せる。Table Reorderは、選択ブロックのDOM内にある本文行を参照し、行の左側へエディター専用のハンドルUIを重ねる。

- `clientId`に対応するブロックラッパー内だけを検索する。
- `figure.wp-block-table table tbody > tr`を本文行として扱う。
- 対象要素の`ownerDocument`内だけを検索対象とする。
- 各行の位置と高さにハンドルを揃える。
- Table DOMから保存データを逆生成しない。
- 行順序の正は常に`attributes.body`とする。
- 行高の変化は対象編集領域の`ResizeObserver`で再測定する。
- 対象編集領域のスクロールまたはリサイズで位置がずれる場合は、必要な最小イベントだけで再測定する。
- 並べ替えモード終了時にObserverとイベント登録を解除する。

DOM取得方法、iframe・非iframeでの座標系およびハンドル配置方法は実装前の小さな検証で確定する。Gutenbergの非公開Reactコンポーネントはimportしない。

### 8. ポインターDnD

`DndContext`へ`PointerSensor`を登録する。

- ポインター操作はハンドルから開始する。
- DnD開始時に移動元行が移動可能か確認する。
- ポインター位置から、現在のドロップ候補となる行間または`tbody`外を求める。
- 現在のドロップ候補、候補境界および`validateMove()`による有効・無効状態をDnD一時状態として管理する。
- 候補変更時に挿入位置と`rowspan`範囲越えを検証する。
- 無効候補または`tbody`外へ入った場合は、確定可能な移動先を`null`にし、以前の有効候補を確定へ流用しない。
- 無効候補へのoptimistic sortingを抑止し、挿入位置を表示しない。
- 有効候補の場合だけ確定可能な移動先を設定し、挿入位置を表示する。
- `onDragEnd`では保持された最後の有効候補を使用せず、実際の終了位置から候補を求め直して`validateMove()`を再実行する。
- 実際の終了位置が無効、候補なし、対象編集領域外または`tbody`外の場合は`setAttributes`を呼ばない。
- 実際の終了位置が有効で順序が変わる場合だけ、開始時の`body`から次の配列を生成する。

ポインター座標、行矩形および挿入位置は同じ編集領域の座標系へ揃える。iframe内の矩形と親文書の矩形を直接比較しない。

### 9. DragOverlay

`DragOverlay`は`DndContext`内に一つだけ配置する。

- Overlay内で`useSortable`を再度呼ばない。
- 移動元行のセル内容と既存属性を参照した表示専用プレビューを描画する。
- OverlayはTableブロック属性を更新しない。
- Overlayの子だけをDnD中に切り替え、`DragOverlay`自体は`DndContext`内に維持する。
- Overlayのスタイルは`editor.scss`だけに置く。
- 要件にない操作ボタン、状態表示または説明を追加しない。
- iframe・非iframe、スクロール領域、可変幅Tableで対象行とずれないことを確認する。

コアTableと同じ完全なセル編集UIを再実装せず、ドラッグ中に対象行を識別できる最小表示にする。表示方法は現在の行DOMを安全に複製できるか、行データから非編集プレビューを描画するかを実装中に比較し、保存形式へ影響しない方を採用する。

### 10. 行データの扱い

Table Reorder内で必要な最小型だけを定義する。

```ts
type TableCell = {
	content?: unknown;
	colspan?: number | string;
	rowspan?: number | string;
	[key: string]: unknown;
};

type TableRow = {
	cells: TableCell[];
	[key: string]: unknown;
};
```

行の移動では、行オブジェクト全体の配列順だけを変更する。

- セル内容をコピーし直さない。
- セルオブジェクトを作り直さない。
- 行内のセル順序を変更しない。
- `content`、`colspan`、`rowspan`、装飾および未知の属性を変更しない。
- `head`、`foot`および他のTable属性を更新しない。
- 同じ順序になる移動では`setAttributes`を呼ばない。
- 禁止またはキャンセルでは`setAttributes`を呼ばない。

確定処理は次の形に限定する。

```ts
const nextBody = reorderRows(bodyAtDragStart, fromIndex, toIndex);
setAttributes({ body: nextBody });
```

### 11. `rowspan`範囲と移動可否

本文行を上から走査し、`rowspan`が2以上のセルごとに、そのセルが占有する開始行から終了行までを結合範囲とする。

```text
[startRow, min(startRow + rowspan - 1, lastBodyRow)]
```

重なる範囲は統合する。

移動判定では行インデックスと挿入境界を分ける。

- 行インデックスは`0`から`body.length - 1`。
- 挿入境界は`0`から`body.length`。
- 上方向では移動先行の直前を候補境界とする。
- 下方向では移動先行の直後を候補境界とする。
- 並べ替え後インデックスへの変換は検証後に一度だけ行う。

`validateMove()`は少なくとも次を判定する。

1. 移動元行が結合範囲に含まれる場合は拒否する。
2. 挿入境界が結合範囲の途中にある場合は拒否する。
3. 移動元と挿入境界が結合範囲を挟んで反対側にある場合は拒否する。
4. 候補が`tbody`外の場合は拒否する。
5. `rowspan`制約に該当せず、`colspan`だけを含む行は許可する。
6. 同じ順序になる候補はデータ更新なしのno-opとする。

ポインターDnDは、この純粋関数を移動可否の正として使用する。

### 12. データと状態の流れ

1. 選択中のブロックが`core/table`であることを確認する。
2. 「行を並べ替え」で並べ替えモードを開始する。
3. 選択中Tableの要素から編集領域を取得する。
4. `attributes.body`、本文行DOM、行矩形および`rowspan`範囲を取得する。
5. `rowspan`範囲内の無効ハンドルから操作された場合は、ハンドル側でポインターの開始前試行を捕捉し、DnD状態を作らず一回だけエラーを表示する。
6. 開始前試行では`pointerdown`時にpointer captureを取得し、`pointerup`、`pointercancel`または`lostpointercapture`で解除・リセットする。
7. 移動可能な行からDnDを開始したときに次を一時状態へ保持する。
   - 移動開始前の`body`
   - 移動元ID
   - 移動元インデックス
   - 現在のドロップ候補と候補境界
   - 現在候補の有効・無効状態
   - 確定可能な移動先。無効候補または`tbody`外では`null`
   - 同じ移動試行でエラーを表示済みかどうか
8. DnD開始時に移動元を再検証し、禁止対象なら開始を拒否して一回だけエラーを表示する。
9. DnD中はdnd-kitの一時的な表示とDragOverlayだけを更新する。
10. 候補変更時に現在候補を更新し、`validateMove()`を呼ぶ。
11. 無効候補または`tbody`外では確定可能な移動先を`null`へ戻し、挿入位置を消して一回だけエラーを表示する。
12. 有効候補では確定可能な移動先と挿入位置を更新する。
13. `onDragEnd`で実際の終了位置から候補を求め直す。
14. 求め直した候補に対して`validateMove()`を再実行する。
15. 実際の終了位置が有効で順序が変わる場合だけ、開始時`body`から次の配列を作り、`setAttributes({ body: nextBody })`を一回呼ぶ。
16. 実際の終了位置が無効、候補なし、対象編集領域外または`tbody`外の場合は`setAttributes`を呼ばない。
17. 完了後にDnD一時状態を破棄する。
18. キャンセルでは`setAttributes`を呼ばず、一時状態だけを破棄する。
19. 「並べ替えを終了」で進行中DnDをキャンセルし、通知済み状態、イベント、Observerおよびハンドルを外して通常編集へ戻る。

### 13. Undo

Undo単位を一回にするため、Tableブロック属性の更新箇所を有効な確定ハンドラーの一か所へ限定する。

次では`setAttributes`を呼ばない。

- DnD開始。
- ポインター移動。
- DragOverlay描画。
- 無効候補。
- 同じ順序への確定。
- キャンセル。
- DnD中のモード終了。

有効な確定時だけ`setAttributes({ body: nextBody })`を一回呼ぶ。追加の属性更新を同じ操作へ混ぜない。

### 14. 画面通知

禁止操作は一つの`notifyInvalidMove()`から、`core/notices`へ規定のエラー文を画面通知として追加する。

> 結合セルを分断する位置には行を移動できません。結合を解除してから並べ替えてください。

通知の重複防止は、開始前に拒否される無効ハンドル操作と、開始後のDnDを別の試行として管理する。

- 無効ハンドルのポインター試行は、主ボタンの`pointerdown`でpointer captureを取得して開始し、`pointerup`、`pointercancel`または`lostpointercapture`までを一回の移動試行とする。
- 試行終了時は通知済み状態をリセットし、保持しているpointer captureを解除する。
- 並べ替えモード終了またはコンポーネントのアンマウント時は、保持中のpointer captureを解除して開始前試行の通知済み状態を破棄する。
- 移動可能な行のDnDでは、DnD開始時に通知済み状態をリセットし、完了またはキャンセルまでに無効候補が複数回発生しても一回だけ通知する。
- DnDの完了、キャンセルまたはモード終了でDnD側の通知済み状態を破棄する。
- 要件にない画面通知は追加しない。

### 15. 保存形式

Table Reorderは`body`配列の順序以外を変更しない。

- 新しいブロック属性を登録しない。
- 独自HTMLを保存しない。
- `save`フィルターを追加しない。
- フロントエンド用スクリプトまたはスタイルを追加しない。
- 一時ID、モード状態、DnD状態および通知状態を保存しない。

保存後のマークアップは、コアTableブロックが並べ替え後の既存属性から生成する形式のままとする。

## Architecture

### Planned files

| File | Change | Responsibility |
|---|---|---|
| `package.json` | Update | dnd-kitと、Table Reorderから直接importするWordPressパッケージを依存関係へ追加する。 |
| `package-lock.json` | Update | 追加依存関係の解決結果を固定する。 |
| `yamabiko-editor-tools.php` | Update | 生成されたTable Reorderのエディタースクリプト、スタイル、依存関係および翻訳を読み込む。 |
| `src/editor-extensions/table-reorder/index.tsx` | Add | スタイルをimportし、`editor.BlockEdit`フィルターを登録する薄い入口。 |
| `src/editor-extensions/table-reorder/with-table-reorder.tsx` | Add | `core/table`への限定、BlockControls、並べ替えモードおよび元のBlockEditとの接続。 |
| `src/editor-extensions/table-reorder/table-reorder.tsx` | Add | 編集領域の取得、行位置測定、DndContext、PointerSensor、DnD一時状態、イベント、確定更新、通知および後始末。 |
| `src/editor-extensions/table-reorder/sortable-row.tsx` | Add | 各行の`useSortable`接続、ドラッグハンドル、無効状態、pointer capture、挿入位置およびOverlay用表示。 |
| `src/editor-extensions/table-reorder/row-order.ts` | Add | Table行とセルの最小型、`rowspan`範囲抽出、移動可否判定および行配列の並べ替え。 |
| `src/editor-extensions/table-reorder/row-order.test.ts` | Add | 行順序、属性保持、`rowspan`範囲、禁止条件、`colspan`保持およびno-opのfocused unit test。 |
| `src/editor-extensions/table-reorder/editor.scss` | Add | ハンドル、無効状態、挿入位置およびDragOverlayのエディター専用スタイル。 |

実装中に責務が過大になった場合だけ、現在必要な責務を一つ持つファイルへ分割する。空ファイル、将来用ディレクトリ、`shared/`、`utils/`または`helpers/`は作成しない。

### Dependency direction

```text
index.tsx
  -> with-table-reorder.tsx
       -> table-reorder.tsx
            -> sortable-row.tsx
            -> row-order.ts
            -> dnd-kit public APIs
            -> WordPress public APIs

row-order.test.ts
  -> row-order.ts
```

UIから純粋ロジックへの一方向とする。`row-order.ts`はReact、WordPress、dnd-kitおよびDOMへ依存しない。

### Main control flow

```text
editor.BlockEdit filter
  -> core/table only
  -> toolbar starts reorder mode
  -> resolve editing document/window from selected table
  -> read body and locate tbody rows in that editing document
  -> calculate row geometry and rowspan ranges
  -> disabled source attempt
     -> handle intercepts pointer before dnd-kit
     -> pointerdown captures pointer until pointerup/cancel/lost capture
     -> one screen notification, no DnD state
  -> movable source starts PointerSensor DnD
  -> validate source
  -> dnd-kit updates temporary drag state and DragOverlay
  -> derive current candidate from pointer position
  -> validate candidate with shared function
     -> invalid or outside tbody: clear committable target + hide insertion indicator + one screen notification
     -> valid: set committable target + update insertion indicator
  -> end
     -> derive actual drop candidate again from final position
     -> validate actual drop candidate again
     -> canceled/no-op/invalid/outside tbody: no attribute update
     -> valid: arrayMove/reorder body + one setAttributes call
  -> remain in reorder mode
  -> explicit exit cancels active drag, removes listeners/observers and returns to normal editing
```

## Implementation phases

### Phase 1: Build entry and Table block connection

- Outcome:
  - 非ブロック拡張のビルド成果物が生成され、ブロックエディターだけで読み込まれる。
  - コアTableブロックを選択したときだけ、既存編集UIを壊さずツールバー操作を表示できる。
- Files:
  - `package.json`
  - `package-lock.json`
  - `yamabiko-editor-tools.php`
  - `src/editor-extensions/table-reorder/index.tsx`
  - `src/editor-extensions/table-reorder/with-table-reorder.tsx`
  - `src/editor-extensions/table-reorder/editor.scss`
- Tasks:
  1. dnd-kitと必要なWordPress直接依存を追加する。
  2. 現在のプロジェクト構成と`@wordpress/scripts`の公開機能を確認し、既存ブロックの自動検出を保持する非ブロックエントリー追加方法を決定する。
  3. PHPへTable Reorderのエディターアセット読込みを追加する。
  4. 薄い`index.tsx`から`editor.BlockEdit`フィルターを登録する。
  5. `core/table`だけを対象にBlockControlsを追加する。
  6. モード状態をブロック属性へ保存しない。
- Validation:
  - 既存Noticeブロックのビルド成果物が引き続き生成される。
  - Table以外にツールバー項目が表示されない。
  - Tableの保存マークアップが変わらない。
  - `npm run format:check`
  - `npm run lint:js`
  - `npm run lint:css`
  - `npm run typecheck`
  - `npm run build`

### Phase 2: Row order and `rowspan` constraints

- Outcome:
  - UIやdnd-kitに依存しない純粋関数で、行順序とMVP移動制約を判定できる。
- Files:
  - `src/editor-extensions/table-reorder/row-order.ts`
  - `src/editor-extensions/table-reorder/row-order.test.ts`
- Tasks:
  1. Table行とセルの最小型を定義する。
  2. `rowspan`値を正規化する。
  3. 結合範囲を抽出して重なる範囲を統合する。
  4. 移動元行、挿入境界、範囲越えおよび`tbody`外を判定する。
  5. 有効な移動だけ行配列を並べ替える。
  6. 行とセルの参照および未知属性を保持する。
- Validation:
  - 通常行の上移動と下移動。
  - 先頭と末尾への移動。
  - no-op。
  - `rowspan`開始行と占有行の移動禁止。
  - 結合範囲途中への挿入禁止。
  - 結合範囲越えの両方向禁止。
  - 複数または重複する結合範囲。
  - `colspan`だけを含む行の移動許可。
  - セル内容、属性、装飾、`colspan`および行内セル順序の保持。
  - `npm run test:unit`
  - `npm run typecheck`

### Phase 3: Editing context, handle UI and dnd-kit pointer DnD

- Outcome:
  - iframe・非iframeの対象編集領域を正しく取得する。
  - 並べ替えモード中だけ行ハンドルが表示され、PointerSensorで同じ制約を使って候補を操作できる。
  - DnD中はTableブロック属性を更新しない。
- Files:
  - `src/editor-extensions/table-reorder/with-table-reorder.tsx`
  - `src/editor-extensions/table-reorder/table-reorder.tsx`
  - `src/editor-extensions/table-reorder/sortable-row.tsx`
  - `src/editor-extensions/table-reorder/editor.scss`
- Tasks:
  1. 選択Tableブロックの要素から`ownerDocument`と`defaultView`を取得する。
  2. その編集領域内で対象Tableの本文行DOMだけを取得する。
  3. 行高を測定し、同じ座標系で左側へハンドルUIを配置する。
  4. `DndContext`、`PointerSensor`、`SortableContext`および縦方向strategyを構成する。
  5. 各行へ`useSortable`、移動可能な各ハンドルへactivatorを接続する。
  6. `rowspan`範囲内の行は`useSortable`を無効化する。
  7. 無効ハンドルのポインター押下をdnd-kit開始前に捕捉し、pointer captureで試行終了を管理する。
  8. 現在のドロップ候補、候補境界および有効・無効状態を管理する。
  9. 候補変更ごとに`validateMove()`を呼ぶ。
  10. 無効候補へのoptimistic sortingを抑止する。
  11. 無効候補または`tbody`外では挿入位置を消し、確定可能な移動先を`null`にする。
  12. 有効候補だけ確定可能な移動先として保持し、挿入位置を表示する。
  13. 表示専用行を一つのDragOverlayへ描画する。
  14. ResizeObserver、スクロール、リサイズで行位置を再測定する。
  15. モード終了または対象変更時にイベントとObserverを解除する。
- Validation:
  - 可変高の行でもハンドルが対応行へ揃う。
  - ポインターDnDで有効候補だけ挿入位置が表示される。
  - 無効候補または`tbody`外へ入ると、以前の有効候補が確定可能な状態として残らない。
  - 無効ハンドルの操作ではDnDを開始しない。
  - 無効ハンドルを押したまま外へ移動して離しても、pointer capture経由で試行終了を検出する。
  - 禁止位置へのoptimistic sortingが発生しない。
  - DragOverlay内で`useSortable`を二重登録しない。
  - DnD中の`body`属性が開始時と同一である。
  - iframe・非iframeの両方で対象Tableだけを取得できる。
  - 両環境でハンドル、挿入位置、DragOverlayが対象行へ揃う。
  - モード終了後にイベントとObserverが残らない。
  - `npm run lint:js`
  - `npm run lint:css`
  - `npm run typecheck`
  - `npm run test:unit`

### Phase 4: Commit, Undo and screen notification

- Outcome:
  - 有効な確定だけが一回の属性更新になる。
  - Undo、画面通知およびDnD中のモード終了が基本設計どおりに動作する。
- Files:
  - `src/editor-extensions/table-reorder/with-table-reorder.tsx`
  - `src/editor-extensions/table-reorder/table-reorder.tsx`
  - `src/editor-extensions/table-reorder/sortable-row.tsx`
- Tasks:
  1. `onDragEnd`で実際の終了位置から候補を求め直し、移動可否を再検証する。
  2. 保持された最後の有効候補を確定処理へ流用しない。
  3. 実際の終了位置が有効で順序が変わる場合だけ`setAttributes({ body: nextBody })`を一回呼ぶ。
  4. 無効位置、候補なし、対象編集領域外または`tbody`外では`setAttributes`を呼ばない。
  5. `arrayMove`を使う場合は有効な確定処理だけで呼ぶ。
  6. 禁止操作を一回だけ画面表示する。
  7. 開始前の無効ハンドル操作と開始後のDnDで通知済み状態を分け、各試行の終了時にリセットする。
  8. DnD中のモード終了で属性更新なしにキャンセルする。
  9. モード終了時にSensor、Observer、イベントおよび一時状態を破棄する。
- Validation:
  - 一回の有効な移動につき`setAttributes`が一回。
  - 一回のUndoで移動前へ戻る。
  - 無効、no-opおよびキャンセルでUndo履歴を増やさない。
  - 有効位置を通過した後、無効位置または`tbody`外へ移動してドロップしても行順序とUndo履歴が変わらない。
  - 無効ハンドルの一回のポインター押下でエラー通知が一回。
  - `pointerup`、`pointercancel`または`lostpointercapture`後の次の操作は新しい試行として一回通知される。
  - 無効ハンドルを押したまま外へ移動して離した後も、次の操作は新しい試行として一回通知される。
  - 一回の開始済みDnDでエラー通知が一回。
  - 新しいDnD開始時に通知済み状態がリセットされる。
  - DnD中のモード終了で開始前の順序を維持する。

### Phase 5: Cross-cutting verification

- Outcome:
  - 要件、基本設計、保存形式、iframe・非iframe対応および既存機能の回帰を横断確認する。
- Files:
  - 原則として新規ファイルなし。
  - 検証で見つかった不具合だけ、責務を持つ既存Table Reorderファイルで修正する。
- Tasks:
  1. 要件とテスト結果を対応付ける。
  2. 通常編集、モード切替、ポインターDnD、`rowspan`、`colspan`、Undoおよび保存を一連で確認する。
  3. iframeエディターと非iframeエディターの両方で、DOM取得、座標、PointerSensor、DragOverlay、Observer、イベントおよび後始末を確認する。
  4. Noticeブロックと既存ビルドを回帰確認する。
  5. `build/`をコミット対象へ含めない。
  6. すべての検証コマンドを実行する。
- Validation:
  - `npm run format:check`
  - `npm run lint:js`
  - `npm run lint:css`
  - `npm run typecheck`
  - `npm run test:unit`
  - `npm run build`
  - 下記の手動確認を完了する。

## Decisions and validation questions

### Decide before implementation

1. **dnd-kitの安定版とAPI系列**
   - 公式ドキュメントに対応する安定版を確認する。
   - `DndContext`、`PointerSensor`、`SortableContext`、`useSortable`およびDragOverlayが同じAPI系列であることを確認する。
   - 使用する縦方向strategyと`arrayMove`の提供パッケージを確認する。
   - ベータ版または内部APIは使用しない。

2. **非ブロックエントリーの出力と読込み**
   - 現在のプロジェクト構成と`@wordpress/scripts`の公開機能を確認し、既存ブロックの自動検出と`blocks-manifest.php`生成を維持できる非ブロックエントリー追加方法を決定する。
   - 確認前に設定ファイル名やビルド拡張方式を確定しない。
   - 一回ビルドし、既存ブロック成果物とTable ReorderのJS、CSS、asset PHPの実際の出力名を確認してPHPのパスを確定する。

3. **Table DOMと編集領域の接続点**
   - `clientId`に対応するブロックラッパーから対象Tableの`tbody > tr`だけを取得できることを確認する。
   - 対象要素の`ownerDocument`と`defaultView`から編集領域を取得できることを確認する。
   - iframe・非iframeの両環境で、同じブロックインスタンスだけを取得できることを確認する。

4. **dnd-kitの座標系とOverlay**
   - PointerSensorの座標、行矩形、挿入位置およびDragOverlayを同じ編集領域の座標系で扱えることを確認する。
   - iframe内の矩形と親文書の矩形を直接比較しない構成にする。
   - スクロール領域と可変幅TableでOverlayがずれない方法を確認する。

5. **DnD中のモード終了**
   - dnd-kitの公開APIで明示的にキャンセルできるか確認する。
   - 明示APIがない場合は`DndContext`のアンマウントで安全に終了し、確定ハンドラーが属性を更新しないことを確認する。
   - 内部Manager状態を直接変更しない。

6. **通常編集との分離**
   - 並べ替えモード中にセル編集を開始しないようにする最小のDOMまたはポインター制御を確認する。
   - 保存DOMを変更せず、エディター一時状態だけで実現する。

### Validate during implementation

1. 無効候補へのdnd-kitのoptimistic sortingを抑止できるか。
2. `useSortable`のtransformを使用しながら、Tableブロック属性をドロップまで変更せずに済むか。
3. DragOverlayがiframe、非iframe、スクロール領域および可変幅Tableで正しく表示されるか。
4. `ResizeObserver`だけで行高変更を捕捉できるか。
5. `rowspan`が数値と文字列のどちらでも同じ範囲を生成できるか。
6. DnD開始時の一時IDとインデックスで確定処理が安定するか。
7. 無効ハンドルのポインター操作をdnd-kitの開始イベントなしで一回だけ通知でき、ハンドル外で離した場合もpointer captureで試行終了を検出できるか。
8. `core/notices`による禁止通知が一回だけになるか。
9. 現在候補が無効または`tbody`外になった時点で確定可能な移動先を確実にクリアできるか。
10. `onDragEnd`で実際の終了位置を再取得し、直前の有効候補ではなく終了位置の検証結果だけを確定へ使用できるか。
11. 一回の`setAttributes({ body: nextBody })`が対象WordPress環境で一回のUndo履歴になるか。
12. モード中にブロック選択またはTable属性が外部から変わった場合、製品仕様を追加せず進行中DnDを安全に破棄できるか。
13. モード終了またはアンマウント後にdnd-kit Sensor、Observerおよび編集領域イベントが残らないか。

ここでは実装技術の成立性だけを確認し、新しい操作、設定、通知または対応範囲を決めない。

## Issue breakdown

プランレビュー後、次の実装単位へ分割できる。

- [ ] 非ブロックエントリー、依存関係およびエディターアセット読込み。
- [ ] コアTableのBlockControlsと並べ替えモード。
- [ ] 行配列、`rowspan`範囲および移動可否の純粋ロジックとunit test。
- [ ] iframe・非iframeの編集領域取得、行DOM測定、ドラッグハンドルUIおよびエディタースタイル。
- [ ] dnd-kitのDndContext、PointerSensor、Sortable、DragOverlayおよび無効候補の制御。
- [ ] 実ドロップ位置の再検証、確定時一回更新、Undoおよびキャンセル。
- [ ] 画面通知と一回の移動試行の管理。
- [ ] 保存形式、両エディター環境および回帰の統合確認。

本Issueでは上記Issueを作成しない。

## Validation

### Automated checks

```bash
npm run format:check
npm run lint:js
npm run lint:css
npm run typecheck
npm run test:unit
npm run build
```

期待結果:

- すべて終了コード0。
- 既存NoticeブロックとTable Reorderの両方がビルドされる。
- `build/blocks-manifest.php`が引き続き生成される。
- Table ReorderのJS、asset PHPおよびエディターCSSが想定パスへ生成される。
- `build/`に手編集またはコミット対象のファイルがない。
- focused unit testが既存テストと一緒に成功する。

### Focused unit test cases

#### Row reordering

- 先頭行を末尾へ移動する。
- 末尾行を先頭へ移動する。
- 中間行を上へ移動する。
- 中間行を下へ移動する。
- 同じ位置では順序を変更しない。
- 元配列を破壊しない。
- 行オブジェクトとセルオブジェクトの参照を保持する。

#### Cell data preservation

- セル内容を保持する。
- セルの未知属性を保持する。
- セル装飾を保持する。
- 行内のセル順序を保持する。
- `colspan`を保持する。
- `rowspan`値を並べ替え処理で変更しない。

#### `rowspan` ranges

- `rowspan: 2`の開始行と後続行を同じ範囲にする。
- 文字列`"2"`を数値と同じように扱う。
- 1、0、負数、非数値および欠損を結合範囲にしない。
- 本文末尾を越える値を最終行までに制限する。
- 重なる範囲を統合する。
- 離れた範囲を別々に保持する。

#### Move validation

- 結合範囲の開始行を移動元にできない。
- 結合範囲の後続行を移動元にできない。
- 結合範囲の途中へ挿入できない。
- 結合範囲の前から後へ移動できない。
- 結合範囲の後から前へ移動できない。
- 結合範囲の外側で同じ側の移動は許可する。
- `tbody`外を拒否する。
- `colspan`だけの行は許可する。
- 禁止結果では表データを変更しない。

### Manual browser checks

#### 1. Normal mode

手順:

1. 3行以上のコアTableブロックを作成する。
2. Tableブロックを選択する。
3. セルを編集する。

期待結果:

- ドラッグハンドルは表示されない。
- 「行を並べ替え」がブロックツールバーに表示される。
- セルを通常どおり編集できる。
- Table以外のブロックには操作が表示されない。

#### 2. Reorder mode

手順:

1. 「行を並べ替え」を押す。
2. 本文行、ヘッダー行およびフッター行を確認する。

期待結果:

- 操作が「並べ替えを終了」へ変わる。
- `tbody`の本文行だけにドラッグハンドルが表示される。
- ヘッダー行とフッター行には表示されない。
- セル内容は表示されたまま、通常編集とDnD操作が分離される。

#### 3. dnd-kit Pointer DnD

手順:

1. 通常行のハンドルをポインターでドラッグする。
2. 有効な別位置へ移動する。
3. ドロップする。

期待結果:

- PointerSensorでハンドルからだけDnDが開始される。
- DragOverlayに移動元行が表示される。
- 有効な候補だけ挿入位置が表示される。
- dnd-kitの一時表示中は`body`属性が更新されない。
- ドロップ時に行順序だけが変わる。
- セル内容、属性、装飾、`colspan`およびセル順序が保持される。
- 一回の確定で`setAttributes`が一回だけ呼ばれる。

#### 4. `rowspan` source protection

手順:

1. `rowspan`を持つ本文行と、そのセルが占有する後続行を用意する。
2. 各行のハンドルをポインターで押す。
3. ハンドルを押したまま外へ移動して離し、もう一度操作する。

期待結果:

- どちらの行からもdnd-kitのDnDを開始できない。
- 一回のポインター押下につき、規定エラーが画面表示で一回だけ通知される。
- 同じ押下中のイベントで通知が増えない。
- ハンドル外で離してもpointer captureにより試行が終了する。
- その後の操作では新しい試行として再び一回通知される。
- 表データを変更しない。

#### 5. `rowspan` insertion and crossing protection

手順:

1. 結合範囲外の通常行からDnDを開始する。
2. 有効な移動先を一度通過する。
3. 結合範囲の途中へ移動し、その無効位置でドロップする。
4. 新しいDnDで有効な移動先を一度通過する。
5. 結合範囲の反対側へ越える無効位置または`tbody`外へ移動し、その位置でドロップする。
6. 同じ試行中に複数の禁止位置へ移動する。

期待結果:

- 禁止位置へのoptimistic sortingが発生しない。
- 禁止位置に挿入線を表示しない。
- 無効位置へ入った時点で、直前の有効候補が確定可能な移動先として残らない。
- `onDragEnd`で実際のドロップ位置が再検証される。
- 有効位置を通過した後でも、無効位置または`tbody`外でドロップした場合は表データを変更しない。
- 無効位置または`tbody`外でドロップした場合は`setAttributes`を呼ばず、Undo履歴を増やさない。
- 一回の試行中、規定エラーは画面に一回だけ表示される。
- 新しいDnDを開始すると必要な場合は再び一回通知される。

#### 6. `colspan` preservation

手順:

1. `colspan`だけを含み、`rowspan`を含まない行を用意する。
2. 有効な位置へ移動する。

期待結果:

- 行を移動できる。
- `colspan`値と行内のセル構造を保持する。

#### 7. Mode exit during DnD

手順:

1. DnDを開始する。
2. 確定前に「並べ替えを終了」を実行する。

期待結果:

- dnd-kitの進行中DnDがキャンセルされる。
- 開始前の順序を維持する。
- Tableブロック属性を更新しない。
- ハンドルが消える。
- 通常編集へ戻る。
- Sensor、イベントおよびObserverが残らない。

#### 8. Undo

手順:

1. 一行を有効な位置へ一回移動して確定する。
2. エディターのUndoを一回実行する。

期待結果:

- 一回のUndoで移動前の順序へ戻る。
- セル内容と属性を保持する。
- 中間位置をたどる複数回のUndoを必要としない。

#### 9. Save format

手順:

1. Table Reorder実行前のブロックマークアップを確認する。
2. 一行を移動して投稿を保存する。
3. コードエディターまたは再読込み後のブロックを確認する。

期待結果:

- コアTableブロックの属性名と保存HTML形式が変わらない。
- 行順序だけが確定後の順序になる。
- Table Reorderのモード、ID、ハンドル、通知またはOverlayに関する値が保存されない。
- ブロック検証エラーが発生しない。

#### 10. iframe editor

手順:

1. iframeを使用する投稿エディターでTableブロックを作成する。
2. 通常編集、並べ替えモード、ポインターDnD、キャンセルおよびモード終了を確認する。
3. エディターをスクロールし、行高が異なるTableでも確認する。

期待結果:

- 選択中Tableブロックの本文行だけを取得する。
- 対象要素の`ownerDocument`と`defaultView`を編集領域として使用する。
- ドラッグハンドルと挿入位置が対象行へ揃う。
- DndContext、PointerSensor、SortableContext、DragOverlayおよびポインターイベントがiframe内の編集領域で正しく動作する。
- iframe内の矩形と親文書の矩形を混在させない。
- モード終了後にSensor、イベントとObserverが残らない。

#### 11. non-iframe editor

手順:

1. 非iframeの投稿エディターでTableブロックを作成する。
2. iframe環境と同じ操作を確認する。

期待結果:

- iframe環境と同じ要件を満たす。
- メイン文書を編集領域として扱い、環境固有の追加操作を必要としない。
- DndContext、PointerSensor、SortableContextおよびDragOverlayの構成を環境ごとに分岐しない。
- 保存形式とTable以外のブロックへ影響しない。

#### 12. Regression

手順:

1. Noticeブロックを挿入し、編集および保存する。
2. Table以外の複数ブロックを編集する。
3. Tableブロックを通常編集する。

期待結果:

- 既存Noticeブロックが従来どおり動作する。
- Table Reorderのフィルターが他ブロックの編集結果を変更しない。
- 通常のTableセル編集、行追加、行削除、列追加および列削除を壊さない。

## Completion criteria

- 実装計画書が`table-reorder-requirements.md`と`table-reorder-design.md`の最新内容に整合している。
- 基本設計書の参照先が`docs/design/table-reorder/table-reorder-design.md`へ統一されている。
- 行の移動方法がドラッグハンドルを使用したポインターDnDだけに限定されている。
- dnd-kitのDndContext、PointerSensor、SortableContext、useSortable、DragOverlay、strategy、arrayMove、安定版確認および公開API利用の実装方針が定義されている。
- dnd-kitの一時表示とTableブロック属性の確定更新が分離されている。
- 現在のドロップ候補と有効・無効状態を管理し、無効候補または`tbody`外では確定可能な移動先をクリアする計画になっている。
- `onDragEnd`で実際のドロップ位置を再検証し、保持された最後の有効候補を確定に使用しない計画になっている。
- 無効候補へのoptimistic sortingを抑止し、実際の終了位置が有効な場合だけ`body`属性を一回更新する計画になっている。
- 無効位置または`tbody`外で終了した場合は`setAttributes`を呼ばず、行順序とUndo履歴を変更しない確認が定義されている。
- iframe・非iframeの両方を対象とする編集領域、座標、イベント、Observer、Sensor、Overlayおよび後始末の方針が定義されている。
- `rowspan`を分断する移動が拒否され、禁止操作では表データが変更されず、一回の移動試行につきエラーが一回だけ画面表示される。
- 一回のUndoで移動前へ戻せる。
- セル内容、セル属性、装飾、`colspan`および行内セル順序を保持する。
- コアTableブロックの保存形式を変更しない。
- Table以外のブロック、対象外のTable領域、既存Noticeブロックへの回帰確認が定義されている。
- 削除済みのキーボードDnDやスクリーンリーダー通知を実装対象、作業手順、テスト項目または完了条件として扱っていない。
