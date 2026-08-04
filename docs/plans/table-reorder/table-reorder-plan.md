# PLAN-75: Table Reorder

## References

- Parent issue: https://github.com/YamabikoLab/yamabiko-editor-tools/issues/75
- Requirements: `docs/requirements/table-reorder/table-reorder-requirements.md`
- Design: `docs/design/table-reorder/table-reorder-design.md`
- Source organization: `docs/development/source-organization.md`
- React Quickstart: https://dndkit.com/react/quickstart/
- `useSortable`: https://dndkit.com/react/hooks/use-sortable/
- `DragOverlay`: https://dndkit.com/react/components/drag-overlay/

## Goal

コアTableブロックの保存形式を変更せず、`tbody`内の本文行をドラッグハンドルによるポインターDnDで安全に並べ替えられるようにする。

通常のセル編集と行の並べ替えを分離し、並べ替えモード中だけDnDを有効にする。有効な移動を確定したときだけTableブロックの`body`属性を一回更新し、一回のUndoで移動前へ戻せるようにする。

## Scope

### Included

- コアTableブロックを対象とするエディター拡張。
- ブロックツールバーによる並べ替えモードの開始と終了。
- `tbody`内の本文行ごとのドラッグハンドル。
- 同じ`tbody`内での一行単位のポインターDnD。
- 現行の`@dnd-kit/react`による`DragDropProvider`、`useSortable`および`DragOverlay`の利用。
- 行データの順序変更によるセル内容、セル属性、装飾、セル順序および`colspan`の保持。
- `rowspan`結合範囲に含まれる行、結合範囲の途中および結合範囲を越える移動の禁止。
- 禁止位置の挿入表示抑止と、一回の移動試行につき一回の画面通知。
- 一回の確定した行移動を一回のUndoで戻せる更新。
- iframe・非iframeの編集環境で同じ操作と後始末を行う実装。
- エディター拡張をビルドし、ブロックエディターだけで読み込むための設定。
- 制約判定と行順序更新の自動テスト、およびエディター上の手動検証。

### Not included

- 上下移動ボタンによる並べ替え。
- 列の並べ替え。
- 複数行の同時移動。
- 結合セルを含む行グループ全体の移動。
- 行の複製。
- CSVの入出力。
- 値による自動ソート。
- `thead`と`tfoot`の並べ替え。
- ヘッダー、本文、フッターをまたぐ移動。
- コアTableブロックの保存形式、独自属性または保存HTMLの変更。

## Approach

### エディター拡張として統合する

Table Reorderは`src/editor-extensions/table-reorder/`に配置し、`editor.BlockEdit`フィルターを通じて`core/table`だけを拡張する。

拡張は元のTableブロック編集UIを置き換えない。通常時はブロックツールバーの開始ボタンだけを追加し、並べ替えモード中だけDnD用の一時UIと状態を追加する。Table以外のブロックでは元の`BlockEdit`をそのまま返す。

エディター拡張用のビルドエントリーを追加し、生成されたスクリプトとスタイルを`enqueue_block_editor_assets`でブロックエディターにだけ読み込む。既存ブロックのmanifestビルドと登録は維持する。

### Tableブロックのデータを唯一の保存対象とする

並べ替え対象はBlockEdit propsが保持するTableブロックの`body`配列とする。

ドラッグ中は`body`属性を更新しない。ドロップが有効で、移動前後の位置が異なる場合だけ、新しい配列順を作成して`setAttributes({ body })`を一回呼ぶ。行オブジェクトとセルオブジェクトは作り直さず、既存の行データを配列内で移動する。

キャンセル、同じ位置へのドロップ、禁止位置へのドロップ、`tbody`外へのドロップでは`setAttributes`を呼ばない。

### 現行dnd-kit React APIを使用する

- `DragDropProvider`と`DragOverlay`を`@dnd-kit/react`から使用する。
- `useSortable`と`isSortable`を`@dnd-kit/react/sortable`から使用する。
- DnD範囲を`DragDropProvider`で包む。
- 各本文行を`useSortable({ id, index, element, disabled })`で登録する。
- 行DOMをsortable elementとして登録し、ドラッグハンドル要素には`handleRef`を接続する。
- 行IDは編集画面上だけで使用する一時IDとし、保存属性やHTMLへ追加しない。
- `rowspan`結合範囲に含まれる行は`disabled`としてDnDを開始できないようにする。
- `onDragStart`で移動開始時の行順序、移動元位置および通知済み状態を初期化する。
- `onDragOver`で移動先候補を検証し、禁止位置ではイベントの既定処理を抑止してsortableの視覚移動を進めない。
- `onDragEnd`では`isSortable()`で移動元を絞り込み、`initialIndex`と`index`から確定位置を取得する。
- `DragOverlay`は`DragDropProvider`内に一つだけ配置し、ドラッグ中の行を読み取り専用の視覚フィードバックとして表示する。
- overlay内では`useSortable`を呼ばず、ドラッグ元の登録を重複させない。

Tableブロックの`body`は独自構造であり、`rowspan`制約を確定前に判定する必要があるため、行順序の更新は汎用move helperへ委ねず、機能内の小さな純粋関数で行う。

### 編集領域を基準にDOMと座標を扱う

BlockEdit拡張が描画する一時アンカーから、対象Tableブロックの要素、`ownerDocument`および`defaultView`を取得する。

本文行の検索、行位置の測定、ハンドル用コンテナ、DnD表示、イベント、`ResizeObserver`および`MutationObserver`は、対象Tableブロックが存在する編集領域に限定する。グローバルな`document`と`window`を編集領域として固定しない。

ドラッグハンドルは対象Tableブロックと同じ編集領域へportalで描画し、各`tbody > tr`の左側へ配置する。行の寸法変化、スクロール、Tableブロックの再描画に合わせて位置を再計算する。

並べ替えモードの終了、対象ブロックの選択解除、ブロックの破棄または編集領域の変更時は、追加したDOM、portal、イベントおよびObserverをすべて解除する。

### `rowspan`を移動不能範囲と境界として扱う

`tbody`の行を上から走査し、`rowspan >= 2`のセルごとに開始行から終了行までの結合範囲を求める。

- 結合範囲に含まれるすべての行を移動元として禁止する。
- 結合範囲の途中にある行間を移動先として禁止する。
- 移動元と移動先が結合範囲を挟んで反対側にある場合は、結合範囲を越える移動として禁止する。
- `tbody`の外を移動先として禁止する。
- `colspan`だけを含む行は、上記の`rowspan`制約に該当しなければ移動を許可する。

禁止候補では挿入位置を表示せず、行データを更新しない。通知は一回のDnD開始から終了までに一回だけ、次の文言で表示する。

> 結合セルを分断する位置には行を移動できません。結合を解除してから並べ替えてください。

## Architecture

### Directory structure

`source-organization.md`のfeature-first方針に従い、Table Reorderが所有する実装、スタイルおよびfocused testsを一つの機能ディレクトリへまとめる。

```text
.
├── src/
│   ├── blocks/
│   │   └── notice/
│   └── editor-extensions/
│       └── table-reorder/
│           ├── index.tsx
│           ├── with-table-reorder.tsx
│           ├── table-reorder-controller.tsx
│           ├── sortable-row.tsx
│           ├── rowspan.ts
│           ├── rowspan.test.ts
│           ├── reorder.ts
│           ├── reorder.test.ts
│           └── editor.scss
├── build/                              # generated, not committed
│   └── editor-extensions/
│       └── table-reorder/
├── webpack.config.js
├── package.json
└── yamabiko-editor-tools.php
```

- Table Reorderはブロックそのものではないため、`src/blocks/`ではなく`src/editor-extensions/`へ配置する。
- 保存マークアップやフロントエンド表示を追加しないため、`block.json`、`save.tsx`、`render.php`および`style.scss`は作成しない。
- エディター専用の見た目は`editor.scss`だけが所有する。
- focused testsは対象モジュールと同じディレクトリに置く。
- MVPでは`components/`、`hooks/`、`utils/`、`helpers/`および`shared/`の下位ディレクトリを作らない。
- 新しいファイルやディレクトリは、実装中に独立した責務が実際に生じた場合だけ追加する。
- `build/`はwebpackが生成する出力であり、直接編集またはコミットしない。

### React component composition

```text
withTableReorder(BlockEdit)
├── original BlockEdit
├── BlockControls
│   └── ToolbarButton
└── TableReorderController             # 並べ替えモード中だけ描画
    ├── DragDropProvider
    │   ├── SortableRow × tbody行数
    │   │   └── drag handle button
    │   └── DragOverlay × 1
    └── handle portal container
```

#### `withTableReorder`

- WordPressの`editor.BlockEdit`フィルターへ登録するHOCとする。
- 元のBlockEditを常に描画し、`core/table`かつ選択中の場合だけTable Reorderの操作を追加する。
- `BlockControls`とモード状態を所有する。
- 並べ替えモード中だけ`TableReorderController`を描画する。
- DnD、DOM測定、`rowspan`判定および行配列更新は持たない。

#### `TableReorderController`

- 一つの対象TableブロックについてDnDセッション全体を調整する。
- `DragDropProvider`、一つの`DragOverlay`、本文行一覧、移動候補および通知済み状態を所有する。
- 対象Tableの編集領域を解決し、portal container、イベントおよびObserverの作成と破棄を行う。
- `rowspan.ts`と`reorder.ts`の結果を組み合わせ、有効なドロップ時だけ`setAttributes`を一回呼ぶ。
- 行ごとの`useSortable`登録は持たず、`SortableRow`へ委譲する。

#### `SortableRow`

- 一つの`tbody`行と一つのドラッグハンドルを対応付ける小さなコンポーネントとする。
- `useSortable`を一回だけ呼び、行DOMをsortable elementへ、ボタンを`handleRef`へ接続する。
- `disabled`、ドラッグ中および挿入候補の表示状態を受け取る。
- Table属性の更新、通知、Observerおよび他行の状態は所有しない。

`DragOverlay`は独立したfeature componentへ分割せず、`TableReorderController`内の小さな読み取り専用表示として開始する。実装が大きくなり独立した責務が明確になった場合だけ、同じfeature directory直下へ分離する。

### Build and loading

#### `webpack.config.js`

- 既存の`@wordpress/scripts`設定を基礎にする。
- ブロックmanifestのビルドを維持したまま、Table Reorderのエディター拡張エントリーを追加する。
- 出力先を`build/editor-extensions/table-reorder/`に固定する。
- 生成物はコミットしない。

#### `yamabiko-editor-tools.php`

- 生成されたassetファイルを読み込み、依存関係とバージョンを使ってTable Reorderスクリプトを登録する。
- `enqueue_block_editor_assets`でエディター用スクリプトとスタイルを読み込む。
- 生成物が存在しない場合は安全に何も行わない。
- 既存のブロック登録処理は変更しない。

### Feature entry and integration

#### `src/editor-extensions/table-reorder/index.tsx`

- エディター用スタイルを読み込む。
- `editor.BlockEdit`フィルターへTable ReorderのHOCを登録する。
- 登録以外の状態管理や制約判定を持たない。

#### `src/editor-extensions/table-reorder/with-table-reorder.tsx`

- `core/table`以外では元のBlockEditをそのまま描画する。
- Tableブロックごとの並べ替えモードを管理する。
- `BlockControls`へ「行を並べ替え」または「並べ替えを終了」を表示する。
- 対象ブロックの選択解除または破棄時に並べ替えモードを終了する。
- 並べ替えモード中だけcontrollerを描画する。

#### `src/editor-extensions/table-reorder/table-reorder-controller.tsx`

- 対象Tableブロックの要素、編集領域、`tbody`および本文行DOMを解決する。
- 行データと行DOMへ一時IDを対応付ける。
- ハンドル用コンテナを作成し、行位置に合わせてportalを配置する。
- `DragDropProvider`のライフサイクルイベントを処理する。
- 有効なドロップ時だけ新しい`body`配列を`setAttributes`へ一回渡す。
- 禁止操作の通知済み状態を一回の移動試行単位で管理する。
- モード終了とunmount時に進行中のDnDおよびDOM資源を破棄する。
- `DragOverlay`を一つだけ描画する。

#### `src/editor-extensions/table-reorder/sortable-row.tsx`

- 一つの本文行について`useSortable`を呼ぶ。
- 行DOMをsortable elementとして登録する。
- ハンドルボタンへ`handleRef`を接続する。
- 移動不能行ではハンドルをdisabled表示にし、DnDを開始させない。
- ドラッグ元、有効な挿入候補および通常状態に必要なclassだけを付与する。

### Focused logic

#### `src/editor-extensions/table-reorder/rowspan.ts`

- Tableブロックの`body`から`rowspan`結合範囲を求める。
- 移動不能な行indexを返す。
- 禁止される行間indexを返す。
- 移動元と移動先の組み合わせが結合範囲を越えるか判定する。
- `colspan`を`rowspan`制約として扱わない。

#### `src/editor-extensions/table-reorder/reorder.ts`

- 行配列を一行単位で移動した新しい配列を返す。
- 同じ位置、範囲外または禁止された移動では元の配列を返す。
- 行とセルの内容およびオブジェクト参照を保持する。

#### `src/editor-extensions/table-reorder/editor.scss`

- ハンドル用レイヤー、ハンドルボタン、disabled状態、挿入位置およびoverlayを定義する。
- Tableブロックの既存セル表示を変更しない。
- iframe・非iframeで同じclassと配置規則を使用する。
- 色だけに依存せず、disabled属性と挿入線の有無で状態を示す。

### Tests

#### `src/editor-extensions/table-reorder/rowspan.test.ts`

- 単一の`rowspan`範囲。
- 複数の`rowspan`範囲。
- 結合範囲の開始行と後続行が移動不能になること。
- 結合範囲の途中が挿入先にならないこと。
- 結合範囲を越える移動が禁止されること。
- 結合範囲の外側だけで完結する移動が許可されること。
- `colspan`だけの行が禁止されないこと。

#### `src/editor-extensions/table-reorder/reorder.test.ts`

- 上方向と下方向の一行移動。
- 同じ位置への移動がno-opになること。
- 範囲外と禁止移動がno-opになること。
- 行、セル、属性および装飾の参照が保持されること。
- 入力配列自体を変更しないこと。

## Implementation phases

### Phase 1: エディター拡張のビルド境界を追加する

- Outcome:
  - Table Reorderの空のエントリーをビルドし、ブロックエディターでだけ読み込める。
  - 既存のNoticeブロックとblocks manifestのビルドが維持される。
- Tasks:
  - `@dnd-kit/react`をruntime dependencyへ追加する。
  - `src/editor-extensions/table-reorder/`を作成し、必要なファイルだけを機能ディレクトリ直下へ追加する。
  - エディター拡張を含むwebpack entryを追加する。
  - PHPでassetファイルを使って生成物を登録・enqueueする。
  - `src/editor-extensions/table-reorder/index.tsx`を追加する。
- Validation:
  - `npm run build`が成功し、block manifestとTable Reorderのasset付き生成物が作られる。
  - Noticeブロックが従来どおり登録される。
  - 投稿エディター以外ではTable Reorderの生成物がenqueueされない。
  - 空の下位ディレクトリや汎用`utils`、`helpers`および`shared`が追加されていない。

### Phase 2: Tableブロックへモード切替を追加する

- Outcome:
  - 選択中のコアTableブロックで並べ替えモードを開始・終了できる。
  - 通常時のセル編集に影響しない。
- Tasks:
  - `editor.BlockEdit`フィルターを登録する。
  - `core/table`だけに`BlockControls`の切替ボタンを表示する。
  - モード状態をTableブロックの保存属性から分離する。
  - 選択解除、unmountおよび明示終了で一時状態を破棄する。
- Validation:
  - Table以外のブロックにUIやDOM変更がない。
  - 通常時にハンドルが存在せず、セルを編集できる。
  - ボタン文言が開始時と終了時で切り替わる。
  - モード状態が投稿保存内容へ入らない。

### Phase 3: 本文行DOMとハンドルを編集領域内で結び付ける

- Outcome:
  - `tbody`の各本文行の左側に対応するハンドルが表示される。
  - ヘッダー行とフッター行にはハンドルが表示されない。
- Tasks:
  - 対象ブロックの一時アンカーからblock element、`ownerDocument`および`defaultView`を取得する。
  - `tbody > tr`だけを収集し、`body`行データへ一時IDで対応付ける。
  - 同じ編集領域にハンドル用portal containerを作成する。
  - 行位置の測定と再配置を実装する。
  - スクロール、リサイズ、Table再描画を監視し、終了時に解除する。
- Validation:
  - iframe・非iframeの両方で各本文行とハンドルが一致する。
  - `thead`と`tfoot`にハンドルが付かない。
  - スクロール、セル編集および幅変更後も配置が追従する。
  - モード終了後に追加DOM、イベントおよびObserverが残らない。

### Phase 4: `rowspan`制約を純粋関数で実装する

- Outcome:
  - 移動元と移動先の可否を、DOM操作やDnD状態から独立して判定できる。
- Tasks:
  - `rowspan`結合範囲を抽出する。
  - 結合範囲内の移動不能行を求める。
  - 結合範囲途中の禁止挿入位置を求める。
  - 結合範囲を越える移動を判定する。
  - `colspan`だけの行を許可する。
  - focused unit testsを`rowspan.ts`の隣へ追加する。
- Validation:
  - `npm run test:unit -- rowspan`相当の対象テストが成功する。
  - 要件定義書と基本設計書の禁止・許可例をテストで表現する。

### Phase 5: 現行dnd-kit APIで行DnDを実装する

- Outcome:
  - 移動可能な本文行を、ハンドルから同じ`tbody`内で並べ替えられる。
  - ドラッグ中はTableブロック属性を変更しない。
- Tasks:
  - `DragDropProvider`をcontrollerへ追加する。
  - 各本文行を`useSortable({ id, index, element, disabled })`で登録する。
  - ハンドルへ`handleRef`を接続する。
  - provider内に一つの`DragOverlay`を追加する。
  - `onDragStart`で開始順序と通知状態を記録する。
  - `onDragOver`で候補位置を検証し、禁止候補の既定sortable処理を抑止する。
  - 有効候補だけ挿入位置を表示する。
  - `onDragEnd`で`isSortable()`と`initialIndex/index`を使って確定位置を取得する。
- Validation:
  - ハンドル以外からDnDが開始しない。
  - 移動不能行からDnDが開始しない。
  - 有効候補だけ視覚的な挿入位置が示される。
  - 禁止候補へ移動しても行DOMの並べ替えが進まない。
  - overlayが一つだけ表示され、操作対象を重複登録しない。

### Phase 6: 一回更新、Undoおよび禁止通知を完成させる

- Outcome:
  - 有効な一回のDnDが一回の属性更新となり、一回のUndoで戻る。
  - 禁止操作ではデータを変更せず、通知を一回だけ表示する。
- Tasks:
  - `reorder.ts`へimmutableな一行移動を実装する。
  - 有効な`onDragEnd`だけで`setAttributes({ body })`を一回呼ぶ。
  - キャンセル、同位置、禁止位置および`tbody`外をno-opにする。
  - WordPressの画面通知で規定メッセージを表示する。
  - 一回の移動試行中の通知を一回へ制限し、次のDnD開始時にリセットする。
  - DnD中のモード終了では未確定変更を破棄する。
  - focused unit testsを`reorder.ts`の隣へ追加する。
- Validation:
  - 移動後もセル内容、セル属性、装飾、行内セル順序および`colspan`が保持される。
  - 一回の移動を一回のUndoで戻せる。
  - 禁止操作、キャンセルおよび同位置ではUndo履歴が増えない。
  - 一回の移動試行で複数の禁止候補を通っても通知は一回だけ表示される。
  - 新しい移動試行では必要に応じて再度一回通知される。

### Phase 7: 影響範囲と編集環境を検証する

- Outcome:
  - 要件定義書と基本設計書の完了条件を、対応環境で確認できる。
- Tasks:
  - 自動検証コマンドをすべて実行する。
  - iframe・非iframeで手動検証する。
  - 通常Table、`rowspan`、`colspan`、`thead`、`tfoot`を含む確認用投稿を用意する。
  - Table以外のブロックと非選択Tableへの影響を確認する。
  - 保存後のHTMLがコアTableブロック形式のままであることを確認する。
- Validation:
  - 下記のValidation一覧を満たす。
  - 実装中に追加された一時的なログ、診断UIおよび生成物が残っていない。

## Decisions and validation questions

### Decide before implementation

- エディター拡張のwebpack entry名とasset出力パスを、PHP enqueue処理と一致させる。
- ハンドル用portal containerの配置先を、対象Tableブロックと同じ座標系を維持できる要素に固定する。
- 行の一時IDを保存データへ入れず、モード中の再描画でも同じ行へ対応付けられる方式に固定する。
- 禁止通知に使用するWordPressの公開notice APIを固定する。

### Validate during implementation

- BlockEdit拡張の一時アンカーから、iframe・非iframeの両方で対象block elementを安定して取得できるか。
- コアTableブロックの再描画後に、`body`配列と`tbody > tr`の順序および件数が一致するか。
- `useSortable`へ外部の行DOM elementとhandle refを渡した構成で、両編集環境のポインターDnDが同じように動作するか。
- 禁止候補で`onDragOver`の既定処理を抑止したとき、optimistic sortingと挿入表示が進まないか。
- DnD中にモードを終了したとき、未確定のDOM順序とprovider状態が残らず通常編集へ戻るか。
- 一回の`setAttributes`が一回のUndo履歴になるか。
- `TableReorderController`または`SortableRow`が大きくなった場合、分割する実責務が生じているか。単なる分類目的では分割しない。

## Issue breakdown

- [ ] Build and loading: エディター拡張entry、dependency、PHP enqueueを追加する。
- [ ] Mode and DOM integration: Table限定HOC、BlockControls、編集領域解決、ハンドル配置を実装する。
- [ ] Row constraints: `rowspan`範囲、移動元、挿入位置および境界越え判定を実装する。
- [ ] Pointer DnD: `DragDropProvider`、`useSortable`、`DragOverlay`および挿入表示を実装する。
- [ ] Commit and feedback: 行配列の一回更新、Undo、キャンセル、通知を実装する。
- [ ] Verification: 自動テスト、iframe・非iframe、保存形式および影響範囲を検証する。

子Issueは本プランのレビュー後、上記の境界が確定してから作成する。

## Validation

### Automated

- `npm ci`
  - 依存関係がlockfileどおりに導入される。
- `npm run format:check`
  - JavaScript、TypeScript、JSONおよび設定ファイルのformat差分がない。
- `npm run lint:js`
  - JavaScriptとTypeScriptのlint errorおよびwarningがない。
- `npm run lint:css`
  - Table Reorderのeditor styleにlint errorがない。
- `npm run typecheck`
  - WordPress API、Table属性およびdnd-kit eventの型が解決される。
- `npm run test:unit`
  - 既存テスト、`rowspan`制約テストおよび行順序テストが成功する。
- `npm run build`
  - blocks manifest、既存ブロックおよびTable Reorderの生成物が作成される。
- `composer lint:php`
  - PHP enqueue変更がWordPress Coding Standardsに適合する。
- `composer analyse:php`
  - PHPStan errorがない。

### Manual: normal editing and mode

- 通常時はハンドルが表示されず、Tableのセルを編集できる。
- 選択中Tableの「行を並べ替え」でモードを開始できる。
- モード中は本文行だけにハンドルが表示される。
- 「並べ替えを終了」でハンドルが消え、セル編集へ戻る。
- 選択解除またはブロック削除で一時UIと監視処理が残らない。

### Manual: valid moves and data preservation

- 本文行を上方向と下方向へ移動できる。
- 同じ`tbody`の先頭、中間および末尾へ移動できる。
- 移動後もセル内容、セル属性、装飾および行内セル順序が保持される。
- `colspan`だけを含む行を、`rowspan`制約がない位置へ移動できる。
- 一回の行移動を一回のUndoで元に戻せる。
- 保存、再読み込み後も行順とコアTableブロックの保存形式が維持される。

### Manual: prohibited moves

- `rowspan`結合範囲に含まれる開始行と後続行からDnDを開始できない。
- `rowspan`結合範囲の途中に挿入位置が表示されない。
- `rowspan`結合範囲を越える移動が確定しない。
- `tbody`外、`thead`および`tfoot`へ移動できない。
- 禁止操作でTableの`body`が変更されない。
- 一回の移動試行につき規定メッセージが一回だけ表示される。
- キャンセルと同位置へのドロップでデータとUndo履歴が変更されない。

### Manual: editor environments and impact

- iframeの投稿エディターで、対象取得、ハンドル配置、DnD、overlay、通知および後始末が動作する。
- 非iframeの投稿エディターで、同じ操作と結果になる。
- Table以外のブロックの編集と表示に変化がない。
- 並べ替えモードではないTableおよび選択されていないTableに追加UIやDnD動作がない。
- 複数のTableがある投稿で、操作対象以外のTableデータが変化しない。

## Completion criteria

- 現行の`@dnd-kit/react`公式APIを使用している。
- 要件定義書の機能要件、結合セル保護、対象外および完了条件が実装単位とValidationへ反映されている。
- 基本設計書のUI、状態、更新方式、DnD、`rowspan`、`colspan`、通知、終了処理および編集環境対応が実装単位とValidationへ反映されている。
- Table Reorderの実装、スタイルおよびfocused testsが`src/editor-extensions/table-reorder/`にまとまっている。
- entry fileが登録だけを担当し、UI、状態、変換および制約判定を抱えていない。
- 実際の責務がない汎用ディレクトリ、共有モジュールおよび空ファイルが追加されていない。
- 有効な行移動だけがTableブロックの`body`を一回更新する。
- 一回の行移動を一回のUndoで戻せる。
- 禁止操作で表データが変更されず、一回の移動試行につき通知が一回だけ表示される。
- iframe・非iframeの両方で同じ要件を満たす。
- コアTableブロックの保存形式へ独自属性または独自HTMLを追加しない。
- Table以外のブロックおよび操作対象外のTableへ影響を与えない。
- 自動検証と手動検証が完了している。

## Notes

- DnD状態、行の一時ID、ハンドル用DOMおよびoverlayは編集画面上の一時情報であり、保存対象にしない。
- `build/`は生成物のためコミットしない。
- 実装ファイルはTable Reorderのfeature directory内へ置き、現在必要な責務だけに分割する。
- 将来ほかの機能から同じ処理が必要になっても、少なくとも二つの実利用と安定した責務が確認されるまでは`shared/`へ抽出しない。
