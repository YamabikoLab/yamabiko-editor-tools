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
- `tbody`内の本文行を一行単位で並べ替えるポインターDnD。
- 並べ替えモードの開始と終了。
- 本文行の左側に表示するドラッグハンドル。
- dnd-kitのSortableとDragOverlay。
- セル内容、セル属性、装飾、セル順序および`colspan`を保持した行配列の並べ替え。
- `rowspan`範囲に含まれる行、範囲途中への挿入、範囲越えの移動禁止。
- 禁止された操作で表データを変更せず、一回の移動試行につき一回だけ行う画面通知。
- 有効な確定時だけTableブロック属性を一回更新する処理。
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
- 環境ごとに異なる操作や製品仕様。
- 将来用の汎用DnD基盤、共通API、拡張ポイント。
- 実装用Issueの作成。

## Approach

### 1. コアTableブロックへの接続

`editor.BlockEdit`フィルターでコアTableブロックの編集コンポーネントをラップする。

- `props.name === 'core/table'`のときだけTable Reorderを追加する。
- 元のBlockEditはそのまま描画し、コアTableの編集・保存処理を再実装しない。
- Tableブロック選択時だけブロックツールバーへ「行を並べ替え」を表示する。
- 並べ替えモードはReactの一時状態とし、ブロック属性へ追加しない。
- 通常時はハンドル、Sensor、SortableおよびDragOverlayを描画しない。

### 2. 非ブロックエントリーとアセット読込み

`src/editor-extensions/table-reorder/`をowning directoryとする。

- 既存Noticeブロックの自動ビルドと`blocks-manifest.php`生成を維持する。
- エントリーは`src/editor-extensions/table-reorder/index.tsx`とする。
- 生成されたJS、CSSおよびasset PHPをブロックエディターだけで読み込む。
- `build/`は生成物として扱い、編集またはコミットしない。
- 専用PHPクラスや汎用アセット管理層は追加しない。

### 3. dnd-kitの構成

実装時点の安定版を確認し、同じAPI系列で次を使用する。

- `DndContext`
- `PointerSensor`
- `useSensors` / `useSensor`
- `SortableContext`
- `useSortable`
- `DragOverlay`
- 縦方向の並べ替えstrategy

直接importする公式パッケージだけを`package.json`へ追加し、`package-lock.json`へ固定する。ベータ版や内部APIは使用しない。

`arrayMove`を使う場合も、`rowspan`検証後の有効な確定処理だけで呼ぶ。DnD中はTableブロック属性を更新しない。

### 4. iframe・非iframeの編集領域

選択中Tableブロックの要素を編集領域の起点とする。

- 対象要素の`ownerDocument`と`defaultView`を編集領域の`document`と`window`として扱う。
- グローバルな`document`や`window`が常に編集領域を表すとは仮定しない。
- 本文行検索、位置測定、ポインターイベント、スクロール・リサイズ監視およびObserver登録を対象編集領域へ限定する。
- ハンドル、挿入位置およびDnD中の表示を対象Tableと同じ座標系で扱う。
- ツールバーと並べ替え状態はWordPressの公開APIとReactで連携し、iframe内外のDOMを直接結合しない。
- 非iframe環境では同じ処理がメイン文書を対象として動作する。
- モード終了、対象変更またはアンマウント時にイベントとObserverを解除する。

### 5. 並べ替えモード

開始時:

1. 現在の`attributes.body`を参照する。
2. 選択中Tableブロックの編集領域と`tbody > tr`を取得する。
3. `rowspan`範囲と各行の移動可否を計算する。
4. 本文行に対応するドラッグハンドルを表示する。

終了時:

1. DnD中なら未確定のまま終了する。
2. `setAttributes`を呼ばず、開始前の行順序を維持する。
3. DnD一時状態と通知済み状態を破棄する。
4. イベントとObserverを解除する。
5. ハンドルを非表示にし、通常編集へ戻る。

確定済みの行順序は維持する。

### 6. ハンドル、行表示およびDnD

- 選択中ブロック内の`figure.wp-block-table table tbody > tr`だけを対象にする。
- 本文行ごとの一時IDを生成し、保存データへ追加しない。
- `useSortable({ id, disabled })`を行へ接続し、移動可能な行のハンドルだけへPointerSensorのactivatorを接続する。
- `rowspan`範囲に含まれる行はDnDを無効化し、ポインター操作時はDnDを開始せず規定エラーを画面表示する。
- 各行の位置と高さにハンドルを揃える。
- 行高変更は対象編集領域の`ResizeObserver`で再測定する。
- スクロールまたはリサイズで必要な最小限の再測定を行う。
- ポインター位置から同じ`tbody`内の行間を移動先候補として求める。
- 候補変更時と確定時に共通の`validateMove()`を呼ぶ。
- 無効候補では表データを変更せず、挿入位置を表示しない。
- 有効候補だけ挿入位置を表示する。
- 同じ順序になる位置へのドロップはno-opとする。

### 7. DragOverlay

`DragOverlay`は`DndContext`内に一つだけ置く。

- Overlay内で`useSortable`を再度呼ばない。
- 移動元行を識別できる最小の表示専用プレビューを描画する。
- OverlayはTableブロック属性を更新しない。
- 対象Tableと同じ編集領域・座標系で表示する。
- スタイルは`editor.scss`だけに置く。
- 要件にない操作や表示を追加しない。

### 8. 行データと`rowspan`制約

行の移動では行オブジェクト全体の配列順だけを変更する。

- セル内容やセルオブジェクトを作り直さない。
- 行内のセル順序を変更しない。
- `content`、`colspan`、`rowspan`、装飾および未知属性を変更しない。
- `head`、`foot`および他のTable属性を更新しない。

本文行を上から走査し、`rowspan`が2以上のセルについて、そのセルが占有する開始行から終了行までを結合範囲とする。重なる範囲は統合する。

`validateMove()`は次を判定する。

1. 移動元行が結合範囲に含まれる場合は拒否する。
2. 挿入境界が結合範囲の途中にある場合は拒否する。
3. 移動元と挿入境界が結合範囲を挟んで反対側にある場合は拒否する。
4. 候補が`tbody`外の場合は拒否する。
5. `rowspan`制約がなく、`colspan`だけを含む行は許可する。
6. 同じ順序になる候補はno-opとする。

確定処理は有効で順序が変わる場合だけ、次の形で一回実行する。

```ts
const nextBody = reorderRows(bodyAtDragStart, fromIndex, toIndex);
setAttributes({ body: nextBody });
```

### 9. Undoとエラー通知

次では`setAttributes`を呼ばない。

- DnD開始。
- ポインター移動。
- DragOverlay描画。
- 無効候補。
- no-op。
- 未確定の終了。
- DnD中のモード終了。

禁止操作はWordPressの公開APIを使用し、次の規定文を画面表示する。

> 結合セルを分断する位置には行を移動できません。結合を解除してから並べ替えてください。

- 同じDnD開始からドロップまたは終了までを一回の移動試行とする。
- 一回の移動試行中は、禁止位置の違いにかかわらず一回だけ表示する。
- 新しい移動試行で表示済み状態をリセットする。
- 移動できない行のハンドル操作も、一回のポインター押下を一回の移動試行として扱う。
- 要件にない通知は追加しない。

### 10. 保存形式

Table Reorderは`body`配列の順序以外を変更しない。

- 新しいブロック属性を登録しない。
- 独自HTMLを保存しない。
- `save`フィルターを追加しない。
- フロントエンド用スクリプトまたはスタイルを追加しない。
- 一時ID、モード状態、DnD状態および通知状態を保存しない。

## Architecture

### Planned files

| File | Change | Responsibility |
|---|---|---|
| `package.json` | Update | dnd-kitと直接importするWordPressパッケージを追加する。 |
| `package-lock.json` | Update | 追加依存関係を固定する。 |
| `yamabiko-editor-tools.php` | Update | Table Reorderのエディターアセットと翻訳を読み込む。 |
| `src/editor-extensions/table-reorder/index.tsx` | Add | スタイルをimportし、`editor.BlockEdit`フィルターを登録する。 |
| `src/editor-extensions/table-reorder/with-table-reorder.tsx` | Add | `core/table`への限定、BlockControls、モード状態を扱う。 |
| `src/editor-extensions/table-reorder/table-reorder.tsx` | Add | 編集領域、行測定、DnD状態、イベント、更新、通知、後始末を扱う。 |
| `src/editor-extensions/table-reorder/sortable-row.tsx` | Add | `useSortable`、ハンドル、無効状態、挿入位置、Overlay表示を扱う。 |
| `src/editor-extensions/table-reorder/row-order.ts` | Add | `rowspan`範囲、移動可否、行配列の並べ替えを扱う。 |
| `src/editor-extensions/table-reorder/row-order.test.ts` | Add | 純粋ロジックのfocused unit test。 |
| `src/editor-extensions/table-reorder/editor.scss` | Add | ハンドル、無効状態、挿入位置、Overlayのエディター用スタイル。 |

実装中に責務が過大になった場合だけ分割する。空ファイル、将来用ディレクトリ、`shared/`、`utils/`または`helpers/`は作成しない。

## Implementation phases

### Phase 1: Build entry and Table connection

- dnd-kitと必要な直接依存を追加する。
- 既存ブロックの自動検出を維持する非ブロックエントリーを追加する。
- PHPへTable Reorderのエディターアセット読込みを追加する。
- `core/table`だけへBlockControlsを追加する。
- モード状態をブロック属性へ保存しない。

Validation:

- 既存Noticeブロックの成果物が生成される。
- Table以外にツールバー項目が表示されない。
- Tableの保存マークアップが変わらない。
- `npm run format:check`
- `npm run lint:js`
- `npm run lint:css`
- `npm run typecheck`
- `npm run build`

### Phase 2: Row order and constraints

- Table行とセルの最小型を定義する。
- `rowspan`値を正規化する。
- 結合範囲を抽出して重なる範囲を統合する。
- 移動元、挿入境界、範囲越え、`tbody`外を判定する。
- 有効な移動だけ行配列を並べ替える。
- 行・セル参照と未知属性を保持する。

Validation:

- 通常行の上下移動、先頭・末尾移動、no-op。
- `rowspan`開始行・占有行、範囲途中、範囲越えの禁止。
- `colspan`だけを含む行の移動許可。
- セル内容、属性、装飾、`colspan`、行内セル順序の保持。
- `npm run test:unit`
- `npm run typecheck`

### Phase 3: Edit context, handle UI and pointer DnD

- 対象Tableから編集領域の`document`と`window`を取得する。
- その編集領域内にある選択Tableの本文行だけを取得する。
- 行高を測定し、同じ座標系へハンドルを配置する。
- `useSortable`とPointerSensorを接続する。
- 無効な移動元と候補を拒否する。
- 有効候補だけ挿入位置を表示する。
- 一つのDragOverlayを描画する。
- スクロール、リサイズ、行高変更へ追従する。
- モード終了または対象変更時にイベントとObserverを解除する。

Validation:

- 可変高の行でもハンドルが対応行へ揃う。
- 有効候補だけ挿入位置が表示される。
- 無効ハンドルではDnDが始まらず、エラーが一回だけ表示される。
- DnD中の`body`属性が開始時と同一である。
- iframe・非iframeの両方で対象Tableだけを取得できる。
- 両環境でハンドル、挿入位置、Overlayが対象行へ揃う。
- モード終了後にイベントとObserverが残らない。
- `npm run lint:js`
- `npm run lint:css`
- `npm run typecheck`
- `npm run test:unit`

### Phase 4: Commit, Undo and notification

- 確定時に移動可否を再検証する。
- 有効で順序が変わる場合だけ`setAttributes`を一回呼ぶ。
- 禁止操作を一回だけ画面表示する。
- 新しい移動試行で通知済み状態をリセットする。
- DnD中のモード終了で属性更新なしに終了する。
- モード終了時にSensor、Observer、イベント、一時状態を破棄する。

Validation:

- 一回の有効な移動につき`setAttributes`が一回。
- 一回のUndoで移動前へ戻る。
- 無効、no-op、未確定の終了でUndo履歴を増やさない。
- 一回の移動試行でエラー通知が一回。
- 新しい移動試行では再び一回通知できる。

### Phase 5: Cross-cutting verification

- 要件とテスト結果を対応付ける。
- 通常編集、モード切替、ポインターDnD、`rowspan`、`colspan`、Undo、保存を一連で確認する。
- iframe・非iframeの両方でDOM取得、座標、Overlay、Observer、イベント、後始末を確認する。
- Noticeブロックと既存ビルドを回帰確認する。
- `build/`をコミット対象へ含めない。
- すべての検証コマンドを実行する。

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
- Table ReorderのJS、asset PHP、エディターCSSが生成される。
- focused unit testが既存テストと一緒に成功する。

### Focused unit test cases

- 行の上下移動、先頭・末尾移動、no-op。
- 元配列を破壊せず、行・セルオブジェクトの参照を保持する。
- セル内容、未知属性、装飾、セル順序、`colspan`、`rowspan`を保持する。
- 数値・文字列の`rowspan`を正規化する。
- 無効値を結合範囲にせず、末尾を越える値を最終行までに制限する。
- 重なる範囲を統合し、離れた範囲を分ける。
- 結合範囲の開始行・後続行、範囲途中、範囲越え、`tbody`外を拒否する。
- 結合範囲外の移動と`colspan`だけの行を許可する。
- 禁止結果で表データを変更しない。

### Manual browser checks

#### 1. Normal and reorder modes

- 通常時はハンドルがなく、セルを通常編集できる。
- Table選択時だけ「行を並べ替え」が表示される。
- 並べ替えモードでは`tbody`の本文行だけにハンドルが表示される。
- ヘッダー行とフッター行にはハンドルが表示されない。

#### 2. Pointer DnD

- 通常行を有効な位置へドラッグし、ドロップする。
- DragOverlayと有効候補の挿入位置だけが表示される。
- ドラッグ中は`body`属性が更新されない。
- ドロップ時に行順序だけが変わる。
- セル内容、属性、装飾、`colspan`、セル順序が保持される。

#### 3. `rowspan` protection

- `rowspan`範囲内の行からDnDを開始できない。
- 結合範囲の途中または反対側へ移動できない。
- 禁止位置に挿入線が表示されない。
- 一回の移動試行で規定エラーが一回だけ画面表示される。
- 禁止操作で表データが変更されない。

#### 4. `colspan`, mode exit and Undo

- `colspan`だけを含む行を移動でき、セル構造を保持する。
- DnD中にモードを終了すると未確定の順序を反映せず通常編集へ戻る。
- 有効な一回の移動を一回のUndoで元へ戻せる。

#### 5. Save format

- コアTableブロックの属性名と保存HTML形式が変わらない。
- 行順序だけが確定後の順序になる。
- モード、ID、ハンドル、通知、Overlayの値が保存されない。
- ブロック検証エラーが発生しない。

#### 6. iframe editor

- 選択中Tableの本文行だけを取得する。
- 対象要素の`ownerDocument`と`defaultView`を編集領域として使用する。
- ハンドル、挿入位置、Overlay、ポインターイベントが正しく動作する。
- スクロールや可変高の行でも位置が揃う。
- モード終了後にイベントとObserverが残らない。

#### 7. non-iframe editor

- iframe環境と同じ要件を満たす。
- メイン文書を編集領域として扱い、環境固有の操作を必要としない。
- 保存形式とTable以外のブロックへ影響しない。

#### 8. Regression

- 既存Noticeブロックが従来どおり動作する。
- Table以外のブロックへ影響しない。
- 通常のTableセル編集、行・列の追加と削除を壊さない。

## Completion criteria

- 実装計画書が`table-reorder-requirements.md`と`table-reorder-design.md`の最新内容に整合している。
- 行の移動方法がドラッグハンドルを使用したポインターDnDだけに限定されている。
- iframe・非iframeの両方を対象とする実装方針、作業手順、手動確認が定義されている。
- `rowspan`を分断する移動が拒否され、禁止操作では表データが変更されず、一回の移動試行につきエラーが一回だけ画面表示される。
- 有効な確定時だけ`body`属性を一回更新し、一回のUndoで移動前へ戻す。
- セル内容、セル属性、装飾、`colspan`、行内セル順序を保持する。
- コアTableブロックの保存形式を変更しない。
- Table以外のブロック、対象外のTable領域、既存Noticeブロックへの回帰確認が定義されている。
- 古い基本設計書のファイル名への参照が残っていない。
- 削除済みの要件を実装対象、作業手順、テスト項目または完了条件として扱っていない。
