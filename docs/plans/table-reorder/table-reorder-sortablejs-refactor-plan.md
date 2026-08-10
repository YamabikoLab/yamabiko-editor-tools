# Table Reorder SortableJS 責務分割リファクタリングプラン

## 参照資料

- 現在の実装: `src/editor-extensions/table-reorder/with-table-reorder.tsx`
- 現在の機能README: `src/editor-extensions/table-reorder/README.md`
- 既存のrowspanロジック: `src/editor-extensions/table-reorder/rowspan.ts`
- ソース構成方針: `docs/development/source-organization.md`
- テストと検証: `docs/development/testing.md`
- 過去のdnd-kit版リファクタリングプラン: `docs/plans/table-reorder/table-reorder-controller-refactor-plan.md`

過去のcontrollerリファクタリングプランは、以前のdnd-kitベース実装を対象としている。プロジェクトの履歴としては有用だが、本プランは現在のSortableJS実装を前提とし、旧プランのcontrollerやhookの境界を機械的には再利用しない。

## 目的

現在のTable Reorderの挙動を維持したまま、`with-table-reorder.tsx` に集中している責務を分離する。

リファクタリング後の `withTableReorder` は、`BlockEdit` の描画、タッチ端末向け並び替えツールバーの表示、機能ライフサイクルの接続を担当する薄いGutenbergアダプターとする。SortableJSの制御、エディターDOMの解決、runtimeの読み込み、ドラッグ時だけ必要なDOM装飾、決定的な行並び替えロジックは、同じ `table-reorder` 機能ディレクトリ内の担当モジュールへ分離する。

このリファクタリングでは、ユーザーから見える操作モデルを変更しない。特に、iframe / non-iframeエディター、hoverハンドル、タッチ端末の長押しドラッグ、`rowspan` 制約、挿入位置表示、SortableJSのアニメーションとauto-scroll、GutenbergへDOM所有権を戻す処理は、リファクタリング前と同じように動作させる。

## 対象範囲

### 含むもの

- 現在 `with-table-reorder.tsx` に集中している責務の分離。
- 大きな構造変更の前に、決定的な行並び替えと `rowspan` の挙動を固定するJestテストの追加。
- テスト対象モジュールの近くへのテスト配置。
- React/Gutenberg統合層から、決定的な行並び替えhelperを分離する。
- iframe / non-iframeのTable DOM解決を局所化する。
- 対象エディター `window` へのSortableJS runtime読み込みを局所化する。
- ドラッグ時のみ必要なDOM装飾と復元処理を局所化する。
- SortableJSライフサイクル制御を専用controller境界へ移す。
- 下位レイヤーの境界が安定した後に、Reactのstate/effectライフサイクルをカスタムhookへ移す。
- `with-table-reorder.tsx` を薄いGutenberg統合・描画境界として残す。
- 最終的なソース構成が確定した後、機能READMEを更新する。

### 含まないもの

- Table Reorderの新機能追加。
- 操作仕様、UI、タイミング、アニメーション、auto-scroll、通知仕様の変更。
- SortableJSの置き換え。
- Core Tableブロックの保存形式やattribute構造の変更。
- 既存の `rowspan` ルールの再設計。
- 汎用的な `shared/`、`utils/`、`helpers/` レイヤーの導入。
- state machineや新しい状態管理ライブラリの導入。
- 将来利用を想定した先行抽象化。
- 行数を減らすことだけを目的とした1helper 1ファイルへの分割。
- 本リファクタリングの前提条件としての新規Playwrightテスト追加。必要に応じて既存E2Eテストは実行するが、本作業の基準はJestによるfocused testと既存の手動エディター確認とする。

## 現在集中している責務

現在の `with-table-reorder.tsx` は、主に次の責務を所有または制御している。

1. Gutenberg `BlockEdit` のラップとTableブロック判定。
2. hover可能端末の判定とタッチ並び替えモードstate。
3. anchor DOMの所有と対象ブロック探索。
4. iframe / non-iframeエディターDOMの解決。
5. `table` / `tbody` の取得。
6. SortableJS runtime URLの取得と対象windowへのscript読み込み。
7. `rowspan` range、移動不可行、禁止挿入位置の算出。
8. hoverハンドルの生成、表示、イベント伝播制御、セルstyle復元。
9. タッチモード時のセル編集抑止と移動不可行の装飾。
10. 挿入線の生成、位置調整、表示、cleanup。
11. fallback drag時のセル幅固定と復元。
12. Gutenbergブロックdragの抑止と復元。
13. タッチpress追跡、長押し時間、移動閾値、警告通知。
14. SortableJS `onChoose`、`onStart`、`onMove`、`onEnd`、`onUnchoose` の制御。
15. Gutenberg attribute更新前の一時的なDOM並び順復元。
16. `setAttributes({ body })` による確定。
17. event listener、style、SortableJS、DOM nodeのcleanup。
18. タッチ向けツールバー描画。

問題はこれらの処理が存在することではなく、所有者とライフサイクルが一つのReact effectと一つのモジュールへ集中していることである。この状態では後続変更の影響範囲を把握しにくく、focused testも書きにくい。

## 方針

全面書き換えではなく、段階的な抽出で進める。

各フェーズでは外部挙動を維持し、拡張機能が動作する状態を保つ。既存責務を一つの明確な所有者へ移し、公開するinterfaceを小さく保ち、そのフェーズを検証してから次の境界へ進む。

汎用抽象化よりも、機能ディレクトリ内の具体的なモジュールを優先する。新しいファイルは、現在の実装に明確に異なる責務があり、その所有者を明示する価値がある場合にのみ作成する。

依存方向はシンプルに保つ。

```text
index.tsx
  ↓
with-table-reorder.tsx
  ↓
use-table-reorder.ts
  ↓
sortable-controller.ts
  ├─ table-context.ts
  ├─ sortable-runtime.ts
  ├─ drag-ui.ts
  ├─ row-order.ts
  └─ rowspan.ts
```

必要に応じて実際のimport関係はこの図より少し平坦でもよい。ただしstate共有だけを理由に、下位モジュールからReact/Gutenberg統合コードへ依存させない。

## アーキテクチャ

### `index.tsx`

担当:

- `withTableReorder` を `editor.BlockEdit` に登録する。

必要なimport path調整を除き、このファイルは変更しない。

### `with-table-reorder.tsx`

リファクタリング後の担当:

- `core/table` のみを対象にする。
- ラップ対象の `BlockEdit` を描画する。
- タッチモード用 `BlockControls` / `ToolbarButton` を描画する。
- owning editor documentを解決するためのhidden anchorを描画する。
- Table Reorder hookを呼び出し、必要最小限のGutenberg propsを渡す。

DOM nodeの直接生成、SortableJS読み込み、pointer session追跡、SortableJS callbackの実装は担当しない。

### `use-table-reorder.ts`

担当:

- React側から見たTable Reorderライフサイクルを所有する。
- hover capability stateを所有する。
- タッチ並び替えモードstateとブロック選択状態との同期を所有する。
- 機能が有効なときに下位のreorder controllerを生成・破棄する。
- WordPress noticesと `setAttributes` を、controllerが利用する狭いcallbackへ接続する。

低レベルのDOM装飾helperやscript読み込み実装は持たない。

### `row-order.ts`

担当:

- `oldIndex` から `newIndex` へ、元配列を変更せず行配列を並び替える。
- React stateに依存しない決定的な計算として扱えるSortableJS move/end用挿入indexを算出する。
- SortableJSが一時的に行DOMを移動した後、取得済みのDOM行順を復元するhelperは、controller抽出後の利用関係を見て `row-order.ts` と `drag-ui.ts` のどちらが自然か判断する。

純粋なデータ変換はWordPressやReactへ依存させない。

### `rowspan.ts`

担当:

- 既存の `rowspan` range解析を維持する。
- 移動不可行の算出を維持する。
- 禁止挿入indexの算出を維持する。

今回のリファクタリングではこのモジュールを再設計しない。

### `table-context.ts`

担当:

- anchorのowning documentを起点として、`clientId` からTableブロック要素を解決する。
- root documentに対象ブロックがない場合、`iframe[name="editor-canvas"]` へfallbackする。
- 解決した `blockElement`、owning `document`、owning `window`、`table`、先頭の `tbody` を一つのcontext objectとして返す。
- 必要なcontextを解決できない場合は `null` を返す。

ここをiframe / non-iframeの明示的な境界とする。呼び出し側はエディターcanvas内の処理で親 `window` へ戻らず、返されたowning document/windowを利用する。

### `sortable-runtime.ts`

担当:

- すでに `window.Sortable` が存在する場合は再利用する。
- runtime scriptが読み込み途中ですでに存在する場合はそれを再利用する。
- 必要な場合のみ、設定済みSortableJS runtime scriptを解決済みeditor documentへ挿入する。
- 読み込み成功時はruntime、失敗時は `null` を返す。

Gutenberg block attributeやReact stateは扱わない。

### `drag-ui.ts`

初期担当:

- 挿入線の生成、表示、非表示、削除。
- hoverハンドルの追加、削除、変更した先頭セルstyleの復元。
- ハンドル表示状態の切り替え。
- タッチ時のセル編集抑止と復元。
- 必要なtouch chosen styleの追加・削除。
- fallback drag時のセル幅固定と復元。
- その他、drag中の表示・操作補助だけを目的とする短命なDOM装飾helper。

最初からさらに分割しない。将来 `drag-ui.ts` 自体に独立して変更される複数責務が蓄積した場合のみ、`hover-handles.ts`、`insertion-line.ts`、`touch-ui.ts` などへの追加分割を検討する。

### `sortable-controller.ts`

担当:

- SortableJS instanceの生成・破棄。
- drag開始、移動、終了、unchooseの制御。
- React描画を必要としないdrag sessionのmutable stateを所有する。
- 行dragがpointerを所有している間、Gutenbergブロックdragを抑止し、終了後に復元する。
- hoverハンドルのactivate/deactivateを制御する。
- タッチpress追跡と長押し警告を制御する。
- `rowspan` による禁止挿入位置を拒否する。
- drag開始時の元行DOM順序を取得する。
- 並び替え済み `body` を確定する前に元のDOM順序を復元する。
- Gutenberg APIを直接importせず、狭い `onCommit(reorderedBody)` callbackを呼ぶ。
- controllerが追加した全listener、DOM装飾、timeout、一時styleをcleanupする。

controllerをSortableJS周辺の命令的な統合境界とする。React層には単一のcleanup / destroy入口を返す。

### `constants.ts` と `types.ts`

これらは任意であり、必須の雛形ではない。

抽出後、複数の実在モジュールで共有されるmode非依存constantが残る場合のみ `constants.ts` を作る。一つのモジュールだけが使うconstantは、その所有モジュール内に残す。

複数の抽出モジュールが同じ機能固有型へ本当に依存し、自然な所有者からexportすると循環依存や所有関係の不明瞭さが生じる場合のみ `types.ts` を作る。

## DOM所有権の不変条件

現在のDOM所有権handoffは互換性要件であり、リファクタリング中も常に明示して維持する。

```text
Gutenbergが正規の <tbody><tr> DOMを描画
        ↓
SortableJSがdrag中だけ一時的に <tr> nodeを移動
        ↓
onEndでold/new位置を取得
        ↓
元の <tr> DOM順序を復元
        ↓
setAttributes() で並び替え済みbodyを確定
        ↓
Gutenbergが新しい正規DOM順序を描画
```

抽出後のcontrollerが、SortableJSによって変更されたDOMを永続的なsource of truthとして扱わないこと。

## 実装フェーズ

### フェーズ0: Jestの基準と最初のテスト境界を作る

成果:

- 大きなライフサイクル分割に入る前に、決定的な挙動がfocused unit testで保護されている。

作業:

- `rowspan.ts` の隣に `rowspan.test.ts` を追加する。
- rowspanなし、number/stringのrowspan、不正値、末尾超過のclamp、重複range、移動不可行、禁止挿入indexをテストする。
- focused testに必要な決定的な行並び替えhelperだけを `with-table-reorder.tsx` から `row-order.ts` へ抽出する。
- 同じ変更で `row-order.test.ts` を追加する。
- 上方向移動、下方向移動、同一index、不正index、immutability、move時の挿入index、end時の挿入indexをテストする。
- この抽出は意図的に小さく保ち、ReactライフサイクルやSortableJS初期化にはまだ触れない。

検証:

- `npm test`
- `npm run build`
- `git diff --check origin/main...HEAD`

### フェーズ1: エディターTable context解決を分離する

成果:

- iframe / non-iframe探索に一つの明示的な所有者ができる。

作業:

- `table-context.ts` を追加する。
- `findBlockElement` と関連するdocument/window/table/tbody解決をこのモジュールへ移す。
- 返されたcontextを、後続フェーズのeditor canvas DOM所有元として利用する。
- 安定した価値がある範囲でfocused jsdom testを追加し、特にdirect document、iframe fallback、未解決contextを確認する。

検証:

- 実装中はfocused Jest testを利用する。
- handoff前に `npm test`、`npm run build`、repository diff checkを実行する。

### フェーズ2: SortableJS runtime読み込みを分離する

成果:

- runtime読み込みがReactやGutenberg attribute更新から独立する。

作業:

- `sortable-runtime.ts` を追加する。
- script IDとruntime読み込み処理をHOCから移す。
- 既存runtime、既存script、load、errorの現在の挙動を維持する。
- iframeを含め、runtimeを対象editor `window` に紐づける。
- async script挙動をbrowserそのものの過剰mockなしでテストできる範囲だけfocused testを追加する。

検証:

- `npm test`
- `npm run build`
- repository diff check。

### フェーズ3: drag専用DOM UI helperを分離する

成果:

- 一時的なDOM装飾と復元処理がSortableJSライフサイクルコードを覆い隠さなくなる。

作業:

- `drag-ui.ts` を追加する。
- 挿入線helperを移す。
- hoverハンドルの生成・表示・復元処理を移す。
- タッチ時の編集抑止 / chosen styleを移す。
- fallback cell width固定・復元を移す。
- 各helperの生成とcleanupを対にし、復元経路を明確にする。
- 変更したinline styleが復元されること、移動不可行にhandleを作らないことなど、価値の高いDOM不変条件をJestで確認する。

検証:

- `npm test`
- `npm run build`
- repository diff check。

### フェーズ4: SortableJS controllerを分離する

成果:

- SortableJSの命令的な処理に一つのライフサイクル所有者ができ、React層がdrag callbackを直接実装しなくなる。

作業:

- `sortable-controller.ts` を追加する。
- SortableJS optionsとcallbacksをcontrollerへ移す。
- drag rows、active handle、drag suppression、touch press、timeout、cleanupなどのmutable stateをcontrollerへ移す。
- 解決済みcontextと算出済み制約を入力として受け取る。
- commitとユーザー通知は狭いcallbackとして受け取る。
- 有効なcommitの前に、必ずDOM所有権の不変条件を維持する。
- `destroy()` がruntime読み込み途中でも安全に動作し、遅れて完了したruntime読み込みが古いSortableJS instanceを生成しないことを保証する。

検証:

- `npm test`
- `npm run build`
- このフェーズではライフサイクル所有者が大きく変わるため、手動smoke checkを推奨する。
- repository diff check。

### フェーズ5: Reactライフサイクルhookを導入する

成果:

- React state/effectに明示的な所有者ができ、HOCが薄くなる。

作業:

- `use-table-reorder.ts` を追加する。
- hover capability判定とmedia queryライフサイクルを移す。
- タッチ並び替えモードstateと選択解除時のresetを移す。
- 抽出済みモジュールを使ってruntime URLとTable contextを解決する。
- effectからSortableJS controllerを生成・破棄する。
- WordPress notice APIとattribute APIはこのadapter境界に残す。
- `with-table-reorder.tsx` が必要とする値とcallbackだけを返す。

検証:

- `npm test`
- `npm run build`
- repository diff check。

### フェーズ6: HOCを薄くし、ソース所有関係を確定する

成果:

- `with-table-reorder.tsx` が主にGutenbergのcomposition / rendering境界になる。

作業:

- 抽出済みモジュールへ移ったimplementation helperと命令的ライフサイクル処理を削除する。
- `BlockEdit`、toolbar描画、hidden anchor、hook接続が一読で把握できる状態にする。
- constants/typesを見直し、現在のcross-module利用が本当に必要な場合だけ機能内共有ファイルを作る。
- 抽出によって不要になったlocal typeや重複helperを削除する。
- `src/editor-extensions/table-reorder/README.md` を、最終的なファイル構成と責務境界に合わせて更新する。

検証:

- `npm test`
- `npm run build`
- `git diff --check origin/main...HEAD`
- 後述の最終手動確認。

## 実装前の決定事項と実装中の確認事項

### 実装前に固定する事項

- 別のbugが見つかり個別に追跡する場合を除き、現在のSortableJS挙動とtimingは変更しない。
- 新しいモジュールはすべて `src/editor-extensions/table-reorder/` 内に置く。
- `rowspan.ts` は既存の制約所有者として残し、controllerへ統合しない。
- 全面rewriteではなく段階的な抽出で進める。
- Jestによるcharacterization coverageを最初の実装フェーズにする。
- 本リファクタリング開始前に新しいPlaywrightテストを必須としない。
- 実際のcross-module所有が必要になるまで `constants.ts` / `types.ts` は作らない。

### 実装中に確認する事項

- controller抽出後の利用関係を見たとき、`restoreOriginalRowOrder` の所有先が `row-order.ts` と `drag-ui.ts` のどちらが明確か。
- タッチpointer追跡をすべて `sortable-controller.ts` に置くべきか、ファイル規模と独立した変更圧力によってtouch専用モジュールが必要になるか。
- `drag-ui.ts` が抽出後も一つの責務としてまとまっているか、後から一段だけ分割する価値があるか。
- runtime/controller抽出後も、既存のlocal `sortablejs.d.ts` が最も明確な型定義元か。
- 責務分離後、現在の `useEffect` dependencyによって不要なcontroller再生成が起きていないか。

これらは実装を進めながら確認する事項であり、先に機能を再設計する理由にはしない。

## Issue分割案

本プランのレビューが完了し、責務境界が安定した後に実装Issueを作成する。

実装単位の候補:

- [ ] Jest基準整備 + `row-order.ts` 抽出。
- [ ] `table-context.ts` + `sortable-runtime.ts` 抽出。
- [ ] `drag-ui.ts` 抽出。
- [ ] `sortable-controller.ts` 抽出。
- [ ] `use-table-reorder.ts` + HOC薄型化 + README最終更新。

最初の2単位はレビュー量に応じて結合・分割してよい。この一覧に合わせること自体を目的として細かく分けず、少ないPRの方がまとまりよくレビューできる場合はそちらを優先する。

## 検証

### 自動検証

実装変更では次を実行する。

```bash
npm test
npm run build
git diff --check origin/main...HEAD
```

実装中はfocused Jest commandを利用してよいが、handoff前にはNode.js全体のquality gateとproduction buildを実行する。

本プランだけを変更するdocumentation PRでは、repositoryのtesting guide上、repository diff / whitespace checkだけが必要となる。GitHub connector経由で作業しlocal checkoutがない場合は、GitHub上でPR diffを確認し、localの `git diff --check` は実行できなかったと明記する。実行していないcommandを成功扱いしない。

### 実装完了後の手動エディター確認

現在の挙動を両方のエディターモードで確認する。

```text
PC / hover可能端末
├─ iframe
└─ non-iframe

タッチ / 長押し並び替えモード
├─ iframe
└─ non-iframe
```

各対象モードで次を確認する。

- 通常Table行を上方向へ移動できる。
- 通常Table行を下方向へ移動できる。
- hover可能端末では、移動可能行にのみhoverハンドルが表示される。
- タッチ並び替えモードでは長押しdragが有効になり、短いtapでは従来どおりモードを終了する。
- `rowspan` に含まれる行をdragできない。
- 縦結合rangeを分断する挿入位置が拒否される。
- 移動不可の縦結合行を長押しした場合、警告通知が従来どおり表示される。
- 有効な移動先では挿入線が表示され、禁止位置・終了・cancel時には消える。
- SortableJSのanimationとauto-scrollが変わっていない。
- fallback drag中の行でセル幅が安定し、終了後に一時inline styleが復元される。
- 行drag終了・cancel・cleanup後にGutenbergブロックdragが復元される。
- 並び替え済みdataが `setAttributes({ body })` で確定され、その後のDOMはGutenbergが所有する。
- ブロック選択解除時にタッチ並び替えモードが従来どおり解除される。

## 完了条件

- focused Jest coverageで、決定的な行並び替えと `rowspan` ルールが保護されている。
- `with-table-reorder.tsx` が低レベルDOM helper実装やSortableJS callback本体を所有していない。
- iframe / non-iframe解決に一つの明示的なソース所有者がある。
- SortableJS runtime読み込みに一つの明示的なソース所有者がある。
- 一時的なdrag DOM装飾に、明確な生成・復元の所有関係がある。
- SortableJSライフサイクルとcleanupに一つの命令的controller所有者がある。
- React/Gutenberg統合層がcontroller周辺の薄いadapterになっている。
- ユーザーから見える挙動を意図的に変更していない。
- 新しい汎用shared architectureやdependencyを導入していない。
- 自動検証が成功する。
- iframe / non-iframe、hover / touchの手動確認が成功する。
- 機能READMEが最終コード構成と一致している。

## 補足

- 現在の機能READMEに記載されているGutenbergとSortableJS間のDOM所有権handoffは、各フェーズで維持すべき主要な不変条件として扱う。
- 過去の `table-reorder-controller-refactor-plan.md` は、別のdnd-kitアーキテクチャを対象としている。新しいSortableJS実装を説明するために過去文書を書き換えず、今後の責務分割では本プランを後継プランとして扱う。
- 責務抽出中に挙動bugが見つかった場合、refactorをbuildable/testableに保つために修正必須でない限り別Issueとして記録する。構造変更PRへproduct behavior変更を混在させない。
