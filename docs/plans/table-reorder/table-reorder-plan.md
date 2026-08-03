# PLAN-49: Table Reorder

## References

- Parent issue: https://github.com/YamabikoLab/yamabiko-editor-tools/issues/49
- Requirements: `docs/requirements/table-reorder/table-reorder-requirements.md`
- Design: `docs/design/table-reorder/table-reorder-high-level-design.md`
- Source organization: `docs/development/source-organization.md`
- Plan template: `docs/plans/TEMPLATE.md`
- dnd-kit: https://dndkit.com/
- Sortable: https://dndkit.com/concepts/sortable/
- DragOverlay: https://dndkit.com/react/components/drag-overlay/

## Goal

コアTableブロックの保存形式を変更せず、`tbody`内の本文行をポインターまたはキーボードによるDnDで安全に並べ替えられるようにする。

通常のセル編集と行の並べ替えを分離し、並べ替えモード中だけドラッグハンドルを表示する。有効な移動を確定したときだけTableブロックの`body`属性を一回更新し、一回のUndoで移動前へ戻せるようにする。

要件定義書と基本設計書に書かれていない製品仕様は追加しない。

## Scope

### Included

- コアTableブロックを対象とする非ブロックのエディター拡張。
- `tbody`内の本文行を一行単位で並べ替えるDnD。
- 並べ替えモードの開始と終了。
- 本文行の左側に表示するドラッグハンドル。
- ポインターDnD。
- `Space`または`Enter`で開始・確定し、`ArrowUp`と`ArrowDown`で移動し、`Escape`でキャンセルするキーボードDnD。
- dnd-kitのSortableとDragOverlay。
- セル内容、セル属性、装飾、セル順序および`colspan`を保持した行配列の並べ替え。
- `rowspan`範囲に含まれる行の移動禁止。
- `rowspan`範囲の途中への挿入禁止。
- `rowspan`範囲を越える移動の禁止。
- 禁止された操作で表データを変更しない処理。
- 一回の移動試行につき一回だけ行う画面通知とスクリーンリーダー通知。
- DnD開始、現在位置、完了、キャンセル、並べ替えモード開始・終了のスクリーンリーダー通知。
- 一回の確定につき一回だけTableブロック属性を更新する処理。
- focused unit test、ビルド確認、ブラウザー上の手動確認。

### Not included

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

現在の`@wordpress/scripts`によるブロック自動ビルドを維持しながら、Table Reorder用の非ブロックエントリーを一つ追加する。実装前に`@wordpress/scripts`の公開webpack設定拡張方法と実際の出力名を確認し、次を満たす最小構成にする。

- 既存Noticeブロックの自動ビルドと`blocks-manifest.php`生成を維持する。
- Table Reorderのエントリーを`src/editor-extensions/table-reorder/index.tsx`とする。
- 生成されたJS、CSSおよびasset PHPをブロックエディターだけで読み込む。
- `build/`は生成物として扱い、編集またはコミットしない。
- Table Reorder専用のPHPクラスや汎用アセット管理層は追加しない。

### 3. dnd-kitの構成

実装開始時にIssue記載の公式ドキュメントとインストール可能な安定版を確認し、同じAPI系列で次を構成する。

- `DndContext`
- `PointerSensor`
- `KeyboardSensor`
- `useSensors` / `useSensor`
- `SortableContext`
- `useSortable`
- `sortableKeyboardCoordinates`
- `DragOverlay`
- 縦方向の並べ替えに必要なstrategy

パッケージは公式ドキュメントに対応する`@dnd-kit/core`と`@dnd-kit/sortable`を基本とし、直接importする公式パッケージだけを`package.json`へ追加する。バージョンは実装時点の安定版を`package-lock.json`へ固定し、ベータ版や内部APIは使用しない。

`arrayMove`を使用する場合も、`rowspan`検証後の有効な確定処理だけで呼ぶ。DnD中のTableブロック属性更新には使用しない。

### 4. 並べ替えモード

「行を並べ替え」を押したときに次を行う。

1. 並べ替えモードを開始する。
2. 現在の`attributes.body`を参照する。
3. 選択中Tableブロックの`tbody > tr`を取得する。
4. `rowspan`範囲と各行の移動可否を計算する。
5. 本文行に対応するドラッグハンドルを表示する。
6. 並べ替えモード開始をスクリーンリーダーへ通知する。

「並べ替えを終了」を押したときに次を行う。

1. DnD中であれば確定せずキャンセルする。
2. DnD開始時の行順序を維持し、`setAttributes`を呼ばない。
3. 移動元、移動先候補、開始時順序および通知済み状態を破棄する。
4. ドラッグハンドルを非表示にする。
5. 通常のTable編集へ戻す。
6. モード終了をスクリーンリーダーへ通知する。
7. ブロックツールバーの「行を並べ替え」へフォーカスを戻す。

確定済みの行順序は維持する。

### 5. ドラッグハンドルとSortableの接続

各本文行に対応する一時IDを並べ替えモード内で生成する。IDは保存しない。

- 各行に対応するUIへ`useSortable({ id, disabled })`を接続する。
- `setNodeRef`は各sortable行の測定対象へ接続する。
- 移動可能な行では、`setActivatorNodeRef`、`listeners`および`attributes`をドラッグハンドルの`button`へ接続する。
- DnDはハンドルからだけ開始する。
- ハンドルはキーボードでフォーカス可能にする。
- ハンドルには対象行と並べ替え操作であることが分かるラベルを付ける。
- `rowspan`範囲に含まれる行は`useSortable`を`disabled`にし、dnd-kitの`listeners`を接続しない。
- `rowspan`範囲に含まれる行のハンドルにはネイティブの`disabled`属性を付けず、`aria-disabled="true"`と無効状態を示す見た目を付けて、キーボードフォーカスを維持する。
- 無効ハンドルの主ボタン`pointerdown`と`Space`または`Enter`の`keydown`をハンドル側で捕捉し、DnD開始イベントを待たずに`notifyInvalidMove()`を一回だけ呼ぶ。キーボードイベントでは既定動作を抑止し、`event.repeat`による重複通知を行わない。
- 開始前に拒否されたポインター操作の通知済み状態は`pointerup`または`pointercancel`で、キーボード操作の通知済み状態は対応する`keyup`でリセットする。フォーカスが外れた場合も状態を破棄し、次の独立した操作を新しい移動試行として扱う。
- ヘッダー行とフッター行へハンドルを追加しない。

コアTableの保存用行データへDnD用ID、クラスまたは属性を追加しない。

### 6. Table表示とハンドルUI

コアTableの編集UIは元のBlockEditへ任せる。Table Reorderは、選択ブロックのDOM内にある本文行を参照し、行の左側へエディター専用のハンドルUIを重ねる。

- `clientId`に対応するブロックラッパー内だけを検索する。
- `figure.wp-block-table table tbody > tr`を本文行として扱う。
- 各行の位置と高さにハンドルを揃える。
- Table DOMから保存データを逆生成しない。
- 行順序の正は常に`attributes.body`とする。
- 行高の変化は`ResizeObserver`で再測定する。
- エディターのスクロールまたはリサイズで位置がずれる場合は、必要な最小イベントだけで再測定する。
- 並べ替えモード終了時にObserverとイベント登録を解除する。

DOM取得方法、iframeエディターでの座標系およびハンドル配置方法は実装前の小さな検証で確定する。Gutenbergの非公開Reactコンポーネントはimportしない。

### 7. ポインターDnDとキーボードDnD

`DndContext`へ`PointerSensor`と`KeyboardSensor`を登録する。

- ポインター操作はハンドルから開始する。
- キーボード操作は`Space`または`Enter`で開始・確定する。
- `ArrowUp`と`ArrowDown`で候補を一行ずつ移動する。
- `Escape`でキャンセルする。
- ポインターとキーボードは同じ`validateMove()`を使用する。
- DnD開始時に移動元行が移動可能か確認する。
- 候補変更時に挿入位置と`rowspan`範囲越えを検証する。
- 無効な候補では有効な移動先状態を変更しない。
- 無効な候補へ挿入位置を表示しない。
- 確定時に同じ判定を再実行する。

キーボードSensorの既定動作で要件どおり一行単位にならない場合は、`sortableKeyboardCoordinates`を基礎に縦方向だけを返す小さなcoordinate getterをfeature directory内へ置く。左右移動や別sectionへの移動は追加しない。

### 8. DragOverlay

`DragOverlay`は`DndContext`内に一つだけ配置する。

- Overlay内で`useSortable`を再度呼ばない。
- 移動元行のセル内容と既存属性を参照した表示専用プレビューを描画する。
- OverlayはTableブロック属性を更新しない。
- Overlayの子だけをDnD中に切り替え、`DragOverlay`自体はDndContext内に維持する。
- Overlayのスタイルは`editor.scss`だけに置く。
- 要件にない操作ボタン、状態表示または説明を追加しない。

コアTableと同じ完全なセル編集UIを再実装せず、ドラッグ中に対象行を識別できる最小表示にする。表示方法は現在の行DOMを安全に複製できるか、行データから非編集プレビューを描画するかを実装中に比較し、保存形式へ影響しない方を採用する。

### 9. 行データの扱い

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

### 10. `rowspan`範囲と移動可否

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

ポインターとキーボードの両方が、この純粋関数を移動可否の正として使用する。

### 11. データと状態の流れ

1. 選択中のブロックが`core/table`であることを確認する。
2. 「行を並べ替え」で並べ替えモードを開始する。
3. `attributes.body`、本文行DOMおよび`rowspan`範囲を取得する。
4. `rowspan`範囲内の無効ハンドルから操作された場合は、ハンドル側でポインターまたはキーボードの開始前試行を捕捉し、DnD状態を作らず一回だけエラーを通知する。
5. 開始前試行の通知済み状態は、ポインターでは`pointerup`または`pointercancel`、キーボードでは対応する`keyup`でリセットする。`blur`またはモード終了でも破棄する。
6. 移動可能な行からDnDを開始したときに次を一時状態へ保持する。
   - 移動開始前の`body`
   - 移動元ID
   - 移動元インデックス
   - 現在の有効な移動先
   - 同じ移動試行でエラーを通知済みかどうか
7. DnD開始時に移動元を再検証し、禁止対象なら開始を拒否して一回だけエラーを通知する。
8. DnD中はdnd-kitの一時的な表示とDragOverlayだけを更新する。
9. 候補変更時に`validateMove()`を呼ぶ。
10. 無効候補では表データを変更せず、候補を変更せず、一回だけエラーを通知する。
11. 有効候補では挿入位置とスクリーンリーダー向け現在位置を更新する。
12. 確定時に`validateMove()`を再実行する。
13. 有効で順序が変わる場合だけ、開始時`body`から次の配列を作り、`setAttributes({ body: nextBody })`を一回呼ぶ。
14. 完了通知後にDnD一時状態を破棄する。
15. キャンセルでは`setAttributes`を呼ばず、一時状態だけを破棄する。
16. 「並べ替えを終了」でDnDをキャンセルし、開始前試行を含む通知済み状態とハンドルを外して通常編集へ戻る。

### 12. Undo

Undo単位を一回にするため、Tableブロック属性の更新箇所を有効な確定ハンドラーの一か所へ限定する。

次では`setAttributes`を呼ばない。

- DnD開始。
- ポインター移動。
- キーボードの`ArrowUp`または`ArrowDown`。
- DragOverlay描画。
- 無効候補。
- 同じ順序への確定。
- `Escape`。
- DnD中のモード終了。

有効な確定時だけ`setAttributes({ body: nextBody })`を一回呼ぶ。追加の属性更新を同じ操作へ混ぜない。

### 13. 通知

DnDのアクセシビリティ設定で、次を日本語で通知する。

- DnD開始。
- 現在の移動先。
- 移動完了。
- キャンセル。

並べ替えモードの開始と終了は`@wordpress/a11y`の`speak()`を使用する。

禁止操作は一つの`notifyInvalidMove()`から次を行う。

- `core/notices`へ規定のエラー文を画面通知として追加する。
- `speak()`で同じ内容をスクリーンリーダーへ通知する。

エラー文は要件定義書の文をそのまま使用する。

> 結合セルを分断する位置には行を移動できません。結合を解除してから並べ替えてください。

通知の重複防止は、開始前に拒否される無効ハンドル操作と、開始後のDnDを別の試行として管理する。

- 無効ハンドルのポインター試行は、主ボタンの`pointerdown`から`pointerup`または`pointercancel`までを一回の移動試行とする。
- 無効ハンドルのキーボード試行は、`Space`または`Enter`の`keydown`から対応する`keyup`までを一回の移動試行とし、キーリピートでは再通知しない。
- 無効ハンドルが`blur`した場合、または並べ替えモードを終了した場合は開始前試行の通知済み状態を破棄する。
- 移動可能な行のDnDでは、DnD開始時に通知済み状態をリセットし、完了またはキャンセルまでに無効候補が複数回発生しても一回だけ通知する。
- DnDの完了、キャンセルまたはモード終了でDnD側の通知済み状態を破棄する。

要件にない画面通知は追加しない。

### 14. フォーカス

- ドラッグハンドルはネイティブ`button`とする。
- `rowspan`範囲内の無効ハンドルにもネイティブの`disabled`属性は付けず、`aria-disabled="true"`で状態を伝えながらフォーカス可能にする。
- DnD開始時は操作中のハンドルを基準にする。
- 有効な確定後は、移動後の対象行に対応するハンドルへフォーカスを維持する。
- キャンセル後は、移動元行のハンドルへフォーカスを戻す。
- モード終了後は、ブロックツールバーの「行を並べ替え」へフォーカスを戻す。
- dnd-kitの既定フォーカス復元で要件を満たせる場合は、それを優先する。
- 明示的な`focus()`は不足する箇所だけに追加する。

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
| `webpack.config.js` | Add | `@wordpress/scripts`の公開webpack設定を拡張し、既存ブロックの自動検出と`blocks-manifest.php`生成を維持したまま、Table Reorderの非ブロックエントリーを追加する。 |
| `yamabiko-editor-tools.php` | Update | 生成されたTable Reorderのエディタースクリプト、スタイル、依存関係および翻訳を読み込む。 |
| `src/editor-extensions/table-reorder/index.tsx` | Add | スタイルをimportし、`editor.BlockEdit`フィルターを登録する薄い入口。 |
| `src/editor-extensions/table-reorder/with-table-reorder.tsx` | Add | `core/table`への限定、BlockControls、並べ替えモードおよび元のBlockEditとの接続。 |
| `src/editor-extensions/table-reorder/table-reorder.tsx` | Add | Table DOMの取得、行位置測定、DndContext、DnD一時状態、イベント、確定更新、通知およびモード終了時のキャンセル。 |
| `src/editor-extensions/table-reorder/sortable-row.tsx` | Add | 各行の`useSortable`接続、ドラッグハンドル、無効状態、開始前の禁止操作捕捉、挿入位置およびOverlay用表示。 |
| `src/editor-extensions/table-reorder/row-order.ts` | Add | Table行とセルの最小型、`rowspan`範囲抽出、移動可否判定および行配列の並べ替え。 |
| `src/editor-extensions/table-reorder/row-order.test.ts` | Add | 行順序、属性保持、`rowspan`範囲、禁止条件、`colspan`保持およびno-opのfocused unit test。 |
| `src/editor-extensions/table-reorder/editor.scss` | Add | ハンドル、フォーカス、無効状態、挿入位置およびDragOverlayのエディター専用スタイル。 |

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
  -> read body and locate tbody rows
  -> calculate row geometry and rowspan ranges
  -> disabled source attempt
     -> handle intercepts pointer or Space/Enter before dnd-kit
     -> one error notification, no DnD state
  -> movable source starts pointer or keyboard DnD
  -> validate source
  -> validate candidate with shared function
     -> invalid: keep candidate + one error notification
     -> valid: update temporary target and insertion indicator
  -> end
     -> canceled/no-op/invalid: no attribute update
     -> valid: reorder body + one setAttributes call
  -> remain in reorder mode
  -> explicit exit cancels active drag and returns to normal editing
```

## Implementation phases

### Phase 1: Build entry and Table block connection

- Outcome:
  - 非ブロック拡張のビルド成果物が生成され、ブロックエディターだけで読み込まれる。
  - コアTableブロックを選択したときだけ、既存編集UIを壊さずツールバー操作を表示できる。
- Files:
  - `package.json`
  - `package-lock.json`
  - `webpack.config.js`
  - `yamabiko-editor-tools.php`
  - `src/editor-extensions/table-reorder/index.tsx`
  - `src/editor-extensions/table-reorder/with-table-reorder.tsx`
  - `src/editor-extensions/table-reorder/editor.scss`
- Tasks:
  1. dnd-kitと必要なWordPress直接依存を追加する。
  2. 既存ブロックの自動検出を保持するビルド設定を追加する。
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

### Phase 3: Reorder mode, handle UI and DnD

- Outcome:
  - 並べ替えモード中だけ行ハンドルが表示され、ポインターとキーボードで同じ制約を使って候補を操作できる。
  - DnD中はTableブロック属性を更新しない。
- Files:
  - `src/editor-extensions/table-reorder/with-table-reorder.tsx`
  - `src/editor-extensions/table-reorder/table-reorder.tsx`
  - `src/editor-extensions/table-reorder/sortable-row.tsx`
  - `src/editor-extensions/table-reorder/editor.scss`
- Tasks:
  1. 選択Tableブロックの本文行DOMを取得する。
  2. 行高を測定し、左側へハンドルUIを配置する。
  3. 各行へ`useSortable`、移動可能な各ハンドルへactivatorを接続する。
  4. `rowspan`範囲内の行は`useSortable`を無効化し、ハンドルをフォーカス可能な`aria-disabled`状態にする。
  5. 無効ハンドルのポインター押下と`Space`または`Enter`をDnD外で捕捉する。
  6. PointerSensorとKeyboardSensorを接続する。
  7. `Space`、`Enter`、`ArrowUp`、`ArrowDown`および`Escape`を確認する。
  8. 候補変更ごとに`validateMove()`を呼ぶ。
  9. 無効候補では候補を変更せず、挿入位置を表示しない。
  10. 有効候補だけ挿入位置を表示する。
  11. 表示専用行を一つのDragOverlayへ描画する。
- Validation:
  - 可変高の行でもハンドルが対応行へ揃う。
  - ポインターDnDで有効候補だけ挿入位置が表示される。
  - キーボードDnDで候補が一行ずつ移動する。
  - `rowspan`範囲内のハンドルへTabでフォーカスでき、`aria-disabled`が伝わる。
  - 無効ハンドルの操作ではDnDを開始せず、開始前の禁止通知経路を呼ぶ。
  - 禁止位置でポインターの挿入位置を表示しない。
  - 禁止位置でキーボード候補を変更しない。
  - DragOverlay内で`useSortable`を二重登録しない。
  - キャンセル時に開始前の順序を維持する。
  - DnD中の`body`属性が開始時と同一である。
  - `npm run lint:js`
  - `npm run lint:css`
  - `npm run typecheck`
  - `npm run test:unit`

### Phase 4: Commit, Undo, notifications and focus

- Outcome:
  - 有効な確定だけが一回の属性更新になる。
  - Undo、通知、フォーカスおよびDnD中のモード終了が基本設計どおりに動作する。
- Files:
  - `src/editor-extensions/table-reorder/with-table-reorder.tsx`
  - `src/editor-extensions/table-reorder/table-reorder.tsx`
  - `src/editor-extensions/table-reorder/sortable-row.tsx`
  - `src/editor-extensions/table-reorder/editor.scss`
- Tasks:
  1. 確定時に移動可否を再検証する。
  2. 有効で順序が変わる場合だけ`setAttributes({ body: nextBody })`を一回呼ぶ。
  3. 開始、現在位置、完了およびキャンセルを通知する。
  4. モード開始と終了を通知する。
  5. 禁止操作を一回だけ画面表示および読み上げる。
  6. 開始前の無効ハンドル操作と開始後のDnDで通知済み状態を分け、各試行の終了時にリセットする。
  7. 確定後、キャンセル後およびモード終了後のフォーカスを戻す。
  8. DnD中のモード終了で属性更新なしにキャンセルする。
  9. モード終了時にSensor、Observerおよび一時状態を破棄する。
- Validation:
  - 一回の有効な移動につき`setAttributes`が一回。
  - 一回のUndoで移動前へ戻る。
  - 無効、no-opおよびキャンセルでUndo履歴を増やさない。
  - 無効ハンドルの一回のポインター押下またはキー押下でエラー通知が一回。
  - `pointerup`、`pointercancel`または対応する`keyup`後の次の操作は新しい試行として一回通知される。
  - キーリピートでは通知が増えない。
  - 一回の開始済みDnDでエラー通知が一回。
  - 新しいDnD開始時にDnD側の通知済み状態がリセットされる。
  - キーボードだけで開始、上下移動、確定およびキャンセルを完了できる。
  - DnD中のモード終了で開始前の順序を維持する。
  - 確定後とキャンセル後に対象ハンドルを操作できる。
  - モード終了後にツールバーボタンを操作できる。

### Phase 5: Cross-cutting verification

- Outcome:
  - 要件、基本設計、保存形式、アクセシビリティおよび既存機能の回帰を横断確認する。
- Files:
  - 原則として新規ファイルなし。
  - 検証で見つかった不具合だけ、責務を持つ既存Table Reorderファイルで修正する。
- Tasks:
  1. 要件とテスト結果を対応付ける。
  2. 通常編集、モード切替、ポインター、キーボード、`rowspan`、`colspan`、Undoおよび保存を一連で確認する。
  3. iframeエディターでDOM取得、Overlay、Observerおよびフォーカスを確認する。
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
   - Issue記載の公式ドキュメントに対応する安定版を確認する。
   - `DndContext`、`SortableContext`、`useSortable`、SensorおよびDragOverlayが同じAPI系列であることを確認する。
   - ベータ版または内部APIは使用しない。

2. **非ブロックエントリーの出力と読込み**
   - `webpack.config.js`で`@wordpress/scripts`の公開webpack設定を拡張する。
   - 既存ブロックの自動検出と`blocks-manifest.php`生成を維持したまま、Table Reorderの非ブロックエントリーを追加する。
   - 一回ビルドし、既存ブロック成果物とTable ReorderのJS、CSS、asset PHPの実際の出力名を確認してPHPのパスを確定する。

3. **Table DOMの接続点**
   - `clientId`に対応するブロックラッパーから対象Tableの`tbody > tr`だけを取得できることを確認する。
   - WordPress 6.8以降とiframeエディターで同じブロックインスタンスだけを取得できることを確認する。

4. **DnD中のモード終了**
   - dnd-kitの公開APIで明示的にキャンセルできるか確認する。
   - 明示APIがない場合はDndContextのアンマウントで安全に終了し、確定ハンドラーが属性を更新しないことを確認する。
   - 内部Manager状態を直接変更しない。

5. **通常編集との分離**
   - 並べ替えモード中にセル編集を開始しないようにする最小のDOMまたはフォーカス制御を確認する。
   - 保存DOMを変更せず、エディター一時状態だけで実現する。
   - Table内容をスクリーンリーダーから不必要に隠さない方法を採用する。

### Validate during implementation

1. 無効候補へのoptimistic sortingをポインターとキーボードの両方で抑止できるか。
2. dnd-kitの既定フォーカス復元だけで確定後とキャンセル後の要件を満たせるか。
3. DragOverlayがiframe、スクロール領域および可変幅Tableで正しく表示されるか。
4. `ResizeObserver`だけで行高変更を捕捉できるか。
5. `rowspan`が数値と文字列のどちらでも同じ範囲を生成できるか。
6. DnD開始時の一時IDとインデックスで確定処理が安定するか。
7. 無効ハンドルのポインター操作と`Space`または`Enter`を、dnd-kitの開始イベントなしで一回だけ通知できるか。
8. `core/notices`と`@wordpress/a11y`による開始済みDnDの禁止通知が一回だけになるか。
9. 一回の`setAttributes({ body: nextBody })`が対象WordPress環境で一回のUndo履歴になるか。
10. モード中にブロック選択またはTable属性が外部から変わった場合、製品仕様を追加せず進行中DnDを安全に破棄できるか。

ここでは実装技術の成立性だけを確認し、新しい操作、設定、通知または対応範囲を決めない。

## Issue breakdown

プランレビュー後、次の実装単位へ分割できる。

- [ ] 非ブロックエントリー、依存関係およびエディターアセット読込み。
- [ ] コアTableのBlockControlsと並べ替えモード。
- [ ] 行配列、`rowspan`範囲および移動可否の純粋ロジックとunit test。
- [ ] 行DOM測定、ドラッグハンドルUIおよびエディタースタイル。
- [ ] dnd-kit Sortable、ポインターDnD、キーボードDnDおよびDragOverlay。
- [ ] 確定時一回更新、Undoおよびキャンセル。
- [ ] 画面通知、スクリーンリーダー通知およびフォーカス。
- [ ] 保存形式、アクセシビリティおよび回帰の統合確認。

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
- モード開始が読み上げられる。
- セル内容は表示されたまま、通常編集とDnD操作が分離される。

#### 3. Pointer DnD

手順:

1. 通常行のハンドルをポインターでドラッグする。
2. 有効な別位置へ移動する。
3. ドロップする。

期待結果:

- DragOverlayに移動元行が表示される。
- 有効な候補だけ挿入位置が表示される。
- ドラッグ中は`body`属性が更新されない。
- ドロップ時に行順序だけが変わる。
- セル内容、属性、装飾、`colspan`およびセル順序が保持される。
- 完了が読み上げられる。

#### 4. Keyboard DnD commit

手順:

1. 通常行のハンドルへTabで移動する。
2. `Space`または`Enter`を押す。
3. `ArrowUp`または`ArrowDown`を押す。
4. `Space`または`Enter`を押す。

期待結果:

- キーボードだけで開始、候補変更および確定できる。
- 候補は一行ずつ変わる。
- 開始、現在位置および完了が読み上げられる。
- 確定時だけ行順序が一回更新される。
- 移動後の行ハンドルを続けて操作できる。

#### 5. Keyboard DnD cancel

手順:

1. ハンドルでDnDを開始する。
2. 一行以上候補を変更する。
3. `Escape`を押す。

期待結果:

- 開始前の順序を維持する。
- Tableブロック属性を更新しない。
- キャンセルが読み上げられる。
- 移動元ハンドルへフォーカスが戻る。

#### 6. `rowspan` source protection

手順:

1. `rowspan`を持つ本文行と、そのセルが占有する後続行を用意する。
2. 各行のハンドルへTabでフォーカスする。
3. ポインターで押下し、`Space`および`Enter`でもDnD開始を試みる。
4. ポインターまたはキーを押したままにして、同じ試行中の重複通知を確認する。
5. ポインターまたはキーを離した後、もう一度開始を試みる。

期待結果:

- どちらの行からもDnDを開始できない。
- ハンドルはフォーカス可能で、`aria-disabled`により無効状態が伝わる。
- 無効状態を色以外でも確認できる。
- 一回のポインター押下またはキー押下につき、規定エラーが画面表示および読み上げで一回だけ通知される。
- キーリピートや同じ押下中のイベントで通知が増えない。
- `pointerup`、`pointercancel`または対応する`keyup`後の次の操作では、必要な場合に再び一回通知される。
- 表データを変更しない。

#### 7. `rowspan` insertion and crossing protection

手順:

1. 結合範囲外の通常行からDnDを開始する。
2. 結合範囲の途中へ移動を試みる。
3. 結合範囲の反対側へ越える移動を試みる。
4. 同じ試行中に複数の禁止位置へ移動する。

期待結果:

- ポインターでは禁止位置に挿入線を表示しない。
- キーボードでは禁止位置へ候補を変更しない。
- 表データを変更しない。
- 一回の試行中、規定エラーは画面と読み上げで一回だけ。
- 新しいDnDを開始すると必要な場合は再び一回通知される。

#### 8. `colspan` preservation

手順:

1. `colspan`だけを含み、`rowspan`を含まない行を用意する。
2. 有効な位置へ移動する。

期待結果:

- 行を移動できる。
- `colspan`値と行内のセル構造を保持する。

#### 9. Mode exit during DnD

手順:

1. DnDを開始する。
2. 確定前に「並べ替えを終了」を実行する。

期待結果:

- 進行中のDnDがキャンセルされる。
- 開始前の順序を維持する。
- Tableブロック属性を更新しない。
- ハンドルが消える。
- 通常編集へ戻る。
- モード終了が読み上げられる。
- 「行を並べ替え」を操作できる位置へフォーカスが戻る。

#### 10. Undo

手順:

1. 一行を有効な位置へ一回移動して確定する。
2. エディターのUndoを一回実行する。

期待結果:

- 一回のUndoで移動前の順序へ戻る。
- セル内容と属性を保持する。
- 中間位置をたどる複数回のUndoを必要としない。

#### 11. Save format

手順:

1. Table Reorder実行前のブロックマークアップを確認する。
2. 一行を移動して投稿を保存する。
3. コードエディターまたは再読込み後のブロックを確認する。

期待結果:

- コアTableブロックの属性名と保存HTML形式が変わらない。
- 行順序だけが確定後の順序になる。
- Table Reorderのモード、ID、ハンドル、通知またはOverlayに関する値が保存されない。
- ブロック検証エラーが発生しない。

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

- [ ] `src/editor-extensions/table-reorder/`をowning directoryとする最小構成が具体化されている。
- [ ] 非ブロックエントリーが既存ブロックの自動ビルドを壊さない方針になっている。
- [ ] Table Reorderのアセットをブロックエディターだけで読み込む方針になっている。
- [ ] `editor.BlockEdit`フィルターで`core/table`だけを拡張する。
- [ ] 通常時はドラッグハンドルを表示せず、セルを通常編集できる。
- [ ] 並べ替えモードの開始と終了が具体化されている。
- [ ] `tbody`本文行だけへドラッグハンドルを表示する。
- [ ] dnd-kit、SortableおよびDragOverlayを使用する。
- [ ] ドラッグハンドルと`useSortable`の接続が具体化されている。
- [ ] `rowspan`範囲内の無効ハンドルをフォーカス可能な`aria-disabled`状態とし、開始前の禁止操作を通知する経路が具体化されている。
- [ ] PointerSensorとKeyboardSensorの接続が具体化されている。
- [ ] ポインターとキーボードが同じ移動可否判定を使用する。
- [ ] キーボードで開始、上下移動、確定およびキャンセルできる。
- [ ] DnD中は確定済み`body`属性を更新しない。
- [ ] 有効な確定時だけ`body`属性を一回更新する。
- [ ] 一回の移動を一回のUndoで戻せる方針になっている。
- [ ] セル内容、属性、装飾、`colspan`および行内セル順序を保持する。
- [ ] `rowspan`範囲内の行を移動元にできない。
- [ ] `rowspan`範囲途中への挿入を禁止する。
- [ ] `rowspan`範囲越えを禁止する。
- [ ] 禁止またはキャンセルで表データを変更しない。
- [ ] 禁止位置でポインターの挿入線を表示しない。
- [ ] 禁止位置でキーボードの移動先を変更しない。
- [ ] 一回の移動試行につきエラーを一回だけ画面表示および読み上げる。
- [ ] DnD開始、現在位置、完了、キャンセル、モード開始およびモード終了を読み上げる。
- [ ] DnD中のモード終了が開始前の順序を維持してキャンセルされる。
- [ ] コアTableブロックの属性構造と保存HTML形式を変更しない。
- [ ] PhaseごとのOutcome、Tasks、Validationが記載されている。
- [ ] 自動テスト、手動確認および検証コマンドが記載されている。
- [ ] 実装前に決める事項と実装中に検証する事項が分離されている。
- [ ] 実装用Issueへ分割可能な単位が記載されている。
- [ ] 要件定義書と基本設計書にない製品仕様を追加していない。

## Notes

- 要件の対象範囲、対象外、完了条件およびエラー文は要件定義書を正とする。
- 基本設計書は要件範囲内の実装方法として扱う。
- dnd-kitとWordPressの公開APIだけを使用し、Gutenbergの非公開内部モジュールへ依存しない。
- Table DOMはエディターUIの接続にだけ使用し、保存内容をDOMから逆生成しない。
- 行順序の正は常にTableブロックの`body`属性とする。
- 技術検証で要件にない製品判断が必要になった場合は実装を拡張せず、確認事項としてIssueへ戻す。
