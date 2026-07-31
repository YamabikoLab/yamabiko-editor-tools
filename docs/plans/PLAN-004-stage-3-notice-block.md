# 第3段階「お知らせブロック本体」実装専用プランの作成

## Summary

- `docs/plans/PLAN-004-stage-3-notice-block.md` のみを新規作成し、Issue #4、PR #5、承認済み4段階方針、最新HEAD `524b90b` を根拠として第3段階の実装契約を確定する。
- お知らせブロック本体、依存関係、設定、テストコードは今回は変更しない。
- 設計上の未決定事項は残さない。計画作成後、対象Markdownのみ整形し、`git diff --check` を通してからPR #5へ結果をコメントする。

## プランで確定する実装契約

### ブロックとエディター

| 項目 | 契約 |
|---|---|
| ブロック名 | `yamabiko/notice` |
| `message` | `string`、既定値 `""`。許可済みインラインHTMLを含む文字列としてブロックコメントJSONへ保存 |
| `tone` | `string`、`enum: ["info", "tip", "warning"]`、既定値 `info` |
| 保存 | `save: () => null` の動的ブロック。保存HTMLは持たず、属性のみ自己終了形式のブロックコメントへ保存 |
| メタデータ | `apiVersion: 3`、category `text`、icon `info`、`supports.html: false`、text domain `yamabiko-blocks` |
| 正本 | PHPは `register_block_type(__DIR__)`、TypeScriptは同じ `block.json` をimport |
| 空本文 | エディターではプレースホルダーを表示。PHPは可視文字が空なら空文字を返し、フロントへ空のNoticeを出力しない |

- `RichText` で本文を直接編集し、`allowedFormats` は `core/bold`、`core/italic`、`core/link` に限定する。
- `InspectorControls`、`PanelBody`、`RadioControl` を使う。3択の排他的選択と標準キーボード操作を理由に `RadioControl` を採用する。
- tone変更ではRichTextを再マウントせず、`message`、選択、フォーカスを保持する。壊れたtoneは表示上 `info` として扱うが、エディターを開いただけで投稿を自動更新しない。
- 独立したReact root、`index.html`、`App.tsx` は作成しない。

### tone、ラベル、HTML、アクセシビリティ

| tone | 可視ラベル | 装飾アイコン | modifier |
|---|---|---|---|
| `info` | お知らせ | `ℹ` | `is-tone-info` |
| `tip` | ヒント | `✓` | `is-tone-tip` |
| `warning` | 注意 | `⚠` | `is-tone-warning` |

- `heading` 属性は追加しない。Issue画像どおりラベルをtoneから導出する。
- 文書アウトライン上の適切な見出しレベルを判断できないため `h2`～`h6` は使わず、可視ラベルを `<strong>` で表す。
- アイコンは `aria-hidden="true"` の装飾とし、意味は必ず可視ラベルから伝える。通常のお知らせに `role="alert"` は付けない。
- エディターとPHPは次の同一構造を使用する。

```html
<div class="wp-block-yamabiko-notice yamabiko-blocks-notice is-tone-info">
  <div class="yamabiko-blocks-notice__label">
    <span class="yamabiko-blocks-notice__icon" aria-hidden="true">ℹ</span>
    <strong>お知らせ</strong>
  </div>
  <div class="yamabiko-blocks-notice__message">お知らせ本文</div>
</div>
```

- `wp-block-yamabiko-notice` はWordPress標準クラス、独自クラスはFoundation契約に従い `yamabiko-blocks-` を接頭辞とする。
- PHPは `get_block_wrapper_attributes()` へ基本クラスと正規化済みmodifierを渡し、WordPressの追加class/support属性と統合する。
- 本文の許可HTMLは `<strong>`、`<em>`、`<br>`、`<a>` のみ。リンク属性は `href`、`title`、`target`、`rel`、`data-type`、`data-id`、protocolは `http`、`https`、`mailto`、`tel` に限定する。
- `wp_kses()` を最終HTML境界で使い、script、iframe、画像、style/class/id、イベント属性、危険なURL schemeを除去する。ラベルとアイコンは `esc_html()`、wrapperはWordPress APIへ委任する。
- `tone.ts` はWordPress・React・DOM非依存とし、tone正規化、任意の翻訳済みラベル集合からの選択、アイコン対応を提供する。翻訳リテラルは `Edit.tsx` の `__()` とPHPの `__()` に置く。

### PHP登録、CSS surface、Vite

- `Notice\Block` は `init` でのメタデータ登録だけを担当し、`Plugin.php` が `AssetLoader` とともに組み立てる。Composer不在時のbootstrap fallbackへ `Notice/Block.php` を追加する。
- `render.php` は一回のrenderに必要な属性検証、tone正規化、翻訳済みpresentation選択、本文KSES、wrapper生成だけを担当し、フック・enqueue・グローバル関数を定義しない。
- build成果物がなくてもブロック登録と安全な動的HTMLは維持する。挿入UIやCSSが使えない場合もfatal errorにせず、既存コンテンツを意味の通る非装飾HTMLとしてrenderする。

| CSS handle | Vite key | surface |
|---|---|---|
| `yamabiko-blocks-notice-editor` | `notice/editor/editor` | `editor-parent`, `editor-canvas` |
| `yamabiko-blocks-notice` | `notice/style` | `editor-canvas`, `front-end` |

- `editor/editor.scss` はエディター専用のプレースホルダー、選択・フォーカス表示を所有する。
- `style.scss` はwrapper、tone色、ラベル、本文、リンクを所有し、エディターキャンバスとフロントエンドで共有する。
- toneごとに明色背景、十分に暗いaccent、可視ラベルを併用する。リンクの下線とWordPress標準フォーカス表示を消さない。
- `block.json` の `editorStyle` と `style` は上記stable handleを参照する。[WordPressのblock metadata](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-metadata/) に従い、iframe・非iframe・フロントエンドへの配置をWordPressへ委任する。
- asset-manifest schema version 1は維持し、後方互換な任意の `styles` セクションを追加する。各recordはkey、handle、file、version、明示的surface配列を持つ。
- style.scssとeditor.scssを独立したVite CSS inputにし、CSS用JavaScriptを生成・enqueueしない。`sass` をdevDependencyとして追加することは第3段階実装に含め、`package-lock.json` を同時更新する。
- `AssetLoader` はproduction styleを登録するがenqueueを所有しない。block metadataが必要なsurfaceだけenqueueする。
- developmentではVite client、editor entry、両CSS URLがすべて2xxのときだけ、editor request内のstable style handlesをVite URLへ切り替える。一つでも欠ければ全体をproductionへ戻し、dev/prodを混在させない。フロントエンドはVite clientやNotice JavaScriptを一切読み込まない。
- Vite dev serverでもWordPress提供runtimeを複製しない。Viteのserve専用virtual adapterで使用するnamed exportを `window.wp.*`、`ReactJSXRuntime` へ接続し、dev descriptorに必要なclassic dependency handlesを明記してmoduleより先にenqueueする。productionの既存external契約は維持する。
- iframe CSS HMRはDOMやiframeを直接検索せず、`editor/development-styles.ts` が `?inline` CSSと公開 `core/block-editor` storeの `updateSettings({ styles })` を使って、専用marker付きstyleだけを追加・交換・disposeする。これによりCSS更新でブロック登録やRichTextを再生成しない。
- production scriptには `wp_set_script_translations()`、WordPress 7.0以降のdevelopment moduleには利用可能な場合のみ `wp_set_script_module_translations()` を設定する。WordPress 6.8最小要件は変更しない。

## 実装順序として文書化する内容

1. **依存・公開契約**
   - 対象: `package.json`/lock、`block.json`、`tone.ts`/test。
   - 最小検証: tone用Vitest、対象format/lint/typecheck。
   - 完了: 属性、fallback、表示対応が純粋テストで固定。
   - 戻し方: package定義とlockを対で戻し、未参照metadataを削除。

2. **Vite metadataとAssetLoader**
   - 対象: Vite設定、build inspector、AssetLoaderと既存smoke test。
   - 最小検証: AssetLoader smoke、`npm run build`。
   - 完了: 2つのCSS record、stable handles、全体fallback、CSS用JS不在を検査。
   - 戻し方: optional `styles` 拡張を外せばstage 2 schema 1 entry契約へ戻せる。

3. **エディターUIとHMR**
   - 対象: entry、`Edit.tsx`、development style bridge、editor/common SCSS。
   - 最小検証: Vitest、targeted lint/typecheck、development手動HMR。
   - 完了: 挿入・直接編集・tone切替、iframe/noniframe CSS、内容・選択・フォーカス保持。
   - 戻し方: entryをstage 2 placeholderへ戻す。永続データ変更はない。

4. **PHP登録とrender**
   - 対象: `Block.php`、`render.php`、Plugin/bootstrap。
   - 最小検証: 変更PHPすべての `php -l`、WP-CLI登録smoke。
   - 完了: metadata登録、動的render、KSES、空本文、asset欠落時safe fallback。
   - 戻し方: Plugin compositionを外せば機能を無効化でき、DB・migration・uninstall処理は不要。

5. **品質ゲートと受け入れ**
   - `test:unit` とwatch scriptを追加し、`npm test` に `vitest run` を統合する。
   - `docs/development/testing.md` は新たに実在するVitest commandだけ最小更新し、READMEなどの完成作業は第4段階へ残す。
   - 完了前に `logcut npm test`、`logcut npm run build`、全変更PHPのlint、`composer validate`、`git diff --check` を各一度実行する。

## テスト・受け入れ・段階境界

- Vitest: 全正常tone、文字列以外・未知値・大文字の `info` fallback、toneとラベルfixture・アイコンの対応、WordPress/React/DOM/network非依存。
- AssetLoader smoke: production style登録、dev style全体切替、不完全・404・redirect時のproduction fallback、欠落metadataでfatalなし。
- Build inspection: CSS handles/surfaces/hash、CSS inputからJSが出ないこと、WordPress runtime・Vite client・HMR marker・development URLがproductionにないこと。
- PHP behaviorは第3段階では変更ファイルのsyntax checkと実WordPress手動確認を必須にする。KSESを不正確なstubで再現する新規PHP smokeは追加せず、PHPUnitによる登録・render・security自動テストは第4段階へ残す。
- 手動確認は依頼された17項目を、development/production × iframe/noniframeに分けて記録する。不正toneはコードエディターで改変し、危険HTMLと許可format、空本文、debug log、console、network、フロントエンドNotice JS不在を確認する。
- 対象外: 新しい属性、閉じるボタン、アニメーション、カラーピッカー、アイコン選択、期限条件、REST/DB、フロントReact、大規模E2E、PHPUnit/PHPStan/PHPCS完成、包括的README・第4段階文書。

## プランファイル作成とPR報告

- `apply_patch` で上記契約、各工程の対象ファイル・最小検証・完了判定・rollback、手動確認表を `docs/plans/PLAN-004-stage-3-notice-block.md` へ記載する。
- `app/` から `npm run format:files -- ../docs/plans/PLAN-004-stage-3-notice-block.md` を実行後、`git diff --check` を実行する。
- 差分がプランファイルだけであることを確認してから、PR #5への書き込み対象を明示し、作成ファイル、主要判断、未決定事項なし、実装開始可能、検証結果、コード未実装を含むコメントを投稿する。

## Assumptions

- Issue本文と承認済み公開契約を画像より優先する。画像は「tone由来の可視ラベルと装飾アイコン」を確認する参考として使用済み。
- 最新ローカルHEADとPR headはともに `524b90b` で、作業ツリーはclean。
- 設計上の未決定事項はなし。実装開始には、このプランファイルを作成して承認する必要がある。

## 作業サマリー

### Work performed

- 添付要件、Issue #4、PR #5、4段階方針、Issue画像、最新HEAD、リポジトリ契約、stage 2実装を読み取り、上記の決定済みプランを作成した。
- Plan Modeのため、ファイル作成とPRコメント投稿は未実施。

### Changed files

None

### Commands run

- 添付・契約・実装の `sed -n ...` 読み取り — success。ただし最初の添付読み取り1回はsandbox namespaceエラーで failure、権限付き再実行は success。
- `git status --short --branch`、`git log -5 --oneline --decorate`、`git diff --stat origin/main...HEAD`、`rg --files ...` — success。
- 関連ファイルの `wc -l ...` と、設定・文書・PHP/TypeScriptソースの限定範囲読み取り — success。
- Issue画像の直接 `curl` — 404で failure。
- `gh api graphql ...` と認証済み添付URLへの `curl` — success。
- 画像確認用の `od`、`php -m`、GDによる一時縮小、`base64` 読み込み — success。
- `file /tmp/yamabiko-notice-issue-4.png` — command未導入で failure。
- `command -v convert` — ImageMagick CLI未導入で failure。

### Decision rationale

- `block.json`、WordPress標準Block API、動的PHP render、stable style handlesを中心に据え、stage 2のasset contractを後方互換に拡張する。
- 可視ラベルを意味の正本とし、装飾アイコンや色だけへ依存しない。
- フロントエンドJavaScriptを追加せず、editor iframe HMRだけを公開Block Editor store経由で補完する。

### Open items

- Plan Mode解除後のプランファイル作成、検証、PR #5コメント投稿。

### Next steps

- 本計画どおり `docs/plans/PLAN-004-stage-3-notice-block.md` のみを作成し、検証後にPR #5へ結果を報告する。
