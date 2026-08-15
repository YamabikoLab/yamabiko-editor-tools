# PLAN-269: Table Reorder ReorderSession 導入

## References

- Parent issue: #269
- Current implementation: `src/editor-extensions/table-reorder/controller/sortable-controller.ts`
- Related tests:
  - `src/editor-extensions/table-reorder/controller/sortable-controller.test.ts`
  - `src/editor-extensions/table-reorder/controller/sortable-controller-keyboard.test.ts`
  - `src/editor-extensions/table-reorder/controller/sortable-controller-pointer.test.ts`

## Goal

`sortable-controller.ts` が個別の可変変数の組み合わせで表現している排他的な並べ替え操作状態を、`ReorderSession` へ集約する。

あわせて、SortableJS の drag 中だけ利用する `dragRows` / `draggedRowLabel` を `DragSnapshot` としてまとめ、操作状態と drag 一時データを分離する。

UI仕様や操作仕様は変更せず、既存挙動を回帰テストで固定した上で状態表現だけを段階的に置き換える。

## Scope

### Included

- `keyboardSession` / `keyboardGuidance` / `singlePointerSession` / `isDragging` を `ReorderSession` へ統合する。
- `dragRows` / `draggedRowLabel` を `DragSnapshot | null` へ統合する。
- `session.kind` を基準に、各イベントハンドラと SortableJS callback の排他条件を整理する。
- `keyboard` 中の SortableJS drag 開始を拒否し、`onChoose` から `onEnd` まで拒否された lifecycle 全体で keyboard UI / guidance / focus / `aria-pressed` を維持する。
- `pointer -> dragging` では pointer UI を cleanup してから `dragging` へ遷移する。
- `onEnd` / controller cleanup / `destroy()` で session と drag snapshot を一貫して破棄する。
- 既存挙動を固定する回帰テストを追加する。

### Not included

- `sortable-controller.ts` の入力方式ごとのファイル分割。
- controller のクラス化。
- UI仕様の変更。
- keyboard / pointer / drag の操作仕様変更。
- SortableJS の置き換え。
- `activeEntry`、`touchModeGuidance`、`lastActiveRowIndex`、`blockDragSuppressed`、`originalDraggable`、`suppressPointerClickUntil`、`restoreFallbackCellWidths` の `ReorderSession` への統合。

## Current state mapping

現行の排他的状態と主な参照箇所を次のように整理する。

| 現行state | 主な参照箇所 | 移行先 |
| --- | --- | --- |
| `keyboardSession` | `deactivateEntry`、`startSinglePointerSession`、`onRowPointerEnter`、`onControlPointerDown`、`onControlClick`、`onControlBlur`、`onControlKeyDown`、`destroy()` | `session.kind === 'keyboard'` |
| `keyboardGuidance` | `finishKeyboardSession`、keyboard開始、`destroy()` | `session.kind === 'keyboard'` の `guidance` |
| `singlePointerSession` | `deactivateEntry`、`startSinglePointerSession`、`onRowPointerEnter`、`onControlPointerDown`、`onControlClick`、`onControlKeyDown`、`onDocumentKeyDown`、SortableJS `onStart`、`destroy()` | `session.kind === 'pointer'` |
| `isDragging` | `deactivateEntry`、`releaseEntry`、`startSinglePointerSession`、`onRowPointerEnter`、`onControlClick`、`onControlKeyDown`、SortableJS `onStart` / `onEnd` | `session.kind === 'dragging'` |
| `dragRows` | `restoreDragRows`、SortableJS `onChoose` / `onMove` / `onEnd`、`destroy()` | `dragSnapshot.rows` |
| `draggedRowLabel` | SortableJS `onChoose` / `onEnd` | `dragSnapshot.rowLabel` |

## Target state model

`sortable-controller.ts` 内に次の型を導入する。

```ts
type ReorderSession =
	| { kind: 'idle' }
	| {
			kind: 'keyboard';
			entry: RowControlEntry;
			oldIndex: number;
			currentIndex: number;
			rowLabel: string;
			lastBoundaryDirection: RowMoveDirection | null;
			guidance: ReorderGuidanceUi;
	  }
	| {
			kind: 'pointer';
			entry: RowControlEntry;
			oldIndex: number;
			rowLabel: string;
			targetsUi: RowMoveTargetsUi;
	  }
	| { kind: 'dragging' };

type DragSnapshot = {
	rows: HTMLTableRowElement[];
	rowLabel: string;
};
```

初期値は次の2変数とする。

```ts
let session: ReorderSession = { kind: 'idle' };
let dragSnapshot: DragSnapshot | null = null;
```

## Transition plan

状態遷移は helper を過剰に抽象化せず、既存の開始・終了関数を段階的に session ベースへ置き換える。

### 1. keyboard session

- `showKeyboardCandidate()` の引数を `KeyboardSession` から `Extract<ReorderSession, { kind: 'keyboard' }>` 相当へ変更する。
- `finishKeyboardSession()` は `session.kind !== 'keyboard'` なら何もしない。
- cleanup 対象を `session.guidance`、`session.entry`、insertion line に集約する。
- commit / cancel 判定完了後に `session = { kind: 'idle' }` とする。
- `onControlBlur`、`onControlKeyDown` は `session.kind` と `session.entry` を基準に判定する。
- ArrowUp / ArrowDown の更新は keyboard session の `currentIndex` / `lastBoundaryDirection` を更新する。

### 2. pointer session

- `startSinglePointerSession()` は `session.kind === 'idle'` のときだけ開始する。
- `finishSinglePointerSession()` は `session.kind !== 'pointer'` なら何もしない。
- `targetsUi.cleanup()`、`entry.setPressed(false)`、focus復帰を pointer session のデータから行う。
- `onControlClick` は `session.kind` で keyboard / dragging を拒否し、pointer 中は同じ control の再clickを維持する。
- `onDocumentKeyDown` は hover mode かつ `session.kind === 'pointer'` のときだけ Escape cancel する。

### 3. dragging session と拒否された SortableJS lifecycle

`keyboard` 中に SortableJS callback まで到達した場合は、`onStart` 単体ではなく `onChoose -> onStart -> onMove / onUnchoose -> onEnd` 全体を「拒否された drag lifecycle」として扱う。

- `onChoose`
  - `session.kind === 'keyboard'` の場合は keyboard insertion line を消さず、guidance / `aria-pressed` / focus に触れない。
  - DOM復元や fallback cleanup に必要な `DragSnapshot` / fallback 情報の準備は許可するが、keyboard UI を drag UI へ切り替えない。
  - 通常の drag 候補では、現行どおり snapshot 取得と fallback width 設定を行う。
- `onStart`
  - `session.kind === 'keyboard'` の場合は `dragging` へ遷移せず、keyboard session をそのまま維持する。
  - keyboard guidance を cleanup しない。
  - `aria-pressed` を解除しない。
  - focusを移動しない。
  - `session.kind === 'pointer'` の場合は、pointer UIを announcement なしで cleanup した後に `dragging` へ遷移する。
  - `session.kind === 'idle'` の場合はそのまま `dragging` へ遷移する。
  - `session.kind === 'dragging'` の再入は状態を変えない。
- `onMove`
  - `session.kind !== 'dragging'` なら drag 用 insertion line を更新せず、移動を拒否する。
  - `session.kind === 'dragging'` の場合だけ `dragSnapshot?.rows` を使って現行の drag UI を更新する。
- `onUnchoose`
  - fallback width / click suppression など drag 固有の fallback cleanup は行う。
  - `session.kind === 'keyboard'` の場合は keyboard guidance / `aria-pressed` / focus を変更しない。
  - keyboard insertion line が SortableJS 側の副作用で変化した可能性がある場合は、`session.currentIndex` を基準に `showKeyboardCandidate()` 相当で復元する。
- `onEnd`
  - commit と `session = { kind: 'idle' }` は、実際に `session.kind === 'dragging'` へ遷移していた場合だけ行う。
  - `session.kind === 'keyboard'` のまま到達した場合は `onCommit` を呼ばず、DOM / fallback / `DragSnapshot` の drag 一時状態だけを cleanup する。
  - keyboard session・guidance・`aria-pressed`・focus は維持し、keyboard insertion line は `session.currentIndex` を基準に維持または復元する。
  - drag終了後の hover 復元 / block drag 復元は現行挙動を維持する。

この分岐により、keyboard 中に drag callback が境界的に発火しても、拒否した drag が keyboard session を終了したり commit したりしないことを保証する。

### 4. hover / active entry

- `deactivateEntry()` の維持条件を、`session.kind` と session の `entry` から判定する。
  - `dragging` 中は active entry を維持する。
  - `keyboard` / `pointer` 中は同じ entry の active state を維持する。
- `onRowPointerEnter()` は `session.kind === 'idle'` のときだけ hover activation を許可する。
- `releaseEntry()` から `isDragging = false` の責務を外し、entry / block drag cleanupだけを担当させる。

### 5. DragSnapshot

- `onChoose` で `dragSnapshot = { rows, rowLabel }` を作成する。
- `onMove` は `session.kind === 'dragging'` の場合だけ `dragSnapshot?.rows` を参照する。
- DOM復元 helper は `dragSnapshot?.rows` を使い、snapshot 自体は勝手に破棄しない。
- 通常の drag `onEnd` の commit announcement は `dragSnapshot?.rowLabel` を利用し、処理終了時に `dragSnapshot = null` とする。
- 拒否された keyboard 中の drag lifecycle でも、`onEnd` / `destroy()` では DOM復元後に `dragSnapshot = null` とする。
- `onUnchoose` は insertion line / fallback width / click suppression の fallback cleanup を担当するが、通常 drag の `dragSnapshot` は保持する。
- `destroy()` では DOM復元後に `dragSnapshot = null` とする。

## Boundary cases and tests

Issue #269 の優先8ケースを、現行のテスト構成へ次のように割り当てる。

| ケース | 現行状態 | 期待する遷移 / 維持 | 主な変更箇所 | テスト候補 |
| --- | --- | --- | --- | --- |
| keyboard 中にpointer開始を無視 | keyboard | keyboard維持 | `onControlPointerDown` / `onControlClick` / `startSinglePointerSession` | `sortable-controller-keyboard.test.ts` |
| pointer 中にkeyboard開始を無視 | pointer | pointer維持 | `onControlKeyDown` | `sortable-controller-pointer.test.ts` |
| dragging 中にkeyboard開始を無視 | dragging | dragging維持 | `onControlKeyDown` | `sortable-controller.test.ts` |
| dragging 中にpointer開始を無視 | dragging | dragging維持 | `onControlClick` / `startSinglePointerSession` | `sortable-controller-pointer.test.ts` |
| keyboard 中にdrag lifecycleが到達してもkeyboardを維持 | keyboard | keyboard維持・commitなし | SortableJS `onChoose` / `onStart` / `onMove` / `onUnchoose` / `onEnd` | `sortable-controller-keyboard.test.ts` |
| pointer -> dragging でpointer UI cleanup | pointer | dragging | SortableJS `onStart` / pointer cleanup | `sortable-controller-pointer.test.ts` |
| drag終了後にkeyboard / pointerを再開できる | dragging -> idle | idleから新session開始可 | SortableJS `onEnd` | `sortable-controller.test.ts` または各責務別test |
| onChoose 後のdestroyでdrag一時状態をcleanup | idle + snapshot | destroyed | `onChoose` / `destroy()` | `sortable-controller.test.ts` |

### Test observations

内部 `session` はテスト用に公開しない。

外部から次の挙動を観測して状態遷移を固定する。

- `aria-pressed`
- keyboard guidance の存在
- destination UI の存在
- focus位置
- insertion line / DOM順序の復元
- `onCommit` の呼び出し有無と引数
- block `draggable` の復元
- drag終了後に別操作を開始できること

SortableJS callback の境界ケースでは、既存テストの runtime options capture helper を必要最小限拡張し、`onChoose` / `onStart` / `onMove` / `onUnchoose` / `onEnd` を直接呼び出して検証する。

優先ケース #5 は `onStart` だけで終わらせず、可能な範囲で `onChoose -> onStart -> onMove -> onUnchoose -> onEnd` 相当まで通す。少なくとも次を固定する。

- `onCommit` が呼ばれない。
- keyboard guidance / `aria-pressed` / focus が維持される。
- keyboard insertion line が維持または復元される。
- lifecycle 終了後も ArrowUp / ArrowDown と Enter / Space / Escape による keyboard 操作を継続できる。

## Implementation order

実装は次の checkpoint ごとに区切る。検証自体はユーザーが行い、各 Green 確認後に次の段階へ進む前提とする。

1. 現行の controller 関連テストを確認する。
2. **Checkpoint: 現行テストが Green であることをユーザーが確認する。**
3. Issue #269 の8ケースを現行実装のまま追加する。
   - 優先ケース #5 は、拒否された SortableJS lifecycle 全体を可能な範囲で通す。
4. **Checkpoint: 8ケースを含む controller 関連テストが Green であることをユーザーが確認する。**
5. `ReorderSession` 型と `session = { kind: 'idle' }` を導入する。
6. keyboard session の開始・移動・commit・cancel・blur・destroy を `session.kind === 'keyboard'` ベースへ移行する。
7. pointer session の開始・commit・cancel・Escape・destroy を `session.kind === 'pointer'` ベースへ移行する。
8. hover / active entry / input handler の排他条件を `session.kind` へ置き換える。
9. SortableJS `onChoose` / `onStart` / `onMove` / `onUnchoose` / `onEnd` を `idle | pointer | keyboard | dragging` の遷移規則と、拒否された keyboard drag lifecycle の規則へ合わせる。
10. 旧 `keyboardSession` / `keyboardGuidance` / `singlePointerSession` / `isDragging` を削除する。
11. **Checkpoint: `ReorderSession` 移行後に全テストと typecheck が Green であることをユーザーが確認する。**
12. `DragSnapshot` を導入し、`dragRows` / `draggedRowLabel` を置き換える。
13. `onUnchoose` と `onEnd` / `destroy()` の snapshot cleanup 責務を整理する。
14. **Checkpoint: `DragSnapshot` 移行後に再度、全テストと typecheck が Green であることをユーザーが確認する。**
15. 最後に重複した `session.kind` 条件や cleanup を必要最小限だけ整理する。

## Validation

本PRでは実装プランのみを追加し、実装・テスト実行は行わない。

実装PRではユーザーによる段階的な検証を前提とし、少なくとも次を確認する。

- controller 関連の既存 Jest テストが通る。
- Issue #269 の優先8ケースが追加され、すべて通る。
- `ReorderSession` 移行後に全テストと typecheck が通る。
- `DragSnapshot` 移行後に再度、全テストと typecheck が通る。
- keyboard / pointer / drag の既存UI仕様が変わっていない。
- keyboard 中に SortableJS `onChoose -> onStart -> onMove / onUnchoose -> onEnd` 相当が到達しても、`onCommit` が呼ばれず keyboard guidance / `aria-pressed` / focus / insertion line が維持または復元される。
- 拒否された drag lifecycle の終了後も keyboard 操作をそのまま継続できる。
- drag終了後に keyboard / pointer の両方を再開できる。
- destroy 後に destination UI、guidance、fallback DOM、drag snapshot 相当の一時状態が残らない。

## Completion criteria

- `ReorderSession` の移行対象、順序、変更関数が明確になっている。
- `DragSnapshot` の生成・参照・破棄責務が明確になっている。
- Issue #269 の8つの優先回帰ケースが既存テストファイルへ対応付けられている。
- `keyboard` 中の SortableJS drag 開始拒否が、`onStart` 単体ではなく拒否された callback lifecycle 全体の実装手順とテストで明示されている。
- 8ケース追加後、`ReorderSession` 導入後、`DragSnapshot` 導入後の Green 確認 checkpoint が Implementation order に明示されている。
- controller の大規模分割や新規抽象化を前提にせず、段階的なリファクタリングとして実装できる。
