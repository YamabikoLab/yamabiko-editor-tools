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

## Goal

現在の SortableJS版 Table Reorder を基礎に、アクセシビリティ要件 `A11Y-FR-01` ～ `A11Y-FR-12` と基本設計で確定した利用者向け仕様を実装できる状態へ分解する。

実装では、既存のポインターDnD、タッチ長押し、rowspan制約、DOM所有権の復元、Gutenbergへの `setAttributes()` commit、iframe / non-iframe対応を再利用する。キーボード操作とドラッグを必要としない単一ポインター操作のために別系統の行移動ロジックを作らず、移動可否判定と確定処理を既存の行順序計算へ集約する。

本プランは要件・基本設計の正本ではない。利用者向け仕様を変更または再定義せず、現在のコードへどの責務・順序で組み込むかだけを定める。

## Scope

### Included

- PCのブロックツールバーから行の並べ替えUIへ移るキーボード入口
- 移動可能な各行のキーボード到達可能な並べ替えUI
- `Enter` / `Space`、`ArrowUp` / `ArrowDown`、`Escape` によるキーボード並べ替え
- PCで既存ハンドルをクリックして開始する、ドラッグ不要の単一ポインター操作
- タッチの並べ替えモード中に行の並べ替えUIをタップして開始する単一ポインター操作
- 既存のセル短タップ編集、行長押しDnD、PCポインターDnDとの競合防止
- rowspan制約を共有する移動先計算とcommit境界
- 行の並べ替えUIと移動先UIの名前・役割・状態、フォーカス表示、Target Size
- 操作案内、状態・結果・移動不能理由の支援技術向け通知
- 確定・キャンセル後のフォーカス維持 / 復元
- キーボード・単一ポインター操作時の縦スクロール追従と Focus Not Obscured
- iframe / non-iframeで同じ意味の操作を成立させるためのDOM / window境界
- 既存単体テストの拡張と、Gutenberg上で必要なE2E / 手動確認
- 実装完了時の `src/editor-extensions/table-reorder/README.md` 更新

### Not included

- アクセシビリティ要件、SortableJS版基本要件、基本設計の変更
- SortableJSそのものの置き換え
- 旧dnd-kit版の状態管理・Portalハンドル・DnD実装の復活
- 複数行の同時移動
- 列の並べ替え
- 汎用アクセシビリティフレームワークや汎用state machineの新設
- Table Reorder以外で再利用することを目的としたshared utilityの抽出
- 初回コーチマークの新規実装。基本設計で必須となる再確認可能な短い操作案内を先に実装し、コーチマークは別Issueで必要性を判断する

## Approach

### 1. React / Gutenberg境界は薄いまま維持する

`with-table-reorder.tsx` は引き続き Gutenberg の描画境界とToolbar描画を担当し、行DOMやイベント処理を直接所有しない。

`use-table-reorder.ts` は現在の hover capability、タッチ並べ替えモード、Table context解決、controller lifecycleを維持しつつ、次の橋渡しだけを追加する。

- Toolbarからcontrollerへ「行の並べ替えUIへフォーカスする」要求を渡す
- controller instanceをrefで保持する
- `setAttributes()` による再描画をまたぐフォーカス復元要求を一時保持する
- WordPress notice APIやGutenberg callbackは現在と同様に狭いcallbackとして下位へ渡す

キーボード並べ替え中・単一ポインター移動先選択中という命令的なDOM操作状態はReact stateへ持ち上げない。controller内の一時sessionとして保持し、body更新でcontrollerが再生成される境界だけhookが橋渡しする。

### 2. 行移動の正本を `row-order.ts` に集約する

現在の `row-order.ts` は `reorderRows()`、SortableJSの挿入位置計算、元DOM順序復元を所有している。この責務を拡張し、入力方式に依存しない次の純粋計算も同ファイルへ置く。

- 移動元indexと移動後indexから、rowspan制約確認に使う挿入indexを求める
- `nonMovableRowIndices` / `forbiddenInsertionIndices` を使って移動可否を判定する
- 上下方向にある次の有効な移動先indexを求める
- 単一ポインター用に表示できる有効な移動先一覧を求める
- 同じ位置への確定をno-opとして判定する

SortableJS `onEnd`、キーボード確定、単一ポインター確定は、最終的に同じ移動可否判定と `reorderRows()` を利用する。`rowspan.ts` は引き続き rowspan range、移動不能行、禁止挿入位置を算出するだけとし、入力方式別の知識を追加しない。

### 3. controllerを入力方式のオーケストレーターとして拡張する

`controller/sortable-controller.ts` はすでに SortableJS instance、drag session、hover handle、touch press、DOM cleanupを束ねる命令的境界であるため、アクセシビリティ操作もこのcontrollerから調停する。

controllerには必要最小限の一時sessionだけを追加する。

- keyboard session: 移動元行indexと現在の移動先index
- single-pointer session: 移動元行index
- pending click suppression: SortableJS drag完了直後のclickを単一ポインター開始として誤処理しないための短寿命フラグ
- last active row: Toolbarから現在行を優先してフォーカスするため、`tbody`内で最後に操作・編集していた移動可能行を追跡する情報

ポインターDnDの既存 `isDragging` やdrag rowsは維持し、キーボード / 単一ポインターsessionと一つの大きなstate machineへ統合しない。同時に複数操作が進行しないことだけcontrollerで保証する。

### 4. アクセシブルな行UIを専用の小さなDOM責務へ分離する

現在の `controller/drag-ui.ts` は insertion line、touch drag装飾、fallback幅固定など「drag中またはdragのための一時UI」を所有している。一方、アクセシブルな行の並べ替えUIは待機中から存在し、キーボード・クリック・タップでも使うため、drag専用責務へ混在させない。

新規 `controller/reorder-ui.ts` を追加し、次だけを所有させる。

- 移動可能行へ対応する行の並べ替えcontrolの生成・cleanup
- controlの表示、フォーカス、選択中状態の反映
- PC hover時とキーボードfocus時の短い操作案内
- 単一ポインター操作時の有効な行間target UIの生成・位置更新・cleanup
- owning `document` 内の支援技術向けstatus nodeの生成・cleanup
- 行control / target UIの位置計測と、必要な範囲のスクロール補助

行の並べ替えcontrolと移動先targetには原則としてnative `button`を使い、`contenteditable="false"` とTable Reorder固有classを付ける。役割をARIAで再実装せず、名前・状態・説明に必要な属性だけを追加する。Gutenbergのcontenteditable内へ一時DOMを挿入する互換性は実装時に検証する。

`drag-ui.ts` から既存hover handle生成部分を `reorder-ui.ts` へ移し、同じcontrolをPCのSortableJS handle、クリック入口、キーボード入口として共用する。insertion line、touch drag UI、fallback row widthは `drag-ui.ts` に残す。

永続的なfocus表示、Target Size、選択状態、target UIのhit areaはinline styleを増やし続けず、新規 `editor.scss` に置く。`index.tsx` はこのeditor styleをimportするだけとし、entry pointを太らせない。

### 5. focus復元はGutenberg commit境界をまたいで明示的に扱う

キーボードまたは単一ポインター操作で確定すると、`setAttributes()` によりGutenbergがTable DOMを再描画し、controllerと一時controlも作り直される。

そのため、controllerからhookへcommitする際に「移動後にfocusすべき行index」を同時に通知する。hookはrefにpending focus requestを保存してから `setAttributes()` を呼び、body更新後に生成された新しいcontrollerへ一度だけ渡す。新controllerは対応する行controlをfocusしてrequestを消費する。

通常のSortableJS DnDでは、このpending focus requestを設定しない。ポインターDnD開始時にTable Reorder都合のfocus移動を追加しないという基本設計を維持する。

キャンセルではbodyを更新しないため、controller内で開始時の行controlへ直接focusを戻す。

### 6. 通知・案内はowning documentで完結させる

iframe / non-iframeの差を上位へ漏らさないため、行control、target UI、案内、status nodeは `TableContext.document` / `window` を使って生成する。

支援技術向け通知は新しいnpm依存を追加せず、`reorder-ui.ts` がowning documentへ一つのlive status nodeを作成し、controllerが次のイベントで必要な文だけ更新する方向とする。

- 開始
- 単一ポインターの移動先選択待ち
- キーボード移動先変更
- 確定
- キャンセル
- 先頭 / 末尾またはrowspan制約による移動不能

直前と同じ通知はcontroller側で抑制する。ARIAの最終属性、politeness、行名の組み立ては実装時にDOM / screen readerで検証し、基本設計の意味を変えない範囲で確定する。

## Architecture

### Existing and new modules

| Module | Plan |
|---|---|
| `index.tsx` | `editor.scss` のimportだけを追加する。登録責務は変更しない。 |
| `with-table-reorder.tsx` | PC / タッチのToolbar入口を基本設計に合わせて描画し、controllerへのfocus要求をhook経由で呼ぶ。PCではモードを新設しない。 |
| `use-table-reorder.ts` | controller ref、Toolbar focus bridge、commit後のpending focus復元を追加する。既存hover / touch mode lifecycleとrowspan制約算出は維持する。 |
| `table-context.ts` | iframe / non-iframeのowning document / window解決をそのまま再利用する。追加が必要でもcontext解決の範囲に限定する。 |
| `rowspan.ts` | rowspan range、移動不能行、禁止挿入位置の正本としてそのまま再利用する。入力方式別ロジックを追加しない。 |
| `controller/sortable-controller.ts` | SortableJSに加え、keyboard / single-pointer session、drag-click競合防止、focus入口、共通commit呼び出しを調停する。 |
| `controller/sortable-runtime.ts` | 変更不要を基本とする。owning windowごとのruntime再利用を回帰確認する。 |
| `controller/drag-ui.ts` | insertion line、touch drag装飾、fallback幅固定を維持する。行control生成は新しい `reorder-ui.ts` へ移す。 |
| `controller/row-order.ts` | 入力方式共通の移動可否、次の有効な移動先、target一覧、no-op判定を追加する。行順計算の正本とする。 |
| `controller/touch-press.ts` | 行controlの短いtapを「セル編集へ戻るtap」と誤判定しない除外境界を追加する。既存長押しthreshold / cleanupは維持する。 |
| `controller/reorder-ui.ts` | 新規。行control、pointer target、短い案内、live status、focus / position / scroll補助を所有する。 |
| `editor.scss` | 新規。focus可視性、選択状態、Target Size、target UI、案内の見た目を所有する。 |
| `README.md` | 実装後の責務・操作フロー・新規fileを反映する。 |

### Requirement to module mapping

| Requirement | Main implementation boundary |
|---|---|
| `A11Y-FR-01` キーボード完結 | `with-table-reorder.tsx` → `use-table-reorder.ts` → `sortable-controller.ts` → `row-order.ts` / `reorder-ui.ts` |
| `A11Y-FR-02` 単一ポインター操作 | `sortable-controller.ts`、`reorder-ui.ts`、`touch-press.ts`、`row-order.ts` |
| `A11Y-FR-03` ターゲットサイズ | `reorder-ui.ts`、`editor.scss` |
| `A11Y-FR-04` 論理的なアクセス順 | `with-table-reorder.tsx`、`sortable-controller.ts`、`reorder-ui.ts` |
| `A11Y-FR-05` 操作文脈 | `use-table-reorder.ts`、`sortable-controller.ts`、`reorder-ui.ts` |
| `A11Y-FR-06` フォーカス可視性 | `reorder-ui.ts`、`editor.scss` |
| `A11Y-FR-07` フォーカス遮蔽 | `sortable-controller.ts`、`reorder-ui.ts`、`editor.scss` |
| `A11Y-FR-08` 操作案内 | `reorder-ui.ts`、`with-table-reorder.tsx` |
| `A11Y-FR-09` 支援技術への情報提供 | `sortable-controller.ts`、`reorder-ui.ts` |
| `A11Y-FR-10` 名前・役割・状態 | `reorder-ui.ts`、`sortable-controller.ts` |
| `A11Y-FR-11` 基本要件の共有 | `rowspan.ts`、`row-order.ts`、`sortable-controller.ts` |
| `A11Y-FR-12` 編集環境 | `table-context.ts`、`sortable-runtime.ts`、`sortable-controller.ts`、`reorder-ui.ts` |

### Main control flow

#### Existing pointer DnD

```text
row reorder control / touch row
        ↓
SortableJS
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

この経路は基本的に維持する。

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
Touch: reorder mode中のrow controlをtap
        ↓
single-pointer session開始
        ↓
row-order.tsで有効な移動先を列挙
        ↓
reorder-ui.tsで行間targetを表示
        ↓
targetをclick / tap
        ↓
共通move validation + reorderRows()
        ↓
pending focusを保存してsetAttributes()
        ↓
再生成controllerが移動後の同じ行controlへfocus
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

- Outcome: 移動可能な行ごとに、PCのdrag handle、click入口、keyboard入口を兼ねる一つのアクセシブルなcontrolが存在し、Toolbarから現在行または先頭の移動可能行へfocusできる。
- Tasks:
  - `reorder-ui.ts` とfocused unit testを追加する。
  - 既存hover handle生成を `drag-ui.ts` から移し、native buttonを基礎に再構成する。
  - PCはhover / focusで視認でき、touch reorder modeでは操作可能な行controlを表示する。
  - non-movable rowには同じcontrolを作らない。
  - 行位置と代表的な行内容からaccessible nameを作り、空行fallbackを持たせる。
  - `with-table-reorder.tsx` / `use-table-reorder.ts` にToolbar focus bridgeを追加する。
  - controllerで最後に操作していたtbody行を追跡し、基本設計のfocus優先順位を実現する。
  - 新規 `editor.scss` でfocus表示と最低target sizeを実装する。
- Validation:
  - Toolbarを実行しただけでは並べ替えsessionを開始しない。
  - 現在行が移動不能ならToolbarへfocusを維持し、理由を通知できる。
  - `Tab` / `Shift + Tab` は独自循環を作らず通常のfocus順で行control間と外部へ移動する。
  - hoverによるPCの既存drag開始が維持される。

### Phase 3: キーボード並べ替えを接続する

- Outcome: 一つの行controlからキーボードだけで開始、移動先変更、確定、キャンセルを完了できる。
- Tasks:
  - controllerへkeyboard sessionを追加する。
  - `Enter` / `Space` で開始・確定、`ArrowUp` / `ArrowDown` で `row-order.ts` が返す次の有効な移動先へ進み、`Escape` でキャンセルする。
  - session中は対象行controlへfocusを維持し、`Tab` / `Shift + Tab` による離脱を抑止する。
  - insertion lineまたは同等の軽量表示を再利用して現在候補を示す。
  - 先頭 / 末尾、rowspan制約、no-opを通知する。
  - 確定時だけpending focus付きでcommitし、キャンセルではbodyを変更しない。
- Validation:
  - rowspan範囲の途中を候補にせず、範囲全体を越えた次の有効位置へ進む。
  - 同じ位置の確定で `setAttributes()` を呼ばず、Undo履歴を増やさない。
  - 確定後は移動後の同じ行control、キャンセル後は開始行controlへfocusする。

### Phase 4: PC / タッチの単一ポインター操作を接続する

- Outcome: PCは既存handle click、touchはreorder mode中のrow control tapから、有効な行間targetを選んでdragなしで移動できる。
- Tasks:
  - controllerへsingle-pointer sessionを追加する。
  - `row-order.ts` の共通計算から有効targetだけを生成する。
  - `reorder-ui.ts` でrowspan途中を除いた行間target buttonをowning document上へ表示し、scroll / resizeに追従させる。
  - PCではSortableJS drag後のclickを抑制し、dragをsingle-pointer開始として二重処理しない。
  - `touch-press.ts` でrow controlの短いtapをセル編集tap扱いから除外し、通常セルの短tapは従来どおりtouch reorder modeを終了して編集へ戻す。
  - target選択時はtargetへfocusされた後、commit再描画を経て移動後の同じ行controlへfocusする。
- Validation:
  - PCで「drag」と「click」が同じcontrol上で共存する。
  - タッチで「セル短tap」「行長押しDnD」「row control tap」が三つの別経路として成立する。
  - target UIがrowspan途中を表示せず、キャンセルではデータを変更しない。

### Phase 5: 案内、通知、focus / scrollを完成させる

- Outcome: `A11Y-FR-05` ～ `A11Y-FR-10` を満たす操作文脈、短い案内、支援技術向け通知、focus可視性、Focus Not Obscuredが揃う。
- Tasks:
  - PC hover / focus時の「ドラッグして移動 / クリックして移動先を選択」を再確認可能な案内として実装する。
  - single-pointer session開始後とkeyboard session中の短い操作案内を実装する。
  - owning document内のlive status nodeと重複通知抑制を実装する。
  - row controlに現在の操作対象であることを表す状態を付与し、focus表示とは区別する。
  - keyboard候補変更時に現在候補と移動方向側の次の有効位置を可能な範囲で見えるようscrollを補助する。
  - pointer target表示中も元のrow controlをTable Reorder自身のUIで完全に隠さない。
- Validation:
  - 開始、候補変更、確定、キャンセル、移動不能が必要な情報だけ通知される。
  - key repeatや同じ無効操作で同一通知を連続発火しない。
  - row control / targetのhit areaがWCAG 2.2 2.5.8の最低要件を満たす。
  - focusされたcontrolがTable Reorderの案内 / target UIによって完全に隠れない。

### Phase 6: 編集環境と既存操作の回帰確認を完了する

- Outcome: iframe / non-iframe、PC / タッチ、rowspanあり / なしで同じ利用者向け意味を確認し、実装責務をREADMEへ反映できている。
- Tasks:
  - controller / reorder UI / touch pressのfocused unit testを追加・更新する。
  - Playwrightで安定して再現できるkeyboard / pointer経路を追加する。支援技術固有挙動は手動確認へ残す。
  - iframe / non-iframeの両環境でfocus、target位置、live statusがowning document内にあることを確認する。
  - 既存PC drag、touch long-press drag、rowspan warning、DOM restore before commit、Undo、セル編集を回帰確認する。
  - `src/editor-extensions/table-reorder/README.md` のfile責務とcontrol flowを更新する。
- Validation:
  - Node品質gate、production build、repository diff checkを通す。
  - 実ブラウザーで要件・基本設計の受け入れ確認を行う。

## Decisions and validation questions

### Decide before implementation

以下は本プランで実装方針として固定する。

- 行の並べ替えcontrolとpointer targetはnative `button`を第一選択とし、独自 `role="button"` 実装を増やさない。
- keyboard / single-pointerの一時状態は `sortable-controller.ts` が所有し、React stateや汎用state machineを新設しない。
- 移動可否と移動後配列の計算は `row-order.ts` / `rowspan.ts` を正本とし、入力方式別に複製しない。
- Gutenberg再描画をまたぐfocus復元requestだけを `use-table-reorder.ts` がrefで保持する。
- 行control / target /案内 / live statusは新規 `reorder-ui.ts` に集約し、drag専用UIは `drag-ui.ts` に残す。
- persistentなaccessibility UIの見た目は新規 `editor.scss` に置き、汎用style基盤を追加しない。
- 支援技術向けstatusはowning document内へTable Reorder自身が一つだけ生成し、新規npm dependencyを追加しない。
- 初回コーチマークは本実装の完了条件に含めず、閉じた後も使える短い案内を必須経路とする。

### Validate during implementation

以下は実装で安全に検証してから最終形を決める。

- `contenteditable` 内へ一時挿入するnative buttonがGutenbergのセル編集・選択・保存DOMへ干渉しないか。
- SortableJS `forceFallback` 環境で、drag完了後のclick抑制をどのイベント境界で行うのが最も単純で安定するか。
- touch端末でToolbarを外付けkeyboardから起動した場合、touch mode開始だけでなくchapter 5のkeyboard focus入口として扱うためのactivation origin判定方法。
- `setAttributes()` 後にcontrollerが再生成されるタイミングで、pending focus requestを一度だけ確実に消費できるか。
- 行間targetをfixed overlayで配置した場合のscroll / resize追従と、Gutenberg toolbar / iframe clippingとの干渉。
- keyboard scroll追従を `scrollIntoView()` 中心で満たせるか、次の有効位置を見せるための追加 `scrollBy()` が必要か。
- row accessible nameに採用する代表的内容の長さ、空行fallback、重複行の区別が支援技術で実用的か。
- live statusの `role` / `aria-live` / `aria-atomic` の組み合わせと、重複抑制がChrome + 主要screen readerで過不足ないか。

検証で実装差が必要になっても、要件・基本設計で確定した利用者向け意味は変更しない。意味の変更が必要と判明した場合は実装側だけで調整せず、#189 / #213の正本へ戻して判断する。

## Issue breakdown

プランレビュー後、次の境界で子Issueへ分割する。各Issueは前段の公開境界を利用し、同じ機能を並行して重複実装しない。

- [ ] Phase 1: 共通の行移動・rowspan制約計算をアクセシビリティ操作向けに拡張する
- [ ] Phase 2: アクセシブルな行controlとToolbar focus入口を実装する
- [ ] Phase 3: キーボードによる行並べ替えを実装する
- [ ] Phase 4: PC / タッチのドラッグ不要な単一ポインター移動を実装する
- [ ] Phase 5: 操作案内・支援技術通知・focus / scroll対応を実装する
- [ ] Phase 6: iframe / non-iframeと既存DnDの回帰検証・文書更新を行う

依存順は Phase 1 → Phase 2 → Phase 3 / Phase 4 → Phase 5 → Phase 6 とする。Phase 3とPhase 4はPhase 1・2を共有するが、controllerの同じsession / UI境界を変更するため、同時並行ではなく順番に実装して競合を避ける。

## Validation

実装完了時は `docs/development/testing.md` を正本として、変更内容に応じた検証を行う。

### Automated

- `npm test`
  - format、JavaScript lint、CSS lint、typecheck、Jest unit testが成功する。
- `npm run build`
  - `editor.scss` を含むTable Reorder production assetが生成できる。
- `git diff --check origin/main...HEAD`
  - whitespace errorがない。
- focused Jest
  - `row-order.test.ts`: 共通移動可否、次の有効移動先、rowspan越え、no-op
  - `reorder-ui.test.ts`: control / target / accessible name / cleanup / live status
  - `sortable-controller.test.ts`: keyboard / pointer session、共通commit、drag-click抑制、focus request
  - `touch-press.test.ts`: row control tap除外と既存短tap / 長押し挙動
  - 既存 `table-context.test.ts` / `sortable-runtime.test.ts` / `drag-ui.test.ts` / `rowspan.test.ts` の回帰
- Playwright
  - PC Toolbar → keyboard row control → move → confirm / cancel
  - PC handle dragとhandle clickの共存
  - stableに自動化できる範囲のtouch mode / single-pointer経路
  - iframe環境を基準にし、non-iframeは対応するwp-dev環境でも確認する

### Manual acceptance

- PC hover-capable環境
  - Table選択だけでfocusが移らない。
  - Toolbarから現在行、fallbackで先頭移動可能行へfocusできる。
  - `Tab` / `Shift + Tab` が論理順で動き、端でTable Reorder外へ出られる。
  - keyboard開始 / 上下移動 / 確定 / cancelが仕様どおり。
  - handleをdragすれば既存DnD、clickすればsingle-pointer選択になる。
  - cell clickは従来どおり編集になる。
- Touch環境
  - reorder mode開始だけでは特定行を自動選択しない。
  - cell短tapは編集、row長押しはDnD、row control tapはsingle-pointer選択になる。
  - non-movable row長押しwarningが維持される。
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
- 新規責務が `reorder-ui.ts` と `editor.scss` に限定され、汎用基盤や入力方式別の重複ロジックを作らない。
- Gutenberg commitをまたぐfocus復元と、drag時には不要なfocus変更を行わない境界が明確である。
- PC drag / click、touch short tap / long press / control tapの競合を実装・検証する順序が明確である。
- unit test、Playwright、手動accessibility確認、iframe / non-iframe回帰の役割分担が明確である。
- 各実装Phaseを単独レビュー可能なIssueへ分割できる。

## Notes

- 旧dnd-kit版アクセシビリティplanは過去資料としてのみ扱う。Portal handle、旧mode、旧state構成を現行実装へ戻す根拠にはしない。
- `sortable-runtime.ts` と `table-context.ts` は現行のowning window / document境界がすでにiframe / non-iframe共通化の土台になっているため、アクセシビリティ専用のeditor mode分岐を上位へ増やさない。
- 現在の `drag-ui.ts` は多くのinline styleを持つが、本Issueを既存drag UI全体のstyle refactorへ広げない。新しく追加するpersistent accessibility UIだけを `editor.scss` へ置く。
- 実装中にcontrollerが過大化する兆候が出ても、先に汎用層を追加しない。keyboard / pointer sessionの純粋計算として独立できる責務が実際に生じた場合だけ、feature内のfocused moduleへ分離する。
