# PLAN-253: Table Reorder E2E 起動・UI表示

## References

- Parent issue: #252
- Implementation issue: #253
- Prototype PR: #307
- Test responsibility map: `docs/development/testing.md`
- Requirements: `docs/requirements/table-reorder/table-reorder-sortablejs-requirements.md`
- Accessibility requirements: `docs/requirements/table-reorder/table-reorder-sortablejs-accessibility-requirements.md`
- Accessibility design: `docs/design/table-reorder/table-reorder-sortablejs-accessibility-design.md`

## Goal

Table Reorder の起動経路と、利用者が最初に触れる基本 UI が、実際の WordPress / Gutenberg / Chromium 環境で成立することを Playwright E2E で固定する。

本プランは #252 の方針に従い、E2E を網羅テストにしない。Jest では保証しにくい実ブラウザ境界だけを対象とし、行移動そのもの、確定結果、結合セル制約、Undo、詳細なアクセシビリティ通知などは後続の E2E Issue に分離する。

PR #307 は起動・UI表示の代表ケースを試作した有用な材料として参照するが、現在の `main` を仕様の正とする。特に coachmark、案内文、行 control、touch reorder mode の現在実装に合わせて期待値を組み直し、PR #307 の文言や DOM 前提をそのまま固定しない。

## Scope

### Included

- 対応 Table ブロック選択時の Block Toolbar 「Reorder rows / 行を並べ替え」入口
- 非対応ブロック選択時に Table Reorder の Toolbar 入口を表示しないこと
- PC hover 時の行 control 表示と、hover 離脱後の非表示
- PC keyboard 初回 coachmark の表示と Toolbar 入口から行 control へのフォーカス移動
- touch 初回 coachmark の表示
- touch reorder mode の ON / OFF と、行 control / 操作案内の連動
- 初回 coachmark preference をテストごとに決定的な状態へ整えるための小さな E2E helper
- iframe / non-iframe のうち、この分類で壊れやすい代表境界の確認
- `core/table` を基準にした代表シナリオ
- `flexible-table-block/table` が既存の対象環境で利用可能な場合の、対応ブロック入口の代表確認

### Not included

- PC ポインター DnD による行移動
- PC 単一ポインターの移動先選択フロー
- Keyboard の Arrow 移動、確定、キャンセル
- Touch の短押し移動先選択や長押し DnD
- `rowspan` / `colspan` の移動制約
- 行データの保持、Undo / Redo
- live region の全文言や通知順序の網羅
- Tab / Shift+Tab を含む詳細なフォーカス遷移
- CSS の正確な座標、opacity の具体的な数値、Popover 内部 DOM など見た目の実装詳細
- 全テストを iframe / non-iframe、Core Table / Flexible Table Block、PC / touch の全組み合わせで重複実行すること
- Flexible Table Block を E2E のためだけに新規導入・セットアップすること

## Approach

### User-visible state を主要な期待値にする

E2E では、内部 React state や controller state を直接検証せず、利用者が確認できる状態を主要な期待値にする。

優先する確認方法:

1. Toolbar 入口や行 control は role / accessible name で取得する。
2. coachmark / guidance は現在のユーザー向け文言または安定した semantic locator で取得する。
3. touch reorder mode は Toolbar button の `aria-pressed` と、行 control / guidance の表示を組み合わせて確認する。
4. PC hover の行 control は「利用可能な control が hover 行に見えること」を確認する。現在実装の `data-visible` は必要な場合の補助に留め、opacity の具体値を仕様として固定しない。
5. 非対応ブロックでは Table Reorder 固有 UI が存在しないことを確認する。

### Current `main` を正とする

PR #307 の試作から現在までに UI 実装が変わっているため、次はそのまま引き継がない。

- 過去の coachmark 文言の正規表現
- 過去の touch guidance 文言
- `opacity: 0 / 1` の厳密値を期待値にする hover テスト
- List View のキー移動回数に依存する `focusWithArrowDown()` のような補助

代わりに、現在の `messages.ts`、`with-table-reorder.tsx`、`row-controls.ts`、`use-table-reorder-interaction.ts` に合わせてテストを組む。

### Jest と責務を重複させない

Jest は現在、block support、interaction state、HOC contract、row control DOM contract、controller state などを担当している。

Playwright ではそれらを再実装するような mock 検証をせず、次の統合境界だけを確認する。

- Gutenberg が実際に Block Toolbar を表示すること
- 実ブラウザの hover / keyboard / touch 入力で UI が切り替わること
- WordPress preferences store と初回 coachmark が実環境で連動すること
- editor canvas が iframe / non-iframe のどちらでも対象 UI を扱えること

## Test structure

基本ファイルは次とする。

- `tests/e2e/table-reorder-ui.spec.ts`

#253 の範囲では、最初から大きな fixture / page object 層は作らない。2回以上繰り返し、かつ意味が明確な処理だけ小さな helper として同ファイル内または `tests/e2e/` 配下へ切り出す。

候補:

- `setPluginPreference(page, name, value)`
- Core Table + 非対応 Paragraph を含む最小テストコンテンツ
- 必要なら editor canvas 内の対象 Table を取得する小さな helper

## Test data

### `basicTableContent`

Core Table 2〜3行と Paragraph 1件だけを含む最小データを使う。

要件:

- 各行は `Alpha`, `Bravo`, `Charlie` のように識別可能にする。
- hover や行 control の accessible name を利用者視点で判別できる。
- 結合セル、画像、装飾、全幅など #253 と無関係な要因を入れない。
- Paragraph は非対応ブロック選択時の Toolbar 非表示確認に使う。

Flexible Table Block を代表確認する場合も、同等の最小データだけを使い、Core Table の全シナリオを複製しない。

## Implementation phases

### Phase 1: E2E 共通準備を最小構成で作る

Outcome:

- #253 の各シナリオが同じ最小データと決定的な初期状態から開始できる。

Tasks:

- `tests/e2e/table-reorder-ui.spec.ts` を追加する。
- Core Table + Paragraph の最小コンテンツを定義する。
- `admin.createNewPost()` と `editor.setContent()` を使って各テストを独立させる。
- `core/preferences` の `yamabiko-editor-tools` scope へ keyboard / touch coachmark dismissal を設定できる小さな helper を用意する。
- 固定時間の `waitForTimeout()` は使用しない。
- iframe / non-iframe の editor canvas 取得は `@wordpress/e2e-test-utils-playwright` の fixture を優先し、各テストへ環境分岐を散らさない。

Validation:

- 対象 spec が TypeScript / lint の対象として成立する。
- preference helper が保存済み利用者設定に依存せず初回状態を再現できる。

### Phase 2: 対応ブロック選択と Toolbar 入口を固定する

Outcome:

- Table Reorder が利用できる対象でだけ Toolbar 入口が現れることを実 Gutenberg 上で固定する。

Core Table scenario:

1. 新規投稿に `basicTableContent` を設定する。
2. Core Table を選択する。
3. 「Reorder rows / 行を並べ替え」Toolbar button が表示されることを確認する。
4. Paragraph を選択する。
5. Table Reorder の Toolbar button が存在しないことを確認する。

Optional supported-block representative:

- Flexible Table Block が対象 E2E 環境に既に存在する場合、ブロック選択時に同じ Toolbar 入口が表示されることを1ケースだけ確認する。
- plugin / block の追加インストールを #253 の実装へ含めない。

Validation:

- Gutenberg の実 Block Toolbar と HOC の対応ブロック判定が接続されている。
- 非対応ブロックへ UI が漏れない。

### Phase 3: PC hover の行 control 表示を固定する

Outcome:

- hover capable なデスクトップ環境で、対象行へポインターを置いたときだけ行 control を視覚的に利用できることを固定する。

Scenario:

1. Core Table を選択する。
2. 先頭行の行 control が DOM 上に用意されていることを確認する。
3. 対象行へ hover する。
4. その行の control が利用者から見える状態になることを確認する。
5. Table 内の別領域または対象行外へポインターを移す。
6. 対象 control が通常の非表示状態へ戻ることを確認する。

Validation policy:

- `opacity: 0 / 1` の具体値を仕様として固定しない。
- 必要なら現在の `data-visible` を補助確認に使うが、主要な意図は「hover 行だけが操作入口として見える」こととする。
- hover 時の Tooltip 文言そのものは #253 で網羅しない。

### Phase 4: PC keyboard 初回 coachmark と Toolbar 入口を固定する

Outcome:

- keyboard 利用者が初回案内を受け取り、Toolbar 入口から実際の行 control へ到達できることを固定する。

Scenario:

1. `tableReorderKeyboardCoachmarkDismissed = false` にする。
2. hover capable なデスクトップ環境で Core Table を keyboard 操作によって選択状態にする。
3. keyboard 入力を契機に現在の keyboard coachmark が表示されることを確認する。
4. 「Reorder rows / 行を並べ替え」Toolbar button を keyboard で実行する。
5. coachmark が閉じることを確認する。
6. 移動可能な先頭行の行 control へフォーカスが移ることを確認する。

Implementation note:

- PR #307 のように List View 内で固定回数 `ArrowDown` を送る helper は避ける。
- Gutenberg の特定の内部フォーカス順に依存せず、対象 block / Toolbar button を semantic locator で取得して keyboard activation する経路を優先する。
- #253 では row control へ到達するところまでとし、Enter / Space で並べ替え session を開始しない。

### Phase 5: Touch coachmark と reorder mode を固定する

Outcome:

- touch 環境で初回案内から reorder mode の ON / OFF までが実ブラウザ上で連動することを固定する。

Playwright context:

- `hasTouch: true`
- `isMobile: true`
- スマートフォン相当の viewport

Scenario:

1. `tableReorderTouchCoachmarkDismissed = false` にする。
2. Core Table を選択する。
3. 現在の touch coachmark が表示されることを確認する。
4. Toolbar button が `aria-pressed="false"` であることを確認する。
5. Toolbar button を tap / click して touch reorder mode を ON にする。
6. Toolbar button が `aria-pressed="true"` になることを確認する。
7. touch mode の操作案内が表示されることを確認する。
8. 移動可能行の行 control が表示されることを確認する。
9. Toolbar button をもう一度実行して mode を OFF にする。
10. `aria-pressed="false"`、guidance 非表示、行 control の通常状態への復帰を確認する。

Implementation note:

- 現在の touch mode message は `messages.ts` の正を使う。
- guidance の座標、スワイプ方向による配置、フェードアニメーションは別責務とし、#253 の期待値に含めない。
- 行 control を tap して移動先選択へ進む操作は後続 Issue に任せる。

### Phase 6: iframe / non-iframe の代表境界を確認する

Outcome:

- editor document の違いで Table Reorder の起動 UI が壊れないことを、重複を増やしすぎず固定する。

Matrix:

| Scenario | iframe | non-iframe |
| --- | --- | --- |
| Toolbar entry + unsupported block | Required | Required |
| PC hover row control | Required | Representative only if separate environment is available |
| Keyboard coachmark + Toolbar → row control focus | Required | Required |
| Touch coachmark + reorder mode | Required | Representative only if touch + non-iframe setup is already available |

Rules:

- 全ケースを機械的に二重化しない。
- `wp-dev` が提供する既存の環境境界を使い、#253 のためだけの新しい WordPress 構成を増やさない。
- non-iframe が別 WordPress instance / configuration で提供される場合、その既存経路に合わせて対象 spec を実行する。
- 現在の E2E runner から安全に自動化できない環境差は、固定 wait や本体変更で無理に吸収せず、実装時の確認事項として記録する。

### Phase 7: 最終整理と validation

Outcome:

- #253 の E2E が他の分類へ責務をはみ出さず、安定した代表シナリオとして実行できる。

Tasks:

- PR #307 から再利用した考え方と、現在仕様に合わせて捨てた前提を確認する。
- locator が Gutenberg 内部 class や一時 DOM に過度に依存していないか見直す。
- 同じ文言 / preference / test data が過剰に重複する場合だけ小さく共通化する。
- `waitForTimeout()`、座標の過度な固定、CSS 数値の厳密比較を残さない。
- #254 以降の行移動系テストを #253 へ混ぜない。

Validation:

- `npm test`
- `npm run build`
- `npm run test:e2e`（互換 `wp-dev` 環境が利用できる場合）
- `git diff --check origin/main...HEAD`

## Decisions and validation questions

### Decide before implementation

実装を開始するために追加の設計判断は不要。

次を既定とする。

- Core Table を #253 の必須基準ブロックにする。
- Flexible Table Block は既存 E2E 環境で利用可能な場合だけ Toolbar 入口の代表確認を追加する。
- PR #307 は prototype として参照し、現在の `main` の UI / message / interaction contract を優先する。
- E2E の主要期待値は user-visible state とする。

### Validate during implementation

1. 現在の Gutenberg で keyboard 入力を保ったまま、内部フォーカス順へ過度に依存せず Core Table を選択する最小経路はどれか。
2. PC hover row control の「見える状態」は `toBeVisible()` だけで十分安定するか。必要なら `data-visible` を補助にする。
3. `core/preferences` への直接設定後、coachmark state が同一ページで確実に再評価されるか。必要なら Table の再選択など、利用者操作に近い同期点を使う。
4. 現行 `wp-dev` の non-iframe 環境を同じ spec からどのように呼び分けるのが最小か。
5. Flexible Table Block が E2E 環境に常設されているか。常設でなければ #253 では追加しない。

これらは architecture を変える判断ではなく、実装時に現在環境へ合わせて最小の安定手段を選ぶための確認事項とする。

## Issue breakdown

#253 は単一の E2E 実装単位として扱い、追加の子 Issue は原則作成しない。

- [ ] Phase 1: 共通準備
- [ ] Phase 2: Toolbar 入口 / 非対応ブロック
- [ ] Phase 3: PC hover
- [ ] Phase 4: Keyboard coachmark / focus entry
- [ ] Phase 5: Touch coachmark / reorder mode
- [ ] Phase 6: iframe / non-iframe 代表確認
- [ ] Phase 7: 最終 validation

## Validation

ドキュメント変更時:

- `git diff --check origin/main...HEAD`

#253 実装時:

- `npm test`
  - format / ESLint / Stylelint / TypeScript / Jest coverage が成功する。
- `npm run build`
  - production assets が生成できる。
- `npm run test:e2e`
  - 互換 `wp-dev` 環境が利用できる場合、Chromium E2E が成功する。
- `git diff --check origin/main...HEAD`
  - whitespace error がない。

E2E 実行に必要な WordPress 環境が利用できない場合は、成功したと報告せず、未実行理由を PR に明記する。

## Completion criteria

- `tests/e2e/table-reorder-ui.spec.ts` に #253 の代表シナリオが実装されている。
- 対応 Core Table 選択時のみ Toolbar 入口が表示される。
- PC hover で行 control が表示され、離脱後に通常状態へ戻る。
- keyboard 初回 coachmark と Toolbar → row control focus entry が実ブラウザで確認できる。
- touch 初回 coachmark と reorder mode ON / OFF が `aria-pressed`、guidance、row control と連動する。
- iframe / non-iframe の必要な代表境界が確認されている。
- Jest で保証済みの内部 contract や、#254 以降の操作フローを重複して E2E 化していない。
- 固定 wait、Gutenberg 内部 DOM への過度な依存、CSS 数値の厳密比較を主要な期待値にしていない。
- 適用可能な validation が成功している、または実行不能なものの理由が記録されている。

## Notes

- 現在の Playwright 設定は Chromium、1 worker、共有 WordPress 環境を前提としている。#253 では runner 構成そのものを変更しない。
- `docs/development/testing.md` を validation command の正とし、このプランへ環境構築手順を重複記載しない。
- PR #307 の試作で得られた「preference を明示的に整える」「Core Table + Paragraph の最小データ」「PC / touch を分ける」という方向性は再利用できる。一方、当時の文言、List View 操作、opacity の厳密比較は現在仕様へ持ち込まない。
