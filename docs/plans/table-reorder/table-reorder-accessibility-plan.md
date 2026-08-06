# PLAN-104: Table Reorder アクセシビリティ

## References

- Parent issue: https://github.com/YamabikoLab/yamabiko-editor-tools/issues/104
- Requirements: `docs/requirements/table-reorder/table-reorder-accessibility-requirements.md`
- Design: `docs/design/table-reorder/table-reorder-accessibility-design.md`
- Base requirements: `docs/requirements/table-reorder/table-reorder-requirements.md`
- Base design: `docs/design/table-reorder/table-reorder-design.md`
- Base plan: `docs/plans/table-reorder/table-reorder-plan.md`
- Current implementation: `src/editor-extensions/table-reorder/`

## Goal

既存のTable Reorderを、外部マニュアルを前提とせず、ポインターまたはキーボードだけで理解して操作できるようにする。

現在の`@dnd-kit/react`、`@dnd-kit/dom`および`@dnd-kit/react/sortable`の構成を基礎とし、キーボードによる開始、上下移動、確定、キャンセル、必要最小限のスクリーンリーダー通知およびフォーカス管理を追加する。

## Scope

### Included

- 並べ替えモード中の短いポインター・キーボード操作案内。
- 既存ドラッグハンドルのアクセシブルな名前と説明の関連付け。
- `Enter`または`Space`によるキーボード並べ替えの開始と確定。
- `ArrowUp`と`ArrowDown`による一行単位の移動先候補変更。
- `Escape`によるキャンセル。
- 既存の行データ保持、Undo、`rowspan`制約および同一`tbody`制約の共有。
- 操作開始、現在位置、完了、キャンセルおよび禁止理由の必要最小限の通知。
- 確定後、キャンセル後およびモード終了後のフォーカス管理。
- iframe・非iframeの両編集環境で同じ操作と結果を提供する実装。
- キーボード状態遷移、通知重複抑止およびフォーカス復元のfocused tests。

### Not included

- 上下移動専用ボタン。
- 左右キー、`Home`、`End`、`PageUp`、`PageDown`による移動。
- ショートカットキーのカスタマイズ。
- 複数行の選択や同時移動。
- 複雑なチュートリアルや初回ガイド。
- 汎用アクセシビリティ基盤の新設。
- ポインター操作と異なる独自の並べ替え仕様。
- 列、`thead`および`tfoot`の並べ替え。
- 本Issueでのソースコード変更。

## Approach

### 現在のdnd-kit構成を拡張する

現在の実装は、`DragDropProvider`、`PointerSensor`、`useSortable`、`DragOverlay`およびportalされたハンドルを使用している。

アクセシビリティ対応では、この構成を維持し、削除前の旧dnd-kit APIを復活させない。ポインターDnDは既存の`PointerSensor`で継続し、キーボード操作は現在の行ID、行index、drag sessionおよびcommit処理を共有する形で追加する。

矢印キーによる移動は行の高さや座標量に依存させず、本文行のindexと挿入indexを使って一回のキー入力につき一行分だけ候補を変更する。これにより、高さの異なる行でも操作単位を一定にする。

### ポインターとキーボードで同じ確定経路を使用する

キーボード操作でも、移動開始時に既存のdrag sessionを作成し、候補変更時に既存の移動可否判定を使用する。

- 操作中はTableブロックの`body`を変更しない。
- 有効な候補では既存の挿入線と行回避表示を使用する。
- `rowspan`禁止位置、範囲外、同位置およびキャンセルでは更新しない。
- 有効な確定時だけ`setAttributes({ body })`を一回呼ぶ。
- 一回の確定を一回のUndoで戻せる既存仕様を維持する。

### 案内を並べ替えモード内へ置く

並べ替えモード中だけ、ポインターとキーボードの操作をまとめた短い案内を表示する。

案内は外部マニュアルへの誘導ではなく、開始、移動、確定およびキャンセルに必要なキーを直接記載する。各ハンドルは`aria-describedby`で案内を参照する。

### フォーカス可能な利用不能状態を設計する

現在の移動不能行はネイティブ`disabled`により操作できないが、アクセシビリティ対応では移動不能理由をキーボード利用者へ伝えられる必要がある。

そのため、ハンドルをフォーカス可能な状態に保ち、`aria-disabled="true"`とSensor側の無効化を組み合わせる。移動不能行で開始キーを押した場合はデータを変更せず、`rowspan`による理由を通知する。

### 通知を一つのライブリージョンへ集約する

並べ替えモード中に、Table Reorder専用のライブリージョンを一つ配置する。

- 開始、候補変更、完了、キャンセルおよび禁止理由だけを通知する。
- 同じ候補や同じ禁止理由を繰り返さない。
- WordPressの画面通知と二重読み上げにならないよう役割を整理する。
- 文言には現在位置と全行数を必要な範囲で含める。

### 行IDを使ってフォーカスを維持する

確定後は移動後の同じ行、キャンセル後は開始前の同じ行のハンドルへフォーカスを戻す。

Gutenbergの再描画後に行IDから新しいハンドル要素を取得し、対象Tableブロックの`ownerDocument`内でフォーカスする。並べ替えモード終了後は、通常表示へ切り替わったモード切替ボタンへ戻す。

## Architecture

### Existing modules to extend

#### `with-table-reorder.tsx`

- 並べ替えモード中の操作案内を描画する。
- 案内IDをcontrollerへ渡す。
- モード切替ボタンのrefを管理する。
- 明示的なモード終了後に切替ボタンへフォーカスを戻す。

#### `table-reorder-controller.tsx`

- キーボード操作中の行ID、挿入index、開始位置および通知状態を管理する。
- ハンドルのキーイベントを処理する。
- 既存のdrag session、制約判定、視覚表現およびcommit処理を共有する。
- ライブリージョンとフォーカス復元を管理する。
- ポインター操作とキーボード操作の相互排他を保証する。

#### `sortable-row.tsx`

- `onKeyDown`、案内ID、`aria-disabled`および操作中状態を受け取る。
- ハンドルのアクセシブルな名前と説明を設定する。
- 移動不能行でもフォーカスできるようにする。
- dnd-kitのドラッグ開始無効化は維持する。

#### `drag-session.ts`

- ポインター固有でないdrag session処理として再利用する。
- キーボードから指定した挿入indexとtarget行IDを検証できる状態を維持する。
- 必要な場合だけ、入力イベントに依存しない小さな関数へ責務を整理する。

#### `drag-visuals.ts`

- 有効なキーボード候補でも既存の回避表示と挿入線を使用する。
- 確定、キャンセル、モード終了および対象削除ですべて解除する。

### New focused module

キーボード状態遷移と候補計算に独立した責務が生じる場合は、`src/editor-extensions/table-reorder/`直下へfocused moduleを追加する。

想定責務:

- キーから操作種別を判定する。
- 現在の挿入indexから一つ前または一つ後の候補を求める。
- 先頭、末尾、同位置および禁止位置の結果を返す。
- 禁止位置を飛び越えない。
- 通知に必要な現在位置を算出する。

`utils`、`helpers`または汎用アクセシビリティディレクトリは追加しない。

## Implementation phases

### Phase 1: 操作案内とハンドル属性を追加する

- Outcome:
  - 並べ替えモード内で操作方法を確認でき、各ハンドルの対象行と説明を支援技術で確認できる。
- Tasks:
  - 並べ替えモード中の短い操作案内を追加する。
  - 案内へ一意なIDを付ける。
  - ハンドルへ`aria-describedby`を設定する。
  - ハンドルの行番号ラベルを現在位置に追従させる。
  - 移動不能行を`aria-disabled`で表し、フォーカス可能にする。
- Validation:
  - 外部マニュアルを見ずに必要なキーを確認できる。
  - スクリーンリーダーで行番号、操作内容、案内および利用不能状態を確認できる。
  - ポインターDnDの開始条件と見た目が壊れない。

### Phase 2: キーボード状態遷移と候補計算を実装する

- Outcome:
  - キーボードだけで開始し、矢印キー一回につき一行分だけ候補を変更できる。
- Tasks:
  - `Enter`と`Space`の開始処理を追加する。
  - 操作中の`ArrowUp`と`ArrowDown`を処理する。
  - index基準の候補計算をfocused pure functionへ分離する。
  - 先頭、末尾、同位置および`rowspan`禁止位置を判定する。
  - 禁止位置を飛び越えず現在候補を維持する。
  - ブラウザー既定のスクロールとボタン動作を適切に抑止する。
- Validation:
  - 高さの異なる行でも一回の矢印キーで一行分だけ候補が変わる。
  - 長押しを除き、一つのkeydownで複数行移動しない。
  - キーボード操作中にポインターDnDが開始しない。
  - ポインターDnD中にキーボード操作が開始しない。

### Phase 3: 既存の制約、視覚表現およびcommit経路を共有する

- Outcome:
  - キーボード操作でもポインターDnDと同じ制約、表示、データ保持およびUndo単位になる。
- Tasks:
  - キーボード開始時に既存のdrag sessionを作成する。
  - 候補変更時に既存の`rowspan`判定を使用する。
  - 有効候補で既存の挿入線と行回避表示を更新する。
  - `Enter`または`Space`で既存のcommit経路から一回更新する。
  - `Escape`、同位置、禁止位置および範囲外をno-opにする。
  - すべての終了経路で一時視覚表現を解除する。
- Validation:
  - セル内容、セル属性、装飾、セル順序および`colspan`が保持される。
  - 一回の確定を一回のUndoで戻せる。
  - キャンセルと禁止操作でUndo履歴が増えない。
  - `rowspan`制約と表示がポインターDnDと一致する。

### Phase 4: スクリーンリーダー通知を追加する

- Outcome:
  - 操作の開始、現在位置、結果および禁止理由を必要な場面で確認できる。
- Tasks:
  - Table Reorder専用ライブリージョンを一つ追加する。
  - 開始、候補変更、完了、キャンセル、先頭・末尾および`rowspan`禁止理由の文言を定義する。
  - 現在位置と全行数を算出する。
  - 同じ候補と同じ禁止理由の重複通知を抑止する。
  - WordPressの画面通知との二重読み上げを避ける。
- Validation:
  - 一回の有効な候補変更につき一回だけ位置が通知される。
  - 同じ禁止キーを続けて押しても同じ通知を過剰に繰り返さない。
  - 別の候補または禁止理由へ変わった場合は必要な通知を行う。
  - ポインター操作で不要なキーボード向け通知が発生しない。

### Phase 5: フォーカス管理を完成させる

- Outcome:
  - 確定、キャンセルおよびモード終了後に操作位置を見失わない。
- Tasks:
  - 開始時の行IDとハンドルを記録する。
  - 確定後に移動後の同じ行IDのハンドルへフォーカスする。
  - キャンセル後に開始前の同じ行のハンドルへ戻す。
  - 明示的なモード終了後にモード切替ボタンへ戻す。
  - 再描画後にフォーカスするための安全なタイミングを設ける。
  - 行またはブロック削除時のフォールバックを実装する。
- Validation:
  - フォーカスが`body`やiframe外へ失われない。
  - 移動後の行番号ラベルが更新された同じハンドルへフォーカスされる。
  - 復元先が存在しない場合に例外や無限再試行が発生しない。

### Phase 6: 自動テストと編集環境検証を追加する

- Outcome:
  - 要件定義書と基本設計書の完了条件を自動テストと手動検証で確認できる。
- Tasks:
  - キー判定と候補計算のunit testsを追加する。
  - `rowspan`禁止位置、先頭、末尾、同位置およびキャンセルをテストする。
  - 通知重複抑止をテストする。
  - フォーカス復元をDOM testで確認する。
  - iframe・非iframeで手動検証する。
  - ポインターDnDの既存回帰テストを実行する。
- Validation:
  - 下記Validation一覧を満たす。
  - ソースコード、スタイル、文言およびテストがTable Reorder機能ディレクトリへまとまっている。

## Decisions and validation questions

### Decided before implementation

- 現在の`DragDropProvider`、`PointerSensor`、`useSortable`およびdrag session構成を基礎とする。
- 削除前の旧dnd-kit APIは復活させない。
- 矢印キーによる候補変更は座標ではなく行indexを基準にする。
- 操作キーは`Enter`または`Space`、`ArrowUp`、`ArrowDown`、`Escape`に限定する。
- 移動不能行は理由を伝えるためフォーカス可能にし、`aria-disabled`とSensor無効化を組み合わせる。
- ライブリージョンはTable Reorder内に一つだけ配置する。
- キーボード操作も既存の一回commit経路とUndo単位を共有する。

### Validate during implementation

- `useSortable`へ登録したハンドルで独自のkeydown処理を追加しても、ポインターSensorのactivator動作を妨げないか。
- `Space`でページスクロールとbutton clickを抑止しつつ、開始と確定が一回だけ実行されるか。
- 現在のdrag sessionへindex基準の候補を渡したとき、上方向と下方向の挿入indexが一貫するか。
- Gutenberg再描画後に行IDから同じ行のハンドルを安定して取得できるか。
- `aria-disabled`のハンドルがポインターでDnDを開始せず、キーボード開始時だけ理由を通知できるか。
- WordPress noticeとライブリージョンが環境や支援技術によって二重読み上げにならないか。
- iframe・非iframeの両方で、アクティブ要素、ownerDocumentおよびフォーカス復元先を正しく扱えるか。

## Validation

### Automated

- `npm ci`
- `npm run format:check`
- `npm run lint:js`
- `npm run lint:css`
- `npm run typecheck`
- `npm run test:unit`
- `npm run build`
- `composer lint:php`
- `composer analyse:php`

### Manual: guidance and handle semantics

- 並べ替えモード中だけ操作案内が表示される。
- 案内にポインター操作と使用可能なキーが明記されている。
- 各ハンドルの現在の行番号と操作内容をスクリーンリーダーで確認できる。
- 各ハンドルから操作案内を確認できる。
- `rowspan`範囲内の行で利用不能状態と理由を確認できる。

### Manual: keyboard operation

- ハンドルへフォーカスし、`Enter`と`Space`のどちらでも開始できる。
- `ArrowUp`と`ArrowDown`一回につき一行分だけ候補が変わる。
- 高さの異なる行でも移動単位が変わらない。
- `Enter`と`Space`のどちらでも有効な候補を確定できる。
- `Escape`で開始前の順序へ戻る。
- 先頭より上、末尾より下および禁止位置を飛び越えない。

### Manual: data, constraints and Undo

- 有効な確定だけがTableブロックの`body`を一回更新する。
- セル内容、セル属性、装飾、セル順序および`colspan`が保持される。
- 一回のキーボード移動を一回のUndoで戻せる。
- キャンセル、同位置、範囲外および`rowspan`禁止操作でデータとUndo履歴が変わらない。
- ポインターDnDとキーボード操作で同じ挿入位置と`rowspan`制約になる。

### Manual: announcements

- 開始時に対象行と全行数が通知される。
- 有効な候補変更時に現在位置が通知される。
- 確定時に移動前後の位置が通知される。
- キャンセル時に開始位置を維持したことが通知される。
- 先頭、末尾および`rowspan`禁止理由が通知される。
- 同じ候補や同じ禁止理由が変わらない間は過剰に繰り返されない。

### Manual: focus and environments

- 確定後に移動後の同じ行のハンドルへフォーカスがある。
- キャンセル後に開始前の同じ行のハンドルへフォーカスがある。
- モード終了後にモード切替ボタンへフォーカスがある。
- 対象行またはTable削除時にフォーカス処理でエラーが発生しない。
- iframeと非iframeで同じキー操作、通知、視覚表現およびフォーカス管理になる。
- Table以外のブロックおよび操作対象外のTableへ影響しない。

## Completion criteria

- アクセシビリティ要件定義書と基本設計書の内容が実装単位とValidationへ反映されている。
- 現行のdnd-kit APIとTable Reorder実装構成を拡張する計画になっている。
- 外部マニュアルを前提とせず、並べ替えモード内の案内で操作方法を理解できる。
- キーボードだけで開始、上下移動、確定およびキャンセルを完了できる。
- 一回の矢印キー入力で一行分だけ候補が変わる。
- キーボード操作にも既存のデータ保持、Undo、`rowspan`制約および同一`tbody`制約が適用される。
- 必要な操作状態と禁止理由だけが重複を抑えて通知される。
- 確定後、キャンセル後およびモード終了後にフォーカスが維持または復元される。
- iframe・非iframeの両方で同じ要件を満たす。
- 汎用アクセシビリティ基盤や対象外のキー操作を追加しない。

## Notes

- 本計画は文書作成のみを対象とし、実装変更は別Issueで行う。
- キーボード操作中の行ID、挿入index、通知内容およびフォーカス情報は編集画面上の一時情報であり、保存対象にしない。
- 実装時は現在のTable Reorder feature directory内へ責務を置き、実利用のない共有層を作らない。
