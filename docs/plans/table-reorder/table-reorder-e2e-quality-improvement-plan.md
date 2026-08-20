# PLAN-389: Table Reorder E2E 品質向上対応

## References

- Issue: #389
- Parent issue: #252
- Startup / UI E2E issue: #253
- PC pointer DnD E2E issue: #255
- PC single-pointer E2E issue: #256
- Touch single-pointer E2E issue: #360
- Startup / UI E2E plan: `docs/plans/table-reorder/table-reorder-e2e-startup-ui-plan.md`
- PC pointer DnD E2E plan: `docs/plans/table-reorder/table-reorder-e2e-pc-pointer-dnd-plan.md`
- PC single-pointer E2E plan: `docs/plans/table-reorder/table-reorder-e2e-pc-single-pointer-plan.md`
- Test responsibility map: `docs/development/testing.md`
- E2E implementation instructions: `tests/e2e/AGENTS.md`
- Requirements: `docs/requirements/table-reorder/table-reorder-requirements.md`
- Accessibility requirements: `docs/requirements/table-reorder/table-reorder-accessibility-requirements.md`
- Design: `docs/design/table-reorder/table-reorder-design.md`
- Accessibility design: `docs/design/table-reorder/table-reorder-accessibility-design.md`

## Goal

#253 / #255 / #256 の実装完了後に設計書との再確認で見つかった、実ブラウザで確認する価値のある追加ケースを Playwright E2E に補完する。

本対応は既存 E2E の分類と入力経路を維持したまま、次の3点を品質向上として追加する。

1. 初回案内と通常操作の境界を、実 WordPress / Gutenberg 上で固定する。
2. PC の実 mouse DnD 中に viewport を越えて下方向へスクロールし、画面外だった有効な移動先へ drop できることを固定する。
3. PC のドラッグ不要の単一ポインター操作で、アクセシビリティ基本設計に定義されているフォーカス遷移を固定する。

E2E を網羅テストにはしない。既存 Jest が担当できる controller state、細かな分岐、CSS の具体値、SortableJS 内部挙動は重複して検証せず、実ブラウザ・WordPress・入力デバイス・フォーカス管理が接続される統合境界だけを対象とする。

## Scope

### Included

#### 起動・UI表示

`tests/e2e/table-reorder-ui.spec.ts` に、初回案内と通常操作の境界を追加する。

- 初回状態でも、PC の通常ポインター操作では Keyboard コーチマークを表示しない。
- Keyboard コーチマークを一度終了した後、Table を選択し直しても自動再表示しない。
- Touch 初回案内が未終了の最初の Table 操作では、セル編集を開始せず Table を選択し、Toolbar の「行を並べ替え」へフォーカスを移し、Touch コーチマークを表示する。
- Touch コーチマーク表示中は reorder mode が OFF のままで、同じ Toolbar control の通常 Tooltip を同時表示しない。
- 「行を並べ替え」をタップすると touch reorder mode に入り、行 control と操作案内を表示する。
- Touch 初回向けの特別な操作制御は最初の操作だけとし、その後の Table 操作では通常のセル編集を妨げない。

#### PC ポインター DnD

`tests/e2e/table-reorder-pointer-dnd.spec.ts` に、下方向 auto-scroll の代表ケースを1件追加する。

- viewport を越える縦長の Core Table を使う。
- drag 開始時点では drop 先を画面外に置く。
- 行ハンドルから mouse drag を開始した後、viewport 下端付近へポインターを移動してスクロールを成立させる。
- スクロール前は画面外だった有効な移動先まで drag を継続し、drop する。
- drag 中に実際にスクロール位置が下方向へ変化したことと、drop 後の Table 行順が期待どおり更新されたことを確認する。

#### PC ドラッグ不要の単一ポインター操作

`tests/e2e/table-reorder-pc-single-pointer.spec.ts` に、アクセシビリティ基本設計 §6 のフォーカス要件を追加する。

- 行ハンドルをクリックして移動対象を選択した後、対象行の row control がフォーカスされている。
- 移動先 UI を表示しただけでは、最初の移動先へ自動的にフォーカスが移っていない。
- 有効な移動先をクリックして確定した後、移動後の同じ行に対応する row control にフォーカスがある。
- Escape でキャンセルした後、操作開始時の同じ行の row control にフォーカスが戻る。
- E2E 追加に合わせて `table-reorder-e2e-pc-single-pointer-plan.md` の Phase / Completion criteria に同じフォーカス責務を同期する。

### Not included

- Flexible Table Block の追加ケース
- iframe / non-iframe の追加マトリクス。#256 の追加フォーカスケースは、既存 PR #361 の両環境検証を重複しない。
- PC DnD の上方向 auto-scroll。下方向1ケースを代表とする。
- Touch DnD、Touch destination-tap、Keyboard reorder の追加ケース
- Touch 初回案内の見た目の座標、フェード時間、Popover 内部 DOM の固定
- Tooltip の CSS 位置や z-index の具体値検証
- SortableJS の内部 state、callback 順序、auto-scroll 内部実装の直接検証
- controller の内部 state を主要 assertion にすること
- 製品コードの変更
- E2E のためだけの新規 page object / 大規模 fixture 層
- 要件定義書・基本設計書の仕様変更。既存の正本仕様を E2E へ反映することが本 Issue の責務であり、新しい製品仕様は追加しない。

## Approach

### 既存 spec の責務を維持する

新しい統合 spec を増やさず、既存分類へ追加する。

- 起動・UI表示: `table-reorder-ui.spec.ts`
- PC mouse DnD: `table-reorder-pointer-dnd.spec.ts`
- PC click destination flow: `table-reorder-pc-single-pointer.spec.ts`

各シナリオで既存 `getEditorContext()` と Table Reorder E2E helper を再利用し、同じ利用者操作を表す helper を重複させない。

### 初回案内は preference と「最初の操作」を決定的に作る

初回案内ケースは WordPress の保存済み利用者状態へ依存させない。

- `core/preferences` の `yamabiko-editor-tools` scope を各テストで明示的に設定する。
- Keyboard と Touch の dismissal state を、対象シナリオに合わせて個別に決める。
- コーチマーク非表示の確認では「まだ表示されていない」だけでなく、対象となる通常操作を実際に行った後も表示されないことを確認する。
- Touch 初回案内では、最初の Table 操作前後の focus / selection / coachmark / reorder mode を user-observable state で確認する。
- 「セル編集を開始しない」は、最初の操作後に cell の editing context へフォーカスが残っていないことと Toolbar control へ実フォーカスが移っていることの組み合わせで確認する。
- 初回処理後の通常セル編集は、同じ Table のセルを再度 tap し、セルが通常の編集状態へ入れることを確認する。

### Tooltip の重複は利用者に見える状態だけを検証する

Touch コーチマーク表示中に同じ Toolbar control の通常 Tooltip が重ならないことを確認するが、Tooltip 実装の class 名や座標は固定しない。

- Toolbar の「行を並べ替え」にフォーカスがある。
- Touch コーチマークが表示されている。
- 通常 Tooltip の利用者向けテキストが同時に visible になっていない。

WordPress 側 Tooltip の semantic locator が安定して取得できない場合は、テスト専用の内部属性追加ではなく、現行 DOM で利用者向けに識別できる最小 locator を選ぶ。

### DnD auto-scroll では drop 先を事前に表示しない

既存 `dragWithMouse()` は source と target の両方へ `scrollIntoViewIfNeeded()` を行うため、今回の「drag 中に画面外の移動先へ到達する」ケースにはそのまま使わない。

auto-scroll シナリオでは次の順序を守る。

1. 縦長 Table の source 行を viewport 内に置く。
2. target 行が viewport 外にあることを確認する。
3. source の行ハンドルから実 mouse drag を開始する。
4. pointer を viewport 下端近くへ移動する。
5. editor の scroll container または page の scroll position が開始時より増加することを `expect.poll()` などで待つ。
6. スクロール後に target の位置を再取得する。
7. target の有効な挿入位置まで pointer を移動して drop する。
8. Table の利用者向け行順と edited post content で確定結果を確認する。

既存 helper を拡張する場合は既存3ケースの意味を変えない optional behavior に限定する。auto-scroll 特有の制御が明確に異なる場合は、小さな専用 helper として同 spec 内へ置く。

固定時間の `waitForTimeout()` は使用しない。スクロール成立、target の可視化、drop 後の行順変更をそれぞれ状態で待つ。

### PC single-pointer のフォーカスは DOM identity ではなく利用者の操作対象で追う

行移動後は DOM node が再配置・再生成される可能性があるため、確定後の focus assertion は「移動前に取得した Locator が同じ node であること」を前提にしない。

- 操作対象行をセル内容などの利用者向け識別子で追跡する。
- 確定後は更新後の行位置に対応する row control を accessible name から再取得し、`toBeFocused()` を確認する。
- キャンセル後は元の行位置・対象名に対応する row control を再取得して確認する。
- destination 表示直後は、対象 row control が focused のままであることを主要 assertion とし、destination 側へ focus が移っていないことを補完する。

## Test data

### 起動・UI表示

既存 `BASIC_TABLE_CONTENT` を基本とし、新しい fixture を増やさない。

必要な状態:

- Core Table 3行
- Table 外の Paragraph
- Keyboard / Touch coachmark preference をシナリオごとに設定

### PC DnD auto-scroll

auto-scroll 用に viewport を越える Core Table を同 spec 内へ追加する。

要件:

- 各行を `Row 01`, `Row 02`, ... のように一意に識別できる。
- source は開始時に viewport 内へ表示できる。
- target は開始時に viewport 外にあり、下方向スクロール後に到達できる。
- rowspan / colspan、画像、装飾など今回と無関係な要因を含めない。
- 行数は「確実に viewport を越える」ために必要な最小限とし、過剰に増やさない。

### PC single-pointer focus

既存 `basicTableContent` と `basicRowLabels` を再利用する。

- `Bravo` など一意な行内容を操作対象として追跡する。
- 確定ケースは移動後に row number が変わる位置を選び、同じ論理行へ focus が追従したことを確認できるようにする。

## Implementation phases

### Phase 1: 起動・UI表示の初回案内境界を補完する

Outcome:

- Keyboard / Touch の初回案内が、通常ポインター操作・dismissal・セル編集・touch reorder mode と正しく分離されていることを実ブラウザで固定する。

Tasks:

- `table-reorder-ui.spec.ts` の preference helper を、必要なら Keyboard / Touch を個別に設定できる最小形へ調整する。
- PC 通常ポインター操作で Keyboard コーチマークが表示されないケースを追加する。
- Keyboard コーチマーク終了後に Table を選択し直しても再表示しないケースを追加する。
- Touch 初回の最初の Table 操作で、Table selection、Toolbar control focus、coachmark 表示、reorder mode OFF、セル非編集を確認する。
- Touch coachmark 表示中に通常 Tooltip が同時表示されないことを確認する。
- Toolbar control の tap 後に reorder mode ON、行 control、touch guidance を確認する。
- 初回処理後にセルを再操作し、通常編集できることを確認する。

Validation:

- 各テストが自身で preference state を構築し、テスト順に依存しない。
- 初回案内以外のケースで coachmark が偶発的にテストを妨げない。
- Tooltip の内部 class / CSS 座標を assertion にしない。

### Phase 2: PC DnD の下方向 auto-scroll を補完する

Outcome:

- 実 mouse drag を継続したまま editor を下方向へスクロールし、開始時に画面外だった有効な移動先へ drop して行順を更新できる。

Tasks:

- `table-reorder-pointer-dnd.spec.ts` に縦長 Core Table fixture を追加する。
- source 表示後も target を事前 `scrollIntoViewIfNeeded()` しない auto-scroll 用 drag 経路を用意する。
- drag 開始前の scroll position を記録する。
- pointer を viewport 下端付近へ移動し、scroll position の増加を deterministic に待つ。
- スクロール後に target の bounding box を再取得し、有効な挿入位置へ drag を継続する。
- drop 後に行順と edited post content を確認する。

Validation:

- drag 前は target が viewport 外にある。
- mouse button を押した後に scroll position が増えている。
- target への drop 後に期待した行順へ変わっている。
- 既存の通常 DnD / no-op / cell drag ケースの helper semantics を壊していない。

### Phase 3: PC single-pointer のフォーカス遷移を補完する

Outcome:

- アクセシビリティ基本設計 §6 の focus lifecycle が、実ブラウザの click / Escape 操作で成立する。

Tasks:

- 行ハンドル click 後に対象 row control が focused であることを追加確認する。
- destination 表示直後も対象 row control の focus が維持され、destination へ自動移動していないことを確認する。
- 確定後、移動後の同じ論理行に対応する row control を再取得して focus を確認する。
- Escape 後、操作開始時の同じ論理行に対応する row control を再取得して focus を確認する。
- 既存の行順・guidance・destination lifecycle assertion は残し、focus だけにテスト責務を寄せすぎない。
- `docs/plans/table-reorder/table-reorder-e2e-pc-single-pointer-plan.md` の Included / Approach / Phase / Completion criteria のうち必要な箇所へ focus lifecycle を同期する。

Validation:

- focus assertion が accessible row control を基準にしている。
- 確定後の row number 変更に追従して locator を再解決する。
- iframe / non-iframe の追加重複ケースは作らない。

### Phase 4: 対象 E2E と品質ゲートを確認する

Outcome:

- #389 の追加ケースが既存 E2E を壊さず、計画した入力経路のまま安定して実行できる。

Tasks:

- まず変更した3 spec を個別または絞り込みで実行する。
- 互換性のある `wp-dev` 環境が利用可能なら全 E2E を実行する。
- TypeScript / lint / unit coverage / build の既存品質ゲートを実行する。
- whitespace error を確認する。

Validation policy:

- E2E の操作同期に固定時間待ちを追加しない。
- Touch / mouse / click destination の入力経路を相互代用しない。
- 失敗時は user-observable state と Playwright trace を優先して原因を切り分け、製品コードへテスト専用 workaround を入れない。

## Decisions and validation questions

### Decide before implementation

- なし。#389 の追加ケース、対象 spec、上方向 auto-scroll を追加しないこと、iframe / non-iframe を重複しないことは Issue で決定済みとする。

### Validate during implementation

- WordPress Toolbar の通常 Tooltip を、現在の Gutenberg DOM でどの semantic locator から安定して識別できるか。
- PC DnD の実際の scroll container が page / editor canvas / その祖先のどれになるか。開始前後の scroll position を観測して、現在の editor 構造に合う最小の対象を選ぶ。
- auto-scroll を既存 `dragWithMouse()` の optional behavior として安全に表現できるか。既存ケースを複雑化する場合は専用 helper を選ぶ。
- Touch 初回処理後の「通常セル編集」を、現在の Gutenberg の編集 DOM で最も利用者視点に近く安定した assertion としてどう確認するか。

これらは実装前に仕様判断を必要とせず、現行 DOM / browser behavior を確認しながら決められるテスト実装上の詳細とする。

## Issue breakdown

本 Issue は既存 E2E の小規模な品質向上として1 PR で扱う。追加の子 Issue は作成しない。

- [ ] Phase 1: 起動・UI表示の初回案内境界
- [ ] Phase 2: PC DnD 下方向 auto-scroll
- [ ] Phase 3: PC single-pointer focus lifecycle と正本プラン同期
- [ ] Phase 4: E2E / 品質ゲート確認

## Validation

実装時は `docs/development/testing.md` を正として、変更範囲に応じて次を実施する。

- `npm test`
  - format / lint / typecheck / Jest coverage が成功する。
- `npm run build`
  - production build が成功する。
- 対象 E2E spec の実行
  - `table-reorder-ui.spec.ts`
  - `table-reorder-pointer-dnd.spec.ts`
  - `table-reorder-pc-single-pointer.spec.ts`
- `npm run test:e2e`
  - 互換性のある `wp-dev` 環境が利用可能な場合、全 E2E が成功する。
- `git diff --check origin/main...HEAD`
  - whitespace error がない。

手動検証は Issue 担当者が実施する。自動 E2E 実装側では、手動検証結果を成功扱いとして代用しない。

## Completion criteria

### 起動・UI表示

- 初回状態でも PC の通常ポインター操作だけでは Keyboard コーチマークを表示しない。
- Keyboard コーチマークを終了した後、Table 再選択で自動再表示しない。
- Touch 初回の最初の Table 操作ではセル編集を開始せず、Table が選択され、Toolbar の「行を並べ替え」へ focus が移り、Touch コーチマークが表示される。
- Touch コーチマーク表示中も reorder mode は OFF であり、同じ Toolbar control の通常 Tooltip を同時表示しない。
- Toolbar control の tap で reorder mode が ON になり、行 control と touch guidance が表示される。
- Touch 初回向けの特別な制御後は、通常の cell tap で編集できる。

### PC ポインター DnD

- viewport を越える Core Table を使った代表ケースがある。
- target が開始時に viewport 外である。
- mouse drag 中に下方向への scroll が成立したことを状態で確認している。
- scroll 後に到達した有効な移動先へ drop できる。
- drop 後の行順と edited post content が期待どおり更新される。
- 上方向 auto-scroll を重複追加していない。

### PC single-pointer focus

- 行ハンドル click 後、対象 row control が focused である。
- destination 表示だけでは focus が最初の destination へ自動移動しない。
- 確定後、移動後の同じ論理行の row control が focused である。
- Escape 後、操作開始時の同じ論理行の row control が focused である。
- `table-reorder-e2e-pc-single-pointer-plan.md` に focus lifecycle が同期されている。
- iframe / non-iframe の重複テストを追加していない。

### 共通

- 固定時間の `waitForTimeout()` に依存していない。
- user-observable state を最終 assertion にしている。
- SortableJS や controller の内部 state / event order を主要 assertion にしていない。
- Touch / mouse / click destination の入力経路を相互代用していない。
- 製品コードを E2E の都合だけで変更していない。
- `npm test`、`npm run build`、適用可能な E2E、`git diff --check origin/main...HEAD` の結果が記録されている。

## Notes

- #389 は、完了済みの元 Issue を再オープンせず、設計書との再確認で見つかった追加 E2E の価値あるケースだけを補完する品質向上対応である。
- 本プランでは新しい仕様を定義しない。既存の要件・基本設計を、実ブラウザ境界の回帰テストへ反映する。
- 特に PC DnD auto-scroll は、既存 helper の「target を drag 前に viewport へ入れる」前提と目的が衝突するため、既存ケースを壊さない形で入力手順を分離する。
