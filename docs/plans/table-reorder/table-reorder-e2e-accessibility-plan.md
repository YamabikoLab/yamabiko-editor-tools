# PLAN-261: Table Reorder E2E アクセシビリティ UI・フォーカス・通知

## 参照

- 親 Issue: #252
- 実装 Issue: #261
- 結合セル制約: #259
- データ保持 / Undo: #260
- Touch 初回 UI フォローアップ: #382
- テスト責務マップ: `docs/development/testing.md`
- E2E 実装指示: `tests/e2e/AGENTS.md`
- 要件定義書: `docs/requirements/table-reorder/table-reorder-requirements.md`
- アクセシビリティ要件定義書: `docs/requirements/table-reorder/table-reorder-accessibility-requirements.md`
- 基本設計書: `docs/design/table-reorder/table-reorder-design.md`
- アクセシビリティ基本設計書: `docs/design/table-reorder/table-reorder-accessibility-design.md`

## 目的

Table Reorder が実 WordPress / Gutenberg / Chromium 環境でも、利用者が操作対象・操作状態・操作結果を見失わず、支援技術から必要な情報を確認できることを Playwright E2E で固定する。

本プランは #252 の方針に従い、アクセシビリティ実装の DOM 詳細や文言生成ロジックを網羅するテストにはしない。既存 Jest が担当するメッセージ選択、live region 更新ロジック、row control の DOM 構築などは重複して検証せず、実ブラウザ上で利用者が触れる UI とフォーカス、アクセシビリティツリー、通知の統合結果を代表シナリオで確認する。

主に次を E2E の責務とする。

- 行の並べ替え操作 UI の accessible name / role / state が対象行と操作内容を識別できること。
- キーボード、PC のドラッグ不要単一ポインター操作で、操作中・確定後・キャンセル後にフォーカス文脈が保たれること。
- 操作状態に応じた画面上の案内が表示・切り替えされること。
- live region から開始、移動先変更、確定、キャンセル、移動不能理由を確認できること。
- Table Reorder 自身の案内がフォーカス対象を完全に覆わないこと。
- 代表的なポインター操作 UI が必要な操作領域を持つこと。
- iframe / non-iframe で利用者向けの意味が変わらないこと。

Touch の初回 Table 操作、Toolbar フォーカス、初回 coachmark、Tooltip 非重複は #382 の責務とし、本 Issue では再テストしない。

## 対象範囲

### 含むもの

- `core/table` の代表 fixture を使ったアクセシビリティ UI / フォーカス / 通知の実ブラウザ確認
- Toolbar の「Reorder rows / 行を並べ替え」の accessible name / role
- 移動可能な各 row control の button role と、現在位置・行内容を含む accessible name
- キーボード待機中と並べ替え中の画面上の案内
- PC 単一ポインターで移動対象を選択したときの操作中案内
- キーボード並べ替え開始時の live region 通知
- キーボードで有効な移動先が変わったときの live region 通知
- 有効位置へ確定したときの live region 通知と、移動後の同じ行へのフォーカス維持
- キャンセル時の live region 通知と、操作開始行へのフォーカス復元
- 先頭 / 末尾でそれ以上進めないときの移動不能通知
- `rowspan` によって移動できない行から入口を実行したときの理由通知
- 移動可能な本文行が存在しない Table での通知
- 代表的な row control / destination UI の操作領域
- 長い Table で、操作対象・移動先・案内のフォーカス文脈が表示追従後も失われないこと
- iframe / non-iframe の代表ケース

### 含まないもの

- 各入力方式の基本的な行移動フローそのものの再テスト。#255、#256、#257、#258、#360 を正とする。
- `rowspan` / `colspan` の移動可否や禁止 insertion index の網羅。#259 と Jest を正とする。
- セル内容・属性・装飾の保持、Undo / Redo。#260 の責務とする。
- Touch 初回操作時のセル編集抑止、Table 選択、Toolbar フォーカス、Touch coachmark、Tooltip 非重複。#382 の責務とする。
- キーボード向け初回 coachmark の表示条件そのもの。起動・初回 UI の既存 E2E 責務と重複させない。
- PC pointer DnD / Touch DnD のアクセシビリティ情報を各ドラッグ操作ごとに反復確認すること。
- メッセージ formatter、翻訳分岐、live region DOM 更新の細かな分岐。既存 Jest を正とする。
- すべての行、入力方式、通常幅 / 全幅、iframe / non-iframe の直積網羅。
- Flexible Table Block の E2E。Core Table の #261 が完了した後に別途扱う。
- 製品コードの変更。

## 正本との対応

| 正本 | 必要な振る舞い | #261 E2E での観測点 |
| --- | --- | --- |
| A11Y-FR-05 / A11Y 基本設計 §5.4, §6 | 操作中・操作後に文脈を失わない | 開始中は対象 row control にフォーカスを維持し、確定後は移動後の同じ行、キャンセル後は開始行へフォーカスがある |
| A11Y-FR-06 / §7.1 | フォーカスを視覚的に確認できる | フォーカス中の row control が可視で、hover に依存せず存在する |
| A11Y-FR-07 / §7.2 | Table Reorder 自身の UI がフォーカス対象を完全に隠さない | フォーカス対象と guidance の bounding box が全面的に重ならず、長い Table の追従後も対象を確認できる |
| A11Y-FR-08 / §9 | 必要な操作案内を画面上で確認できる | 待機中、キーボード移動中、PC 移動先選択中の各状態で対応する案内が表示・終了する |
| A11Y-FR-09 / §12 | 状態・結果・移動不能理由を支援技術から確認できる | live region から開始、移動先変更、確定、キャンセル、境界、`rowspan` 理由を確認できる |
| A11Y-FR-10 / §4, §11 | name / role / state を判別できる | row control が button として取得でき、accessible name に行番号と代表情報が含まれる |
| A11Y-FR-03 / §8 | ポインター UI に必要な操作領域がある | 代表 row control / destination target の bounding box が原則 24 × 24 CSS px 以上 |
| A11Y-FR-12 / §14 | iframe / non-iframe で意味を共通化する | 同じ locator / helper と利用者向け assertion で代表シナリオが成立する |

## 方針

### 1. 専用 spec を追加し、既存操作 spec の責務を膨らませない

`tests/e2e/table-reorder-accessibility.spec.ts` を追加し、#261 固有の assertion をまとめる。

既存 `table-reorder-keyboard.spec.ts` や `table-reorder-pc-single-pointer.spec.ts` は入力方式の基本操作を正とするため、そこへ live region や accessible name の assertion を大量に追加しない。

ただし、既存 helper が同じ利用者操作を表している場合は再利用する。低レベル DOM traversal や製品内部 class への依存を新たに広げない。

### 2. accessible name / role は role locator で確認する

row control は `getByRole( 'button', { name: ... } )` または既存 `getRowControl()` を使い、次を確認する。

- button としてアクセシビリティツリーから取得できる。
- accessible name が現在の行番号と行内容の代表情報を含む。
- 行移動後は、新しい現在位置を反映した accessible name へ更新される。

DOM の `aria-label` 属性値そのものを主要 assertion にしない。利用者 / 支援技術から取得できる accessible name を観測する。

### 3. フォーカスは「同じ行を追跡できること」を確認する

キーボード操作では既存の代表シナリオを土台に、次を一つの統合フローで確認する。

1. Toolbar 入口から `Bravo` の row control へ入る。
2. `Enter` で開始する。
3. `ArrowDown` で有効な移動先を変更する。
4. 操作中も `Bravo` の row control にフォーカスが維持される。
5. `Space` で確定する。
6. 移動後の `Bravo` row control にフォーカスがある。
7. accessible name の行番号が移動後の位置へ更新される。

キャンセルは別の短いケースで、開始位置へ戻ることを確認する。

PC 単一ポインター操作では、handle click で対象を選んだ時点で対象 row control がフォーカス対象になり、確定 / キャンセル後にも同じ行を追跡できることを代表確認する。

### 4. live region は利用者向け状態変化を順番に確認する

製品内部の notification 関数やイベント順序は assertion しない。

実ブラウザ上の live region を role / aria-live semantics で取得し、状態変化後に `expect(...).toContainText()` または `expect.poll()` で利用者向け通知を確認する。

代表シナリオは次とする。

- キーボード開始: 対象行、現在位置、総行数
- キーボード移動先変更: 対象行、移動予定位置、総行数
- 確定: 対象行、移動元、移動先
- キャンセル: 対象行、維持された位置
- 境界: それ以上移動できない方向
- `rowspan`: 移動できない理由
- 移動可能行なし: 並べ替え可能行が存在しないこと

テストは英語 / 日本語の両方を個別に重複実行せず、既存 E2E と同様に現在 locale のどちらでも一致する正規表現を使用する。

同一通知を連続して必要以上に繰り返さない仕様は、DOM 内部の更新回数ではなく、同じ境界キーを連打したときに利用者向け状態が不必要に増殖しないことを確認できる場合のみ E2E に含める。安定した利用者向け assertion が作れない場合は Jest の責務に残す。

### 5. 操作案内は状態遷移で確認する

画面固定 guidance / tooltip は「文言が存在する」だけでなく、操作状態に合わせて切り替わることを確認する。

代表フロー:

- row control がキーボードフォーカスを受ける → `Enter / Space: start moving` が確認できる。
- キーボード移動開始 → 待機中 tooltip が終了し、キーボード移動中 guidance が表示される。
- 確定 / キャンセル → 移動中 guidance が終了する。
- PC handle click → 移動先選択中 guidance が表示される。
- 移動先選択終了 → guidance が終了する。

初回 coachmark との非重複は #382 に任せるため、本 spec では関連 preference を明示的に dismissed にして開始する。

### 6. フォーカス遮蔽は geometry の代表ケースだけを測る

すべての viewport / browser size を網羅しない。

長い Table の既存 keyboard scroll scenario を参考に、対象 row control または insertion line と guidance の bounding box を取得し、Table Reorder の案内がフォーカス対象を完全に覆っていないことを代表ケースで確認する。

CSS の pixel-perfect な座標や特定の offset 値は assertion しない。

### 7. ターゲットサイズは代表 UI だけを測る

PC row control と destination target の代表一つについて bounding box を取得し、幅・高さが原則 24 CSS px 以上であることを確認する。

視覚アイコン自体のサイズではなく、実際に pointer input を受ける操作領域を測る。

Touch について同じ CSS contract を共有している場合は PC / Touch 双方を反復しない。異なる UI が使われている場合だけ Touch の代表 target を追加する。

### 8. `rowspan` 通知は #259 と責務を分ける

#259 は「移動できない」という制約そのものを確認する。

#261 では制約計算を再テストせず、既存 / 共通 fixture で `rowspan` 内の行から Toolbar の「Reorder rows」を実行したときに、フォーカスが Toolbar に留まり、live region / 一時通知から理由を確認できることだけを確認する。

同様に「移動可能な行がない Table」も、行可否計算ではなく利用者への情報提供だけを確認する。

### 9. iframe / non-iframe は横断マトリクスとして扱う

#252 の方針どおり、すべてのアクセシビリティケースを両環境で複製しない。

`getEditorContext()` を使用し、少なくとも次の代表境界が iframe / non-iframe の双方で同じ意味になることを確認する。

- row control の accessible name / role
- Toolbar 入口から row control へのフォーカス
- 確定 / キャンセル後のフォーカス
- live region の開始または確定通知

実装時の `wp-dev` 対応バージョンで両編集環境を実行できる場合に横断検証する。環境差の切り替えを test 内部の製品実装へ持ち込まない。

## 想定テストケース

### A. アクセシブルな識別情報

1. Toolbar 入口が `Reorder rows / 行を並べ替え` という名前の button として取得できる。
2. 移動可能な row control が button として取得でき、accessible name に行番号と行内容の代表情報が含まれる。
3. 行移動後、移動した行の row control の accessible name が新しい行番号を反映する。

### B. キーボード操作時のフォーカスと通知

4. キーボード並べ替え開始後も移動対象 row control にフォーカスを維持し、対象行と現在位置を通知する。
5. `ArrowDown` / `ArrowUp` で有効な移動先を変更したとき、移動対象 row control からフォーカスを外さず、新しい移動予定位置を通知する。
6. 移動を確定したとき、移動元と移動先を通知し、移動後の同じ行に対応する row control へフォーカスを維持する。
7. キャンセルしたとき、キャンセルを通知し、行順を変更せず、操作開始行の row control へフォーカスを戻す。
8. 先頭 / 末尾など、それ以上進めない移動先で操作したとき、これ以上移動できないことを通知する。

### C. PC 単一ポインター操作時のフォーカスと案内

9. row handle をクリックして移動先選択へ入ったとき、選択した row control をフォーカス対象とし、選択状態を通知し、移動先選択中の案内を表示する。
10. 確定 / キャンセルで移動先選択中の案内を終了し、同じ論理行のフォーカス文脈を維持する。

### D. 利用できない操作

11. `rowspan` 制約で移動できない行から並べ替え入口を実行したとき、Toolbar の操作文脈を維持し、移動できない理由を通知する。
12. 移動可能な本文行が存在しない Table で並べ替え入口を実行したとき、並べ替えできる行がないことを通知する。

### E. 視覚的アクセシビリティの統合確認

13. キーボード待機中の案内が、並べ替え開始後に移動中案内へ切り替わり、確定 / キャンセル後に終了する。
14. 代表的な row control / destination target の操作領域が 24 × 24 CSS px 以上であることを確認する。ただし、実装が WCAG の spacing 例外を意図的に利用しており、その条件を別途確認できる場合を除く。
15. 長い Table でキーボード移動したとき、現在の移動先を表示領域内で確認でき、Table Reorder の案内がフォーカスされた操作文脈を完全に覆わない。

## 実装フェーズ

### Phase 1: アクセシビリティ識別情報と共通 helper

- 成果:
  - アクセシビリティ専用 spec の骨格と、安定した利用者視点の locator が利用できる。
- 作業:
  - `tests/e2e/table-reorder-accessibility.spec.ts` を追加する。
  - `getEditorContext()`、`getRowControl()`、Table fixture helper、既存 coachmark preference 設定を必要に応じて再利用する。
  - live region の取得や操作領域 geometry の取得に既存 helper がない場合のみ、必要最小限の helper を追加する。
  - アクセシブルな識別情報のケースを追加する。
- 検証:
  - #261 の focused Playwright spec を実行する。
  - 既存 keyboard / PC single-pointer spec の責務を変更しないことを確認する。

### Phase 2: フォーカス・案内・live region の統合確認

- 成果:
  - 開始 / 移動 / 確定 / キャンセルの一連のフローで、フォーカスと通知の振る舞いを E2E で確認できる。
- 作業:
  - キーボードのフォーカス + 通知シナリオを追加する。
  - PC 単一ポインターのフォーカス + 案内の代表シナリオを追加する。
  - 操作案内が状態に応じて切り替わることを assertion する。
- 検証:
  - #261 の focused accessibility spec を実行する。
  - 既存の入力方式別 spec を回帰確認する。

### Phase 3: 利用不可操作と視覚境界

- 成果:
  - 移動不能理由、ターゲットサイズ、フォーカス遮蔽境界を、行移動ロジックと重複せず確認できる。
- 作業:
  - 通知ケースに必要な最小限の `rowspan` / 移動可能行なし fixture を再利用または追加する。
  - 代表的なターゲットサイズ assertion を追加する。
  - 既存 keyboard E2E で十分に保証できていない場合のみ、長い Table のフォーカス / guidance geometry assertion を追加する。
  - 既存の長い Table の keyboard case が #261 要件を十分に保証している場合は、重複テストを追加せず参照する。
- 検証:
  - #261 の focused accessibility spec を実行する。
  - 対応する `wp-dev` 環境で E2E 全体を実行する。

## 判断事項と実装時の確認事項

### 実装前に決めること

- なし。要件定義書とアクセシビリティ基本設計書ですでに期待する利用者向け振る舞いが定義されている。

### 実装中に確認すること

- Playwright から製品内部 class 名へ依存せず取得できる、安定した live region の semantics が現在どの DOM node にあるか。
- row control / destination の pointer hit area が視覚アイコン要素とは別か、どの node が実際に pointer input を受けるか。
- 既存の長い Table のキーボードテストが、#261 のフォーカス遮蔽 / 表示追従要件を十分に保証しており、重複ケースを避けられるか。
- 現在の `wp-dev` WordPress マトリクスで、代表ケースの iframe / non-iframe 境界をどのように実行できるか。

## 検証

`tests/e2e/` 配下の実装変更は `docs/development/testing.md` に従う。

- `npm test`
  - 期待結果: format、lint、typecheck、Jest coverage が成功する。
- `npm run build`
  - 期待結果: production build が成功する。
- `npm run test:e2e -- tests/e2e/table-reorder-accessibility.spec.ts`
  - 期待結果: 対応する `wp-dev` 環境で #261 の focused scenario が成功する。
- `npm run test:e2e`
  - 期待結果: 既存 E2E と #261 scenario がすべて成功する。
- `git diff --check origin/main...HEAD`
  - 期待結果: whitespace error がない。

最終的な実環境検証はユーザーが実施する。対応する `wp-dev` 環境で実際に実行していない E2E を成功したとは報告しない。

## 完了条件

- [ ] Playwright が Jest の重複テストにならない形で、アクセシビリティ専用 E2E が実装されている。
- [ ] row control を利用者向け role と accessible name で識別でき、現在位置と代表情報を確認できる。
- [ ] 移動した行の accessible identity が新しい位置へ更新される。
- [ ] キーボード並べ替え中は対象 row control にフォーカスを維持する。
- [ ] キーボード確定後は移動後の同じ論理行にフォーカスを維持する。
- [ ] キーボードキャンセル後は元の論理行へフォーカスを戻す。
- [ ] PC 移動先選択でも、確定 / キャンセル後まで選択した行のフォーカス文脈を維持する。
- [ ] キーボード待機中 / 移動中、PC 移動先選択中の案内が観測でき、操作状態に応じて切り替わる。
- [ ] 開始、移動先変更、確定、キャンセル、境界、`rowspan` 理由、移動可能行なしの情報を、ブラウザ上のアクセシビリティ通知経路から確認できる。
- [ ] 代表的な pointer operation target が基本設計の target-size contract を満たすか、適用する spacing 例外が明示的に説明されている。
- [ ] 長い Table の代表シナリオで、Table Reorder の案内がフォーカスされた操作文脈を完全に覆わない。
- [ ] SortableJS 内部状態や内部イベント順序ではなく、利用者から観測できる UI / accessibility state を assertion している。
- [ ] 固定時間の `waitForTimeout()` による同期を追加していない。
- [ ] Touch 初回 UI の責務を #382 から重複して取り込んでいない。
- [ ] 結合セル制約の計算を #259 / Jest から重複して取り込んでいない。
- [ ] データ保持 / Undo を #260 から重複して取り込んでいない。
- [ ] iframe / non-iframe を直積網羅ではなく、代表的な横断マトリクスとして扱っている。
- [ ] Flexible Table Block E2E は今回の Core Table 実装範囲外のままである。

## 補足

- 最終 assertion は role / accessible name / visible guidance / focus / live-region text を優先する。
- semantic locator が存在しない場合に限り製品 class 名を狭く利用できるが、#261 テストの主要 contract にはしない。
- 初回 UI が #261 シナリオへ混入しないよう、keyboard / touch coachmark preference は明示的に設定する。
- Playwright で自動化しやすくするためだけの product hook や test-only attribute は追加しない。
