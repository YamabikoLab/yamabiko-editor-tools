# PLAN-257: Table Reorder E2E キーボード操作

## References

- Parent issue: #252
- Implementation issue: #257
- Test responsibility map: `docs/development/testing.md`
- Requirements: `docs/requirements/table-reorder/table-reorder-requirements.md`
- Accessibility requirements: `docs/requirements/table-reorder/table-reorder-accessibility-requirements.md`
- Design: `docs/design/table-reorder/table-reorder-design.md`
- Accessibility design: `docs/design/table-reorder/table-reorder-accessibility-design.md`

## Goal

hover 可能な PC 環境で、キーボードだけを使って Table Reorder の行操作 UI へ到達し、並べ替えを開始、移動、確定またはキャンセルできることを、実 WordPress / Gutenberg / Chromium 環境の Playwright E2E で固定する。

本プランは #252 の方針に従い、E2E を網羅テストにしない。Jest ですでに扱える controller のキー分岐、禁止位置の探索、state 遷移などは重複して検証せず、実ブラウザで Gutenberg のフォーカス、行 control、キーボード入力、Table データ更新が一連の利用者操作として接続される代表シナリオを対象とする。

行数の多い Table については、`ArrowUp` / `ArrowDown` を連続操作したときの縦スクロール追従、現在の挿入線の視認、操作方向に応じた画面固定案内の上下切り替えまでを、キーボード操作の一連の利用者体験として本 Issue で確認する。

## Scope

### Included

- Toolbar の「行を並べ替え」から現在行または先頭の移動可能行の row control へキーボードで到達できること
- 待機中に `Tab` / `Shift+Tab` で移動可能な row control 間を論理順に移動できること
- `Enter` または `Space` でキーボード並べ替えを開始できること
- `ArrowUp` / `ArrowDown` で有効な移動先へ進めること
- `Enter` または `Space` で現在の移動先を確定し、行順が更新されること
- `Escape` で並べ替えをキャンセルし、行順を変更しないこと
- キーボード並べ替え中は対象 row control にフォーカスを維持することの代表確認
- 確定後は移動後の同じ行、キャンセル後は操作開始時の同じ行の row control にフォーカスが保たれることの代表確認
- 行数の多い Table で `ArrowDown` / `ArrowUp` を連続操作したとき、移動先に合わせて縦スクロールが追従すること
- スクロール追従中も、現在の挿入線を viewport 内で確認でき、移動先を見失わないこと
- `ArrowDown` ではキーボード操作中案内が viewport 上側、`ArrowUp` では viewport 下側へ切り替わり、進行方向を妨げないこと
- iframe / non-iframe の両方で代表的なキーボード並べ替えが成立すること
- `core/table` を基準にした代表シナリオ

### Not included

- Mouse / Touch による操作
- PC ポインター DnD（#255）
- PC ドラッグ不要の単一ポインター操作（#256）
- Touch DnD（#258）
- Touch のドラッグ不要の単一ポインター操作（#360）
- `rowspan` / `colspan` の詳細な移動制約（#259）
- データ保持の詳細な属性・装飾パターンや Undo / Redo（#260）
- accessible name / role / state、live region、通知文言などアクセシビリティ情報提供の網羅（#261）
- キーボード操作中案内について、文言・座標値・CSS の詳細を網羅すること
- 先頭・末尾で進めない場合の通知文言や禁止位置スキップの全境界ケース
- controller 内部 state、keydown handler、insertion index など実装詳細の直接検証
- Core Table / Flexible Table Block、iframe / non-iframe、通常幅 / 全幅、通常行 / 結合セルの全組み合わせ網羅
- Flexible Table Block を E2E のためだけに新規導入・セットアップすること

## Approach

### 実ブラウザ上のキーボード操作と最終結果を検証する

Playwright では、Toolbar button と row control を role / accessible name など利用者向け semantic locator で取得し、`page.keyboard` を使って実際のキー入力を送る。

主要な期待値は次とする。

1. Toolbar の「行を並べ替え」をキーボードで実行すると、正本文書で定義された row control にフォーカスが移る。
2. 待機中は `Tab` / `Shift+Tab` で移動可能な row control 間を論理順に移動できる。
3. `Enter` または `Space` で並べ替えを開始できる。
4. `ArrowUp` / `ArrowDown` で有効な移動先を変更できる。
5. `Enter` または `Space` で確定すると、Gutenberg の Table 編集内容上の行順が更新される。
6. `Escape` でキャンセルすると、Table 内容は変わらない。
7. 操作中・操作後のフォーカスが正本文書どおりの row control に保たれる。
8. 長い Table で移動先が表示領域外へ進む場合は縦スクロールが追従し、現在の挿入線を表示領域内で確認できる。
9. `ArrowDown` / `ArrowUp` の操作方向に応じて、操作中案内が進行方向と反対側へ切り替わる。

最終的な並べ替え成立判定は controller 内部状態ではなく、Table の編集内容を正とする。長い Table の操作継続性は、実際の viewport、スクロール、挿入線、操作中案内の見え方を利用者視点で確認する。

### キーボード専用シナリオとして扱う

本プランでは `hasTouch: false` / `isMobile: false` の hover 可能な PC 環境を使い、行ハンドルの hover やクリックを操作入口にしない。

Toolbar 入口への到達は、既存 #253 の keyboard coachmark / Toolbar 入口テストで使用している経路を参考にしつつ、Gutenberg の内部フォーカス順へ過度に依存しない。

row control への到達後は、ポインター入力を混ぜず、開始、移動、確定、キャンセル、長い Table での操作継続までをキーボードだけで完結させる。

### 長い Table のスクロール追従と案内位置を一連の操作として確認する

アクセシビリティ基本設計では、`ArrowUp` / `ArrowDown` によって移動先候補が実際に変わり表示領域外へ進んだ場合、現在位置と移動方向を見失わない範囲で表示を追従させる。また、キーボード操作中案内は操作方向に応じて表示側を切り替える。

これらは同じ矢印キー操作から生じる一連の利用者体験なので、#261 へ分割せず #257 の長い Table シナリオでまとめて確認する。

確認では、実装定数や厳密な CSS 座標を固定しない。

- `ArrowDown` を繰り返して現在候補が下側へ進むと、必要な時点で editor viewport が下へ追従する。
- 追従後も現在の挿入線が viewport 内にあり、視覚的に確認できる。
- `ArrowDown` 操作中は操作中案内が viewport 上側にある。
- そこから `ArrowUp` を繰り返して現在候補が上側へ戻ると、必要な時点で editor viewport が上へ追従する。
- 追従後も現在の挿入線が viewport 内にある。
- `ArrowUp` 操作中は操作中案内が viewport 下側にある。

案内については `top: 64px` のような値を期待値にせず、viewport の上半分 / 下半分など、利用者から見て進行方向を妨げない側にあることを確認する。

### Jest と責務を重複させない

Jest の `sortable-controller-keyboard.test.ts` はすでに、次のような controller 単体のキー分岐と境界条件を扱っている。

- `Enter` / `Space` による開始・確定
- `ArrowUp` / `ArrowDown` の移動
- `Escape` キャンセル
- 禁止位置のスキップ
- 元位置での no-op
- active session 中の `Tab` / `Shift+Tab` 抑止
- pointer / Sortable lifecycle との競合

また、reorder guidance の Jest では案内位置やスクロール処理の個別ロジックを扱える。

Playwright ではそれらの内部条件を再列挙せず、次の実ブラウザ境界だけを確認する。

- Gutenberg の Toolbar から row control へフォーカスが接続されること
- 実ブラウザの `Tab` / `Shift+Tab` で待機中の row control 間を移動できること
- 実ブラウザのキー入力が keyboard reorder session と Table 更新へ接続されること
- 確定またはキャンセル後に、利用者が同じ対象行の操作文脈を継続できること
- 長い Table で矢印キーを連続操作しても、scroll / insertion line / guidance が組み合わさって操作を継続できること
- iframe / non-iframe の editor canvas 差を越えて同じ意味の操作が成立すること

## Test structure

基本ファイルは次とする。

- `tests/e2e/table-reorder-keyboard.spec.ts`

既存の `tests/e2e/table-reorder.ts` と `tests/e2e/editor-context.ts` で扱える責務は再利用し、#257 のためだけに大きな page object 層を新設しない。

必要な場合だけ、小さな helper を追加する。

候補:

- row control を row number / row label から取得する helper
- Table の現在行順を利用者向けテキストから読み取る既存 helper
- keyboard で Toolbar 入口を実行し、期待する row control へ到達する小さな helper
- 長い Table の最小テストコンテンツを生成する helper
- editor viewport に対する挿入線・操作中案内の位置を確認する小さな helper

PC pointer 用の `getRowHandle()` は hover を含むため、キーボード操作の入口にはそのまま流用しない。共通化する場合は、semantic locator の取得と pointer 固有操作を分離する。

## Test data

### `basicTableContent`

既存 E2E helper の 4 行 Core Table を再利用する。

- `Alpha`
- `Bravo`
- `Charlie`
- `Delta`

用途:

- 中間行から前後へ移動できる代表ケース
- `Tab` / `Shift+Tab` の論理順確認
- `Escape` キャンセル時の no-op
- 確定後の行順と対象行フォーカス確認

結合セル、画像、装飾、全幅など #257 と無関係な要因は入れない。

### `longTableContent`

viewport の高さを十分に越える、20〜30 行程度の Core Table を用意する。各行は `Row 01`, `Row 02`, ... のように一意に識別できる単純な内容にする。

用途:

- `ArrowDown` の連続操作で移動先が初期 viewport より下へ進むこと
- 下方向への縦スクロール追従と挿入線の視認
- `ArrowDown` 時の操作中案内の上側表示
- 続けて `ArrowUp` を連続操作し、上方向へ戻ること
- 上方向への縦スクロール追従と挿入線の視認
- `ArrowUp` 時の操作中案内の下側表示

スクロール確認だけのために装飾、結合セル、全幅など別責務の要因は追加しない。

## Implementation phases

### Phase 1: キーボード E2E の共通準備を整える

Outcome:

- 各シナリオが同じ方法で Table、row control、行順、Toolbar 入口を扱える。

Tasks:

- `tests/e2e/table-reorder-keyboard.spec.ts` を追加する。
- 既存 `basicTableContent` / `basicRowLabels` / `getTableRows()` / `getTableRowOrder()` を再利用する。
- 必要なら `tests/e2e/table-reorder.ts` に、hover を伴わず row control を semantic locator で取得する helper を追加する。
- 長い Table シナリオ用に、単純な連番行だけを持つ `longTableContent` または等価な生成 helper を用意する。
- `admin.createNewPost()` と `editor.setContent()` を使い、各テストを独立させる。
- `hasTouch: false` / `isMobile: false` を明示する。
- iframe / non-iframe の editor canvas 取得は既存 `getEditorContext()` を使用する。
- 固定時間の `waitForTimeout()` は使用しない。

Validation:

- helper が row control の内部 class 名や controller state を主要な前提にしない。
- pointer 固有の hover / click が keyboard spec の準備へ混入しない。
- 長い Table のデータがスクロール境界の確認に必要なだけの単純な構成になっている。

### Phase 2: Toolbar 入口と待機中の `Tab` / `Shift+Tab` を固定する

Outcome:

- キーボード利用者が Toolbar 入口から row control へ入り、移動可能な row control 間を論理順に移動できることを固定する。

Scenario:

1. `basicTableContent` を設定する。
2. Core Table をキーボード操作の文脈で選択する。
3. 現在行を識別できる状態を作り、その行が移動可能であることを確認する。
4. Toolbar の「行を並べ替え」を keyboard activation する。
5. 現在行に対応する row control へフォーカスが移ることを確認する。
6. `Tab` を押し、次の移動可能な row control へフォーカスが移ることを確認する。
7. `Shift+Tab` を押し、前の row control へ戻ることを確認する。

Validation policy:

- #253 ですでに扱う coachmark 自体は再テストしない。
- List View の固定回数 `ArrowDown` など Gutenberg の内部順序へ強く依存する操作を避ける。
- 先頭・末尾から WordPress 標準フォーカス順へ抜ける詳細は #261 に委ね、#257 では row control 間の代表的な前後移動を確認する。

### Phase 3: `Enter` 開始 + `ArrowDown` + `Space` 確定を固定する

Outcome:

- キーボードだけで並べ替えを開始し、移動先を進め、別の確定キーで行移動を完了できることを固定する。

Scenario:

1. 中間行 `Bravo` の row control にフォーカスする。
2. `Enter` を押してキーボード並べ替えを開始する。
3. 対象 row control にフォーカスが維持されていることを確認する。
4. `ArrowDown` を押して後方の有効な移動先へ進む。
5. `Space` を押して確定する。
6. Table の編集内容から行順が期待どおり更新されたことを確認する。
7. 移動後の `Bravo` に対応する row control へフォーカスが保たれていることを確認する。

Validation policy:

- `Enter` と `Space` の双方が開始・確定に使えることは、1シナリオ内で開始と確定に別キーを使うことで代表確認する。
- insertion line の座標や内部 index は期待値にしない。
- 最終判定は Gutenberg の Table 内容の行順で行う。

### Phase 4: `Space` 開始 + `ArrowUp` + `Enter` 確定を固定する

Outcome:

- 逆方向の移動と、Phase 3 と逆の開始・確定キーの組み合わせでもキーボード並べ替えが成立することを固定する。

Scenario:

1. 中間行 `Charlie` の row control にフォーカスする。
2. `Space` を押して並べ替えを開始する。
3. `ArrowUp` を押して前方の有効な移動先へ進む。
4. `Enter` を押して確定する。
5. Table の編集内容から行順が期待どおり更新されたことを確認する。
6. 移動後の `Charlie` に対応する row control へフォーカスが保たれていることを確認する。

Validation policy:

- `ArrowUp` / `ArrowDown` の細かな境界や禁止位置スキップは Jest / #259 に委ねる。
- #257 では前後それぞれ1つの代表方向を実ブラウザで確認する。

### Phase 5: `Escape` キャンセルを固定する

Outcome:

- キーボード並べ替え中に `Escape` を押すと、行順を変更せず操作開始時の row control へ戻れることを固定する。

Scenario:

1. `Bravo` の row control にフォーカスする。
2. `Enter` または `Space` で並べ替えを開始する。
3. `ArrowDown` を押して移動先を変更する。
4. `Escape` を押す。
5. Table の行順と編集内容が開始前から変わっていないことを確認する。
6. 操作開始時の `Bravo` row control にフォーカスが戻っていることを確認する。

Validation policy:

- controller state を直接確認しない。
- no-op は Table 内容とフォーカス復元の組み合わせで確認する。
- キャンセル時の live region 文言は #261 に委ねる。

### Phase 6: 長い Table のスクロール追従・挿入線・操作案内を固定する

Outcome:

- 行数の多い Table でも、`ArrowDown` / `ArrowUp` を連続操作したときに現在の移動先を見失わず、キーボード操作を継続できることを固定する。

Scenario:

1. `longTableContent` を設定する。
2. 上側にある移動可能行の row control にキーボードでフォーカスする。
3. `Enter` または `Space` でキーボード並べ替えを開始する。
4. `ArrowDown` を複数回押し、現在候補を初期 viewport より下まで進める。
5. 必要な時点で editor の縦スクロール位置が下方向へ変化していることを確認する。
6. 現在の挿入線が editor viewport 内に表示されていることを確認する。
7. キーボード操作中案内が viewport 上側に表示され、下方向の移動先確認を妨げないことを確認する。
8. さらに `ArrowDown` を進めても、スクロール追従後の挿入線を見失わないことを確認する。
9. `ArrowUp` を複数回押し、現在候補を上方向へ戻す。
10. 必要な時点で editor の縦スクロール位置が上方向へ変化していることを確認する。
11. 現在の挿入線が editor viewport 内に表示されていることを確認する。
12. キーボード操作中案内が viewport 下側に表示され、上方向の移動先確認を妨げないことを確認する。
13. `Escape` で終了し、長い Table の行順が変わっていないことを確認する。

Validation policy:

- `ArrowDown` / `ArrowUp` の固定回数そのものを仕様にしない。テストデータと viewport に対して、実際にスクロール境界を越える十分な回数だけ操作する。
- scroll の確認は、対象 editor document / owning window の実際の縦スクロール位置を使う。
- 挿入線は「現在の移動先を視覚的に確認できること」が主要な期待値であり、CSS 座標や内部 insertion index の値は固定しない。
- 挿入線の bounding box が editor viewport 内にあることなど、利用者から見える状態で確認する。
- 操作中案内は厳密な `top` 値を固定せず、`ArrowDown` では viewport 上側、`ArrowUp` では viewport 下側にあることを bounding box 等で確認する。
- 案内文言そのものや live region 通知の網羅は #261 に委ねる。
- スクロール追従、挿入線、案内位置を別々の Issue に分割せず、同じキーボード操作シナリオの中で確認する。

### Phase 7: iframe / non-iframe の境界を確認する

Outcome:

- キーボード並べ替えの代表シナリオが iframe / non-iframe の両環境で成立する。

Tasks:

- Phase 3 の基本確定フローを両環境で確認する。
- editor canvas の環境差は既存 `getEditorContext()` で吸収する。
- Phase 2、4、5、6 の全シナリオを両環境へ機械的に複製しない。

Validation:

- iframe / non-iframe のどちらでも、Toolbar 入口、row control、keyboard input、確定結果の意味が変わらない。

## Decisions and validation questions

### Decide before implementation

- None. 正本文書と既存 E2E helper から実装方針は決定できる。

### Validate during implementation

- WordPress / Gutenberg の実ブラウザフォーカス順で、待機中の `Tab` / `Shift+Tab` が row control 間を安定して移動できるか。
- 行移動後に DOM が再生成された場合でも、移動後の同じ行の row control を semantic locator で安定して特定できるか。
- 長い Table で、対象 editor の縦スクロール位置と viewport を iframe / non-iframe に過度に依存せず取得できるか。
- insertion line の視認性を、内部 insertion index に依存せず実ブラウザ上で安定して確認できるか。
- 操作中案内の上側 / 下側を、厳密な CSS 座標値に依存せず安定して判定できるか。
- iframe / non-iframe の両環境で keyboard activation と `toBeFocused()` の確認方法を共通化できるか。

## Issue breakdown

- [ ] #257 の実装 PR で本プランを一括して進める。
- [ ] 追加の子 Issue は、実装中に #257 の責務を越える独立課題が判明した場合だけ作成する。

## Validation

実装時は、次を確認する。

- `npm test`
- `npm run build`
- `npm run test:e2e` または対象 spec の実行
- `git diff --check origin/main...HEAD`

E2E は互換性のある `wp-dev` 環境で実施する。手動環境検証は Issue 担当者が iframe / non-iframe の両方で行い、結果を PR に記録する。

本プラン作成 PR ではドキュメントのみを変更するため、リポジトリ方針上の必須検証は `git diff --check origin/main...HEAD` のみとする。実際の検証は依頼者が実施するため、本対応では実行しない。

## Completion criteria

- hover 可能な PC 環境で、Toolbar の「行を並べ替え」から正しい row control へキーボードで到達できる。
- 待機中に `Tab` / `Shift+Tab` で移動可能な row control 間を論理順に移動できる。
- `Enter` と `Space` の双方を用いて、キーボード並べ替えの開始・確定が実ブラウザで成立する。
- `ArrowUp` / `ArrowDown` による前後方向の代表的な移動が成立する。
- 確定時に Gutenberg の Table 編集内容の行順が期待どおり更新される。
- `Escape` キャンセル時に Table 内容が変わらない。
- 並べ替え中は対象 row control にフォーカスを維持し、確定後は移動後の同じ行、キャンセル後は操作開始時の同じ行へフォーカスが保たれる。
- 行数の多い Table で `ArrowDown` / `ArrowUp` を連続操作したとき、必要に応じて縦スクロールが追従する。
- スクロール追従後も現在の挿入線が editor viewport 内にあり、利用者が移動先を見失わない。
- `ArrowDown` 操作中は操作中案内が viewport 上側、`ArrowUp` 操作中は viewport 下側へ切り替わり、進行方向を妨げない。
- iframe / non-iframe の両方で代表的なキーボード並べ替えが成立する。
- Mouse / Touch 操作、結合セル制約、Undo、live region 通知など他 Issue の責務を重複してテストしない。
- 固定時間の `waitForTimeout()` や controller 内部 state、厳密な CSS 座標値を主要な期待値にしない。

## Notes

- #253 ですでに keyboard coachmark と Toolbar 入口から row control への到達の一部を確認している。#257 では同じ coachmark を重複して網羅せず、実際のキーボード並べ替えフローへ責務を進める。
- 現在行を識別できる場合の Toolbar 入口は、その行が移動可能なら当該 row control を優先する。現在行を識別できない場合は先頭の移動可能行を使う。現在行が移動不能、または移動可能行が存在しない場合の理由通知は #261 の責務とする。
- キーボード操作中のスクロール追従、挿入線の視認、`ArrowDown` / `ArrowUp` に応じた操作中案内の上下切り替えは、#261 へ分割せず #257 の一連のキーボード操作として確認する。
- #261 は accessible name / role / state、live region、通知文言などアクセシビリティ情報提供の確認に集中させる。
- Jest で固定済みの禁止位置スキップ、元位置 no-op、pointer / Sortable lifecycle 競合などは Playwright で重複させない。