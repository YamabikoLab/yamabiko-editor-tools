# PLAN-95: Table Reorder の行押し退けアニメーション

## References

- Parent issue: https://github.com/YamabikoLab/yamabiko-editor-tools/issues/95
- Existing implementation: `src/editor-extensions/table-reorder/`
- Related stabilization: https://github.com/YamabikoLab/yamabiko-editor-tools/pull/91

## Goal

青い挿入線と現在の安定したドラッグ判定を維持したまま、ドラッグ元と
挿入位置の間にある行だけを視覚的に押し退ける。

## Scope

### Included

- 論理座標からドラッグ候補と行の表示オフセットを導く小さな純粋モジュール。
- 実際の `tr` 順序を変えない CSS transform による押し退け表示。
- ドロップ、キャンセル、モード終了および unmount 時の表示状態の解除。
- reduced motion 時に transition を無効化するスタイル。
- 高さの異なる行と候補位置を検証する focused unit test。

### Not included

- dnd-kit の Optimistic Sorting の再有効化。
- ドロップ確定、Undo、rowspan 制約またはキーボード DnD の仕様変更。

## Approach

ドラッグ中に transform 済みの `getBoundingClientRect()` を候補判定へ渡さない。
表示オフセットを差し引いた論理行座標を更新し、最後のポインター座標と
その座標だけで挿入候補を決定する。候補が有効なときだけ、移動元の高さを
移動方向の中間行へ反対向きに適用する。

## Architecture

- `push-aside.ts` はポインター位置からの候補算出と行 ID ごとの表示オフセットを所有する。
- `table-reorder-controller.tsx` は論理座標、ドラッグセッション、DOM class/style の適用と解除を所有する。
- `content.scss` は押し退けとドラッグ元の視覚状態、reduced motion を所有する。

## Implementation phases

### Phase 1: 表示計算を分離する

- Outcome: 挿入候補と押し退け量を DOM 非依存で算出できる。
- Tasks: 純粋モジュールと focused test を追加する。
- Validation: `npm run test:unit`。

### Phase 2: コントローラーとスタイルへ統合する

- Outcome: DOM 順序を維持した行押し退けと確実な後始末が機能する。
- Tasks: 論理座標による候補判定、class/style の適用・解除、reduced motion を実装する。
- Validation: TypeScript、lint、build と WordPress 上の手動確認。

## Decisions and validation questions

### Decide before implementation

- dnd-kit が返す transform 後の衝突候補は確定判定へ使わず、論理座標から候補を決める。
- 押し退け量は常にドラッグ元の行高とする。

### Validate during implementation

- スクロール後も論理座標、挿入線、押し退け量が同じ候補を示す。
- `rowspan` の禁止候補では押し退けを表示しない。

## Issue breakdown

- [x] Single implementation unit; no child issues required.

## Validation

- `npm run format:check`
- `npm run lint:js`
- `npm run lint:css`
- `npm run typecheck`
- `npm run test:unit`
- `npm run build`
- `git diff --check origin/main...HEAD`
- WordPress editor manual checks for iframe and non-iframe mode.

## Completion criteria

- 挿入線と押し退け表示が同じ論理挿入位置を示す。
- ドラッグ中に実際の `tr` DOM 順序を変更しない。
- すべての終了経路で追加した class と custom property が残らない。
- reduced motion では transition が無効になる。

## Notes

ブラウザーの Table レイアウト、pointer 座標および iframe は JSDOM で完全には再現できないため、
自動検証に加えて WordPress editor 上の手動確認が必要である。
