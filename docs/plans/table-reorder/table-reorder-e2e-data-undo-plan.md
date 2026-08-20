# PLAN-260: Table Reorder E2E データ保持・Undo

## References

- Parent issue: #252
- Implementation issue: #260
- Merged-cell constraints follow-up: #259
- Accessibility UI / focus / notification follow-up: #261
- Test responsibility map: `docs/development/testing.md`
- E2E implementation instructions: `tests/e2e/AGENTS.md`
- Requirements: `docs/requirements/table-reorder/table-reorder-requirements.md`
- Accessibility requirements: `docs/requirements/table-reorder/table-reorder-accessibility-requirements.md`
- Design: `docs/design/table-reorder/table-reorder-design.md`
- Accessibility design: `docs/design/table-reorder/table-reorder-accessibility-design.md`

## Goal

Table Reorder で行を確定移動したときに、行の位置だけが変わり、セル内容・セル属性・装飾が保持されること、および一回の行移動を WordPress / Gutenberg の一回の Undo で元に戻せることを、実ブラウザ上の Playwright E2E で固定する。

本プランは #252 の方針に従い、各入力方式の基本操作を再テストするものではない。既存の PC pointer DnD、PC single-pointer、keyboard、Touch DnD、Touch single-pointer の E2E が「その入力で行移動を確定できること」を担当し、#260 ではその確定結果が Gutenberg の編集データ・Undo 履歴へ正しく接続されることを入力方式横断で確認する。

E2E を保存形式の全文スナップショットテストにはしない。利用者が編集したセル内容・属性・装飾が論理的に同じ行へ追従することと、Undo 後に行順とデータが元へ戻ることを主要な観測点とする。

## Scope

### Included

- `core/table` を使った代表的なデータ保持 fixture
- 行移動後も、対象行のセル内容が保持されること
- 行移動後も、対象行のセル属性が保持されること
- 行移動後も、対象行の装飾が保持されること
- 行移動後は行順だけが変わり、他の行の内容が意図せず変化しないこと
- 一回の確定した行移動を、一回の Gutenberg Undo で元の行順へ戻せること
- Undo 後もセル内容・属性・装飾が元の行に保持されたままであること
- PC pointer DnD、PC single-pointer、keyboard、Touch 系のうち、異なる commit 経路を代表する入力方式で Undo 契約を横断確認すること
- iframe / non-iframe の両編集環境で、代表的なデータ保持・Undo が成立すること
- assertion は Gutenberg の利用者向け編集内容と WordPress の Undo 結果を基準にし、controller 内部 state や SortableJS の内部状態を主要 assertion にしないこと

### Not included

- 各入力方式の開始・移動・確定・キャンセル操作そのものの再テスト。#255 / #256 / #257 / #258 / #360 を正とする。
- `rowspan` / `colspan` の移動可否制約そのものの再テスト。#259 を正とする。
- accessible name / role / state、live region、通知、フォーカス遷移の詳細。#261 を正とする。
- 初回 coachmark や Touch 初回操作。#382 を正とする。
- Core Table の全ての cell schema、全ての RichText mark、全ての色・typography・border 設定の網羅
- 保存済み post を reload した後の永続化確認。#260 の主眼は確定移動時の編集データ保持と Undo 履歴であり、保存 API / reload の別統合境界は扱わない。
- Redo の追加検証。要件は「一回の行移動を一回の Undo で戻せること」であり、Redo は完了条件に含めない。
- Flexible Table Block の E2E。Core Table の #260 が完了した後に別途扱う。
- 製品コードの変更

## Source-of-truth mapping

参照文書と E2E で固定する観測点を次のように対応付ける。

| Source of truth | Required behavior | #260 E2E observation |
| --- | --- | --- |
| 基本要件 FR-03 / §9 | 移動後もセル内容、セル属性、装飾を保持する | 装飾付き対象行を移動し、移動後の同じ論理行から内容・属性・装飾を確認する |
| 基本要件 FR-04 / §9 | 一回の行移動を一回の Undo で戻せる | 1回だけ Undo を実行し、元の行順へ戻ることを確認する |
| 基本要件 FR-05 / FR-06 | 確定時だけデータを更新し、無効操作では変更しない | #260 では確定成功後のデータと Undo を対象とし、no-op / cancel の詳細は各操作 Issue を正とする |
| 基本設計 §7 | 行の位置だけを変更し、セル内容・属性・装飾を保持する | 移動前後で対象行の意味的データが同一であることを確認する |
| 基本設計 §7 / §10 | 一回の確定移動は一回の Undo、iframe / non-iframe で同じ意味 | 代表ケースを両 editor canvas で実行する |
| A11Y要件 A11Y-FR-11 / §11 | キーボード・単一ポインターでもデータ保持・Undo を共有する | keyboard / single-pointer の代表 commit でも一回の Undo で戻ることを確認する |

## Approach

### 1. データ保持用の代表 fixture を一つ用意する

`tests/e2e/table-reorder.ts` に、#260 でのみ必要な意味のある Core Table fixture を追加するか、専用 spec 内に小さく定義する。

4行程度の Table とし、通常行の一つを `Rich Bravo` のような一意な対象行にする。対象行には、WordPress Core Table が正式に保持する保存形式だけを使って、次の3種類を含める。

- **セル内容**: plain text だけでなく、リンクや強調などの RichText 内容
- **セル属性**: Core Table の cell schema で保存される代表属性を1つ以上
- **装飾**: Core Table が正式に保存する alignment / color / style 等から、現行 WordPress で安定して保持される代表値を1つ以上

fixture の具体的な属性・装飾は実装時に現在の WordPress Core Table の保存形式を確認して決める。E2E の都合で任意の `data-*` や WordPress が保存しない属性を人工的に注入しない。

`rowspan` / `colspan` をデータ保持 fixture の主要要素にはしない。結合セル属性を使うと #259 の移動制約と責務が混ざるため、#260 では通常移動できる行でセルデータ保持そのものを確認する。

### 2. 保存マークアップ全文ではなく、意味的なデータ保持を確認する

移動前後の `editor.getEditedPostContent()` 全文をスナップショット比較する方式にはしない。WordPress が属性順や markup の正規化を変更しただけで壊れる脆いテストになるためである。

主要 assertion は次とする。

- `Rich Bravo` が期待する新しい行位置へ移動している
- `Rich Bravo` のセルに期待する text / link / emphasis 等が残っている
- 対象セルの代表属性が残っている
- 対象セルの代表装飾が残っている
- `Alpha` / `Charlie` / `Delta` など他行の内容が元のままである

必要に応じて edited post content を補助 assertion に使ってよいが、全文一致や内部 block attribute object の直接比較を主要判定にしない。

### 3. データ保持の詳細確認は1つの代表 commit に集約する

セル内容・属性・装飾の詳細保持は、最も安定して実行できる既存 commit 経路1つで深く確認する。

第一候補は PC single-pointer とする。

理由:

- drag 座標や Touch gesture に依存せず deterministic に対象行と destination を指定しやすい
- destination click から Gutenberg data commit までの実ブラウザ統合を確認できる
- rich fixture の内容検証に操作ノイズを持ち込みにくい

既存 E2E 構造を確認した結果、keyboard の方が共通 helper を自然に再利用できる場合は keyboard を代表にしてもよい。重要なのは、詳細なデータ保持を全入力方式で反復しないことである。

### 4. Undo は異なる commit 経路を代表して横断確認する

#260 は「入力方式横断」の分類なので、Undo を1経路だけに限定しない。ただし5方式すべての直積網羅にもならないようにする。

代表として少なくとも次を含める。

- **SortableJS drag commit 系**: PC pointer DnD または Touch DnD のどちらか一つ
- **controller の非 drag commit 系**: keyboard または single-pointer のどちらか一つ

さらに A11Y-FR-11 の共有を明示するため、非 drag 側は keyboard または single-pointer を必ず含める。

Touch 固有 commit が PC drag と同じ製品 commit 境界へ合流しており、既存 #258 / #360 で入力自体が十分に固定されている場合は、#260 で Touch Undo を重複追加しない。実装時に既存 spec と commit 経路を確認し、異なる data commit 境界を最小ケース数で代表する。

### 5. Undo は Gutenberg の利用者操作として1回だけ実行する

行移動確定後、WordPress / Gutenberg の Undo を利用者向け経路で一回だけ実行する。

優先順位は次とする。

1. `@wordpress/e2e-test-utils-playwright` に安定した editor Undo helper があればそれを使う。
2. そうでなければ Gutenberg の公開された利用者操作として keyboard shortcut または editor UI を使う。
3. `wp.data.dispatch( 'core/editor' )` など内部 store を直接操作して履歴を巻き戻す方法は、E2E の主要操作には使わない。

確認すること:

- 1回の Undo で元の行順へ戻る
- 追加の Undo を必要としない
- 対象行のセル内容・属性・装飾は元の位置へ戻った後も保持されている

「Undo stack の件数」など内部 history state は assertion しない。利用者が1回 Undo した結果だけを確認する。

### 6. 行移動の前処理を Undo 履歴へ混ぜない

テスト setup で `editor.setContent()` などを使って fixture を投入した直後は、初期 content 設定自体が Undo 履歴に残る可能性がある。

そのため、実装時は既存 WordPress E2E helper の挙動を確認し、行移動前に baseline を確立する。

候補:

- `editor.setContent()` 後に Gutenberg の編集状態が安定するまで待つ
- 必要なら post save / dirty-state reset など、既存 helper が提供する正式な境界を使って baseline を作る
- テスト専用に private history store を直接初期化しない

目的は「行移動の一回」が、利用者にとって次の Undo 一回で戻る状態を deterministic に作ることである。

### 7. iframe / non-iframe は代表ケースに横断適用する

#252 の方針どおり、iframe / non-iframe を全ケースへ機械的に掛けない。

最低限、データ保持 + Undo の中心シナリオを両 editor canvas で実行する。

- 行移動前の rich data を確認
- 行移動を1回確定
- 移動後の row order と rich data を確認
- Undo を1回実行
- 元の row order と rich data を確認

追加の input-path 横断 Undo ケースは、同じ editor canvas の重複が増えない最小構成にする。

### 8. Jest と Playwright の責務を分ける

既存 Jest / controller tests は、`reorderRows()` や各 input session から `onCommit()` へ到達する分岐・境界を扱える。

Playwright では次の実ブラウザ境界だけを確認する。

- 実際の Gutenberg Table データに rich cell data がある
- 行移動 commit 後もそのデータが同じ論理行へ追従する
- WordPress editor の Undo history に1回の行移動として積まれる
- 利用者が Undo を1回実行すると元へ戻る
- iframe / non-iframe の違いを越えて同じ結果になる

`reorderRows()` の配列結果、`onCommit()` の呼び出し回数、WordPress store の history object などは E2E の主要 assertion にしない。

## Test structure

基本ファイルは次とする。

- `tests/e2e/table-reorder-data-undo.spec.ts`

共通操作は、既存 `tests/e2e/table-reorder.ts`、`tests/e2e/editor-context.ts`、各 input spec の helper を確認して再利用する。

既存 input spec 内に閉じている helper を #260 でも使う必要がある場合は、同じ利用者操作を表す最小 helper だけを `table-reorder.ts` 等へ引き上げる。#260 のためだけに大きな page object や抽象 interaction framework を新設しない。

候補 helper:

- rich data fixture の対象行を visible text から取得する helper
- 対象セルの意味的な content / attribute / decoration を確認する helper
- Gutenberg Undo を利用者向け経路で1回実行する小さな helper
- 既存 input spec から再利用可能にした最小の row-move helper

## Test scenarios

### Scenario A: rich cell data を保持して移動し、1回の Undo で戻る

中心シナリオ。iframe / non-iframe の両方で実行する。

1. rich data fixture を editor に投入する。
2. `Rich Bravo` の content / attribute / decoration が初期状態で存在することを確認する。
3. PC single-pointer または keyboard の代表経路で `Rich Bravo` を別位置へ1回移動する。
4. 行順が期待どおり変化したことを確認する。
5. 移動後の `Rich Bravo` に content / attribute / decoration が保持されていることを確認する。
6. 他行の content が変化していないことを確認する。
7. Gutenberg Undo を1回実行する。
8. 行順が初期状態へ戻ったことを確認する。
9. 元の位置へ戻った `Rich Bravo` に content / attribute / decoration が保持されていることを確認する。

### Scenario B: drag commit も1回の Undo で戻る

異なる commit 経路の代表確認。

1. 単純な Core Table fixture を使う。
2. PC pointer DnD または Touch DnD で行を1回移動する。
3. 行順が更新されたことを確認する。
4. Undo を1回実行する。
5. 元の行順へ戻ることを確認する。

このシナリオでは rich data の詳細を再検証しない。目的は drag commit も同じ Undo 契約を共有することの確認である。

### Scenario C: accessibility commit 経路も同じ Undo 契約を共有する

Scenario A が keyboard / single-pointer なら、その結果を A11Y-FR-11 の代表確認として兼用する。

Scenario A を PC pointer 系で実装した場合だけ、keyboard または single-pointer で単純な行移動 → Undo 1回 → 元順復帰を追加する。

同じ意味のケースを重複させない。

## Implementation phases

### Phase 1: fixture と Undo baseline を確立する

Outcome:

- #260 の中心シナリオを deterministic に開始できる test data と Undo baseline が定義される。

Tasks:

- 現行 WordPress Core Table の保存形式を確認し、content / attribute / decoration を含む最小 fixture を決める。
- fixture は Core Table が正式に保存する属性だけを使う。
- `editor.setContent()` 等の初期投入が Undo 履歴へ与える影響を確認する。
- private WordPress store を直接操作せず、行移動が次の Undo 一回で戻る baseline 作成方法を決める。
- 対象 row / cell を semantic に取得できる locator を決める。

Validation:

- rich data fixture が Gutenberg で正しく読み込まれ、対象 content / attribute / decoration を安定して観測できること。
- 行移動前の baseline から Undo シナリオを開始できること。

### Phase 2: 中心のデータ保持 + Undo シナリオを実装する

Outcome:

- 行移動後の data preservation と一回 Undo の契約が、実ブラウザで一連の利用者操作として固定される。

Tasks:

- `tests/e2e/table-reorder-data-undo.spec.ts` を追加する。
- Scenario A を実装する。
- 行移動後の row order を確認する。
- rich target row の content / attribute / decoration を意味的に確認する。
- Gutenberg Undo を利用者向け経路で一回実行する。
- 元の row order と rich data が戻ることを確認する。
- 固定時間の `waitForTimeout()` を使わず、行順・editor state・locator visibility 等の状態で待つ。

Validation:

- Scenario A が Chromium で安定して Green になること。
- implementation detail を主要 assertion にしていないこと。

### Phase 3: 異なる commit 経路の Undo を横断確認する

Outcome:

- drag commit と accessibility commit が同じ一回 Undo 契約を共有していることを、最小ケース数で確認できる。

Tasks:

- Scenario A で使った input path を確認する。
- Scenario B と、必要な場合のみ Scenario C を追加する。
- 既存 input spec の helper を再利用し、入力方式を別方式で代用しない。
- PC pointer DnD を単一ポインター click で代用しない。
- Touch を使う場合は mouse / pointer drag で代用しない。
- input 固有の基本操作 assertions を #260 に重複させない。

Validation:

- 各代表 commit 後に1回の Undo だけで元の行順へ戻ること。
- 追加ケースが #255 / #256 / #257 / #258 / #360 の基本操作テストを不要に複製していないこと。

### Phase 4: iframe / non-iframe と責務境界を確認する

Outcome:

- #260 の中心契約が editor canvas の違いを越えて成立し、他 Issue / Jest との責務が重複しすぎていない。

Tasks:

- Scenario A を iframe / non-iframe の両方で確認する。
- `getEditorContext()` を使い、editor canvas 差を spec 内へ散らさない。
- #259 / #261 / #382 の責務を取り込んでいないことを確認する。
- Jest で十分な純粋ロジック・内部 callback assertion を E2E に追加していないことを確認する。

Validation:

- 両 editor canvas で Scenario A が Green になること。
- E2E 全体で固定時間待ちや内部 state 依存が増えていないこと。

## Decisions and validation questions

### Decide before implementation

- rich data fixture で使う具体的な Core Table cell attribute / decoration。現行 WordPress が正式に round-trip する保存形式を選ぶ。
- Gutenberg Undo の利用者向け操作方法。公式 E2E helper が利用できる場合はそれを優先する。
- Scenario A の input path。詳細 data assertion を最も deterministic に実装できる既存経路を選ぶ。
- Scenario B の drag input。既存 helper と安定性を優先し、PC pointer DnD または Touch DnD の一方に絞る。

### Validate during implementation

- `editor.setContent()` 後に Undo baseline を作るため追加操作が必要か。
- rich cell の decoration を DOM / accessible representation / edited content のどこから最も安定して確認できるか。
- Undo 後の editor update をどの user-observable state で deterministic に待てるか。
- 既存 input helper のうち、#260 用に共通 helper へ引き上げる価値があるものがあるか。

## Issue breakdown

- [ ] #260: Core Table のデータ保持・Undo E2E を実装する。
- [ ] Flexible Table Block の同等 E2E は Core Table 完了後に別途検討する。

新しい子 Issue は、本プランレビュー後に境界が安定し、実装を分割する必要が生じた場合だけ作成する。

## Validation

実装時は `docs/development/testing.md` と `tests/e2e/AGENTS.md` を正とする。

- `npm test`
  - Expected: Node.js quality gate がすべて成功する。
- `npm run build`
  - Expected: production build が成功する。
- `npm run test:e2e -- tests/e2e/table-reorder-data-undo.spec.ts`
  - Expected: #260 の focused E2E が Chromium で成功する。
- `npm run test:e2e`
  - Expected: 既存 Table Reorder E2E を含む全 E2E が成功する。
- `git diff --check origin/main...HEAD`
  - Expected: whitespace error がない。

`wp-dev` の互換 WordPress 環境が利用できない場合、E2E を成功扱いにせず未実行理由を報告する。

## Completion criteria

- `core/table` の代表 fixture で、行移動後もセル内容が保持される。
- 同じ fixture で、行移動後も代表的なセル属性が保持される。
- 同じ fixture で、行移動後も代表的な装飾が保持される。
- 行移動後、対象行以外のデータが意図せず変化していない。
- 一回の確定した行移動が、一回の Gutenberg Undo で元の行順へ戻る。
- Undo 後も対象行のセル内容・属性・装飾が保持されている。
- drag commit 系と accessibility / non-drag commit 系の代表経路で、同じ一回 Undo 契約が成立する。
- A11Y-FR-11 に基づき、keyboard または single-pointer の代表経路でデータ保持・Undo の共有が確認される。
- 中心シナリオが iframe / non-iframe の両方で成立する。
- PC / Touch / keyboard の各基本操作を #260 で過剰に再テストしていない。
- `rowspan` / `colspan` 制約、アクセシビリティ UI、初回 coachmark の責務を取り込んでいない。
- 固定時間の `waitForTimeout()` に依存していない。
- controller、SortableJS、WordPress history store の内部状態を主要 assertion にしていない。
- E2E のためだけに製品コードを変更していない。

## Notes

- #260 の価値は「配列の並び替えが正しい」ことではなく、実 WordPress / Gutenberg 上で **行の意味的なデータを壊さず、編集履歴として一回の操作にまとまること** を固定する点にある。
- rich data fixture は仕様を証明する最小限に留める。装飾の種類を増やして保存形式カタログにしない。
- WordPress の保存 markup 正規化は将来変わり得るため、全文 string equality より semantic assertion を優先する。
- Undo の操作入口は WordPress の公開された利用者操作を使い、テスト専用に history を直接操作しない。
