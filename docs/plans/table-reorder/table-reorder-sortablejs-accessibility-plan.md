# PLAN-215: SortableJS版 Table Reorder アクセシビリティ実装

## References

- Parent issue: #215
- Requirements:
  - `docs/requirements/table-reorder/table-reorder-sortablejs-requirements.md`
  - `docs/requirements/table-reorder/table-reorder-sortablejs-accessibility-requirements.md`
- Design: `docs/design/table-reorder/table-reorder-sortablejs-accessibility-design.md`
- Current implementation overview: `src/editor-extensions/table-reorder/README.md`
- Plan template: `docs/plans/TEMPLATE.md`
- Historical reference only: `docs/plans/table-reorder/archive/table-reorder-accessibility-plan.md`
- Touch handle DnD update: #246

## Goal

現在の SortableJS版 Table Reorder を基礎に、アクセシビリティ要件 `A11Y-FR-01` ～ `A11Y-FR-12` と基本設計で確定した利用者向け仕様を実装できる状態へ分解する。

実装では、PC・タッチで共通の行ハンドルから開始するポインターDnD、rowspan制約、DOM所有権の復元、Gutenbergへの `setAttributes()` commit、iframe / non-iframe対応を再利用する。キーボード操作とドラッグを必要としない単一ポインター操作のために別系統の行移動ロジックを作らず、移動可否判定と確定処理を既存の行順序計算へ集約する。

Touch の DnD は #246 で行ハンドル操作へ統一する。並べ替えモード中は、セルの通常タップを編集、行ハンドルのタップを単一ポインター移動先選択、行ハンドルのドラッグを SortableJS DnD とし、行そのものの長押しをDnD開始操作にしない。

本プランは要件・基本設計の正本ではない。利用者向け仕様を変更または再定義せず、現在のコードへどの責務・順序で組み込むかだけを定める。

## Scope

### Included

- PCのブロックツールバーから行の並べ替えUIへ移るキーボード入口
- 移動可能な各行のキーボード到達可能な並べ替えUI
- `Enter` / `Space`、`ArrowUp` / `ArrowDown`、`Escape` によるキーボード並べ替え
- PCで既存ハンドルをクリックして開始する、ドラッグ不要の単一ポインター操作
- タッチの並べ替えモード中に行ハンドルをタップして開始する単一ポインター操作
- PC・タッチで共通の行ハンドルをドラッグして開始する SortableJS DnD
- セルの通常タップ編集、行ハンドルのタップ、行ハンドルのドラッグの競合防止
- 行ハンドル以外からの通常のTableスクロール維持
- rowspan制約を共有する移動先計算とcommit境界
- 行の並べ替えUIと移動先UIの名前・役割・状態、フォーカス表示、Target Size
- 基本設計8章を正本とする操作案内、状態・結果・移動不能理由の支援技術向け通知、操作UIの名前・説明
- タッチ端末での初回コーチマークと、閉じた後の自動再表示抑制
- 利用者向け文言を一元管理するメッセージモジュールとWordPress標準i18n
- 確定・キャンセル後のフォーカス維持 / 復元
- キーボード・単一ポインター操作時の縦スクロール追従と Focus Not Obscured
- iframe / non-iframeで同じ意味の操作を成立させるためのDOM / window境界
- 既存単体テストの拡張と、Gutenberg上で必要なE2E / 手動確認
- 実装完了時の `src/editor-extensions/table-reorder/README.md` 更新

### Not included

- アクセシビリティ要件、SortableJS版基本要件、基本設計の変更
- SortableJSそのものの置き換え
- 旧dnd-kit版の状態管理・Portalハンドル・DnD実装の復活
- 行長押しDnDの復活
- 複数行の同時移動
- 列の並べ替え
- 汎用アクセシビリティフレームワークや汎用state machineの新設
- Table Reorder以外で再利用することを目的としたshared utilityの抽出

## Approach

### 1. React / Gutenberg境界は薄いまま維持する

`with-table-reorder.tsx` は引き続き Gutenberg の描画境界とToolbar描画を担当し、行DOMやイベント処理を直接所有しない。タッチ初回コーチマークはToolbar入口に紐づくReact / Gutenberg側のUIとしてここで描画し、行DOM側へ責務を持ち込まない。

`use-table-reorder.ts` は現在の hover capability、タッチ並べ替えモード、Table context解決、controller lifecycleを維持しつつ、次の橋渡しだけを追加する。

- Toolbarからcontrollerへ「行の並べ替えUIへフォーカスする」要求を渡す
- controller instanceをrefで保持する
- `setAttributes()` による再描画をまたぐフォーカス復元要求を一時保持する
- タッチ初回コーチマークのdismiss済み状態をWordPress側で永続化する境界を提供する
- WordPress notice APIやGutenberg callbackは現在と同様に狭いcallbackとして下位へ渡す

キーボード並べ替え中・単一ポインター移動先選択中という命令的なDOM操作状態はReact stateへ持ち上げない。controller内の一時sessionとして保持し、body更新でcontrollerが再生成される境界だけhookが橋渡しする。

タッチ並べ替えモードではセル操作を無効化しない。行ハンドルだけを SortableJS の `handle` とし、セルの通常タップと行ハンドル外からのスクロールはGutenberg / browserの通常操作へ委ねる。

### 2. 行移動の正本を `row-order.ts` に集約する

現在の `row-order.ts` は `reorderRows()`、SortableJSの挿入位置計算、元DOM順序復元を所有している。この責務を拡張し、入力方式に依存しない次の純粋計算も同ファイルへ置く。

- 移動元indexと移動後indexから、rowspan制約確認に使う挿入indexを求める
- `nonMovableRowIndices` / `forbiddenInsertionIndices` を使って移動可否を判定する
- 上下方向にある次の有効な移動先indexを求める
- 単一ポインター用に表示できる有効な移動先一覧を求める
- 同じ位置への確定をno-opとして判定する

SortableJS `onEnd`、キーボード確定、単一ポインター確定は、最終的に同じ移動可否判定と `reorderRows()` を利用する。`rowspan.ts` は引き続き rowspan range、移動不能行、禁止挿入位置を算出するだけとし、入力方式別の知識を追加しない。

### 3. controllerを入力方式のオーケストレーターとして拡張する

`controller/sortable-controller.ts` は SortableJS instance、drag session、keyboard / single-pointer session、行control、DOM cleanupを束ねる命令的境界であるため、アクセシビリティ操作もこのcontrollerから調停する。

controllerには必要最小限の一時sessionだけを追加する。

- keyboard session: 移動元行indexと現在の移動先index
- single-pointer session: 移動元行index
- pending click suppression: SortableJS drag完了直後のclick / tapを単一ポインター開始として誤処理しないための短寿命フラグ
- last active row: Toolbarから現在行を優先してフォーカスするため、`tbody`内で最後に操作・編集していた移動可能行を追跡する情報

PC・タッチとも SortableJS の drag start は共通の行ハンドルに限定する。タッチ専用の長押しtimer、長押しthreshold、行全体のdrag開始領域は持たない。ポインターDnDの既存 `isDragging` やdrag rowsは維持し、キーボード / 単一ポインターsessionと一つの大きなstate machineへ統合しない。同時に複数操作が進行しないことだけcontrollerで保証する。

### 4. アクセシブルな行UIを専用の小さなDOM責務へ分離する

`controller/drag-ui.ts` は insertion line、fallback幅固定など「drag中だけ必要な一時UI」を所有する。一方、アクセシブルな行の並べ替えUIは待機中から存在し、キーボード・クリック・タップ・ドラッグで共用するため、drag専用責務へ混在させない。

`controller/reorder-ui.ts` は次を所有する。

- 移動可能行へ対応する行の並べ替えcontrolの生成・cleanup
- controlの表示、フォーカス、選択中状態の反映
- 基本設計8章の優先関係に従うTooltip / インライン案内の表示・置換・cleanup
- 単一ポインター操作時の有効な行間target UIと、タッチ時の明示的なキャンセル操作の生成・位置更新・cleanup
- owning `document` 内の支援技術向けstatus nodeの生成・cleanup
- 行control / target UIの位置計測と、必要な範囲のスクロール補助

行の並べ替えcontrolと移動先targetには原則としてnative `button`を使い、`contenteditable="false"` とTable Reorder固有classを付ける。役割をARIAで再実装せず、名前・状態・説明に必要な属性だけを追加する。Gutenbergのcontenteditable内へ一時DOMを挿入する互換性は実装時に検証する。

同じ行controlをPCのSortableJS handle、タッチのSortableJS handle、クリック / タップ入口、キーボード入口として共用する。insertion lineとfallback row widthは `drag-ui.ts` に残す。タッチ専用の `touch-press.ts` と、セルのpointer eventsを止めるtouch drag UIは廃止する。

`reorder-ui.ts` 自身は利用者向け文言を定義せず、`messages.ts` から基本設計8章に対応する文言を受け取って表示する。controllerも利用者向け文字列を直接持たず、状態・イベントと可変値だけをUI / message境界へ渡す。

永続的なfocus表示、Target Size、選択状態、target UIのhit areaはinline styleを増やし続けず、`editor.scss` に置く。`index.tsx` はこのeditor styleをimportし、`@wordpress/scripts` が生成する `build/editor-extensions/table-reorder/index.css` は `yamabiko-editor-tools.php` の `enqueue_block_assets` から `is_admin()` でeditorに限定してenqueueする。Table ReorderのJS / runtime configは既存どおり `enqueue_block_editor_assets` を維持する。JS entryのimportだけでCSS配信済みとみなさず、生成CSSのWordPress側配信までを実装境界に含める。

### 5. focus復元はGutenberg commit境界をまたいで明示的に扱う

キーボードまたは単一ポインター操作で確定すると、`setAttributes()` によりGutenbergがTable DOMを再描画し、controllerと一時controlも作り直される。

そのため、controllerからhookへcommitする際に「移動後にfocusすべき行index」を同時に通知する。hookはrefにpending focus requestを保存してから `setAttributes()` を呼び、body更新後に生成された新しいcontrollerへ一度だけ渡す。新controllerは対応する行controlをfocusしてrequestを消費する。

通常のSortableJS DnDでは、このpending focus requestを設定しない。ポインターDnD開始時にTable Reorder都合のfocus移動を追加しないという基本設計を維持する。

キャンセルではbodyを更新しないため、controller内で開始時の行controlへ直接focusを戻す。

### 6. 利用者向け文言を一元管理し、案内・通知はowning documentで完結させる

`messages.ts` をTable Reorder feature内に置き、基本設計8章で確定した画面表示メッセージ、支援技術向け動的通知、操作UIのアクセシブルな名前・説明を一元管理する。英語を翻訳元として `@wordpress/i18n` と `sprintf()` を使用し、controller、UI処理、React描画へ利用者向け文字列を直接記述しない。WordPress i18n関数では `yamabiko-editor-tools` text domainを使用する。

`messages.ts` は基本設計のメッセージIDと実装上の定義を対応付け、固定文言と可変値を含む文の組み立てだけを担当する。表示優先度、DOM構造、WordPress UI componentの選択、ARIA属性、通知更新方法は各表示責務が担い、文言仕様そのものを実装側で再定義しない。

タッチモードの案内は、行長押しではなく「行ハンドルをドラッグしてDnD」「行ハンドルをタップして移動先選択」「セルをタップして編集」という現在の操作へ揃える。

iframe / non-iframeの差を上位へ漏らさないため、行control、target UI、インライン案内、status nodeは `TableContext.document` / `window` を使って生成する。Toolbarに紐づく一時通知とタッチ初回コーチマークはReact / Gutenberg側で表示し、同じ `messages.ts` の定義を利用する。

支援技術向け通知は新しいnpm依存を追加せず、`reorder-ui.ts` がowning documentへ一つのlive status nodeを作成し、controllerが基本設計8章で定義された状態変化・操作結果に対応するイベントと可変値だけを渡す。直前と同じ通知の抑制も基本設計のルールに従ってcontroller / UI境界で行う。

JavaScript翻訳はJSON生成だけで完了とせず、既存の `npm run i18n` / `i18n:json` をsource → build mapping対応へ拡張し、`wp i18n make-json --use-map` 等で `src/editor-extensions/table-reorder/messages.ts` の翻訳元を実際にenqueueされる `build/editor-extensions/table-reorder/index.js` に対応付けたJSONを生成する。`yamabiko-editor-tools.php` ではTable Reorder scriptをenqueueした後、同じhandle `yamabiko-editor-tools-table-reorder-index` に `wp_set_script_translations()` で `yamabiko-editor-tools` text domainと `__DIR__ . '/languages'` 相当の実ファイルシステム上のディレクトリを関連付ける。

## Architecture

### Existing and new modules

| Module | Plan |
|---|---|
| `index.tsx` | `editor.scss` のimportだけを追加する。登録責務は変更しない。 |
| `yamabiko-editor-tools.php` | Table ReorderのJS / runtime configは既存 `enqueue_block_editor_assets` を維持する。script enqueue後、同じhandle `yamabiko-editor-tools-table-reorder-index` に `wp_set_script_translations()` で `yamabiko-editor-tools` text domainと `__DIR__ . '/languages'` 相当の実ファイルシステム上のディレクトリを関連付ける。生成された `build/editor-extensions/table-reorder/index.css` が存在する場合は `enqueue_block_assets` + `is_admin()` でeditor content向けstyleとしてenqueueする。 |
| `with-table-reorder.tsx` | PC / タッチのToolbar入口を基本設計に合わせて描画し、controllerへのfocus要求をhook経由で呼ぶ。PCではモードを新設しない。タッチ初回コーチマークをToolbar入口に紐づけて表示する。 |
| `use-table-reorder.ts` | controller ref、Toolbar focus bridge、commit後のpending focus復元、タッチ初回コーチマークのdismiss済み状態の永続化境界を追加する。既存hover / touch mode lifecycleとrowspan制約算出は維持する。 |
| `messages.ts` | 基本設計8章のメッセージIDと実装定義を対応付け、`yamabiko-editor-tools` text domainのWordPress i18n / `sprintf()` による画面表示・動的通知・アクセシブルな名前 / 説明の文言生成を一元管理する。表示状態やDOMは所有しない。 |
| `table-context.ts` | iframe / non-iframeのowning document / window解決をそのまま再利用する。追加が必要でもcontext解決の範囲に限定する。 |
| `rowspan.ts` | rowspan range、移動不能行、禁止挿入位置の正本としてそのまま再利用する。入力方式別ロジックを追加しない。 |
| `controller/sortable-controller.ts` | SortableJSに加え、keyboard / single-pointer session、drag-click / drag-tap競合防止、focus入口、共通commit呼び出しを調停する。PC・タッチとも同じhandle selectorを使い、行全体をdrag開始領域にしない。利用者向け文字列は保持しない。 |
| `controller/sortable-runtime.ts` | 変更不要を基本とする。owning windowごとのruntime再利用を回帰確認する。 |
| `controller/drag-ui.ts` | insertion lineとfallback幅固定を維持する。タッチ専用のcontenteditable抑止やchosen styleは持たない。 |
| `controller/row-order.ts` | 入力方式共通の移動可否、次の有効な移動先、target一覧、no-op判定を追加する。行順計算の正本とする。 |
| `controller/reorder-ui.ts` | 行control、pointer target、基本設計8章の優先関係に従う案内表示、タッチのキャンセル操作、live status、focus / position / scroll補助を所有する。利用者向け文言は `messages.ts` から取得する。 |
| `controller/touch-press.ts` | 廃止。Touch DnDを行ハンドルに限定するため、長押しtimer / threshold / セル短tap判定を独立追跡しない。 |
| `editor.scss` | focus可視性、選択状態、Target Size、target UI、案内の見た目を所有する。 |
| `README.md` | 実装後の責務・操作フロー・新規fileを反映する。 |

### Requirement to module mapping

| Requirement | Main implementation boundary |
|---|---|
| `A11Y-FR-01` キーボード完結 | `with-table-reorder.tsx` → `use-table-reorder.ts` → `sortable-controller.ts` → `row-order.ts` / `reorder-ui.ts` |
| `A11Y-FR-02` 単一ポインター操作 | `sortable-controller.ts`、`reorder-ui.ts`、`row-order.ts` |
| `A11Y-FR-03` ターゲットサイズ | `reorder-ui.ts`、`editor.scss` |
| `A11Y-FR-04` 論理的なアクセス順 | `with-table-reorder.tsx`、`sortable-controller.ts`、`reorder-ui.ts` |
| `A11Y-FR-05` 操作文脈 | `use-table-reorder.ts`、`sortable-controller.ts`、`reorder-ui.ts` |
| `A11Y-FR-06` フォーカス可視性 | `reorder-ui.ts`、`editor.scss` |
| `A11Y-FR-07` フォーカス遮蔽 | `sortable-controller.ts`、`reorder-ui.ts`、`editor.scss` |
| `A11Y-FR-08` 操作案内 | `messages.ts`、`reorder-ui.ts`、`with-table-reorder.tsx`、`use-table-reorder.ts` |
| `A11Y-FR-09` 支援技術への情報提供 | `messages.ts`、`sortable-controller.ts`、`reorder-ui.ts` |
| `A11Y-FR-10` 名前・役割・状態 | `messages.ts`、`reorder-ui.ts`、`sortable-controller.ts` |
| `A11Y-FR-11` 基本要件の共有 | `rowspan.ts`、`row-order.ts`、`sortable-controller.ts` |
| `A11Y-FR-12` 編集環境 | `table-context.ts`、`sortable-runtime.ts`、`sortable-controller.ts`、`reorder-ui.ts`、`yamabiko-editor-tools.php` |

### Main control flow

#### Existing pointer DnD

```text
PC / Touch: row reorder controlをdrag
        ↓
SortableJS (handle = row reorder control)
        ↓
sortable-controller.ts
        ↓
row-order.ts + rowspan constraints
        ↓
restore original DOM order
        ↓
onCommit(reorderedBody)
        ↓
use-table-reorder.ts → setAttributes()
```

PC・タッチで同じdrag開始境界を利用する。Touchで行そのものの長押しを別経路として持たない。

#### Keyboard

```text
Toolbar「行を並べ替え」
        ↓
with-table-reorder.tsx
        ↓
use-table-reorder.ts
        ↓
controller.focusRowReorderControl()
        ↓
row control: Enter / Space
        ↓
keyboard session開始
        ↓
ArrowUp / ArrowDown
        ↓
row-order.tsで次の有効な移動先を計算
        ↓
reorder-ui.tsで候補表示・scroll・通知
        ↓
Enter / Space
        ↓
共通move validation + reorderRows()
        ↓
pending focusを保存してsetAttributes()
        ↓
再生成controllerが移動後の同じ行controlへfocus
```

#### Single pointer

```text
PC: 既存row controlをclick
Touch: reorder mode中の同じrow controlをtap
        ↓
single-pointer session開始
        ↓
row-order.tsで有効な移動先を列挙
        ↓
reorder-ui.tsで行間targetを表示
        ├─ targetをclick / tap
        │       ↓
        │  共通move validation + reorderRows()
        │       ↓
        │  pending focusを保存してsetAttributes()
        │       ↓
        │  再生成controllerが移動後の同じ行controlへfocus
        │
        ├─ PC: Escape
        │       ↓
        │  sessionをcancel
        │       ↓
        │  bodyは変更せず開始行controlへfocus
        │
        └─ Touch: 案内に併設した「キャンセル」操作をtap
                ↓
           sessionをcancel
                ↓
           bodyは変更せず開始行controlへfocus

Touchでは「行を並び替え」モードをOFFにした場合も、activeなsingle-pointer sessionをcommitせずcancelしてからmode cleanupする。
```

## Implementation phases

### Phase 1: 共通の移動計算境界を整える

- Outcome: SortableJS、キーボード、単一ポインターが同じ移動可否とrowspan制約を利用できる純粋計算APIができている。利用者向けUIはまだ変えない。
- Tasks:
  - `row-order.ts` に移動可否、次の有効な移動先、単一ポインターtarget一覧、no-op判定を追加する。
  - SortableJS `onEnd` も同じ判定境界を通すように整理する。
  - `rowspan.ts` は制約データ生成だけを維持する。
  - 上下移動、先頭 / 末尾、rowspan越え、同位置、無効indexを単体テストする。
- Validation:
  - 既存 `row-order.test.ts` と `rowspan.test.ts` が維持される。
  - 既存ポインターDnDのcommit結果とrowspan禁止位置が変わらない。

### Phase 2: 共用の行controlとキーボード入口を作る

- Outcome: 移動可能な行ごとに、PC / Touchのdrag handle、click / tap入口、keyboard入口を兼ねる一つのアクセシブルなcontrolが存在し、Toolbarから現在行または先頭の移動可能行へfocusできる。
- Tasks:
  - `reorder-ui.ts` とfocused unit testを追加する。
  - 基本設計8章の文言を一元管理する `messages.ts` を追加し、このPhaseで必要な行controlの名前・説明とTooltipも同moduleから取得する。WordPress i18n関数では `yamabiko-editor-tools` text domainを使用する。
  - native buttonを基礎に行controlを構成する。
  - PCはhover / focusで視認でき、touch reorder modeでは操作可能な行controlを表示する。
  - non-movable rowには同じcontrolを作らない。
  - 行位置と代表的な行内容からaccessible nameを作り、空行fallbackを持たせる。
  - `with-table-reorder.tsx` / `use-table-reorder.ts` にToolbar focus bridgeを追加する。
  - controllerで最後に操作していたtbody行を追跡し、基本設計のfocus優先順位を実現する。
  - `editor.scss` でfocus表示と最低target sizeを実装する。
  - `yamabiko-editor-tools.php` ではTable ReorderのJS / runtime configを既存 `enqueue_block_editor_assets` に残す。script enqueue後、同じhandle `yamabiko-editor-tools-table-reorder-index` に `wp_set_script_translations()` で `yamabiko-editor-tools` text domainと `__DIR__ . '/languages'` 相当の実ファイルシステム上のディレクトリを関連付ける。生成された `build/editor-extensions/table-reorder/index.css` は `enqueue_block_assets` + `is_admin()` でeditor content向けstyleとしてenqueueする。
- Validation:
  - Toolbarを実行しただけでは並べ替えsessionを開始しない。
  - 現在行が移動不能ならToolbarへfocusを維持し、基本設計8章の通知を表示・通知できる。
  - `Tab` / `Shift + Tab` は独自循環を作らず通常のfocus順で行control間と外部へ移動する。
  - PC hoverによるdrag開始とTouch modeのhandle表示が維持される。
  - 行controlの利用者向け文言がcontroller / UIへ直書きされず `messages.ts` から提供される。
  - iframe / non-iframeの両方で、生成CSSがeditorへ配信され、row controlのfocus表示とTarget Sizeが実際に適用される。

### Phase 3: キーボード並べ替えを接続する

- Outcome: 一つの行controlからキーボードだけで開始、移動先変更、確定、キャンセルを完了できる。
- Tasks:
  - controllerへkeyboard sessionを追加する。
  - `Enter` / `Space` で開始・確定、`ArrowUp` / `ArrowDown` で `row-order.ts` が返す次の有効な移動先へ進み、`Escape` でキャンセルする。
  - session中は対象行controlへfocusを維持し、`Tab` / `Shift + Tab` による離脱を抑止する。
  - insertion lineまたは同等の軽量表示を再利用して現在候補を示す。
  - 先頭 / 末尾、rowspan制約、no-opを基本設計8章の動的通知として扱う。
  - 確定時だけpending focus付きでcommitし、キャンセルではbodyを変更しない。
- Validation:
  - rowspan範囲の途中を候補にせず、範囲全体を越えた次の有効位置へ進む。
  - 同じ位置の確定で `setAttributes()` を呼ばず、Undo履歴を増やさない。
  - 確定後は移動後の同じ行control、キャンセル後は開始行controlへfocusする。

### Phase 4: PC / タッチの単一ポインター操作とTouch handle DnDを接続する

- Outcome: PC / Touchとも同じ行controlを使い、tap / clickでは有効な行間targetを選んでdragなしで移動でき、dragでは SortableJS DnDを開始できる。Touchの行長押しDnDは存在しない。
- Tasks:
  - controllerへsingle-pointer sessionを追加する。
  - `row-order.ts` の共通計算から有効targetだけを生成する。
  - `reorder-ui.ts` でrowspan途中を除いた行間target buttonをowning document上へ表示し、scroll / resizeに追従させる。
  - SortableJS の `handle` をPC / Touchとも行controlに固定し、Touchの行全体をdraggable開始領域にしない。
  - タッチ専用のdrag delay / long-press threshold / `touch-press.ts` を廃止する。
  - touch modeでcontenteditableのpointer eventsを止めず、セルの通常タップによる編集を維持する。
  - 行ハンドル外からの通常スクロールをTable Reorderが横取りしない。
  - drag完了直後のclick / tapをsingle-pointer開始として二重処理しないよう抑制する。
  - PCではsingle-pointer session中の `Escape` を明示的なcancel手段として扱い、target UIをcleanupして開始行controlへfocusを戻す。
  - touchでは `reorder-ui.ts` の案内に明示的なキャンセル操作を併設し、縦スクロール中も確認・操作できる状態を保つ。キャンセル時はtarget UIをcleanupして開始行controlへfocusを戻す。
  - touch reorder modeをOFFにする既存Toolbar操作では、activeなsingle-pointer sessionをcommitせずcancelしてからmode cleanupする。
  - target選択時はtargetへfocusされた後、commit再描画を経て移動後の同じ行controlへfocusする。
- Validation:
  - PCで「handle drag」と「handle click」が同じcontrol上で共存する。
  - Touchで「cell tap」「handle tap」「handle drag」が三つの別結果として成立する。
  - Touchで行そのものを長押ししてもDnDを開始しない。
  - Touchでセルの通常タップ編集と、行ハンドル以外からの通常スクロールを妨げない。
  - PCでは `Escape`、touchでは案内に併設したキャンセル操作で確定せず終了でき、データを変更しない。
  - touchで移動先を探して縦スクロールしても案内とキャンセル操作を確認・操作でき、target UI上のスワイプだけでは移動を確定しない。
  - touch reorder modeをOFFにした場合もactive sessionが残らず、データを変更しない。
  - target UIがrowspan途中を表示せず、キャンセルではデータを変更しない。

### Phase 5: 案内、通知、focus / scrollを完成させる

- Outcome: `A11Y-FR-05` ～ `A11Y-FR-10` を満たす操作文脈、基本設計8章の画面表示・支援技術向け通知・操作UIの名前 / 説明、focus可視性、Focus Not Obscuredが揃う。
- Tasks:
  - 基本設計8章のメッセージIDと `messages.ts` の定義を対応付け、英語を翻訳元とする `yamabiko-editor-tools` text domainのWordPress i18n / `sprintf()` で固定文言・可変文言を提供する。
  - controller、`reorder-ui.ts`、React側のToolbar / coachmark描画から利用者向け文字列の直書きを除き、すべて `messages.ts` を利用する。
  - タッチモード案内を「行ハンドルdrag / 行ハンドルtap / セルtap」の操作へ揃え、長押し案内を残さない。
  - 基本設計8章で定義された表示形式・表示契機・消える契機・競合時の優先関係に従って、Tooltip、インライン案内、WordPress一時通知を実装する。
  - タッチ端末の初回コーチマークをToolbar入口に紐づけて実装し、閉じた後はページ再読み込みや投稿を開き直しても自動再表示しない状態をWordPress側で永続化する。PCには追加しない。
  - single-pointer session中は、PCでは `Escape`、touchでは案内に併設するキャンセル操作という基本設計のキャンセル経路を案内とUIへ反映する。
  - owning document内のlive status nodeと基本設計8章の重複通知抑制を実装する。
  - row controlに現在の操作対象であることを表す状態を付与し、focus表示とは区別する。
  - keyboard候補変更時に現在候補と移動方向側の次の有効位置を可能な範囲で見えるようscrollを補助する。
  - pointer target表示中も元のrow controlをTable Reorder自身のUIで完全に隠さない。
- Validation:
  - 基本設計8章で定義された開始、候補変更、確定、キャンセル、移動不能等の画面表示 / 動的通知が、定義された契機と優先関係で一つだけ提示される。
  - タッチの初回コーチマークが初回利用時だけ表示され、閉じた後は自動再表示されず、モード開始後は通常案内へ置き換わる。
  - touch reorder mode中に、cell tap / handle tap / handle dragの違いを画面上から再確認できる。
  - single-pointer session中に、PC / touchそれぞれのキャンセル経路を画面上または操作UIから確認できる。
  - key repeatや同じ無効操作で同一通知を連続発火しない。
  - 利用者向け文言が一つの `messages.ts` に集約され、controller / UI処理へ直書きされていない。
  - row control / targetのhit areaがWCAG 2.2 2.5.8の最低要件を満たす。
  - focusされたcontrolがTable Reorderの案内 / target UIによって完全に隠れない。

### Phase 6: 編集環境と既存操作の回帰確認を完了する

- Outcome: iframe / non-iframe、PC / タッチ、rowspanあり / なしで同じ利用者向け意味を確認し、実装責務をREADMEへ反映できている。
- Tasks:
  - controller / reorder UI / messageのfocused unit testを追加・更新する。
  - Playwrightで安定して再現できるkeyboard / pointer / coachmark経路を追加する。支援技術固有挙動は手動確認へ残す。
  - iframe / non-iframeの両環境でfocus、target位置、live statusがowning document内にあることを確認する。
  - iframe / non-iframeの両環境で `index.css` がeditorへ配信され、row control / target / 案内のstyleが適用されることを確認する。
  - 既存PC handle drag、Touch handle drag、rowspan制約、DOM restore before commit、Undo、セル編集、通常スクロールを回帰確認する。
  - WordPress i18n用の翻訳データを既存のリポジトリ手順に従って更新する。`i18n:json` をsource → build mapping対応へ拡張し、`wp i18n make-json --use-map` 等で `src/editor-extensions/table-reorder/messages.ts` の翻訳元を `build/editor-extensions/table-reorder/index.js` に対応付けたJSONを生成する。
  - `src/editor-extensions/table-reorder/README.md` のfile責務とcontrol flowを更新する。
- Validation:
  - Node品質gate、production build、repository diff checkを通す。
  - 実ブラウザーで要件・基本設計の受け入れ確認を行う。
  - 日本語localeの実ブラウザーで、source → build mappingにより生成したJSON翻訳がTable Reorderのscript handleへロードされ、基本設計8章の翻訳が表示・通知されることを確認する。

## Decisions and validation questions

### Decide before implementation

以下は本プランで実装方針として固定する。

- 行の並べ替えcontrolとpointer targetはnative `button`を第一選択とし、独自 `role="button"` 実装を増やさない。
- PC / Touchとも SortableJS のdrag開始は共通の行controlへ限定し、Touchの行長押しDnDを持たない。
- Touchではセルのpointer eventsを抑止せず、cell tapを通常編集として残す。
- keyboard / single-pointerの一時状態は `sortable-controller.ts` が所有し、React stateや汎用state machineを新設しない。
- 移動可否と移動後配列の計算は `row-order.ts` / `rowspan.ts` を正本とし、入力方式別に複製しない。
- Gutenberg再描画をまたぐfocus復元requestだけを `use-table-reorder.ts` がrefで保持する。
- 行control / target /案内 / live statusは `reorder-ui.ts` に集約し、drag専用UIは `drag-ui.ts` に残す。
- `touch-press.ts` は廃止し、Touch専用の長押しtimer、開始threshold、セル短tap判定を持たない。
- persistentなaccessibility UIの見た目は `editor.scss` に置く。Table ReorderのJS / runtime configは既存 `enqueue_block_editor_assets` を維持し、`yamabiko-editor-tools.php` の追加責務は生成された `build/editor-extensions/table-reorder/index.css` の `enqueue_block_assets` + `is_admin()` によるeditor content配信と、Table Reorder script handleへの `wp_set_script_translations()` による翻訳関連付けに限定する。
- JavaScript翻訳JSONは既存i18n手順にsource → build mappingだけを追加し、`messages.ts` の翻訳元を実際にenqueueされる `build/editor-extensions/table-reorder/index.js` に対応付けて生成する。新しい汎用翻訳基盤は作らない。
- single-pointer sessionのcancelは、PCでは `Escape`、touchでは案内に併設する明示的なキャンセル操作を主経路とする。touch reorder modeをOFFにする場合もactive sessionをcancelしてからcleanupする。
- タッチ初回コーチマークは本実装に含め、Toolbar入口に紐づけて初回利用時だけ表示し、閉じた後の自動再表示を永続的に抑制する。PCには追加しない。
- 基本設計8章の画面表示・動的通知・アクセシブルな名前 / 説明は `messages.ts` に集約し、`yamabiko-editor-tools` text domainのWordPress i18n / `sprintf()` を使用する。controllerやUIへ利用者向け文字列を直書きしない。
- 支援技術向けstatusはowning document内へTable Reorder自身が一つだけ生成し、新規npm dependencyを追加しない。

### Validate during implementation

以下は実装で安全に検証してから最終形を決める。

- `contenteditable` 内へ一時挿入するnative buttonがGutenbergのセル編集・選択・保存DOMへ干渉しないか。
- SortableJS `forceFallback` 環境で、PC / Touchともdrag完了後のclick / tap抑制をどのイベント境界で行うのが最も単純で安定するか。
- Touchで行controlをdragした際に通常スクロールとの境界が自然で、行control外からの縦スクロールが妨げられないか。
- touch端末でToolbarを外付けkeyboardから起動した場合、touch mode開始だけでなくchapter 5のkeyboard focus入口として扱うためのactivation origin判定方法。
- `setAttributes()` 後にcontrollerが再生成されるタイミングで、pending focus requestを一度だけ確実に消費できるか。
- 行間targetをfixed overlayで配置した場合のscroll / resize追従と、Gutenberg toolbar / iframe clippingとの干渉。
- keyboard scroll追従を `scrollIntoView()` 中心で満たせるか、次の有効位置を見せるための追加 `scrollBy()` が必要か。
- row accessible nameに採用する代表的内容の長さ、空行fallback、重複行の区別が支援技術で実用的か。
- live statusの `role` / `aria-live` / `aria-atomic` の組み合わせと、重複抑制がChrome + 主要screen readerで過不足ないか。
- タッチ初回コーチマークのdismiss済み状態を、追加依存を最小にしつつWordPress内で確実に永続化できる保存境界。
- 基本設計8章の表示形式をWordPress標準component / UI patternで実現したとき、iframe / non-iframeとToolbar / editor contentの境界をまたいでも表示優先度と関連付けを保てるか。

検証で実装差が必要になっても、要件・基本設計で確定した利用者向け意味は変更しない。意味の変更が必要と判明した場合は実装側だけで調整せず、#189 / #213の正本へ戻して判断する。

## Issue breakdown

プランレビュー後、次の境界で子Issueへ分割する。各Issueは前段の公開境界を利用し、同じ機能を並行して重複実装しない。

- [ ] Phase 1: 共通の行移動・rowspan制約計算をアクセシビリティ操作向けに拡張する
- [ ] Phase 2: アクセシブルな行controlとToolbar focus入口を実装する
- [ ] Phase 3: キーボードによる行並べ替えを実装する
- [ ] Phase 4: PC / タッチのドラッグ不要な単一ポインター移動とTouch handle DnDを実装する
- [ ] Phase 5: 操作案内・支援技術通知・focus / scroll対応を実装する
- [ ] Phase 6: iframe / non-iframeと既存DnDの回帰検証・文書更新を行う

依存順は Phase 1 → Phase 2 → Phase 3 / Phase 4 → Phase 5 → Phase 6 とする。Phase 3とPhase 4はPhase 1・2を共有するが、controllerの同じsession / UI境界を変更するため、同時並行ではなく順番に実装して競合を避ける。

## Validation

実装完了時は `docs/development/testing.md` を正本として、変更内容に応じた検証を行う。

### Automated

- `npm test`
  - format、JavaScript lint、CSS lint、typecheck、Jest unit testが成功する。
- `npm run build`
  - `editor.scss` を含むTable Reorder production assetとして `build/editor-extensions/table-reorder/index.css` が生成できる。
- `git diff --check origin/main...HEAD`
  - whitespace errorがない。
- focused Jest
  - `row-order.test.ts`: 共通移動可否、次の有効移動先、rowspan越え、no-op
  - `messages.test.ts`: 基本設計8章のmessage ID対応、可変文言、`yamabiko-editor-tools` text domainのWordPress i18n / `sprintf()` 境界
  - `reorder-ui.test.ts`: control / target / accessible name / cancel UI / cleanup / live status / message優先表示
  - `sortable-controller.test.ts`: keyboard / pointer session、共通commit、PC / Touchのhandle設定、drag後click / tap抑制、focus request、PC Escape cancel
  - `table-context.test.ts` / `sortable-runtime.test.ts` / `drag-ui.test.ts` / `rowspan.test.ts` の回帰
- Playwright
  - PC Toolbar → keyboard row control → move → confirm / cancel
  - PC handle dragとhandle clickの共存
  - Touch handle dragとhandle tapの共存
  - Touchで行そのものの長押しからDnDが始まらないこと
  - Touchでセルtap編集と通常スクロールが維持されること
  - PC single-pointer開始 → `Escape` cancel
  - touch single-pointer開始 → 案内に併設したキャンセル操作によるcancel
  - タッチ初回コーチマークの初回表示、終了、再表示抑制
  - iframe環境を基準にし、non-iframeは対応するwp-dev環境でも確認する

### Manual acceptance

- PC hover-capable環境
  - Table選択だけでfocusが移らない。
  - Toolbarから現在行、fallbackで先頭移動可能行へfocusできる。
  - `Tab` / `Shift + Tab` が論理順で動き、端でTable Reorder外へ出られる。
  - keyboard開始 / 上下移動 / 確定 / cancelが仕様どおり。
  - handleをdragすれば既存DnD、clickすればsingle-pointer選択になる。
  - single-pointer選択中に `Escape` を押すとcancelでき、行順を変更しない。
  - cell clickは従来どおり編集になる。
  - PCでは初回コーチマークを表示しない。
- Touch環境
  - 初回利用時にToolbar入口へコーチマークが表示され、閉じた後はページ再読み込みや投稿を開き直しても自動再表示されない。
  - reorder mode開始だけでは特定行を自動選択しない。
  - reorder mode中に、cell tapは通常編集、handle tapはdrag不要の移動先選択、handle dragはDnDであることを確認できる。
  - 行そのものを長押ししてもDnDを開始しない。
  - 行ハンドル以外からの通常の縦スクロールを妨げない。
  - single-pointer選択中に案内へ併設されたキャンセル操作をtapするとcancelでき、行順を変更しない。
  - 移動先を探して縦スクロールしても案内とキャンセル操作が画面内で確認・操作でき、target UI上のスワイプだけでは確定しない。
  - single-pointer選択中にToolbarからreorder modeをOFFにしてもsessionが残らず、行順を変更しない。
  - 外付けkeyboard相当の操作でkeyboard経路を完了できる。
- rowspan
  - rowspan範囲内の行に通常のrow controlを提供しない。
  - keyboard / pointer targetでrowspan途中を選べない。
  - 範囲外の行は結合範囲全体を越えられる。
- Focus / scroll
  - focus ringがhoverに依存せず見える。
  - row control / targetの操作領域を実測しTarget Sizeを確認する。
  - 長いTableで上下移動し、現在候補と移動方向側の次の有効位置を可能な範囲で確認できる。
  - Table Reorder自身の案内・targetがfocus controlを完全に隠さない。
- Editor asset delivery
  - iframe / non-iframeの両環境で `build/editor-extensions/table-reorder/index.css` がeditorへ読み込まれる。
  - row controlのfocus ring、Target Size、選択状態、pointer target、操作案内に `editor.scss` のstyleが実際に適用される。
- Messages / i18n
  - 基本設計8章の画面表示・動的通知・アクセシブルな名前 / 説明が `messages.ts` を経由し、controller / UIへ利用者向け文字列が直書きされていない。
  - タッチ案内に行長押しDnDの文言が残っていない。
  - `messages.ts` のWordPress i18n関数が `yamabiko-editor-tools` text domainを使用している。
  - source → build mappingにより `src/editor-extensions/table-reorder/messages.ts` の翻訳元を `build/editor-extensions/table-reorder/index.js` に対応付けたJSONが生成され、そのJSON翻訳がTable Reorderのscript handle `yamabiko-editor-tools-table-reorder-index` へ実際にロードされる。
- Support technology
  - 少なくとも一つの主要screen reader + Chrome系browserで、row名、開始、移動先変更、確定、cancel、移動不能理由を確認する。
  - 同じ無効操作やkey repeatで不要な同一通知が連続しない。
- Data / Gutenberg regression
  - cell内容・属性・装飾を保持する。
  - 一回の有効移動が一回のUndoで戻る。
  - cancel / invalid / no-opで不要なattribute更新を行わない。
  - SortableJS dragでは元DOM順序を復元してからGutenbergへcommitする既存境界を維持する。

## Completion criteria

- `A11Y-FR-01` ～ `A11Y-FR-12` の各要件が上記module境界のいずれかへ対応付いている。
- keyboard、single pointer、既存SortableJS DnDが `row-order.ts` / `rowspan.ts` の共通移動可否を利用する計画になっている。
- 既存の `use-table-reorder.ts`、`with-table-reorder.tsx`、`table-context.ts`、`rowspan.ts`、controller各moduleの再利用範囲が明確である。
- 新規責務が `messages.ts`、`reorder-ui.ts`、`editor.scss` を中心に限定され、`yamabiko-editor-tools.php` の追加責務も生成CSSのeditor content配信とTable Reorder script handleへのscript translations関連付けに限定される。JS / runtime configは既存 `enqueue_block_editor_assets` を維持し、汎用基盤や入力方式別の重複ロジックを作らない。
- Gutenberg commitをまたぐfocus復元と、drag時には不要なfocus変更を行わない境界が明確である。
- PC / Touchとも行ハンドルをSortableJSのdrag開始境界とし、Touchの行長押しDnDと専用 `touch-press.ts` を廃止する計画になっている。
- PCではhandle drag / click、Touchではcell tap / handle tap / handle dragの競合と、PC `Escape` / touch明示的cancelによるsingle-pointerの確定しないcancel経路を実装・検証する順序が明確である。
- Touchでセルの通常編集と行ハンドル外からの通常スクロールを妨げない実装・検証計画がある。
- タッチ初回コーチマークを初回だけ表示し、閉じた後の自動再表示を抑制する実装・検証計画がある。
- 基本設計8章の利用者向け文言を `messages.ts` に一元管理し、`yamabiko-editor-tools` text domainのWordPress標準i18nを利用する実装・検証計画がある。
- JavaScript翻訳JSONを既存i18n手順のsource → build mappingで `build/editor-extensions/table-reorder/index.js` に対応付け、Table Reorderのscript handleへ関連付けて日本語localeの実ブラウザーで翻訳が適用されることを検証する計画がある。
- `wp_set_script_translations()` の翻訳ディレクトリへ実ファイルシステム上の `languages` パスを渡す計画がある。
- touch reorder mode中に必要な操作案内を実装・確認する計画がある。
- iframe / non-iframeの両方でTable Reorderの生成CSS配信を検証する計画がある。
- unit test、Playwright、手動accessibility確認、iframe / non-iframe回帰の役割分担が明確である。
- 各実装Phaseを単独レビュー可能なIssueへ分割できる。

## Notes

- 旧dnd-kit版アクセシビリティplanは過去資料としてのみ扱う。Portal handle、旧mode、旧state構成を現行実装へ戻す根拠にはしない。
- `sortable-runtime.ts` と `table-context.ts` は現行のowning window / document境界がすでにiframe / non-iframe共通化の土台になっているため、アクセシビリティ専用のeditor mode分岐を上位へ増やさない。
- Touchの長押しDnD実装と `touch-press.ts` は #246 で廃止する。アーカイブ文書の長押し記述は過去資料として扱い、現行仕様の根拠にしない。
- `drag-ui.ts` の責務はdrag中の一時UIへ戻し、Touch modeでcontenteditableを無効化する責務は持たせない。
- 実装中にcontrollerが過大化する兆候が出ても、先に汎用層を追加しない。keyboard / pointer sessionの純粋計算として独立できる責務が実際に生じた場合だけ、feature内のfocused moduleへ分離する。
