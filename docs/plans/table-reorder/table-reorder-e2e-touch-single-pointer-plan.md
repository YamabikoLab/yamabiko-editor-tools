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

あわせて、Touch 固有の単一ポインター操作として、明示的なキャンセルで行順を変更せず操作を終了できることと、移動先探索中の縦 scroll gesture が destination tap と誤認されず行移動を確定しないことを確認する。

本プランは #252 の方針に従い、E2E を網羅テストにしない。Jest ですでに扱える移動先生成、tap / scroll 判定の細かな境界値、controller の内部状態は重複して検証せず、実ブラウザ上で Touch 入力、並べ替えモード、行ハンドル、移動先 UI、Gutenberg の Table データ更新が利用者操作として正しく接続される代表シナリオを対象とする。

## Scope

### Included

- `hasTouch: true` / `isMobile: true` / スマートフォン相当 viewport の Touch 環境
- Toolbar の「行を並べ替え」から Touch の並べ替えモードへ入ること
- 行ハンドルを tap して移動対象を選択すること
- 選択後に有効な移動先 UI が表示されること
- 有効な別位置を tap して行移動を確定し、Table の行順が更新されること
- Touch 用の明示的なキャンセル操作で行順を変更せず移動先選択を終了すること
- 移動先探索中に destination 上から縦 scroll gesture を行っても、その gesture 自体では移動を確定しないこと
- scroll gesture 後も移動先選択を継続でき、あらためて destination を tap すれば確定できることの代表確認
- iframe / non-iframe の両方で代表的な Touch 単一ポインター操作が成立すること
- `core/table` を基準にした代表シナリオ

### Not included

- Touch DnD（#258）
- PC ポインター DnD（#255）
- PC ドラッグ不要の単一ポインター操作（#256）
- キーボード操作（#257）
- `rowspan` / `colspan` の詳細な移動制約（#259）
- データ保持の詳細な属性・装飾パターンや Undo / Redo（#260）
- accessible name / role / state、live region、通知文言などアクセシビリティ情報提供の網羅（#261）
- Touch 初回案内、最初の Table gesture の抑止、Toolbar の「行を並べ替え」への初回フォーカス移動の再テスト（#382）
- 並べ替えモード ON/OFF 自体の再テスト（#253 で固定済み）
- tap 判定しきい値 `5px` など実装定数の E2E 固定
- pointer event の内部順序や controller state の直接検証
- CSS class、座標、opacity など移動先 UI の実装詳細
- Core Table / Flexible Table Block、iframe / non-iframe、通常幅 / 全幅、通常行 / 結合セルの全組み合わせ網羅
- Flexible Table Block を E2E のためだけに新規導入・セットアップすること

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
3. 移動対象行の行ハンドルを tap する。
4. 有効な移動先 UI が表示される。
5. 有効な別位置を tap する。
6. Gutenberg の Table 編集内容上の行順が期待どおり更新される。

初回案内の表示、最初の Table gesture の抑止、Toolbar focus は assertion に含めない。

### semantic locator を優先する

行ハンドルと移動先 UI は role / accessible name など利用者向けの semantic locator で取得する。

既存の `getRowHandle()` は PC 用に `row.hover()` を含むため、Touch テストではそのまま使わない。既存の `getRowControl()` を再利用するか、Touch 用に hover を伴わない小さな helper を追加する。

移動先は `Move before row ...` / `Move to the end of the table.` と対応する日本語名を基準に取得し、CSS class を主要 locator にしない。

### 明示的キャンセルを利用者操作として確認する

Touch の移動先選択中には明示的な Cancel button が表示されるため、キャンセルシナリオでは `Escape` ではなく Touch でその button を tap する。

主要な期待値は次とする。

- 移動先 UI と Touch pointer guidance が消える
- 行順が変わらない
- Gutenberg の編集内容が変わらない
- Touch の並べ替えモード自体は維持され、次の行選択を開始できる状態へ戻る

フォーカス復元や支援技術向け通知の詳細は #261 の責務とする。

### destination 上の scroll gesture が tap 確定にならないことを実ブラウザで確認する

`row-move-targets.ts` では Touch pointer の移動量を見て、scroll gesture 後の click を抑止する処理がある。この分岐の閾値やイベント単位の詳細は Jest に委ね、Playwright では実 Touch gesture を通した利用者視点の結果だけを確認する。

scroll gesture のシナリオでは、縦に十分な長さの Table を使い、移動先選択中に destination の操作領域から縦方向へ finger 相当の gesture を送る。

主要な期待値は次とする。

- gesture 前後で editor / page の縦スクロール位置が変化する
- gesture だけでは Table の行順が変わらない
- gesture だけでは移動先選択が終了しない
- destination UI が残り、あらためて明示的に tap すると行移動を確定できる

固定時間の `waitForTimeout()` は使わず、scroll position、destination の存在、Table 行順など観測可能な状態を待つ。

Playwright の通常 API だけで destination 上からの連続 touch gesture を十分に表現できない場合は、Chromium CDP の `Input.dispatchTouchEvent` を使う最小 helper を E2E 側に限定して利用する。#258 の実装で同等 helper が追加済みなら再利用を優先し、同種の CDP helper を重複して増やさない。

### Jest と E2E の責務を重複させない

Jest では `row-move-targets.test.ts` などで、Touch tap と pointer movement による確定抑止を細かく検証できる。

Playwright では次の実ブラウザ境界だけを確認する。

- Gutenberg Toolbar から Touch 並べ替えモードへ入り、row control を tap できること
- row control tap が移動先 UI 表示へ接続されること
- destination tap が Gutenberg の Table データ更新へ接続されること
- Touch Cancel button が未確定操作を破棄すること
- destination 上の scroll gesture が誤って tap 確定にならないこと
- iframe / non-iframe の editor canvas 差を越えて同じ意味の操作が成立すること

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
- Table の現在行順を読み取る既存 helper の再利用

#258 の実装で Touch gesture helper が共通化されている場合は、それを利用できる範囲だけ再利用する。#360 固有の destination tap / cancel / scroll assertion は本 spec 側に残す。

## Test data

### `basicTableContent`

既存 E2E helper の 4 行 Core Table を再利用する。

- `Alpha`
- `Bravo`
- `Charlie`
- `Delta`

用途:

- `Bravo` の row control を tap して移動対象を選択する
- Table 末尾など有効な destination を tap して確定する
- Touch Cancel button で未確定操作を終了する
- 確定・キャンセル後の行順を確認する

### `longTableContent`

既存 E2E helper の 24 行 Table を再利用する。

用途:

- 移動先探索中に縦スクロール可能な距離を確保する
- destination 上の scroll gesture が tap 確定にならないことを確認する

既存データで十分なスクロール距離を確保できない場合だけ、#360 に必要な最小 fixture を追加する。

## Implementation phases

### Phase 1: Touch 単一ポインター E2E の共通準備を整える

- Outcome: 初回案内終了済みの Touch 環境で、並べ替えモードへ入り、hover なしで row control と destination を取得できる。
- Tasks:
  - `tests/e2e/table-reorder-touch-single-pointer.spec.ts` を追加する。
  - `hasTouch: true` / `isMobile: true` / スマートフォン相当 viewport を設定する。
  - `requestUtils.setPreferences()` で Touch coachmark を dismissed に固定する。
  - `admin.createNewPost()` / `editor.setContent()` / `getEditorContext()` を既存どおり再利用する。
  - Touch 並べ替えモードへの入口を helper 化する場合は、この spec と #258 で無理なく共有できる小さな責務に留める。
  - row control は `getRowControl()` など hover を伴わない semantic locator を使う。
- Validation:
  - 実 Touch context で Toolbar → reorder mode → row control 表示まで deterministic に到達できることを確認する。

### Phase 2: handle tap → destination tap の代表移動を追加する

- Outcome: Touch のドラッグ不要操作だけで有効な別位置へ行を移動できる。
- Tasks:
  - `basicTableContent` で中間行の row control を tap する。
  - 有効な destination が表示され、元位置に相当する無効 destination が確定対象にならないことは必要最小限だけ確認する。
  - Table 末尾など明確な有効 destination を tap する。
  - 行順と `editor.getEditedPostContent()` の更新を利用者結果として確認する。
- Validation:
  - row control tap → destination 表示 → destination tap → Table データ更新が一連で成立する。

### Phase 3: Touch Cancel の代表ケースを追加する

- Outcome: 移動先選択中に明示的なキャンセルを行うと Table を変更せず操作を終了できる。
- Tasks:
  - row control を tap して destination を表示する。
  - Touch pointer guidance 内の Cancel button を tap する。
  - destination / guidance が消えることを確認する。
  - 行順と編集内容が変わらないことを確認する。
  - reorder mode が維持され、row control を再度選べる状態であることを代表確認する。
- Validation:
  - Cancel tap で未確定操作だけが破棄される。

### Phase 4: destination 上の scroll gesture 誤確定防止を追加する

- Outcome: 移動先探索中に縦 scroll gesture を行っても、その gesture が destination tap として確定されない。
- Tasks:
  - `longTableContent` を使い、Touch reorder mode で row control を tap して destination を表示する。
  - destination 上から縦方向の実 Touch gesture を送る。
  - gesture 前後で scroll position が変わることを確認する。
  - 行順が変わらず、destination UI が残ることを確認する。
  - scroll 後にあらためて destination を tap し、その時点では正常に行移動を確定できることを確認する。
  - 通常 Playwright API で連続 Touch gesture を表現できない場合だけ CDP helper を使う。
- Validation:
  - scroll gesture と destination tap の意味が実 Chromium 上で分離される。

### Phase 5: iframe / non-iframe の代表境界を固定する

- Outcome: editor canvas の違いによらず Touch 単一ポインター操作の主要フローが成立する。
- Tasks:
  - 現行テスト環境で iframe / non-iframe を再現する既存方法を利用する。
  - 両環境で少なくとも handle tap → destination tap → 行順更新の代表フローを確認する。
  - cancel と scroll gesture の全ケースを両環境へ機械的に複製しない。
- Validation:
  - iframe / non-iframe それぞれで同じ利用者結果になる。

## Decisions and validation questions

### Decide before implementation

- None. Issue #360 と既存設計で、Touch reorder mode → handle tap → destination tap、明示的キャンセル、移動先探索中の scroll gesture 非確定まで対象が確定している。

### Validate during implementation

- Playwright の `locator.tap()` で row control / destination の Touch 単一ポインター操作を実ブラウザ上で安定して表現できること。
- destination 上からの連続 Touch scroll gesture に通常 Playwright API が十分か、Chromium CDP helper が必要か。
- #258 の実装が先行した場合、その Touch gesture helper を #360 でも小さく再利用できるか。
- long Table の destination を使った scroll gesture が、固定時間待機なしで安定して scroll position の変化として観測できること。
- iframe / non-iframe の代表ケースで semantic locator が同じ意味で利用できること。

## Issue breakdown

- [x] Issue #360 を単一実装単位として扱う。追加の子 Issue は作成しない。

## Validation

ユーザーが検証を実施するため、この対応では検証コマンドを実行しない。

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
- 行ハンドルを tap すると有効な移動先 UI が表示される。
- 有効な destination を tap すると、ドラッグなしで行順が更新される。
- Touch の明示的 Cancel を tap すると、行順を変更せず移動先選択を終了できる。
- destination 上の縦 scroll gesture だけでは行移動を確定しない。
- scroll gesture 後も移動先選択を継続でき、あらためて destination を tap すれば確定できる。
- iframe / non-iframe の代表ケースで主要フローが成立する。
- Jest で十分な内部ロジックや閾値を Playwright で重複して固定していない。
- #258 / #259 / #260 / #261 / #382 の責務を取り込んでいない。
- 固定時間の `waitForTimeout()` や内部実装 state への過度な依存を追加していない。

## Notes

- #360 は WCAG 2.2 2.5.7 Dragging Movements に関係する Touch のドラッグ不要操作を、実ブラウザ上の利用者フローとして固定する E2E である。
- `row-move-targets.ts` の pointer movement threshold は Jest 側で扱い、E2E では具体的な px 値ではなく「scroll gesture が tap 確定にならない」という結果を確認する。
- Touch 初回案内は #382、Touch DnD は #258 に分離し、本 spec の setup では初回案内を dismissed にして単一ポインター操作だけへ集中する。
- 検証はユーザーが実施する。
