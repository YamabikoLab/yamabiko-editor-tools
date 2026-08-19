# PLAN-258: Table Reorder E2E Touch DnD

## References

- Parent issue: #252
- Implementation issue: #258
- Test responsibility map: `docs/development/testing.md`
- Requirements: `docs/requirements/table-reorder/table-reorder-requirements.md`
- Accessibility requirements: `docs/requirements/table-reorder/table-reorder-accessibility-requirements.md`
- Design: `docs/design/table-reorder/table-reorder-design.md`
- Accessibility design: `docs/design/table-reorder/table-reorder-accessibility-design.md`

## Goal

Touch 環境で Table Reorder の並べ替えモードへ入り、表示された行ハンドルを実際の touch drag で操作して本文行を別の有効な位置へ移動できることを、実 WordPress / Gutenberg / Chromium 環境の Playwright E2E で固定する。

本プランは #252 の方針に従い、E2E を網羅テストにしない。Jest ですでに扱える touch 固有の controller 分岐、移動計算、禁止位置判定などは重複して検証せず、実ブラウザで Touch 入力、並べ替えモード、行ハンドル、SortableJS、Table データ更新が一連の利用者操作として接続される代表シナリオを対象とする。

また、Touch DnD の入口を行ハンドルに限定し、セル上の通常スクロールが行移動として誤認されないことを同じ分類で確認する。

## Scope

### Included

- `hasTouch: true` / `isMobile: true` / スマートフォン相当 viewport の Touch 環境
- Toolbar の「行を並べ替え」から Touch の並べ替えモードへ入ること
- 並べ替えモード中に表示された移動可能行の行ハンドルから touch drag を開始すること
- 有効な別位置への touch drag / drop で行順が更新されること
- ドラッグ中に現在の有効な挿入位置を視覚的に確認できることの代表確認
- 元と同じ位置へ戻した場合に行順を変更しないことの代表確認
- 並べ替えモード中でも、セル上の縦方向 touch gesture が通常スクロールとして成立し、行順を変更しないこと
- iframe / non-iframe の両方で代表的な Touch DnD が成立すること
- `core/table` を基準にした代表シナリオ

### Not included

- 行ハンドルを tap して移動先を tap するドラッグ不要の単一ポインター操作（#360）
- PC ポインター DnD（#255）
- PC ドラッグ不要の単一ポインター操作（#256）
- キーボード操作（#257）
- `rowspan` / `colspan` の詳細な移動制約（#259）
- データ保持の詳細な属性・装飾パターンや Undo / Redo（#260）
- accessible name / role / state、live region、通知文言などアクセシビリティ情報提供の網羅（#261）
- Touch 初回案内や並べ替えモード ON/OFF 自体の再テスト（#253 で固定済み）
- Touch drag 中の auto-scroll の全境界や速度・閾値の数値検証
- CSS の座標、opacity、transform などドラッグ UI の実装詳細
- SortableJS の内部 state、callback、class 名の直接検証
- Core Table / Flexible Table Block、iframe / non-iframe、通常幅 / 全幅、通常行 / 結合セルの全組み合わせ網羅
- Flexible Table Block を E2E のためだけに新規導入・セットアップすること

## Approach

### Touch 専用の実入力として drag gesture を送る

既存の `table-reorder-ui.spec.ts` と同じ Touch 環境設定を基準にする。

```ts
hasTouch: true
isMobile: true
viewport: { width: 390, height: 844 }
```

Touch DnD の成立確認では、Mouse の `page.mouse` や `locator.dragTo()` へ置き換えず、touch の `start → move → end` を実ブラウザへ送る。

Playwright の通常 API だけで連続した touch drag を十分に表現できない場合は、Chromium の CDP session を利用して `Input.dispatchTouchEvent` を送る小さな E2E helper を用意する。現在の E2E ブラウザ対象は Chromium のため、この helper は #258 の実ブラウザ境界に限定して使用し、製品コードへ持ち込まない。

helper は次の責務に絞る。

- source / target の bounding box から touch 座標を求める
- `touchStart` を source の行ハンドル中心へ送る
- 複数の `touchMove` で target の有効な行間へ移動する
- 必要なら drag 中 assertion を挟める callback を受ける
- `touchEnd` で操作を終了する

固定時間の `waitForTimeout()` は使わず、DOM 状態や最終的な行順の変化を待つ。

### Touch の並べ替えモードを必ず入口にする

Touch では Table を選択しただけでは行ハンドルを常時表示せず、Toolbar の「行を並べ替え」を実行して並べ替えモードへ入ってから DnD を行う。

代表シナリオは次の利用者操作を再現する。

1. 対象 Table を選択する。
2. Toolbar の「行を並べ替え」を touch で実行する。
3. 行ハンドルが表示される。
4. 移動対象行の行ハンドルから touch drag を開始する。
5. 有効な行間へ finger 相当の touch point を移動する。
6. ドラッグ中に現在の挿入位置が利用者から確認できる。
7. touch を終了する。
8. Gutenberg の Table 編集内容上の行順が期待どおり更新される。

最終的な成立判定は SortableJS の内部状態ではなく、Table の編集内容を正とする。

### Touch DnD と通常スクロールを分離して確認する

通常スクロールとの共存は、DnD の入口が行ハンドルに限定されていることを利用者視点で確認する。

並べ替えモード中でも、セル本文上から縦方向の touch gesture を行った場合は行移動を開始せず、editor / page のスクロール位置が変化できることを代表ケースで確認する。

このシナリオでは次を主要な期待値とする。

- gesture 前後で縦スクロール位置が実際に変わる
- Table の行順は変わらない
- 行ハンドルから開始していない操作を DnD として扱わない

スクロール量の厳密な pixel 値、慣性スクロール量、ブラウザ内部の touch event 順序は固定しない。

Touch の移動先選択中に scroll gesture が tap 確定にならないことは #360 の責務とし、本 Issue では扱わない。

### Jest と責務を重複させない

Jest の `sortable-controller-touch.test.ts` などでは、touch 固有の controller behavior や分岐を単体で確認できる。

Playwright では細かなイベント分岐を再列挙せず、次の実ブラウザ境界だけを確認する。

- Gutenberg の Toolbar から Touch 並べ替えモードへ入り、行ハンドルが実操作可能になること
- 実 touch gesture が行ハンドルから SortableJS drag へ接続されること
- drag 中の現在挿入位置が実画面へ反映されること
- touch drop の確定結果が Gutenberg の Table データへ反映されること
- セル上の通常 touch scroll が DnD と競合しないこと
- iframe / non-iframe の editor canvas 差を越えて同じ意味の操作が成立すること

## Test structure

基本ファイルは次とする。

- `tests/e2e/table-reorder-touch-dnd.spec.ts`

既存の `tests/e2e/table-reorder.ts` と `tests/e2e/editor-context.ts` で扱える責務は再利用し、#258 のためだけに大きな page object 層を新設しない。

必要な場合だけ、小さな helper を追加する。

候補:

- Touch 並べ替えモードへ入る helper
- hover を伴わず row control を semantic locator で取得する helper
- source / target locator から touch drag gesture を送る helper
- セル上で縦方向 touch scroll gesture を送る helper
- Table の現在行順を利用者向けテキストから読み取る既存 helper

既存の `getRowHandle()` は内部で `row.hover()` を実行するため、Touch DnD ではそのまま流用しない。共通化する場合は、row control の semantic locator 取得と pointer 固有の表示操作を分離する。

## Test data

### `basicTableContent`

既存 E2E helper の 4 行 Core Table を再利用する。

- `Alpha`
- `Bravo`
- `Charlie`
- `Delta`

用途:

- 中間行を別の有効な位置へ移動する代表 Touch DnD
- 元位置へ戻す no-op
- Touch DnD の最終行順確認

### `scrollableTableContent`

スマートフォン相当 viewport の高さを越えて縦スクロールできる、単純な Core Table を用意する。

各行は `Row 01`, `Row 02`, ... のように一意に識別できる内容とし、結合セルや装飾など #258 と無関係な要因は入れない。

用途:

- Touch 並べ替えモード中でもセル上の縦 touch gesture で通常スクロールできること
- スクロール gesture だけでは行順が変わらないこと

既存のテストコンテンツで十分なスクロール距離を確保できる場合は、新しい fixture を増やさず既存データを優先する。

## Implementation phases

### Phase 1: Touch DnD の共通準備を整える

Outcome:

- Touch 環境で並べ替えモードへ入り、行ハンドル取得と実 touch gesture を同じ方法で実行できる。

Tasks:

- `tests/e2e/table-reorder-touch-dnd.spec.ts` を追加する。
- `hasTouch: true` / `isMobile: true` / スマートフォン相当 viewport を spec に設定する。
- `admin.createNewPost()` と `editor.setContent()` を使い、各テストを独立させる。
- iframe / non-iframe の editor canvas 取得は既存 `getEditorContext()` を再利用する。
- Toolbar の「行を並べ替え」を touch で実行し、並べ替えモードへ入る helper を用意する。
- row control は role / accessible name など利用者向け semantic locator を優先する。
- Touch drag が通常 Playwright API で十分表現できない場合だけ、Chromium CDP の `Input.dispatchTouchEvent` を使う最小 helper を追加する。
- helper は固定時間待機や SortableJS 内部 class へ依存しない。

Validation:

- Mouse input に置き換えず Touch 専用入力として成立する構成になっている。
- 既存の `table-reorder.ts` / `editor-context.ts` と責務が重複しない。
- Touch single-pointer (#360) の tap 操作を helper 内へ混ぜない。

### Phase 2: 基本 Touch DnD の確定結果を固定する

Outcome:

- Touch の行ハンドルをドラッグし、有効な別位置へドロップすると行順が更新されることを固定する。

Scenario:

1. `basicTableContent` を設定する。
2. Table を選択し、Toolbar の「行を並べ替え」を touch で実行する。
3. 移動対象行の行ハンドルが表示されていることを確認する。
4. 行ハンドルから touch drag を開始する。
5. 別の有効な行間まで touch point を移動する。
6. ドラッグ中に挿入位置表示が見えることを代表的に確認する。
7. touch を終了する。
8. Table の編集内容から行順が期待どおり変わったことを確認する。

Validation policy:

- 挿入位置表示は「移動先を利用者が確認できる状態」を確認し、CSS の具体値は固定しない。
- 最終判定は表示だけでなく Gutenberg の Table 内容の行順で行う。

### Phase 3: no-op と通常スクロールの共存を固定する

Outcome:

- Touch DnD の無効操作と、セル上の通常スクロールが行移動を発生させないことを固定する。

Representative scenarios:

#### 元位置への no-op

- 行ハンドルから touch drag を開始する。
- 元と同じ位置へ戻して touch を終了する。
- Table 内容の行順が変わらないことを確認する。

#### セル上の通常スクロール

- Touch 並べ替えモードへ入る。
- scrollable な Table のセル本文上から縦方向 touch gesture を行う。
- 縦スクロール位置が変化したことを確認する。
- Table 内容の行順が変わっていないことを確認する。

Validation policy:

- controller 内部 state や touch event の個別発火回数は検証しない。
- スクロール量の厳密な pixel 値は固定しない。
- 「スクロールできたこと」と「行順が変わらなかったこと」を利用者境界として確認する。

### Phase 4: iframe / non-iframe の境界を確認する

Outcome:

- Touch DnD の代表シナリオが iframe / non-iframe の両環境で成立する。

Tasks:

- Phase 2 の基本 Touch DnD を両環境で確認する。
- touch 座標取得や CDP gesture helper が editor iframe の有無に依存しないよう、locator の実際の bounding box を基準にする。
- no-op や通常スクロールまで両環境へ機械的に複製しない。

Validation:

- iframe / non-iframe のどちらでも同じ利用者操作と確定結果になる。

## Decisions and validation questions

### Decide before implementation

- Touch drag helper は、まず利用可能な Playwright API で実 touch gesture を表現できるか確認し、不足する場合だけ Chromium CDP を使用する。
- CDP を使う場合も #258 の E2E helper に閉じ、製品コードや共通アプリケーション層へ持ち込まない。
- 通常スクロール確認は Touch single-pointer (#360) の移動先選択状態へ入らず、Touch reorder mode の待機状態で行う。

### Validate during implementation

- SortableJS が Chromium の synthetic touch sequence を実ブラウザ相当の drag として受け取るか。
- touch move の距離や steps を最小限どの程度にすると安定して drag が成立するか。
- iframe / non-iframe の双方で、locator の bounding box を使った viewport 座標が同じ helper で扱えるか。
- 通常スクロール gesture の前後で、どの scroll container を利用者視点の安定した期待値として観測するのが適切か。

これらは実装時に小さく確認し、特定の数値や内部イベント順序を計画段階で固定しない。

## Issue breakdown

- [ ] Phase 1: Touch DnD 共通準備と gesture helper
- [ ] Phase 2: 基本 Touch DnD
- [ ] Phase 3: no-op / 通常スクロール共存
- [ ] Phase 4: iframe / non-iframe 横断確認

本 Issue 内の実装フェーズとして扱い、追加の子 Issue は作成しない。

## Validation

実装時は、次を確認する。

- `npm test`
- `npm run build`
- `npm run test:e2e -- tests/e2e/table-reorder-touch-dnd.spec.ts` または対象 spec を実行できる等価なコマンド
- `git diff --check origin/main...HEAD`

E2E は互換性のある `wp-dev` 環境で実施する。手動環境検証は Issue 担当者が iframe / non-iframe の両方で行い、結果を PR に記録する。

本 PR はプラン文書のみのため、依頼者が検証を実施する前提で検証コマンドは実行しない。

## Completion criteria

- Touch 環境が `hasTouch: true` / `isMobile: true` / スマートフォン相当 viewport として明示されている。
- Touch の Toolbar 入口から並べ替えモードへ入り、表示された行ハンドルから実 touch drag を開始する計画になっている。
- 有効な別位置への touch drop で Table の行順が更新される代表ケースがある。
- ドラッグ中の有効な挿入位置を利用者が確認できる代表ケースがある。
- 元位置への no-op で行順が変わらない代表ケースがある。
- 並べ替えモード中でもセル上の縦 touch gesture で通常スクロールでき、行順が変わらない代表ケースがある。
- 基本 Touch DnD が iframe / non-iframe の両方で成立する計画になっている。
- #360 の handle tap → destination tap、#259 の結合セル、#260 のデータ保持・Undo、#261 のアクセシビリティ情報提供を取り込んでいない。
- Jest で十分な touch controller の細かな分岐を Playwright へ重複させていない。
- Mouse DnD で Touch DnD を代用しない。
