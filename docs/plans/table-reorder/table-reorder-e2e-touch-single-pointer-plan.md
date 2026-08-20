# PLAN-360: Table Reorder E2E Touch ドラッグ不要の単一ポインター操作

## References

- Parent issue: #252
- Implementation issue: #360
- Touch DnD: #258
- Touch first-guidance E2E follow-up: #382
- Test responsibility map: `docs/development/testing.md`
- Requirements: `docs/requirements/table-reorder/table-reorder-requirements.md`
- Accessibility requirements: `docs/requirements/table-reorder/table-reorder-accessibility-requirements.md`
- Design: `docs/design/table-reorder/table-reorder-design.md`
- Accessibility design: `docs/design/table-reorder/table-reorder-accessibility-design.md`

## Goal

Touch 環境で Table Reorder の並べ替えモードへ入り、行ハンドルをタップして移動対象を選択し、表示された有効な移動先をタップして行移動を確定できることを、実 WordPress / Gutenberg / Chromium 環境の Playwright E2E で固定する。

あわせて、Touch の並べ替えモードへ入っただけでは移動対象を選択しないこと、セルの tap は通常のセル編集として扱われること、明示的な Cancel と並べ替えモード終了のどちらでも未確定操作を行順変更なしで終了できることを確認する。

Touch 固有の単一ポインター操作として、移動先探索中の縦 scroll gesture が destination tap と誤認されず行移動を確定しないこと、上下 swipe の方向に合わせて Touch pointer guidance が viewport 上側 / 下側へ切り替わり、反対方向の swipe まで直前の位置を維持することも確認する。

本プランは #252 の方針に従い、E2E を網羅テストにしない。Jest ですでに扱える移動先生成、tap / scroll 判定の細かな境界値、guidance の swipe 判定しきい値、controller の内部状態は重複して検証せず、実ブラウザ上で Touch 入力、並べ替えモード、通常セル編集、行ハンドル、移動先 UI、操作案内、Gutenberg の Table データ更新が利用者操作として正しく接続される代表シナリオを対象とする。

## Scope

### Included

- `hasTouch: true` / `isMobile: true` / スマートフォン相当 viewport の Touch 環境
- `core/table` を基準にした代表シナリオ
- Toolbar の「行を並べ替え」から Touch の並べ替えモードへ入ること
- 並べ替えモードへ入っただけでは特定行を移動対象として選択せず、destination UI を表示しないこと
- 並べ替えモード中でもセルの tap は通常のセル編集として扱われ、移動先選択を開始しないこと
- 行ハンドルを tap して移動対象を選択すること
- 選択後に有効な移動先 UI が表示されること
- 有効な別位置を tap して行移動を確定し、Table の行順が更新されること
- Touch 用の明示的な Cancel 操作で行順を変更せず移動先選択を終了すること
- 移動先選択中に Toolbar の「行を並べ替え」を OFF にした場合、未確定操作を破棄して行順を変更せず並べ替えモードを終了すること
- 移動先探索中に destination 上から縦 scroll gesture を行っても、その gesture 自体では移動を確定しないこと
- 移動先探索中の上方向 swipe で Touch pointer guidance が viewport 上側、下方向 swipe で viewport 下側へ切り替わり、反対方向の swipe まで直前の位置を維持することの代表確認
- scroll gesture 後も移動先選択を継続でき、あらためて destination を tap すれば確定できることの代表確認

### Not included

- Touch DnD（#258）
- PC ポインター DnD（#255）
- PC ドラッグ不要の単一ポインター操作（#256）
- キーボード操作（#257）
- `rowspan` / `colspan` の詳細な移動制約（#259）
- データ保持の詳細な属性・装飾パターンや Undo / Redo（#260）
- accessible name / role / state、live region、通知文言などアクセシビリティ情報提供の網羅（#261）
- Touch 初回案内、最初の Table gesture の抑止、Toolbar の「行を並べ替え」への初回フォーカス移動の再テスト（#382）
- 通常状態からの並べ替えモード ON / OFF 自体の再テスト（#253 で固定済み）
- iframe / non-iframe の自動 E2E 境界確認。本対応ではユーザー側の検証へ委ねる
- Flexible Table Block。Core Table の E2E 整備完了後に別途扱う
- tap 判定しきい値 `5px` や guidance の swipe 判定しきい値 `8px` など実装定数の E2E 固定
- pointer event の内部順序や controller state の直接検証
- CSS class、厳密な座標、opacity など移動先 UI / guidance の実装詳細
- 通常幅 / 全幅、通常行 / 結合セルの全組み合わせ網羅

## Approach

### Touch の並べ替えモードを明示的な入口にする

既存の Touch UI E2E と同じ環境設定を基準にする。

```ts
hasTouch: true
isMobile: true
viewport: { width: 390, height: 844 }
```

各テストは Touch 初回案内の責務を #382 と分離するため、`requestUtils.setPreferences()` で次の preference を `true` に固定し、初回案内終了済みの状態から開始する。

```text
yamabiko-editor-tools / tableReorderTouchCoachmarkDismissed = true
```

代表シナリオでは次の利用者操作を再現する。

1. 対象 Table を選択する。
2. Toolbar の「行を並べ替え」を tap して並べ替えモードへ入る。
3. この時点では行ハンドルは利用可能になるが、移動対象はまだ選択されず destination UI も表示されない。
4. 移動対象行の行ハンドルを tap する。
5. 有効な移動先 UI が表示される。
6. 有効な別位置を tap する。
7. Gutenberg の Table 編集内容上の行順が期待どおり更新される。

初回案内の表示、最初の Table gesture の抑止、Toolbar focus は assertion に含めない。

### reorder mode と移動対象選択を分離して確認する

基本設計どおり、Touch の並べ替えモードへ入ることと特定行を移動対象として選択することを別状態として扱う。

Toolbar の「行を並べ替え」を ON にした直後は次を主要な期待値とする。

- 行ハンドルが利用可能になる
- destination UI はまだ存在しない
- Touch mode guidance は表示されるが、移動先選択中の guidance には切り替わっていない
- Table の行順と編集内容は変わらない

controller の selected row など内部 state は直接確認しない。

### cell tap が通常編集を維持することを確認する

Touch reorder mode 中でも、セルの tap は通常の Table 編集として扱い、行移動の入口は行ハンドルに限定する。

代表ケースでは移動可能な通常行のセルを tap し、次を確認する。

- セルが Gutenberg の通常の編集文脈へ入る
- destination UI が表示されない
- Touch pointer guidance へ切り替わらない
- 行順が変わらない

セル編集の成立判定は、Gutenberg の実ブラウザ上で安定して観測できる editable / focus 状態を優先する。特定の CSS class や内部 React state には依存しない。必要な場合は、セルへ通常入力できることを最小限の利用者操作として確認する。

### semantic locator を優先する

行ハンドルと移動先 UI は role / accessible name など利用者向けの semantic locator で取得する。

既存の `getRowHandle()` は PC 用に `row.hover()` を含むため、Touch テストではそのまま使わない。既存の `getRowControl()` を再利用するか、Touch 用に hover を伴わない小さな helper を追加する。

移動先は `Move before row ...` / `Move to the end of the table.` と対応する日本語名を基準に取得し、CSS class を主要 locator にしない。

### 明示的 Cancel を利用者操作として確認する

Touch の移動先選択中には明示的な Cancel button が表示されるため、キャンセルシナリオでは `Escape` ではなく Touch でその button を tap する。

主要な期待値は次とする。

- 移動先 UI と Touch pointer guidance が消える
- 行順が変わらない
- Gutenberg の編集内容が変わらない
- Touch の並べ替えモード自体は維持され、次の行選択を開始できる状態へ戻る

フォーカス復元や支援技術向け通知の詳細は #261 の責務とする。

### reorder mode OFF で未確定操作を破棄する

基本設計では、「行を並べ替え」を終了した場合は進行中の未確定操作を行順を変更せず終了する。

このケースでは次の利用者フローを確認する。

1. Touch reorder mode へ入る。
2. 行ハンドルを tap し、destination UI と Touch pointer guidance を表示する。
3. Toolbar の「行を並べ替え」を再度 tap して mode を OFF にする。
4. destination UI と移動先選択中 guidance が消える。
5. Toolbar button が OFF 状態へ戻る。
6. 行順と Gutenberg の編集内容が変更されていない。

通常状態からの mode ON / OFF 自体は #253 で確認済みなので、#360 では「未確定の移動先選択を持った状態から OFF にしたときのキャンセル結果」だけを追加する。

### destination 上の scroll gesture が tap 確定にならないことを実ブラウザで確認する

`row-move-targets.ts` では Touch pointer の移動量を見て、scroll gesture 後の click を抑止する処理がある。この分岐の閾値やイベント単位の詳細は Jest に委ね、Playwright では実 Touch gesture を通した利用者視点の結果だけを確認する。

scroll gesture のシナリオでは、縦に十分な長さの Table を使い、移動先選択中に destination の操作領域から縦方向へ finger 相当の gesture を送る。

主要な期待値は次とする。

- gesture 前後で editor / page の縦スクロール位置が変化する
- gesture 前後の `editor.getEditedPostContent()` が同一で、Table データが変化していない
- gesture だけでは移動先選択が終了しない
- destination UI が残り、あらためて明示的に tap すると行移動を確定できる
- 上方向の swipe では Touch pointer guidance が viewport 上側へ移動する
- 下方向の swipe では Touch pointer guidance が viewport 下側へ移動する
- swipe 終了後も guidance は直前の表示側を維持し、反対方向の swipe で反対側へ切り替わる

Touch pointer guidance の確認は `top: 8px` や要素高から算出した pixel 値などを固定せず、viewport の上半分 / 下半分など利用者から見た表示側として判定する。微小な揺れを無視する `8px` の内部しきい値は Jest の責務とする。

固定時間の `waitForTimeout()` は使わず、scroll position、destination の存在、guidance の表示側、Table 編集内容など観測可能な状態を待つ。

Playwright の通常 API だけで destination 上からの連続 touch gesture を十分に表現できない場合は、Chromium CDP の `Input.dispatchTouchEvent` を使う最小 helper を E2E 側に限定して利用する。#258 の実装で同等 helper が追加済みなら再利用を優先し、同種の CDP helper を重複して増やさない。

### Jest と E2E の責務を重複させない

Jest では `row-move-targets.test.ts` などで Touch tap と pointer movement による確定抑止を、`reorder-guidance.test.ts` で swipe 方向の判定、微小移動のしきい値、直前位置の保持を細かく検証できる。

Playwright では次の実ブラウザ境界だけを確認する。

- Gutenberg Toolbar から Touch 並べ替えモードへ入っても、row control を操作するまでは移動先選択が始まらないこと
- Touch reorder mode 中の cell tap が通常編集へ接続され、destination selection を開始しないこと
- row control tap が移動先 UI 表示へ接続されること
- destination tap が Gutenberg の Table データ更新へ接続されること
- Touch Cancel button が未確定操作を破棄すること
- reorder mode OFF が進行中の未確定操作を破棄すること
- destination 上の scroll gesture が誤って tap 確定にならないこと
- 実 Touch swipe の方向に応じて Touch pointer guidance が viewport 上側 / 下側へ切り替わり、反対方向の swipe まで表示側を維持すること

## Test structure

基本ファイルは次とする。

- `tests/e2e/table-reorder-touch-single-pointer.spec.ts`

既存の `tests/e2e/table-reorder.ts` と `tests/e2e/editor-context.ts` で扱える責務は再利用し、#360 のためだけに大きな page object 層を新設しない。

必要な場合だけ、小さな helper を追加する。

候補:

- Touch 初回案内を dismissed にする setup helper
- Toolbar から Touch 並べ替えモードへ入る helper
- hover を伴わず row control を semantic locator で取得する helper
- destination を accessible name で取得する helper
- destination 上から縦 touch scroll gesture を送る helper
- guidance が viewport 上側 / 下側のどちらに表示されているかを判定する小さな helper
- `basicTableContent` の行順確認では、Table の現在行順を読み取る既存 helper を再利用する

`getTableRowOrder()` は `basicRowLabels`（Alpha / Bravo / Charlie / Delta）を前提としているため、`longTableContent` の非確定確認には再利用しない。Phase 6 では `editor.getEditedPostContent()` の操作前後比較で、scroll gesture により Table データが変化していないことを確認する。

#258 の実装で Touch gesture helper が共通化されている場合は、それを利用できる範囲だけ再利用する。#360 固有の destination tap / cancel / mode-off cancel / scroll / guidance position assertion は本 spec 側に残す。

## Test data

### `basicTableContent`

既存 E2E helper の 4 行 Core Table を再利用する。

- `Alpha`
- `Bravo`
- `Charlie`
- `Delta`

用途:

- reorder mode ON 直後はまだ移動対象を選択していないことを確認する
- cell tap が通常編集として成立し、移動先選択を開始しないことを確認する
- `Bravo` の row control を tap して移動対象を選択する
- Table 末尾など有効な destination を tap して確定する
- Touch Cancel button で未確定操作を終了する
- reorder mode OFF で未確定操作を破棄する
- 確定・キャンセル後の行順を確認する

### `longTableContent`

既存 E2E helper の 24 行 Table を再利用する。

用途:

- 移動先探索中に縦スクロール可能な距離を確保する
- destination 上の scroll gesture が tap 確定にならないことを確認する
- 上下 swipe に応じて Touch pointer guidance の表示側が切り替わることを確認する

既存データで十分なスクロール距離を確保できない場合だけ、#360 に必要な最小 fixture を追加する。

## Implementation phases

### Phase 1: Touch 単一ポインター E2E の共通準備と未選択状態を整える

- Outcome: 初回案内終了済みの Touch 環境で並べ替えモードへ入り、行ハンドルは利用できるが、特定行の移動先選択はまだ始まっていない。
- Tasks:
  - `tests/e2e/table-reorder-touch-single-pointer.spec.ts` を追加する。
  - `hasTouch: true` / `isMobile: true` / スマートフォン相当 viewport を設定する。
  - `requestUtils.setPreferences()` で Touch coachmark を dismissed に固定する。
  - `admin.createNewPost()` / `editor.setContent()` / `getEditorContext()` を既存どおり再利用する。
  - Touch 並べ替えモードへの入口を helper 化する場合は、この spec と #258 で無理なく共有できる小さな責務に留める。
  - row control は `getRowControl()` など hover を伴わない semantic locator を使う。
  - mode ON 直後に row control が利用可能で、destination UI がまだ存在せず、Table の行順が変化していないことを確認する。
- Validation:
  - Toolbar → reorder mode と row control tap → destination selection が別の利用者状態として成立する。

### Phase 2: cell tap が通常編集として成立する代表ケースを追加する

- Outcome: Touch reorder mode 中でもセルの tap が行移動ではなく通常編集として扱われる。
- Tasks:
  - `basicTableContent` で Touch reorder mode へ入る。
  - 通常行のセルを tap する。
  - Gutenberg の通常のセル編集文脈へ入ることを、安定した editable / focus state で確認する。
  - destination UI が表示されず、移動先選択中 guidance へ切り替わらないことを確認する。
  - 行順が変わらないことを確認する。
- Validation:
  - cell tap と row control tap の意味が実 Chromium 上で分離される。

### Phase 3: handle tap → destination tap の代表移動を追加する

- Outcome: Touch のドラッグ不要操作だけで有効な別位置へ行を移動できる。
- Tasks:
  - `basicTableContent` で中間行の row control を tap する。
  - 有効な destination が表示され、元位置に相当する無効 destination が確定対象にならないことは必要最小限だけ確認する。
  - Table 末尾など明確な有効 destination を tap する。
  - 行順と `editor.getEditedPostContent()` の更新を利用者結果として確認する。
- Validation:
  - row control tap → destination 表示 → destination tap → Table データ更新が一連で成立する。

### Phase 4: Touch Cancel の代表ケースを追加する

- Outcome: 移動先選択中に明示的な Cancel を行うと Table を変更せず操作を終了できる。
- Tasks:
  - row control を tap して destination を表示する。
  - Touch pointer guidance 内の Cancel button を tap する。
  - destination / guidance が消えることを確認する。
  - 行順と編集内容が変わらないことを確認する。
  - reorder mode が維持され、row control を再度選べる状態であることを代表確認する。
- Validation:
  - Cancel tap で未確定操作だけが破棄される。

### Phase 5: reorder mode OFF による未確定操作キャンセルを追加する

- Outcome: 移動先選択中に「行を並べ替え」を終了すると、未確定の移動だけを破棄して mode を終了できる。
- Tasks:
  - Touch reorder mode で row control を tap して destination を表示する。
  - Toolbar の「行を並べ替え」を tap して mode を OFF にする。
  - Toolbar button が OFF 状態へ戻ることを確認する。
  - destination / Touch pointer guidance が消えることを確認する。
  - 行順と `editor.getEditedPostContent()` が操作前から変わらないことを確認する。
- Validation:
  - mode OFF が未確定操作を commit せず破棄する。

### Phase 6: destination 上の scroll gesture と guidance 追従を追加する

- Outcome: 移動先探索中に縦 scroll gesture を行っても、その gesture が destination tap として確定されず、Touch pointer guidance が swipe 方向に応じて viewport 上側 / 下側へ切り替わる。
- Tasks:
  - `longTableContent` を使い、Touch reorder mode で row control を tap して destination を表示する。
  - scroll gesture 前の `editor.getEditedPostContent()` を保存する。
  - destination 上から上方向の実 Touch gesture を送り、scroll position が変わり、guidance が viewport 上側に表示されることを確認する。
  - `editor.getEditedPostContent()` が操作前から変わらず、destination UI が残ることを確認する。
  - swipe 終了後も guidance が上側を維持することを確認する。
  - 続けて下方向の実 Touch gesture を送り、guidance が viewport 下側へ切り替わることを確認する。
  - `editor.getEditedPostContent()` が操作前から変わらず、移動先選択が継続していることを確認する。
  - scroll 後にあらためて destination を tap し、その時点では正常に行移動を確定して `editor.getEditedPostContent()` が更新されることを確認する。
  - guidance の厳密な pixel 座標や `8px` の swipe 判定しきい値は assertion にしない。
  - 通常 Playwright API で連続 Touch gesture を表現できない場合だけ CDP helper を使う。
- Validation:
  - scroll gesture と destination tap の意味が実 Chromium 上で分離される。
  - 上方向 / 下方向の Touch swipe に追従して guidance の表示側が切り替わり、反対方向の swipe まで直前の位置が維持される。

## Decisions and validation questions

### Decide before implementation

- None. Issue #360 と既存設計・実装で、Touch reorder mode と移動対象選択の分離、cell tap の通常編集、handle tap → destination tap、明示的 Cancel、mode OFF による未確定操作キャンセル、移動先探索中の scroll gesture 非確定、Touch guidance の swipe 方向追従まで対象が確定している。

### Validate during implementation

- Touch reorder mode ON 直後の「未選択」を、内部 controller state に依存せず destination UI 非表示などの利用者向け状態で安定して確認できること。
- cell tap の通常編集を、Gutenberg の内部 CSS class に依存せず editable / focus state などで安定して確認できること。
- Playwright の `locator.tap()` で row control / destination / Toolbar の Touch 単一ポインター操作を実ブラウザ上で安定して表現できること。
- destination 上からの連続 Touch scroll gesture に通常 Playwright API が十分か、Chromium CDP helper が必要か。
- #258 の実装が先行した場合、その Touch gesture helper を #360 でも小さく再利用できるか。
- long Table の destination を使った scroll gesture が、固定時間待機なしで安定して scroll position の変化として観測できること。
- Touch pointer guidance の表示側を、厳密な CSS 座標へ依存せず viewport 上側 / 下側として安定して判定できること。

## Issue breakdown

- [x] Issue #360 を単一実装単位として扱う。追加の子 Issue は作成しない。

## Validation

ユーザーが検証を実施するため、この対応では検証コマンドを実行しない。

iframe / non-iframe の境界確認も本 E2E 実装には含めず、ユーザー側の検証へ委ねる。

実装時の確認候補:

- `npm test`
  - Expected result: Node.js quality gate が成功する。
- `npm run build`
  - Expected result: production build が成功する。
- `npm run test:e2e -- tests/e2e/table-reorder-touch-single-pointer.spec.ts`
  - Expected result: Touch 単一ポインターの対象 E2E が成功する。
- `npm run test:e2e`
  - Expected result: 既存 E2E を含む Playwright suite が対応環境で成功する。
- `git diff --check origin/main...HEAD`
  - Expected result: whitespace error がない。

## Completion criteria

- Touch 環境で Toolbar の「行を並べ替え」から reorder mode へ入れる。
- reorder mode ON だけでは特定行の移動対象選択を開始せず、destination UI を表示しない。
- reorder mode 中の cell tap は通常編集として成立し、移動先選択を開始しない。
- 行ハンドルを tap すると有効な移動先 UI が表示される。
- 有効な destination を tap すると、ドラッグなしで行順が更新される。
- Touch の明示的 Cancel を tap すると、行順を変更せず移動先選択を終了できる。
- 移動先選択中に reorder mode を OFF にすると、未確定操作を破棄して行順を変更せず mode を終了できる。
- destination 上の縦 scroll gesture だけでは行移動を確定しない。
- 上方向の Touch swipe で Touch pointer guidance が viewport 上側へ、下方向の Touch swipe で viewport 下側へ切り替わる。
- Touch pointer guidance は swipe 終了後も直前の表示側を維持し、反対方向の swipe で反対側へ切り替わる。
- scroll gesture 後も移動先選択を継続でき、あらためて destination を tap すれば確定できる。
- Jest で十分な内部ロジックや閾値を Playwright で重複して固定していない。
- #258 / #259 / #260 / #261 / #382 の責務を取り込んでいない。
- iframe / non-iframe と Flexible Table Block の確認を本 E2E に混在させていない。
- 固定時間の `waitForTimeout()` や内部実装 state への過度な依存を追加していない。

## Notes

- #360 は WCAG 2.2 2.5.7 Dragging Movements に関係する Touch のドラッグ不要操作を、実ブラウザ上の利用者フローとして固定する E2E である。
- `row-move-targets.ts` の pointer movement threshold と `reorder-guidance.ts` の swipe direction threshold は Jest 側で扱い、E2E では具体的な px 値ではなく「scroll gesture が tap 確定にならない」「swipe 方向に応じて guidance の表示側が切り替わる」という結果を確認する。
- `longTableContent` の scroll gesture 非確定確認では、`getTableRowOrder()` ではなく `editor.getEditedPostContent()` の操作前後比較を使う。
- Touch 初回案内は #382、Touch DnD は #258 に分離し、本 spec の setup では初回案内を dismissed にして単一ポインター操作だけへ集中する。
- Flexible Table Block は Core Table の E2E 整備完了後に扱う。
- iframe / non-iframe の境界確認はユーザー側で実施する。
- 検証はユーザーが実施する。