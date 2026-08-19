# PLAN-256: Table Reorder E2E ドラッグ不要の単一ポインター操作

## References

- Parent issue: #252
- Implementation issue: #256
- Test responsibility map: `docs/development/testing.md`
- Requirements: `docs/requirements/table-reorder/table-reorder-requirements.md`
- Accessibility requirements: `docs/requirements/table-reorder/table-reorder-accessibility-requirements.md`
- Design: `docs/design/table-reorder/table-reorder-design.md`
- Accessibility design: `docs/design/table-reorder/table-reorder-accessibility-design.md`

## Goal

PC・タッチのどちらでも、行ハンドルをドラッグせず、単一ポインター操作だけで移動対象を選び、有効な移動先を選択して本文行を並べ替えられることを、実 WordPress / Gutenberg / Chromium 環境の Playwright E2E で固定する。

本プランは #252 の方針に従い、E2E を網羅テストにしない。Jest ですでに扱える移動先計算、pointer 分岐、UI lifecycle などは重複して検証せず、実ブラウザで行ハンドル、移動先 UI、確定結果が一連の利用者操作として接続される代表シナリオを対象とする。

## Scope

### Included

- PC で行ハンドルをクリックし、ドラッグ不要の移動先選択を開始すること
- タッチ reorder mode で行ハンドルをタップし、移動先選択を開始すること
- 単一ポインター操作で有効な移動先を選択し、行順が更新されること
- 元と同じ位置を確定対象にしないことの代表確認
- PC で移動先選択をキャンセルした場合に行順を変更しないこと
- タッチで明示的にキャンセルした場合に行順を変更せず reorder mode に戻ること
- タッチで移動先を探すためにスクロールしても、その操作だけでは移動を確定しないことの代表確認
- iframe / non-iframe の両方で単一ポインター操作が成立すること
- `core/table` を基準にした代表シナリオ

### Not included

- PC ポインター DnD（#255）
- キーボードによる開始・移動・確定・キャンセル（#257）
- タッチのドラッグ操作（#258）
- `rowspan` / `colspan` の詳細な移動制約（#259）
- データ保持の詳細な属性・装飾パターンの網羅
- Undo / Redo の E2E
- live region の全文言や通知順序の網羅
- 行ハンドルや移動先 UI の target size の数値検証
- 移動先 UI の CSS 座標、幅、opacity など実装詳細
- `data-new-index` など内部属性を主要な期待値にすること
- controller の内部 state や pointer event の発火順序の直接検証
- Core Table / Flexible Table Block、iframe / non-iframe、PC / touch、通常幅 / 全幅の全組み合わせ網羅
- Flexible Table Block を E2E のためだけに新規導入・セットアップすること

## Approach

### 利用者が見える入口・移動先・確定結果を検証する

Playwright では、行ハンドルと移動先を role / accessible name など利用者向け semantic locator で取得し、実際の click / tap で一連の操作を再現する。

主要な期待値は次とする。

1. 行ハンドルをクリック / タップすると、ドラッグせず移動先選択へ入れる。
2. Table 内に、その行を挿入できる有効な移動先だけが利用者向けに表示される。
3. 有効な別位置をクリック / タップすると、編集内容上の行順が更新される。
4. キャンセルでは行順が変わらない。
5. タッチでは移動先を探すためのスクロール操作だけで確定しない。

最終的な成立判定は controller 内部 state や UI の内部属性ではなく、Gutenberg の Table 編集内容を正とする。

### PC と touch の違いを必要な範囲だけ分ける

単一ポインター操作の確定ロジックは共通だが、入口とキャンセルの見え方は異なる。

- PC は hover で表示した行ハンドルをクリックして移動先選択へ入る。
- touch は Toolbar から reorder mode に入り、表示済みの行ハンドルをタップして移動先選択へ入る。
- PC のキャンセルは現在設計で提供される通常のキャンセル経路を使う。
- touch は移動先選択中の明示的なキャンセル UI を使い、reorder mode へ戻る。

両入力方式の全シナリオを複製せず、共通の確定フローは代表ケースを共有し、入力方式固有の入口・終了だけを個別に確認する。

### Jest と責務を重複させない

Jest は現在、行移動候補の計算、row move target の生成・選択、pointer controller、touch 固有分岐などを担当している。

Playwright では細かな候補位置や pointer event の境界値を全列挙せず、次の統合境界だけを確認する。

- 実 Gutenberg DOM 上の行ハンドルから単一ポインター操作へ入れること
- 実画面に移動先 UI が現れ、利用者が選択できること
- 移動先の click / tap が controller と Table データ更新へ接続されること
- touch の scroll gesture と tap 確定が実ブラウザ上で分離される代表ケース
- iframe / non-iframe の editor canvas 差を越えて同じ意味の操作が成立すること

## Test structure

基本ファイルは次とする。

- `tests/e2e/table-reorder-single-pointer.spec.ts`

#256 の範囲では大きな page object 層を新設しない。複数シナリオで繰り返す処理だけ、小さな helper として同ファイル内または既存 E2E helper へ寄せる。

候補:

- editor canvas 内の対象行を取得する helper
- PC で対象行を hover して行ハンドルを取得する helper
- touch reorder mode を ON にして対象行ハンドルを取得する helper
- accessible name から有効な移動先を取得する helper
- Table の現在行順を利用者向けテキストから読み取る helper

既存の #253 / #255 E2E helper で同じ責務を扱える場合は再利用し、重複 helper を増やさない。

## Test data

### `basicTableContent`

3〜4行の Core Table を使い、各行を `Alpha`, `Bravo`, `Charlie`, `Delta` のように識別可能にする。

用途:

- 中間行を別位置へ移動する代表ケース
- 元と同じ位置が移動先に含まれないことの確認
- キャンセル時の no-op
- PC / touch の同一結果確認

結合セル、画像、装飾、全幅など #256 と無関係な要因は入れない。

## Implementation phases

### Phase 1: 単一ポインター操作の共通準備を整える

Outcome:

- 各シナリオが同じ方法で Table、行、行ハンドル、移動先 UI、行順を取得できる。

Tasks:

- `tests/e2e/table-reorder-single-pointer.spec.ts` を追加する。
- `basicTableContent` を定義する。
- `admin.createNewPost()` と `editor.setContent()` を使い、各テストを独立させる。
- iframe / non-iframe の editor canvas 取得は `@wordpress/e2e-test-utils-playwright` の既存 fixture / helper を優先する。
- 行ハンドルと移動先は role / accessible name など利用者向け semantic locator を優先して取得する。
- 固定時間の `waitForTimeout()` は使用しない。

Validation:

- spec が既存 E2E 構成に収まり、環境分岐を各テストへ散らさない。
- helper が内部 class 名や `data-*` 属性を主要な前提にしない。

### Phase 2: PC のクリックによる移動先選択と確定を固定する

Outcome:

- hover 可能な PC 環境で、行ハンドルをクリックし、有効な移動先をクリックすると行順が更新されることを固定する。

Scenario:

1. `basicTableContent` を設定する。
2. 移動対象行へ hover して行ハンドルを表示する。
3. 行ハンドルをクリックする。
4. 移動先選択中の案内と、有効な移動先が表示されることを確認する。
5. 元と同じ位置が確定可能な移動先として表示されないことを確認する。
6. 有効な別位置をクリックする。
7. Table の編集内容から行順が期待どおり変わったことを確認する。

Validation policy:

- 移動先の CSS 位置や内部 index は固定しない。
- accessible name など、利用者が「どこへ移動するか」を識別できる情報を使って対象を選ぶ。
- 最終判定は Gutenberg の Table 内容の行順で行う。

### Phase 3: キャンセルで行順を変更しないことを固定する

Outcome:

- 移動先選択をキャンセルした場合、行順を変更せず通常操作へ戻れることを固定する。

PC representative:

1. 行ハンドルをクリックして移動先選択へ入る。
2. 現在設計のキャンセル経路を実行する。
3. 移動先 UI が閉じることを確認する。
4. Table の行順が変わっていないことを確認する。

Touch representative:

1. touch reorder mode を ON にする。
2. 行ハンドルをタップして移動先選択へ入る。
3. 明示的なキャンセル UI をタップする。
4. 行順が変わっていないことを確認する。
5. touch reorder mode 自体は継続し、行ハンドル操作へ戻れることを確認する。

Validation policy:

- controller state を直接確認しない。
- no-op は Table 内容と、利用者向け UI が通常の操作状態へ戻ることの組み合わせで確認する。

### Phase 4: touch の単一ポインター確定とスクロール分離を固定する

Outcome:

- touch reorder mode で、tap による移動先確定と、移動先を探すための scroll gesture が分離されることを固定する。

Scenario A: tap で確定

1. touch reorder mode を ON にする。
2. 移動対象行のハンドルをタップする。
3. 有効な移動先をタップする。
4. Table の編集内容から行順が期待どおり変わったことを確認する。

Scenario B: scroll gesture では確定しない

1. 行ハンドルをタップして移動先選択へ入る。
2. 移動先 UI 上またはその近傍から、縦方向の scroll gesture を行う。
3. スクロール後も行順が変わっていないことを確認する。
4. 移動先選択を継続できることを確認する。

Validation policy:

- 5px など内部 threshold の数値そのものは E2E で固定しない。
- 「明確な scroll gesture が tap 確定として扱われない」という利用者向け結果だけを検証する。

### Phase 5: iframe / non-iframe の境界を確認する

Outcome:

- 単一ポインター操作の代表シナリオが iframe / non-iframe の両環境で成立する。

Tasks:

- PC の基本確定フローを両環境で確認する。
- 必要に応じて touch の基本確定フローも、環境差が実際に影響する代表境界として確認する。
- locator / click / tap / scroll の環境差は helper 層で吸収する。
- キャンセルや scroll 分離まで両環境へ機械的に複製しない。

Validation:

- iframe / non-iframe のどちらでも、利用者から見て同じ入口・移動先選択・確定結果になる。

## Validation

実装時は、次を確認する。

- `npm test`
- `npm run build`
- `npm run test:e2e` または対象 spec の実行
- `git diff --check origin/main...HEAD`

E2E は互換性のある `wp-dev` 環境で実施する。手動環境検証は Issue 担当者が iframe / non-iframe の両方で行い、結果を PR に記録する。

## Completion criteria

- PC で行ハンドルをクリックし、ドラッグせず移動先選択へ入れる。
- touch reorder mode で行ハンドルをタップし、ドラッグせず移動先選択へ入れる。
- 有効な別位置の click / tap で Table の行順が更新される。
- 元と同じ位置が確定可能な移動先として提供されない代表ケースがある。
- PC / touch のキャンセルで行順が変わらない代表ケースがある。
- touch で scroll gesture だけでは移動が確定しない代表ケースがある。
- 基本フローが iframe / non-iframe の両方で成立する。
- #255 / #257 / #258 / #259 の責務を取り込まず、ドラッグ不要の単一ポインター操作に限定されている。
- Jest で十分な細かな境界条件を Playwright へ重複させていない。
