# PLAN-365: Table Reorder キーボード待機中のフォーカス操作整理

## References

- Parent issue: #365
- Requirements: `docs/requirements/table-reorder/table-reorder-accessibility-requirements.md`
- Design: `docs/design/table-reorder/table-reorder-accessibility-design.md`

## Goal

キーボード待機中の row control では `Tab / Shift+Tab` を行間フォーカス移動として維持し、修飾キーなしの `ArrowUp / ArrowDown` が Gutenberg の `WritingFlow` に伝播して別行へフォーカスを移す挙動だけを Table Reorder 側で抑止する。

あわせて、初回コーチマーク、翻訳、E2E、アクセシビリティ基本設計を実装仕様と一致させる。

## Scope

### Included

- idle の row control で修飾キーなし `ArrowUp / ArrowDown` を `preventDefault()` / `stopPropagation()` する。
- `Shift` / `Ctrl` / `Alt` / `Meta` 付き `ArrowUp / ArrowDown` は Table Reorder で消費しない。
- 並べ替え開始後の `ArrowUp / ArrowDown` による移動先変更を維持する。
- `Tab / Shift+Tab` による idle row control 間のフォーカス移動を維持する。
- キーボード初回コーチマークへ `Tab / Shift+Tab` の案内を追加する。
- 日本語翻訳 JSON を新しいコーチマーク文言へ同期する。
- unit / E2E テストを Issue #365 のテスト方針に沿って更新する。
- アクセシビリティ基本設計書の §5.2、§5.3、§9、§10 / §10.1 を更新する。

### Not included

- document / capture フェーズの新しい keydown listener。
- Gutenberg 固有 DOM の判定や分岐。
- 修飾キー付き Arrow の挙動を Table Reorder 側で再定義すること。
- タッチ・ポインター操作の仕様変更。
- 待機中ツールチップへの `Tab / Shift+Tab` 常時表示。

## Approach

既存の row control 自身の `keydown` 処理を境界として使う。`session.kind === 'idle'` かつキーが `ArrowUp` / `ArrowDown`、さらに `Shift` / `Ctrl` / `Alt` / `Meta` のいずれも押されていない場合だけイベントを消費して終了する。

これにより Gutenberg `WritingFlow` への不要な伝播だけを狭い範囲で止め、修飾キー付き操作や並べ替え開始後の既存キーボード操作には介入しない。

## Architecture

- `src/editor-extensions/table-reorder/controller/sortable-controller.ts`
  - idle row control の keydown 境界で plain Arrow を抑止する。
- `src/editor-extensions/table-reorder/messages.ts`
  - キーボード初回コーチマーク文言を更新する。
- `languages/yamabiko-editor-tools-ja-yamabiko-editor-tools-table-reorder-index.json`
  - 新しい英語 msgid と日本語訳を同期する。
- `src/editor-extensions/table-reorder/controller/sortable-controller-keyboard.test.ts`
  - idle plain Arrow の抑止と modifier Arrow の passthrough を固定する。
- `tests/e2e/table-reorder-keyboard.spec.ts`
  - 実 Gutenberg 上で plain Arrow がフォーカスを動かさず、Tab が引き続き移動することを確認する。
- `tests/e2e/table-reorder-ui.spec.ts`
  - 新しいコーチマーク文言を確認する。
- `docs/design/table-reorder/table-reorder-accessibility-design.md`
  - 利用者向け操作仕様と初回案内を実装に同期する。

## Implementation phases

### Phase 1: idle Arrow のイベント境界を追加

- Outcome: 待機中の plain `ArrowUp / ArrowDown` だけが row control で抑止される。
- Tasks:
  - idle 分岐へ plain Arrow 判定を追加する。
  - modifier Arrow は既存どおり外側へ渡す。
  - active keyboard session の Arrow 処理は変更しない。
  - unit テストを追加する。
- Validation:
  - `sortable-controller-keyboard.test.ts` で default prevention と propagation を確認する。

### Phase 2: 初回コーチマークと翻訳を同期

- Outcome: キーボード利用者が初回だけ `Tab / Shift+Tab` による行選択方法を把握できる。
- Tasks:
  - `getKeyboardCoachmarkMessage()` を Issue #365 の確定文言へ更新する。
  - 翻訳 JSON の msgid / 日本語訳を更新する。
  - 待機中ツールチップは変更しない。
- Validation:
  - `table-reorder-ui.spec.ts` の期待文言を更新する。

### Phase 3: Gutenberg E2E を更新

- Outcome: 実エディター上で idle Arrow と Tab の責務分離を確認できる。
- Tasks:
  - toolbar から row control に入った後、plain Arrow でフォーカスが維持されるケースを追加する。
  - 既存の Tab / Shift+Tab 論理順テストを維持する。
- Validation:
  - `tests/e2e/table-reorder-keyboard.spec.ts` を実行する。

### Phase 4: アクセシビリティ基本設計を同期

- Outcome: §5.2、§5.3、§9、§10 / §10.1 が実装と一致する。
- Tasks:
  - idle の plain / modifier Arrow の責務を明記する。
  - active session の Arrow 移動を明記する。
  - `Tab / Shift+Tab` は常時案内せず初回案内だけに含めることを明記する。
  - §10.1 の英語・日本語文言を Issue #365 の確定文言へ更新する。
- Validation:
  - Issue #365 の完了条件と設計書を突き合わせる。

## Decisions and validation questions

### Decide before implementation

- None. Issue #365 で実装境界、modifier passthrough、文言、テスト対象まで確定済み。

### Validate during implementation

- plain Arrow の抑止が row control の `keydown` だけで Gutenberg のフォーカス移動を止められること。
- modifier Arrow が Table Reorder では抑止されないこと。
- idle の変更が active keyboard session の Arrow 移動に影響しないこと。

## Issue breakdown

- [x] Issue #365 を単一実装単位として扱う。追加の子 Issue は作成しない。

## Validation

ユーザーが検証を実施するため、この対応では検証コマンドを実行しない。

- `npm test`
  - Expected result: Node.js quality gate が成功する。
- `npm run build`
  - Expected result: production build が成功する。
- `npm run test:e2e`
  - Expected result: 対象 E2E を含む Playwright suite が対応環境で成功する。
- `git diff --check origin/main...HEAD`
  - Expected result: whitespace error がない。

## Completion criteria

- idle では `Tab / Shift+Tab` で移動可能な row control 間を移動できる。
- idle の修飾キーなし `ArrowUp / ArrowDown` では row control 間のフォーカス移動が発生しない。
- idle の修飾キー付き `ArrowUp / ArrowDown` は Table Reorder で抑止されない。
- 並べ替え開始後は `ArrowUp / ArrowDown` で従来どおり移動先を変更できる。
- 初回コーチマークで `Tab / Shift+Tab` による行選択を案内する。
- 新しい英語コーチマーク文言に対応する日本語翻訳が翻訳 JSON に反映される。
- unit / E2E の対象テストとアクセシビリティ基本設計が実装に一致する。

## Notes

- 実装は row control 自身の `keydown` に限定し、Gutenberg の内部 DOM や `WritingFlow` 実装への依存を追加しない。
- 検証はユーザーが実施する。
