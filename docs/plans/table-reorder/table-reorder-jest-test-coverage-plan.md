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

#312 で確認した現状値は以下。

| Metric | Coverage |
| --- | ---: |
| Statements | 90.99% |
| Branches | 76.64% |
| Functions | 95.36% |
| Lines | 91.07% |

- Test Suites: 19 passed / 19 total
- Tests: 151 passed / 151 total
- 80% を下回っているのは Branches のみ。
- #315 では `npm run test:unit:coverage` を再実行し、ファイル別 Branches と `Uncovered Line #s` を確認して、このプランの候補と照合する。

## Scope

### Included

- 既存 Jest テストの不足分岐の補強
- 純粋ロジック、境界条件、Controller の状態遷移の追加テスト
- Keyboard / Pointer / Touch の重要な分岐の追加テスト
- jsdom で安定して確認できる UI 制御の追加テスト
- WordPress API / SortableJS をモックして確認できる接着処理の追加テスト
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

- `src/editor-extensions/table-reorder/controller/sortable-controller.ts`
- `src/editor-extensions/table-reorder/controller/sortable-controller.test.ts`
- `src/editor-extensions/table-reorder/controller/sortable-controller-keyboard.test.ts`
- `src/editor-extensions/table-reorder/controller/sortable-controller-pointer.test.ts`
- `src/editor-extensions/table-reorder/controller/sortable-controller-touch.test.ts`

理由:

- `sortable-controller.ts` は `idle` / `keyboard` / `pointer` / `dragging` の排他的な session state と、Keyboard / Pointer / Touch / SortableJS callback を集約している。
- commit / cancel / cleanup / focus 復元 / non-movable row / rowspan 制約など、ユーザー操作結果に直結する分岐が多い。
- 特に touch 専用テストは現在、共有 row control を DnD handle として使う設定確認が中心で、touch mode 内の Controller 分岐は他の controller テストとの重複を確認しながら補強余地を精査する必要がある。

#315 で確認する主なケース:

1. `rows` がない、source row が見つからない、non-movable row などで session を開始しない分岐。
2. valid target がない場合に pointer session を開始しない分岐。
3. keyboard session の commit / cancel / no-op と focus 復元。
4. keyboard の先頭・末尾到達時、同じ境界方向を繰り返した場合の announcement 制御。
5. pointer target 選択の commit / cancel と target cleanup。
6. drag の `onChoose` / `onStart` / `onMove` / `onEnd` / `onUnchoose` 間の snapshot 復元と cleanup。
7. 無効な SortableJS index、rowspan で禁止された挿入位置、no-op move を commit しない分岐。
8. `destroy()` が keyboard / pointer / dragging / idle の各状態で残存 UI・DOM 状態を片付ける分岐。
9. hover / touch での row control 可視状態と block drag suppression の復元。

### High: 行移動の純粋ロジックと rowspan 制約

対象:

- `src/editor-extensions/table-reorder/controller/row-order.ts`
- `src/editor-extensions/table-reorder/controller/row-order.test.ts`
- `src/editor-extensions/table-reorder/rowspan.ts`
- `src/editor-extensions/table-reorder/rowspan.test.ts`

理由:

- 行移動可否を決める中核ルールであり、Jest で高速かつ決定的に検証できる。
- 既存テストは充実しているため、coverage レポートで未実行分岐が残っている場合だけ追加する。数値合わせのために網羅済みケースを細分化しない。

#315 で優先して確認する候補:

1. `isRowMoveAllowed()` の `rowCount < 1` を含む invalid constraints。
2. `getNextValidRowMoveIndex()` の invalid `currentIndex`（非整数、負数、範囲外）。
3. `getValidRowMoveTargets()` の invalid `rowCount` / invalid `oldIndex`。
4. `getRowspanRanges()` で row 自体が object でない場合、cells 配列内に object でない値が混在する場合。
5. Table 末尾で実質 1 行しか占有しない rowspan が range として残らない分岐。

これらが既に coverage 済みであれば追加しない。

### High: React interaction hook の状態分岐

対象:

- `src/editor-extensions/table-reorder/use-table-reorder-interaction.ts`
- `src/editor-extensions/table-reorder/use-table-reorder-interaction.test.ts`

理由:

- hover capability、入力方式、selection、touch mode、coachmark preference の組み合わせが UI の入口を決める。
- jsdom とモックで安定して確認でき、Branches coverage の改善にも直結しやすい。

#315 で確認する主なケース:

1. `enabled: false` では media/event listener を有効化せず interaction mode を開始しない。
2. `Alt` / `Control` / `Meta` / `Shift` のみでは keyboard modality に切り替えない。
3. Table context を解決できない場合でも root document の listener が成立する。
4. root document と iframe document の両方へ listener を登録し、cleanup で双方から解除する。
5. handle 以外への `focusin` では keyboard coachmark を dismiss しない。
6. coachmark が一度も visible になっていない段階では handle focus だけで永続 dismiss しない。
7. `dismissTouchCoachmark()` が local state と preference の双方を更新する。
8. `enabled` / `isSelected` / persisted preference の変更で keyboard trigger を解除する。

### Medium: Reorder UI の条件分岐

対象:

- `src/editor-extensions/table-reorder/controller/reorder-ui/reorder-guidance.ts`
- `src/editor-extensions/table-reorder/controller/reorder-ui/row-controls.ts`
- `src/editor-extensions/table-reorder/controller/reorder-ui/row-move-targets.ts`
- `src/editor-extensions/table-reorder/controller/reorder-ui/live-status.ts`
- 各対応 `*.test.ts`

理由:

- jsdom で確認できるが、ユーザー操作の本質は Controller 側にあるため High の完了後に扱う。
- 表示位置や pointer event の細かな分岐は、実ブラウザ依存になっていないものだけ Jest で補強する。

#315 で確認する候補:

- guidance の show / hide / cleanup と touch direction による位置切替。
- row controls の focus / hover / non-movable row による表示状態。
- move target の先頭 / 末尾 / 中間挿入位置と cleanup。
- live region の再利用・更新など、DOM 単体で保証できる条件。

### Medium: WordPress / React 接着層

対象:

- `src/editor-extensions/table-reorder/use-table-reorder.ts`
- `src/editor-extensions/table-reorder/use-table-reorder.test.ts`
- `src/editor-extensions/table-reorder/with-table-reorder.tsx`
- `src/editor-extensions/table-reorder/with-table-reorder.test.tsx`
- `src/editor-extensions/table-reorder/flexible-table-block.tsx`
- `src/editor-extensions/table-reorder/flexible-table-block.test.tsx`
- `src/editor-extensions/table-reorder/controller/sortable-runtime-loader.ts`
- `src/editor-extensions/table-reorder/controller/sortable-runtime-loader.test.ts`

理由:

- モックで安定して確認できる局所的な分岐は Jest の責務。
- Gutenberg や実 SortableJS の統合成立そのものは Playwright E2E に任せる。

追加対象は coverage レポートに未実行分岐があり、その分岐がローカル contract として意味を持つ場合に限定する。

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

### Phase 1: coverage レポートを確定する

Outcome:

- #315 着手時点の file-level coverage と `Uncovered Line #s` を取得し、このプランの候補を実データに絞る。

Tasks:

- `npm run test:unit:coverage` を実行する。
- Branches 80% 未満、または重要ロジックに uncovered branch があるファイルを抽出する。
- 上記 Priority map と照合し、低価値な分岐は対象から外す。

Validation:

- 追加前の baseline を記録する。

### Phase 2: High priority の純粋ロジックと Controller を補強する

Outcome:

- 行移動可否と Controller の重要な状態遷移に意味のある未テスト分岐が残らない状態に近づける。

Tasks:

- `row-order.test.ts` / `rowspan.test.ts` は uncovered branch があるケースだけ追加する。
- `sortable-controller*.test.ts` へ session start / commit / cancel / invalid / cleanup の不足ケースを追加する。
- 1 テストで複数の無関係な分岐をまとめず、失敗理由が分かる粒度にする。

Validation:

- 対象 Jest テストを個別実行する。
- `npm run test:unit:coverage` で Branches の変化を確認する。

### Phase 3: interaction hook を補強する

Outcome:

- hover / input modality / coachmark / touch mode の重要な条件分岐を Jest で保証する。

Tasks:

- `use-table-reorder-interaction.test.ts` に不足ケースを追加する。
- listener 登録・解除、modifier key、dismiss persistence、disabled state を coverage レポートに沿って優先する。

Validation:

- 対象 Jest テストを個別実行する。
- coverage レポートで該当 branch の解消を確認する。

### Phase 4: Medium priority を必要な分だけ補強する

Outcome:

- Branches 80% に届かない場合、または意味のある UI / 接着分岐が残る場合だけ補強する。

Tasks:

- Reorder UI と WordPress / React 接着層の uncovered branch を確認する。
- jsdom / mock で安定して contract を保証できる分岐のみ追加する。
- 実ブラウザ依存なら Jest 追加をやめ、Playwright E2E 対象として記録する。

Validation:

- 対象テストと coverage を再実行する。

### Phase 5: 80% 到達確認と過剰テストの回避

Outcome:

- Branches を含む全 coverage metric が 80% 以上であること、または未達理由が明確であることを確認する。

Tasks:

- `npm run test:unit:coverage` を実行する。
- 80% 到達後は数値をさらに上げる目的だけでテストを追加しない。
- uncovered branch が残っていても E2E 向き・防御的到達困難分岐・外部 API 実装詳細であれば、その理由を #315 に記録する。

## 80% に向けて優先して補強する範囲

優先順は以下。

1. `sortable-controller.ts` の重要な状態遷移・失敗分岐。
2. `use-table-reorder-interaction.ts` の入力方式・coachmark・touch mode 分岐。
3. `row-order.ts` / `rowspan.ts` の未実行境界条件が実際に残っている場合。
4. Reorder UI の jsdom で安定して確認できる条件分岐。
5. WordPress / React 接着層の局所 contract。

80% 到達前でも、低価値な defensive branch を埋めるために複雑な mock を増やすより、重要な Controller / interaction 分岐を優先する。

## Intentionally not tested with Jest

- 実ブラウザの pointer / touch event 差異: jsdom では実ブラウザ保証にならないため。
- iframe / non-iframe の最終統合挙動: Jest は context 解決ロジックまで、統合は E2E とするため。
- SortableJS 本体の挙動: 外部ライブラリ自身を再テストしないため。
- CSS の見た目・viewport 上の最終配置: Jest では layout engine を保証できないため。
- Gutenberg 内部実装の詳細: Yamabiko Editor Tools 側の contract だけをテストするため。
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

- #315 で追加するテスト候補が High / Medium / E2E に分類されている。
- High priority の対象ファイル、主要な未テスト分岐、優先理由が明確である。
- Jest と Playwright E2E の責務境界が維持されている。
- #315 の実装順序が Phase 1 から Phase 5 まで明確である。
- Branches 80% に向けて優先する範囲と、あえて Jest 対象にしない領域が明文化されている。
- `docs/development/testing.md` に一時的な優先順位を追加していない。

## Notes

- #312 の aggregate coverage は調査時点の baseline として扱う。#315 着手時には main の最新状態で coverage を再取得する。
- 実際の file-level percentage と `Uncovered Line #s` を最終的なテスト追加判断の根拠とし、このプランに列挙した候補を機械的にすべて実装しない。
- #316 の coverage threshold 設定は #315 完了後に扱う。