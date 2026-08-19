# PLAN-227: Table Reorder PC行hoverハンドル表示

## References

- Parent issue: #227
- Requirements: `docs/requirements/table-reorder/table-reorder-requirements.md`
- Current implementation: `src/editor-extensions/table-reorder/controller/sortable-controller.ts`
- Current UI helper: `src/editor-extensions/table-reorder/controller/drag-ui.ts`

## Goal

PCのTable Reorderで、行左端の限定された操作領域ではなく、移動可能な行全体へのhoverをハンドル表示の検知条件にする。

行全体はハンドルを表示するための検知領域に限定し、ドラッグ開始領域にはしない。セルクリックによる通常編集と、ハンドルから開始する既存SortableJS DnDの役割を維持する。

## Scope

### Included

- PCのhover検知対象をハンドル領域から移動可能な`tr`へ変更する。
- hoverした行に対応する左端ハンドルだけを表示する。
- 行からpointerが離れたら、ドラッグ中を除いてハンドルを非表示にする。
- SortableJSの`handle`指定は既存のハンドル操作領域のまま維持する。
- 複数行にまたがる結合セルの範囲内など、既存の移動不能行にはハンドルを表示しない。
- iframe / non-iframeで同じowning document上の行イベントを利用する。
- hover表示条件を単体テストで確認する。
- 要件定義書と実装概要を新しい表示条件へ合わせる。

### Not included

- 行全体からのドラッグ開始。
- セルクリックからの単一ポインター並べ替え開始。
- タッチ端末の操作変更。
- コーチマークや操作案内メッセージの実装。
- アクセシビリティ基本設計書の変更。

## Implementation

1. `createHoverHandles()`が生成する各ハンドルと、その所属`tr`をcontroller側で対応付ける。
2. `pointerenter` / `pointerleave`はハンドル操作領域ではなく、対応する`tr`へ登録する。
3. `pointerdown`は従来どおりハンドル操作領域で扱い、行hoverだけでドラッグ開始状態へ入らないようにする。
4. SortableJSの`handle`は`.yamabiko-table-reorder-handle-zone`のまま維持する。
5. drag終了後のhover復元判定も、ハンドル操作領域ではなく所属行の`:hover`を確認する。
6. cleanupでは行に追加したhover listenerと、ハンドル操作領域のpointer listenerをそれぞれ解除する。

## Validation

ユーザーによる実ブラウザー検証を前提とする。

単体テストでは少なくとも次を確認する。

- 行のセル上へmouse pointerが入ると、その行のハンドルが表示される。
- 行からpointerが離れるとハンドルが非表示になる。
- SortableJSの`handle`指定がハンドル操作領域のままであり、行全体がドラッグ開始領域になっていない。

手動確認では次を確認する。

- PCで行のどこへhoverしても左端ハンドルが表示される。
- セルをクリックすると従来どおりセル編集できる。
- ハンドルをドラッグすると既存DnDが開始する。
- 移動不能行ではハンドルが表示されない。
- iframe / non-iframeで同じ意味の動作になる。

## Completion criteria

- PCのハンドル表示条件が行全体hoverになっている。
- 行全体はドラッグ開始領域になっていない。
- セル編集と既存ハンドルDnDを維持している。
- iframe / non-iframeで同じ実装境界を利用している。
- 要件・実装計画・実装概要・実装が#227と整合している。
