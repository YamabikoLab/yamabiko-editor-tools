# PLAN-004: Stage 3 Notice block

## 目的

Issue #4 の初期仕様どおり、`yamabiko/notice` をエディターで編集でき、PHPで安全に動的レンダリングできる状態にする。

Stage 2で完成したVite entry、external化、manifest、`AssetLoader`はそのまま利用する。Stage 3ではアセット基盤を再設計しない。

## 実装範囲

- 属性は`message`と`tone`のみ
- `tone`は`info`、`tip`、`warning`
- 見出しは属性にせず、toneから導出する
- 本文は`RichText`で直接編集する
- toneはInspector Controlsの`RadioControl`で変更する
- PHPによる動的レンダリングを使う
- フロントエンドJavaScriptは追加しない
- TypeScriptでtoneの正規化を単体テストする
- 共通スタイルとエディター専用スタイルをWordPressのblock metadataから読み込む

## 変更しないもの

Stage 3では次を変更しない。

- `AssetLoader`の責務、constructor、manifest schema
- `vite.config.ts`のentry、external、development descriptor
- Viteのvirtual moduleや独自HMR bridge
- Script Modules APIの追加設計
- iframe向けCSS HMRの追加実装
- PHPUnit、PHPStan、PHPCS、WPCSの基盤
- E2E基盤、README、配布基盤

iframe／非iframe、development／productionの横断確認とHMRの仕上げはStage 4で行う。

## ファイル構成

```text
app/src/Notice/
├── Block.php
├── block.json
├── render.php
├── entries/
│   └── notice-block.entry.ts
├── editor/
│   └── Edit.tsx
├── editor.css
├── style.css
├── tone.ts
└── tone.test.ts
```

初期実装ではSassを追加しない。スタイル量が少ないため、WordPressが直接読み込めるCSSを使用する。

## block.json

`block.json`は次の契約を正本とする。

```json
{
  "$schema": "https://schemas.wp.org/trunk/block.json",
  "apiVersion": 3,
  "name": "yamabiko/notice",
  "title": "お知らせ",
  "category": "text",
  "icon": "info",
  "description": "本文と表示種別を設定できるお知らせです。",
  "textdomain": "yamabiko-blocks",
  "attributes": {
    "message": {
      "type": "string",
      "default": ""
    },
    "tone": {
      "type": "string",
      "enum": ["info", "tip", "warning"],
      "default": "info"
    }
  },
  "supports": {
    "html": false
  },
  "style": "file:./style.css",
  "editorStyle": "file:./editor.css",
  "render": "file:./render.php"
}
```

`editorScript`は指定しない。Stage 2で実装済みの`AssetLoader`が`notice-block.entry.ts`をブロックエディターへ読み込む。

## TypeScriptとエディターUI

### tone.ts

WordPress、React、DOMに依存しない純粋モジュールとする。

- `NoticeTone`型を定義する
- 対応toneの一覧を定義する
- `normalizeTone(value: unknown)`を実装する
- 未対応値や文字列以外は`info`へフォールバックする

表示ラベルは翻訳が必要なため、`Edit.tsx`で定義する。

| tone | ラベル |
| --- | --- |
| `info` | お知らせ |
| `tip` | ヒント |
| `warning` | 注意 |

### notice-block.entry.ts

entryは次だけを担当する。

- `block.json`を読み込む
- `Edit`を読み込む
- `registerBlockType()`で登録する
- `save`は`null`を返す

entryへtoneロジックや表示処理を置かない。

### Edit.tsx

- `useBlockProps()`を使用する
- `RichText`で`message`を直接編集する
- 許可するformatは`core/bold`、`core/italic`、`core/link`
- `InspectorControls`、`PanelBody`、`RadioControl`でtoneを変更する
- 不正なtoneは表示上のみ`info`として扱い、エディターを開いただけで属性を書き換えない
- tone変更で`RichText`を再マウントしない
- ユーザー向け文字列は`@wordpress/i18n`で翻訳する

独立したReact root、`index.html`、`App.tsx`は作成しない。

## PHP登録とレンダリング

### Block.php

`YamabikoLab\Blocks\Notice\Block`を追加する。

- `register_hooks()`で`init`へ登録処理を追加する
- 登録処理は`register_block_type(__DIR__)`だけを行う
- enqueueやレンダリング処理を持たない

`Plugin.php`で`Block`を生成し、`register_hooks()`を呼ぶ。

Composer autoloaderがない場合にも動くよう、`yamabiko-blocks.php`のfallback requireへ`src/Notice/Block.php`を追加する。

### render.php

- `tone`をPHP側でも正規化し、不正値は`info`にする
- toneから翻訳済みラベルを選ぶ
- `message`を許可HTMLで`wp_kses()`する
- 可視文字が空なら空文字を返す
- wrapperは`get_block_wrapper_attributes()`を使う
- 通常のお知らせへ`role="alert"`を付けない
- フック、グローバル関数、JavaScriptを追加しない

許可する本文マークアップは次に限定する。

- `strong`
- `em`
- `br`
- `a`: `href`、`title`、`target`、`rel`、`data-type`、`data-id`

出力構造はエディターとフロントエンドでそろえる。

```html
<div class="wp-block-yamabiko-notice yamabiko-blocks-notice is-tone-info">
  <div class="yamabiko-blocks-notice__label">
    <strong>お知らせ</strong>
  </div>
  <div class="yamabiko-blocks-notice__message">お知らせ本文</div>
</div>
```

色だけに依存せず、可視ラベルでtoneを伝える。初期実装では独自アイコンを追加しない。

## スタイル

- `style.css`はwrapper、tone、ラベル、本文、リンクを担当する
- `editor.css`はプレースホルダーや編集時にだけ必要な調整を担当する
- WordPress標準のフォーカス表示とリンクの下線を消さない
- toneごとに背景色だけでなく、境界線と可視ラベルも使用する
- `block.json`の`style`と`editorStyle`に読み込みを委ねる

## テスト

`tone.test.ts`で少なくとも次を確認する。

- `info`、`tip`、`warning`をそのまま返す
- 未対応文字列を`info`へフォールバックする
- `null`、数値、配列などを`info`へフォールバックする

`package.json`へ次を追加する。

- `test:unit`: `vitest run`
- `test:watch`: `vitest`
- `npm test`へ`test:unit`を組み込む

Stage 3では新しいPHPテスト基盤を作らない。変更したPHPファイルへ`php -l`を実行し、PHPUnitによる登録・render・securityテストはStage 4へ残す。

## 実装順序

1. `block.json`、`tone.ts`、`tone.test.ts`を追加する
2. `notice-block.entry.ts`と`Edit.tsx`を実装する
3. `Block.php`、`Plugin.php`、bootstrap fallbackを更新する
4. `render.php`を実装する
5. `style.css`と`editor.css`を追加する
6. Vitest scriptsを追加し、品質ゲートを実行する
7. WordPress上で手動確認する

## 完了前の検証

Dev Containerの`app/`で実行する。

```bash
logcut npm test
logcut npm run build
php -l src/Notice/Block.php
php -l src/Notice/render.php
php -l src/Plugin.php
php -l yamabiko-blocks.php
composer validate
git diff --check
```

手動確認:

1. お知らせブロックを挿入できる
2. 本文を直接編集できる
3. 3種類のtoneを切り替えられる
4. 保存と再読み込みで本文とtoneが保持される
5. フロントエンドでPHPレンダリングされる
6. 不正なtoneが`info`になる
7. 許可formatが残り、危険なHTMLが出力されない
8. フロントエンドでNotice用JavaScriptが読み込まれない
9. console error、PHP warning、fatal errorがない

## Stage 3の完了条件

- `yamabiko/notice`の編集、保存、動的レンダリングが動く
- tone、翻訳、サニタイズ、アクセシビリティの基本契約を満たす
- Node品質ゲートと変更PHPのsyntax checkが成功する
- Stage 2のVite／AssetLoader契約を壊していない

## Stage 4へ残す内容

- iframe／非iframeでのHMR確認と必要な改善
- development／productionの横断確認
- PHPUnit、PHPStan、PHPCS、WPCS
- E2E、README、開発文書、配布物の完成確認
