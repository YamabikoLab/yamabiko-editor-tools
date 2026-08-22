# PLAN-314: Table Reorder Jest テスト補強

## References

- Parent issue: #311
- Investigation issue: #314
- Implementation issue: #315
- Coverage baseline: #312
- Jest responsibility map: #313 / `docs/development/testing.md`

## Goal

#312 で確認した Jest coverage と #313 で整理した責務マップをもとに、#315 で追加する Jest テストの優先順位と実装順序を明確にする。

80% という数値だけを追わず、Table Reorder の重要なロジック、境界条件、状態遷移、入力方式ごとの条件分岐を優先する。実ブラウザ依存の統合動作は Jest に寄せず、Playwright E2E の責務として残す。

## Current baseline

#312 で確認した aggregate coverage は以下。

| Metric | Coverage |
| --- | ---: |
| Statements | 90.99% |
| Branches | 76.64% |
| Functions | 95.36% |
| Lines | 91.07% |

- Test Suites: 19 passed / 19 total
- Tests: 151 passed / 151 total
- 80% を下回っているのは Branches のみ。

#314 で `npm run test:unit:coverage` の file-level coverage と `Uncovered Line #s` を確認し、以下の実測結果を #315 の入力として確定した。

### File-level investigation result

| File | Branches | Uncovered Line #s | #315 での扱い |
| --- | ---: | --- | --- |
| `controller/sortable-controller.ts` | 72.03% | 多数。端末の coverage 表では先頭側が省略表示され、末尾側に `508,523,528,554,576,589-593,642,680,686,690-718,742,768,779-780,789,823-824,829` などを確認 | High |
| `controller/drag-ui.ts` | 62.50% | `48,52-53,94` | High |
| `use-table-reorder-controller.ts` | 76.66% | `77,83,88,95,122-123` | High |
| `controller/reorder-ui/row-move-targets.ts` | 73.07% | `95,102,112-114` | Medium |
| `controller/reorder-ui/row-controls.ts` | 75.71% | `76,137,226-228,233-235,249,265-266` | Medium |
| `controller/reorder-ui/reorder-guidance.ts` | 78.78% | `174,181,191,262,267,275-276` | Medium |
| `use-table-reorder.ts` | 50.00% | `93,99-103,119,123,131-132` | Medium |
| `with-table-reorder.tsx` | 36.00% | `49-63` | Medium |
| `use-table-reorder-interaction.ts` | 91.83% | `161` | Low / 必要時のみ |
| `rowspan.ts` | 95.23% | `92` | Low / 必要時のみ |
| `controller/sortable-runtime-loader.ts` | 80.00% | `83,94,119` | Low / 原則追加不要 |
| `controller/reorder-ui/live-status.ts` | 83.33% | `33` | Low / 原則追加不要 |
| `controller/row-order.ts` | 100.00% | なし | 追加不要 |

補足:

- `block-support.ts`、`messages.ts`、`table-context.ts` は Branches 100%。
- `controller/reorder-ui/index.ts` は coverage 表では 0% だが、既存 API を再公開するだけの facade であり、数値合わせのための Jest テストは追加しない。
- `row-order.ts` は全 metric 100% のため、#315 の追加候補から外す。
- `rowspan.ts` と `use-table-reorder-interaction.ts` は重要な責務だが、Branches はすでに 90% を超えているため、未実行行が重要な契約に関わる場合だけ扱う。
- `sortable-runtime-loader.ts` と `live-status.ts` は Branches 80% 以上のため、80% 到達を目的とした優先補強対象にはしない。

## Scope

### Included

- 実測で確認した不足分岐のうち、ユーザー操作結果やローカル contract に意味のある Jest テストの補強
- Controller の状態遷移、drag UI、Controller hook の失敗・cleanup 分岐
- jsdom で安定して確認できる Reorder UI の条件分岐
- WordPress / React 接着層のうち、モックで局所 contract を保証できる分岐
- Branches coverage 80% 到達に必要な範囲の補強

### Not included

- 実際の WordPress / Gutenberg 上での統合動作
- 実ブラウザでのマウス、タッチ、キーボード操作
- iframe / non-iframe のブラウザ統合確認
- 実 SortableJS を含む E2E シナリオ
- coverage 数値だけを上げるための低価値なテスト
- coverage threshold の設定
- `docs/development/testing.md` への一時的な優先順位の追記

## Priority map

### High: Controller の状態遷移と入力分岐

対象:

- `src/editor-extensions/table-reorder/controller/sortable-controller.ts`（Branches 72.03%）
- `src/editor-extensions/table-reorder/controller/sortable-controller.test.ts`
- `src/editor-extensions/table-reorder/controller/sortable-controller-keyboard.test.ts`
- `src/editor-extensions/table-reorder/controller/sortable-controller-pointer.test.ts`
- `src/editor-extensions/table-reorder/controller/sortable-controller-touch.test.ts`

理由:

- `sortable-controller.ts` は `idle` / `keyboard` / `pointer` / `dragging` の session state と Keyboard / Pointer / Touch / SortableJS callback を集約する中核で、実測でも Branches 72.03% と不足が大きい。
- commit / cancel / cleanup / focus 復元 / non-movable row / rowspan 制約など、ユーザー操作結果に直接影響する分岐を優先する。

#315 で優先するケース:

1. session を開始しない失敗分岐と valid target 不在時の no-op。
2. keyboard / pointer の commit、cancel、no-op、focus 復元。
3. SortableJS callback 間の snapshot 復元と cleanup。
4. 無効な index、rowspan で禁止された挿入位置、no-op move を commit しない分岐。
5. `destroy()` 時の各 session state の残存 UI / DOM cleanup。
6. coverage で確認した末尾側の未実行領域（690-718 など）は、上記 contract と対応するものからテストする。

### High: drag UI の防御分岐

対象:

- `src/editor-extensions/table-reorder/controller/drag-ui.ts`（Branches 62.50%）
- 対応する既存 Jest テスト

実測した未実行行:

- `48,52-53,94`

理由:

- Branches が 62.50% と主要ファイルの中でも低い。
- insertion line の active target 不在、対象 row が DOM から外れた場合、`defaultView` の有無、`tr` 以外への fallback width 処理など、DOM 単体で安定して確認できる防御分岐がある。
- 実ブラウザ上の最終レイアウト自体は E2E の責務とし、Jest では DOM contract だけを補強する。

### High: Controller hook の生成・破棄分岐

対象:

- `src/editor-extensions/table-reorder/use-table-reorder-controller.ts`（Branches 76.66%）
- 対応する既存 Jest テスト

実測した未実行行:

- `77,83,88,95,122-123`

#315 で優先するケース:

1. anchor 不在、runtime URL 不在、table context 解決失敗時に Controller を生成しない。
2. hover mode で fine pointer 条件を満たさない場合に生成しない。
3. microtask 実行前に cleanup された場合、生成済み Controller を即座に破棄する。
4. pending focus の復元成功・失敗で ref を正しく維持する。

### Medium: Reorder UI の実測不足分岐

対象:

- `controller/reorder-ui/row-move-targets.ts`（Branches 73.07%、`95,102,112-114`）
- `controller/reorder-ui/row-controls.ts`（Branches 75.71%、`76,137,226-228,233-235,249,265-266`）
- `controller/reorder-ui/reorder-guidance.ts`（Branches 78.78%、`174,181,191,262,267,275-276`）

理由:

- いずれも 80% 未満で、jsdom で安定して確認できる条件分岐が残っている。
- Controller の重要分岐を補強した後、Branches 80% に必要な分だけ扱う。
- viewport の見た目そのものやブラウザ layout engine に依存する保証は Jest に持ち込まない。

### Medium: WordPress / React 接着層

対象:

- `src/editor-extensions/table-reorder/use-table-reorder.ts`（Branches 50.00%、`93,99-103,119,123,131-132`）
- `src/editor-extensions/table-reorder/with-table-reorder.tsx`（Branches 36.00%、`49-63`）

理由:

- percentage は低いが、Gutenberg 内部実装まで Jest で再現することは目的にしない。
- enabled / selection / block support / body commit など、Yamabiko Table Reorder 側の局所 contract として意味のある分岐だけを補強する。
- 複雑な WordPress mock が必要になる分岐は、80% の数値合わせだけを理由に追加しない。

### Low: すでに十分な coverage の領域

原則として #315 の初期対象にしない。

- `use-table-reorder-interaction.ts`: Branches 91.83%、未実行 `161`
- `rowspan.ts`: Branches 95.23%、未実行 `92`
- `sortable-runtime-loader.ts`: Branches 80.00%、未実行 `83,94,119`
- `live-status.ts`: Branches 83.33%、未実行 `33`
- `row-order.ts`: Branches 100%、未実行なし

これらは High / Medium を補強した後も重要な未テスト contract が残ると判断した場合だけ追加する。

## Playwright E2E に任せる領域

以下は Jest で無理に再現しない。

1. WordPress / Gutenberg 実画面で row handle が正しい位置・タイミングで操作できること。
2. 実マウス DnD と SortableJS の統合動作。
3. 実タッチ操作での短押し / DnD とブラウザ pointer event の挙動。
4. 実キーボード操作のフォーカス順、スクロール、ツールバーとの連携。
5. iframe / non-iframe editor での一連の行移動。
6. ユーザー操作開始から Gutenberg attribute commit までの統合シナリオ。
7. CSS レイアウトやブラウザ viewport に依存する最終的な表示位置。

Jest 側ではこれらを支える純粋ロジック、Controller state、DOM 単体の contract までを保証する。

## Implementation order for #315

#314 で file-level investigation は完了しているため、#315 では調査工程から始めず、実測結果に沿ってテスト追加へ着手する。

### Phase 1: High priority の Controller / drag UI を補強する

Outcome:

- ユーザー操作結果に直結する中核分岐を先に補強する。

Tasks:

- `sortable-controller*.test.ts` へ session start / commit / cancel / invalid / cleanup の不足ケースを追加する。
- `drag-ui.ts` の DOM 単体で保証できる未実行分岐を補強する。
- `use-table-reorder-controller.ts` の生成中断・失敗・破棄・focus 復元分岐を補強する。

Validation:

- 対象 Jest テストを個別実行する。
- `npm run test:unit:coverage` で Branches の変化を確認する。

### Phase 2: Reorder UI を必要な分だけ補強する

Outcome:

- Branches 80% 未満の Reorder UI について、jsdom で安定して保証できる分岐を補強する。

Tasks:

- `row-move-targets.ts`、`row-controls.ts`、`reorder-guidance.ts` の実測 uncovered lines を対象にする。
- CSS の見た目や viewport の最終配置は Jest 対象にしない。

Validation:

- 対象 Jest テストを個別実行する。
- coverage を再実行する。

### Phase 3: WordPress / React 接着層を必要な分だけ補強する

Outcome:

- `use-table-reorder.ts` と `with-table-reorder.tsx` の局所 contract を保証する。

Tasks:

- coverage の低さだけを理由に Gutenberg 内部を過剰に mock しない。
- enabled / selection / block support / commit など、製品側の条件分岐を優先する。
- 実統合に依存するものは Playwright E2E に残す。

Validation:

- 対象 Jest テストと coverage を再実行する。

### Phase 4: 残る意味のある分岐を確認する

Outcome:

- High / Medium 完了後も Branches 80% に届かない場合だけ、残りを再評価する。

Tasks:

- `use-table-reorder-interaction.ts`、`rowspan.ts`、`sortable-runtime-loader.ts`、`live-status.ts` の未実行行を確認する。
- 重要な contract でなければ、数値合わせのためには追加しない。
- `reorder-ui/index.ts` の facade 再公開を coverage のためだけにテストしない。

### Phase 5: 80% 到達確認と過剰テストの回避

Outcome:

- Branches を含む全 coverage metric が 80% 以上であること、または未達理由が明確であることを確認する。

Tasks:

- `npm run test:unit:coverage` を実行する。
- 80% 到達後は数値をさらに上げる目的だけでテストを追加しない。
- uncovered branch が残っていても E2E 向き・防御的到達困難分岐・外部 API 実装詳細であれば、その理由を #315 に記録する。

## 80% に向けて優先して補強する範囲

実測結果を踏まえた優先順は以下。

1. `sortable-controller.ts` の重要な状態遷移・失敗分岐。
2. `drag-ui.ts` と `use-table-reorder-controller.ts` の DOM / lifecycle contract。
3. `row-move-targets.ts` / `row-controls.ts` / `reorder-guidance.ts` の安定して Jest で確認できる分岐。
4. `use-table-reorder.ts` / `with-table-reorder.tsx` の局所 contract。
5. すでに Branches 80% 以上のファイルは、重要な未テスト contract が残る場合のみ。

`row-order.ts` は 100%、`rowspan.ts` は 95.23%、`use-table-reorder-interaction.ts` は 91.83% のため、当初の候補から優先度を下げる。

## Intentionally not tested with Jest

- 実ブラウザの pointer / touch event 差異: jsdom では実ブラウザ保証にならないため。
- iframe / non-iframe の最終統合挙動: Jest は context 解決ロジックまで、統合は E2E とするため。
- SortableJS 本体の挙動: 外部ライブラリ自身を再テストしないため。
- CSS の見た目・viewport 上の最終配置: Jest では layout engine を保証できないため。
- Gutenberg 内部実装の詳細: Yamabiko Table Reorder 側の contract だけをテストするため。
- `reorder-ui/index.ts` の再公開 facade: 実装ロジックを持たず、数値合わせのテスト価値が低いため。
- 到達させるためだけに不自然な mock が必要な defensive branch: 数値合わせを避けるため。

## Validation

#315 の実装完了時に以下を実施する。

```bash
npm run test:unit:coverage
npm test
git diff --check origin/main...HEAD
```

期待結果:

- 追加した Jest テストがすべて成功する。
- Branches を含む coverage が原則 80% 以上になる。
- 80% 未達の場合は、残る uncovered branch と Jest で補強しない理由が説明されている。
- Playwright E2E の責務を Jest の複雑な mock で代替していない。

## Completion criteria

- #314 で file-level Branches と `Uncovered Line #s` の実測確認が完了している。
- 実測結果から #315 の High / Medium / Low / E2E が分類されている。
- `row-order.ts` など既に十分に coverage されている領域が優先候補から除外されている。
- Jest と Playwright E2E の責務境界が維持されている。
- #315 は調査ではなく、Phase 1 のテスト補強からそのまま着手できる。
- Branches 80% に向けて優先する範囲と、あえて Jest 対象にしない領域が明文化されている。
- `docs/development/testing.md` に一時的な優先順位を追加していない。

## Notes

- #312 の aggregate coverage と #314 で確認した file-level coverage を #315 の開始 baseline とする。
- #315 の実装中はテスト追加後に coverage を再実行して変化を確認するが、未テスト領域の特定そのものを #315 に先送りしない。
- #316 の coverage threshold 設定は #315 完了後に扱う。
