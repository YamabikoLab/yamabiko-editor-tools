# PLAN-259: Table Reorder E2E 結合セル制約

## References

- Parent issue: #252
- Implementation issue: #259
- Accessibility UI / focus / notification follow-up: #261
- Test responsibility map: `docs/development/testing.md`
- E2E implementation instructions: `tests/e2e/AGENTS.md`
- Requirements: `docs/requirements/table-reorder/table-reorder-requirements.md`
- Accessibility requirements: `docs/requirements/table-reorder/table-reorder-accessibility-requirements.md`
- Design: `docs/design/table-reorder/table-reorder-design.md`
- Accessibility design: `docs/design/table-reorder/table-reorder-accessibility-design.md`

## Goal

Table Reorder の結合セル制約について、`rowspan` / `colspan` を含む代表ケースが実 WordPress / Gutenberg / Chromium 環境でも設計どおりに成立することを Playwright E2E で固定する。

本プランは #252 の方針に従い、結合セル判定ロジックの網羅テストにはしない。`rowspan.ts` と既存 Jest が担当する範囲計算・禁止挿入位置計算などの細かな境界条件は重複して検証せず、実ブラウザ上で利用者が触れる「移動対象」「移動先」「確定結果」が結合セル制約を正しく共有していることを代表シナリオで確認する。

特に、参照文書で定義されている次の仕様を漏れなく E2E の責務へ落とし込む。

- 複数行にまたがる結合範囲内の行そのものは移動できない。
- 複数行にまたがる結合範囲の途中へ別の行を挿入できない。
- 結合範囲外の行は、結合範囲全体を越えて前後へ移動できる。
- 禁止された操作では Table のデータを変更しない。
- `colspan` だけを含む行は、安全に行単位で移動できる場合は通常の移動可能行として扱う。
- キーボード操作とドラッグを必要としない単一ポインター操作にも同じ結合セル制約を適用する。
- 移動できない行や位置を、有効な移動対象・移動先として扱わない。

移動不能理由の具体的な通知文言、live region、accessible name / role / state などアクセシビリティ情報提供そのものは #261 の責務とし、#259 では結合セル制約の成立確認に必要な範囲だけを扱う。

## Scope

### Included

- `core/table` の `tbody` に通常行、`colspan` 行、`rowspan` 範囲を含む代表 fixture
- `rowspan` 範囲内の行に、移動可能行と同じ row control / handle が提供されないこと
- `rowspan` 範囲の途中が移動先として利用できないこと
- `rowspan` 範囲外の通常行を、結合範囲全体の前から後、または後から前へ越えて移動できること
- 上記の禁止操作では行順が変更されないこと
- `colspan` のみを含む行を安全な位置へ移動できること
- 結合セル制約が、代表的な PC ポインター操作、キーボード操作、Touch 操作で共有されること
- iframe / non-iframe の両編集環境で、代表的な結合セル制約が成立すること
- 最終的な assertion は利用者から見える行順・移動対象 UI・移動先 UI を基準にすること

### Not included

- `rowspan` 値の不正値、数値文字列、table末尾超過、複数・重複 `rowspan` 範囲などの純粋ロジック境界。既存 Jest を正とする。
- すべての行・すべての挿入位置・すべての入力方式の直積網羅
- PC ポインター DnD、PC 単一ポインター、キーボード、Touch DnD、Touch 単一ポインターの基本操作そのものの再テスト
- データ保持の詳細、Undo / Redo（#260）
- accessible name / role / state、live region、通知文言、確定・キャンセル後のフォーカスなどの詳細（#261）
- 初回 coachmark や Touch 初回操作（#382）
- 通常幅 / 全幅の結合セル制約の全組み合わせ
- Flexible Table Block の E2E。Core Table の #259 が完了した後に別途扱う。
- 製品コードの変更

## Source-of-truth mapping

参照文書と E2E で固定する観測点を次のように対応付ける。

| Source of truth | Required behavior | #259 E2E observation |
| --- | --- | --- |
| 基本要件 §5.1 | `rowspan` 範囲内の行そのものは移動できない | `Rowspan start` / `Rowspan covered` に移動可能行と同じ row control / handle が提供されない |
| 基本要件 §5.1 / 基本設計 §7, §8.1 | `rowspan` 範囲途中へ挿入できない | 単一ポインター / キーボードの移動先候補から除外され、禁止位置へ確定できない |
| 基本要件 §5.1 / 基本設計 §8.1 | 範囲外の行は結合範囲全体を越えて移動できる | 結合範囲前後の有効位置へ実際に移動し、行順が更新される |
| 基本要件 §5.1 | 禁止操作ではデータを変更しない | 操作前後の行順が同一 |
| 基本要件 §5.2 / 基本設計 §8.2 | `colspan` のみの行は安全なら移動できる | `colspan` 行の row control が利用でき、有効位置への移動が確定する |
| A11Y要件 A11Y-FR-11 / §11 | キーボード・単一ポインターでも同じ制約 | 代表入力経路で同じ移動対象・移動先制約を確認 |
| A11Y基本設計 §5.3 | キーボード移動先は有効位置のみ | Arrow 操作で `rowspan` 内部位置を候補にせず、範囲外の次の有効位置へ進む |
| A11Y基本設計 §9 | 移動できない行は利用者へ示される | #259 では「移動不能が成立する」ことまで。具体的通知の表示・文言・支援技術検証は #261 |

## Approach

### 1. `mergedCellsTable` を一つの代表 fixture として用意する

既存の E2E helper に、結合セル制約だけを判断しやすい Core Table fixture を追加する。

例として 8 行程度を使う。

1. `Alpha` - 通常行
2. `Bravo` - 通常行
3. `Colspan` - `colspan="2"` のみを含む横結合行
4. `Charlie` - 通常行
5. `Rowspan start` - `rowspan="2"` の開始行
6. `Rowspan covered` - 上記結合範囲に含まれる行
7. `Delta` - 通常行
8. `Echo` - 通常行

fixture の具体的な HTML は現在の Core Table 保存形式に合わせ、WordPress が正しく解釈する内容を用いる。テストごとにマークアップを重複させず、意味のあるラベルで各行を識別できるようにする。

この fixture では `rowspan` 範囲の前後に少なくとも一つずつ通常行を置き、「範囲全体を越える移動」と「範囲途中へ挿入できない」の両方を同じデータで確認できるようにする。

### 2. Jest と Playwright の責務を分ける

既存 `src/editor-extensions/table-reorder/rowspan.test.ts` では次を単体で固定済みである。

- `rowspan` 範囲抽出
- `rowspan` 範囲内の non-movable row index
- 結合範囲を分断する forbidden insertion index
- 結合範囲前後が有効位置として残ること
- 重複範囲の dedupe / sort などの境界

そのため Playwright では index 計算そのものを再検証しない。実ブラウザで各入力 UI がその結果を正しく利用していることだけを確認する。

### 3. 入力方式は「制約共有」を証明できる代表ケースに絞る

#259 は各入力方式の基本操作を再テストする Issue ではないため、すべての仕様を全入力方式で反復しない。

代表分担は次とする。

- **PC 単一ポインター**: 移動対象 UI と移動先 UI を直接観測しやすいため、`rowspan` 範囲内の行が移動対象にならないこと、範囲途中が移動先にならないこと、範囲全体を越えて移動できることを主に確認する。
- **キーボード**: `ArrowUp` / `ArrowDown` が `rowspan` 内部の禁止位置を候補にせず、次の有効位置へ進む代表ケースを確認する。
- **Touch**: Touch reorder mode でも `rowspan` 行が通常の移動可能行として扱われないことを代表確認する。Touch DnD と Touch destination-tap の両方を繰り返さず、一方で制約共有を確認すればよい。
- **`colspan`**: 安全な行移動が許可されることを、最も安定した既存入力経路一つで確認する。

実装時に既存 helper / spec 構造を確認し、同じ意味をより少ないケースで固定できる場合はケースを統合する。ただし、上記 source-of-truth mapping の各仕様を落とさない。

### 4. 禁止位置は内部 index ではなく利用者向け UI で確認する

`rowspan` 範囲途中への挿入禁止は、`getForbiddenInsertionIndices()` の戻り値を直接 assertion しない。

単一ポインター操作では、表示された destination UI のうち `rowspan` 範囲を分断する位置が選択肢として存在しないことを確認する。

キーボード操作では、Arrow 操作後の利用者向け移動先状態・最終行順を確認し、禁止位置を経由した内部 state の数値は主要 assertion にしない。

### 5. 「移動できない行」と「移動できない位置」を分けて検証する

設計では両者は別の制約なので、一つの assertion にまとめない。

- **移動できない行**: `rowspan` 範囲内の行を source として選べない。
- **移動できない位置**: 範囲外の通常行を source にしても、`rowspan` 範囲の途中を destination にできない。

これにより、「ハンドルを消しているだけで destination 制約が壊れている」またはその逆の回帰を取りこぼさない。

### 6. `rowspan` 範囲全体を越える成功ケースを必ず含める

禁止ケースだけでは実装が過剰に制限されてもテストが通るため、設計書に明記された許可ケースを対にする。

通常行を `rowspan` 範囲の前から後、または後から前へ移動し、結合範囲全体を飛び越えた有効位置で確定できることを確認する。

この成功ケースでは、最終的な Gutenberg Table の行順を主要 assertion とする。

### 7. `colspan` を `rowspan` と同じ禁止扱いにしないことを確認する

`colspan` のみを含む行には `rowspan` と同じ制約を適用しない。

`Colspan` 行を source として選べること、および安全な有効位置へ移動して行順が更新されることを代表ケースで確認する。

セル属性や装飾の完全保持は #260 に任せ、#259 では「横結合があるという理由だけで移動不能にならない」ことを固定する。

### 8. iframe / non-iframe は全ケースを二重化しない

#252 の方針どおり、iframe / non-iframe は横断マトリクスとして扱う。

最低限、結合セル制約の中核となる代表フローを両環境で確認する。たとえば「`rowspan` 範囲途中が destination にならず、範囲全体を越える有効移動は成立する」フローを iframe / non-iframe で共有し、`colspan` や入力方式横断の補助ケースまで機械的に二重化しない。

## Test structure

基本ファイルは次とする。

- `tests/e2e/table-reorder-merged-cells.spec.ts`

既存 `tests/e2e/table-reorder.ts`、`tests/e2e/editor-context.ts`、入力方式別 spec で利用している helper を再利用する。

必要な場合だけ、`mergedCellsTableContent` と行ラベルなどの fixture helper を `tests/e2e/table-reorder.ts` に追加する。

入力方式固有の low-level helper は既存のものを優先し、#259 のためだけに新しい大きな abstraction を作らない。

## Planned scenarios

### Scenario A: `rowspan` 範囲内の行は移動対象にならない

- `mergedCellsTable` を表示する。
- Table Reorder の操作入口へ入る。
- `Rowspan start` と `Rowspan covered` に、移動可能行と同じ row control / handle が提供されないことを必須 assertion として確認する。
- 操作前後で行順が変わらないことを確認する。
- Touch でも同じ制約が成立することを代表確認する。

通知の具体的文言や live region は #261 に任せる。

### Scenario B: `rowspan` 範囲途中は destination にならず、範囲全体は越えられる

- `rowspan` 範囲外の通常行を source に選ぶ。
- PC 単一ポインター操作で destination を表示する。
- `rowspan` 範囲を分断する行間が destination として提供されないことを確認する。
- 結合範囲の反対側にある有効 destination を選ぶ。
- 最終行順が期待どおり更新されることを確認する。
- 同じ代表フローを iframe / non-iframe で確認する。

この一連で「禁止位置」と「範囲全体を越える許可位置」の対を固定する。

### Scenario C: キーボードでも禁止位置を候補にしない

- `rowspan` 範囲外の通常行からキーボード並べ替えを開始する。
- `ArrowUp` / `ArrowDown` で `rowspan` 範囲方向へ移動する。
- `rowspan` 範囲途中では止まらず、次の有効位置へ進むことを利用者向け状態で確認する。
- 確定後の行順が、結合範囲を分断しない結果になっていることを確認する。

Arrow の基本操作自体は #257 で固定済みなので、#259 では禁止位置 skip の一ケースだけに絞る。

### Scenario D: `colspan` 行は安全な位置へ移動できる

- `Colspan` 行を source として選べることを確認する。
- 通常の有効 destination へ移動する。
- 行順が更新されることを確認する。

`colspan` 属性そのものの保持やセル内容・装飾保持の詳細は #260 に任せる。

## Implementation phases

### Phase 1: 結合セル fixture と共通準備

Outcome:

- `rowspan` / `colspan` の意味が明確な Core Table fixture を、既存 E2E helper と editor context で利用できる。

Tasks:

- `tests/e2e/table-reorder-merged-cells.spec.ts` を追加する。
- 必要に応じて `mergedCellsTableContent` と識別用 row labels を `tests/e2e/table-reorder.ts` へ追加する。
- 各テストは独立した投稿状態を作る。
- coachmark など #259 と無関係な first-run state は明示的に無効化する。
- semantic locator と既存 helper を優先する。

Validation:

- fixture が WordPress / Gutenberg で正しく読み込まれ、`rowspan` / `colspan` を含む Table として表示される。

### Phase 2: `rowspan` の source / destination 制約を固定する

Outcome:

- `rowspan` 範囲内の行が移動対象にならず、範囲途中が destination にならない一方、範囲全体を越える移動は成立する。

Tasks:

- Scenario A を実装する。
- Scenario B を実装する。
- 中核 Scenario B を iframe / non-iframe の両方で実行する。
- 禁止操作で行順が変わらない assertion を含める。
- 最終 assertion は row order / visible UI とし、内部 index や SortableJS state を主要 assertion にしない。

Validation:

- `rowspan` を過剰に禁止する実装でも、過小に禁止する実装でもテストが落ちる組み合わせになっている。

### Phase 3: 入力方式共有と `colspan` 許可を固定する

Outcome:

- 結合セル制約がキーボード / Touch にも共有され、`colspan` は `rowspan` と誤って同じ禁止扱いにならない。

Tasks:

- Scenario C を実装する。
- Scenario A の Touch 代表確認を実装する。
- Scenario D を実装する。
- 各入力方式の既存 spec がすでに固定している基本操作は重複しない。

Validation:

- キーボードでも禁止 destination を選べない。
- Touch でも `rowspan` 行を通常の移動可能行として扱わない。
- `colspan` 行は安全な移動ができる。

## Decisions and validation questions

### Decide before implementation

- `mergedCellsTable` の具体的な Core Table 保存形式は、実装時の WordPress が生成する現在形式に合わせる。
- Touch の代表確認は DnD と destination-tap の両方を実装せず、既存 helper と安定性を比較して一方に絞る。
- 移動不能理由の通知そのものは #261 に残し、#259 では通知文言・live region を assertion しない。

### Validate during implementation

- PC 単一ポインターの destination UI だけで禁止位置を十分に利用者視点で判定できるか。
- キーボードの禁止位置 skip を、内部 insertion index へ依存せず可視状態または最終行順で安定して観測できるか。
- `Rowspan start` / `Rowspan covered` の移動不能を、既存 semantic locator で brittle な DOM traversal なしに確認できるか。

## Issue breakdown

- [ ] #259 の中で一括実装する。追加の子 Issue は、実装時に明確な別責務が見つかった場合だけ作成する。

## Validation

実装時は `docs/development/testing.md` を正として、変更した E2E spec に必要な最小コマンドを実行する。

手動確認では、少なくとも次を確認する。

- `rowspan` 範囲内の行を移動できない。
- `rowspan` 範囲途中へ別行を挿入できない。
- `rowspan` 範囲外の行は結合範囲全体を越えて移動できる。
- 禁止操作では行順が変わらない。
- `colspan` 行は安全な位置へ移動できる。
- 代表的な制約が PC / Keyboard / Touch で共有される。
- 中核シナリオが iframe / non-iframe の両方で成立する。

## Completion criteria

- `Rowspan start` / `Rowspan covered` に、移動可能行と同じ row control / handle が提供されないことを確認する E2E がある。
- `rowspan` 範囲途中が有効な移動先にならない E2E がある。
- `rowspan` 範囲外の行が結合範囲全体を越えて前後の有効位置へ移動できる E2E がある。
- 禁止された操作では Table の行順が変更されないことを確認している。
- `colspan` のみを含む行が、安全な行移動では移動可能であることを確認している。
- キーボード操作でも `rowspan` 内部の禁止位置を候補にしない代表ケースを確認している。
- Touch でも `rowspan` 行を通常の移動可能行として扱わない代表ケースを確認している。
- iframe / non-iframe の両編集環境で結合セル制約の中核フローを確認している。
- `rowspan.ts` の純粋ロジック境界を Playwright で重複網羅していない。
- PC / Touch / Keyboard の基本操作を #255 / #256 / #257 / #258 / #360 から重複して再テストしていない。
- データ保持・Undo は #260、アクセシビリティ UI・フォーカス・通知の詳細は #261、Touch 初回 UI は #382 に残している。
- 製品コードを E2E のためだけに変更していない。
- 固定時間の `waitForTimeout()` や SortableJS 内部状態を主要 assertion にしていない。

## Notes

- #259 の価値は「禁止されること」だけでなく、「`rowspan` 範囲全体を越える正当な移動」と「`colspan` 行の正当な移動」が残ることを同時に固定する点にある。禁止ケースだけでは、すべての結合セルを移動不能にする過剰制限を見逃す。
- Flexible Table Block は Core Table の #259 完了後に扱う。今回のプランへ混ぜてテストマトリクスを膨らませない。
