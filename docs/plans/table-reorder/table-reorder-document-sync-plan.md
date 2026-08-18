# PLAN-338: Table Reorder 要件・基本設計同期

## References

- Parent issue: #338
- Basic requirements: `docs/requirements/table-reorder/table-reorder-sortablejs-requirements.md`
- Accessibility requirements: `docs/requirements/table-reorder/table-reorder-sortablejs-accessibility-requirements.md`
- Accessibility design: `docs/design/table-reorder/table-reorder-sortablejs-accessibility-design.md`
- Current implementation overview: `src/editor-extensions/table-reorder/README.md`
- Supported blocks: `src/editor-extensions/table-reorder/block-support.ts`
- Interaction state: `src/editor-extensions/table-reorder/use-table-reorder-interaction.ts`
- Gutenberg integration: `src/editor-extensions/table-reorder/with-table-reorder.tsx`
- Controller: `src/editor-extensions/table-reorder/controller/sortable-controller.ts`
- User-facing messages: `src/editor-extensions/table-reorder/messages.ts`

## Goal

現在の `main` に実装済みの Table Reorder の振る舞いを基準に、要件定義書と基本設計書の役割・内容を整理し、後続Issueで文書を安全に更新できる状態にする。

このIssueでは文書そのものは更新せず、現行実装との差分、更新対象、更新順序、文書間の責務境界を計画として確定する。

## Scope

### Included

- 現在の `main` と次の文書との差分整理。
  - `table-reorder-sortablejs-requirements.md`
  - `table-reorder-sortablejs-accessibility-requirements.md`
  - `table-reorder-sortablejs-accessibility-design.md`
- 現行実装に合わせた通常操作側の基本設計書を新設する必要性と責務の整理。
- 対応block、PC / touch / keyboard / single-pointer操作、rowspan制約、Undo、フォーカス、案内・通知、iframe / non-iframe対応について、どの文書を正本にするかの整理。
- 文書更新を後続Issueへ分割できる実装順序の整理。

### Not included

- 要件定義書・基本設計書そのものの更新。
- TypeScript / TSX / SCSS / PHP等の製品コード変更。
- Jest / Playwrightテストの追加・変更。
- 現行実装の仕様変更。
- 過去文書や `archive/` 配下の更新。
- README、リリース文書、一般利用者向けドキュメントの全面見直し。

## Current state and gaps

### 1. Supported blocks

現行実装は `core/table` に加えて `flexible-table-block/table` を正式な対応blockとして扱い、block固有差分は `block-support.ts` の薄いsupport境界へ集約している。

一方、現在の基本要件・アクセシビリティ要件・アクセシビリティ基本設計には「コア Tableブロック」を対象とする記述が残っている。

更新時は、Table Reorder共通要件を対応block共通の契約として記述し、block固有差分は実装詳細として必要以上に要件へ持ち込まない。

### 2. 通常操作の基本設計

現在はアクセシビリティ基本設計書が、PC hover、touch reorder mode、single-pointer操作、共通行ハンドルなど通常操作側の詳細も広く保持している。

しかし、基本要件には通常のPC / touch操作が定義されており、その実現方法を受け持つ通常操作側の基本設計書が存在しない。

そのため、後続更新では通常操作の基本設計書を新設し、次をアクセシビリティ基本設計から分離する。

- PC hoverでの行ハンドル表示とDnD開始境界。
- touch reorder modeと共通行ハンドル。
- PC / touchのsingle-pointer移動先選択。
- SortableJS drag中の挿入表示、auto-scroll、DOM ownership handoff。
- rowspan制約を各入力方式で共用する構造。

アクセシビリティ基本設計は、キーボード到達性、フォーカス、支援技術向け情報提供、Target Size、Focus Not Obscured、操作案内など、アクセシビリティ要件を実現する設計へ責務を絞る。

### 3. PC keyboard entry and coachmark

現行実装では、PCキーボード利用時に初回コーチマークを表示し、Block Toolbarの `Reorder rows` を行controlへの明示的な入口としている。

コーチマークのdismiss状態は WordPress preferences に保存され、表示済みのコーチマークから行controlへキーボードフォーカスした場合などに永続dismissされる。

この基本方針はアクセシビリティ基本設計に存在するが、実装後の細かな状態管理と文書表現を照合し、利用者向け仕様と実装内部のstateを混同しない形へ整理する必要がある。

### 4. User-facing messages

アクセシビリティ基本設計8章には、実装前に確定した比較的長い画面表示文言が正本文言として残っている。

現行 `messages.ts` では、その後のUI改善により画面表示向け文言が短文化されている。一方、accessible name、description、支援技術向けannouncementは別の文言として維持されている。

後続更新では、現在の実装済み文言を基準に設計書を同期し、次の区分を維持する。

- 画面表示メッセージ。
- 操作UIのaccessible name / description。
- 支援技術向け動的announcement。

文言を要件定義書へ重複して持ち込まず、具体文言の正本は基本設計側に置く。

### 5. Keyboard / pointer / drag common behavior

現行controllerは、keyboard、single-pointer、SortableJS DnDの確定処理を共通の行移動境界へ接続している。

- 有効な移動だけcommitする。
- 同位置や無効な移動はcommitしない。
- rowspan範囲内の行は移動対象にしない。
- rowspan範囲の途中を移動先にしない。
- 結合範囲外の行は結合範囲全体を越えて移動できる。
- keyboard確定やsingle-pointer確定では移動後の行controlへfocusを復元する。

文書更新時は、移動可否・commit・Undo等の共通契約を基本要件に置き、入力方式固有の操作フローやfocus設計を基本設計へ置く。

### 6. iframe / non-iframe

現行実装は対象Tableの `ownerDocument` / `defaultView` を基準にDOM、イベント、SortableJS runtimeを扱い、iframe / non-iframeで同じ操作契約を提供している。

この要件自体は既存文書にも存在するため、更新時は新しい仕様として増やすのではなく、現行構造と矛盾しないことを確認して表現を揃える。

## Document responsibility after update

### Basic requirements

`table-reorder-sortablejs-requirements.md` は、入力方式やblock種類に依存しない利用者向けの基本契約と、PC / touchの通常操作要件を定義する。

主な責務:

- 対応blockの範囲。
- `tbody`本文行の並べ替え。
- データ保持、commit条件、Undo。
- rowspan / colspan制約。
- PC hover + handle DnD。
- touch reorder mode + handle DnD / tap destination selection。
- iframe / non-iframeで同じ基本契約を満たすこと。

具体的なDOM、controller、SortableJS options、CSS、focus実装は記述しない。

### Accessibility requirements

`table-reorder-sortablejs-accessibility-requirements.md` は、基本要件を前提にアクセシビリティ上追加で満たす必要がある性質を定義する。

主な責務:

- keyboardだけで完結できること。
- drag不要のsingle-pointer操作。
- logical focus order。
- visible focus / Focus Not Obscured。
- Target Size。
- 操作案内。
- 名前・役割・状態・結果・移動不能理由を支援技術から確認できること。

通常のPC / touch操作やrowspanの基本契約を重複定義しない。

### Normal interaction design

新設する通常操作側の基本設計書は、基本要件を現在の利用者向けUIと操作フローでどう実現するかを定義する。

主な責務:

- 対応blockと共通行ハンドルの構成。
- PC hover / pointer DnD。
- touch reorder mode。
- PC / touch single-pointer destination selection。
- drag中のdestination表示とscroll追従。
- SortableJSとGutenbergのDOM ownership handoff。
- 共通の移動可否とcommit境界。
- iframe / non-iframeで同じ意味の操作を維持する設計。

アクセシビリティ固有のfocus規則、WCAG達成基準、announcement詳細はアクセシビリティ基本設計へ委ねる。

### Accessibility design

`table-reorder-sortablejs-accessibility-design.md` は、アクセシビリティ要件を実現する設計へ責務を絞る。

主な責務:

- Toolbarからrow controlへのkeyboard entry。
- row controlのkeyboard操作。
- keyboard reorder中のfocus保持・復元。
- single-pointer操作時に必要なfocus設計。
- Target Size / Focus Not Obscured。
- 初回coachmark。
- visible guidance。
- accessible name / description。
- live announcement。

通常操作側の設計を参照し、その内容を重複して再定義しない。

## Implementation phases

### Phase 1: 現行 `main` との差分を確定する

- Outcome:
  - 後続文書更新で何を変更し、何を維持するかが明確になる。
- Tasks:
  - 基本要件、アクセシビリティ要件、アクセシビリティ基本設計を現行実装と照合する。
  - 対応block、操作方法、rowspan制約、focus、coachmark、visible guidance、announcementの差分を更新候補として確定する。
  - 実装内部だけの詳細は文書更新対象から除外する。
- Validation:
  - 差分項目ごとに根拠となる現行実装または現行文書を特定できる。
  - 未実装の将来仕様を更新内容へ混入させていない。

### Phase 2: 基本要件とアクセシビリティ要件を同期する

- Outcome:
  - 「何を満たすか」が現在の製品仕様と一致する。
- Tasks:
  - Core Table限定の表現を現在の対応block範囲へ更新する。
  - PC / touchの現行操作とrowspan制約を基本要件へ反映する。
  - アクセシビリティ要件側は基本要件との重複を除き、追加要件だけに保つ。
  - 実装方法や具体文言を要件へ持ち込まない。
- Validation:
  - 要件間で同じ仕様を異なる表現で二重管理していない。
  - 現行実装と矛盾する要件が残っていない。

### Phase 3: 通常操作の基本設計書を新設する

- Outcome:
  - 基本要件の実現方法を、アクセシビリティ基本設計に依存せず説明できる。
- Tasks:
  - PC hover / DnD、touch reorder mode、single-pointer操作の設計を整理する。
  - 共通row handle、移動可否、commit、DOM ownership、scroll追従、iframe / non-iframeの設計を整理する。
  - 実装ファイル一覧の写経ではなく、利用者向け振る舞いと主要な責務境界に留める。
- Validation:
  - 基本要件の各通常操作要件が基本設計上どのように実現されるか追跡できる。
  - TypeScriptの内部関数や一時stateを仕様として固定していない。

### Phase 4: アクセシビリティ基本設計を責務整理・同期する

- Outcome:
  - アクセシビリティ基本設計が現在の実装と一致し、通常操作設計との重複が減る。
- Tasks:
  - 通常操作側へ移した内容を参照へ置き換える。
  - keyboard entry、focus、coachmark、Target Size、Focus Not Obscured、支援技術向け情報提供を現在の実装へ同期する。
  - 画面表示向けメッセージを現在の短文化済み文言へ同期する。
  - accessible name / description / announcementとvisible guidanceの責務分離を維持する。
- Validation:
  - 現行 `messages.ts` と文言・役割が矛盾しない。
  - 通常操作設計とアクセシビリティ設計が同じ操作フローを別々の正本として保持していない。

### Phase 5: 文書間リンクと完了条件を整える

- Outcome:
  - 更新後の正本関係が明確になり、次回以降の仕様変更で追従先を判断できる。
- Tasks:
  - 各文書のReferences / 関連節を相互に整理する。
  - 「基本要件 → 通常基本設計」「アクセシビリティ要件 → アクセシビリティ基本設計」の追跡関係を明記する。
  - 完了条件が現行仕様を過不足なく表すよう整理する。
- Validation:
  - 文書を跨いで循環参照や責務の二重定義がない。
  - 後続の仕様変更時に、更新すべき文書を判断できる。

## Decisions and validation questions

### Decide before implementation

次を後続文書更新の前提とする。

- 現行 `main` の利用者向け振る舞いを文書同期の基準とし、今回の文書整理を理由に製品仕様を変更しない。
- 通常操作の基本設計書を新設する。
- アクセシビリティ基本設計から通常操作の詳細を分離する。
- 基本要件とアクセシビリティ要件は「何を満たすか」、基本設計は「どのような利用者向け設計で満たすか」を担当する。
- 実装内部のファイル構成や関数名は、仕様上必要な責務境界を説明する場合だけ参照する。
- archive文書は更新しない。

### Validate during implementation

- Flexible Table Block対応を各文書でどの粒度まで明記すれば、block固有実装詳細を漏らさず利用者向け仕様を説明できるか。
- visible guidanceの具体文言をアクセシビリティ基本設計の正本として維持する際、一般の通常操作設計からどこまで参照すれば重複を最小化できるか。
- single-pointer操作は基本要件上の通常操作とアクセシビリティ要件上のDragging Movements代替手段の両方に関係するため、要件の重複ではなく追跡関係としてどう表現するのが最小か。

## Issue breakdown

プランレビュー後、文書更新は次の単位を基本とする。

- [ ] 基本要件・アクセシビリティ要件を現行仕様へ同期する。
- [ ] 通常操作の基本設計書を新設する。
- [ ] アクセシビリティ基本設計を責務整理し、現行仕様へ同期する。

文書間リンクや軽微な表現調整は、上記の各更新Issue内で必要な範囲を扱う。独立した判断が必要な規模へ広がった場合だけ別Issueへ分ける。

## Validation

後続の文書更新はドキュメントのみを想定するため、`docs/development/testing.md` に従い次を確認する。

- `git diff --check origin/main...HEAD`
  - Expected: whitespace errorがない。
- 現行実装との内容照合。
  - Expected: 対応block、PC / touch / keyboard / single-pointer操作、rowspan制約、focus、案内・通知、iframe / non-iframeの記述が現在の `main` と矛盾しない。
- 文書間責務の照合。
  - Expected: 要件と基本設計、通常操作とアクセシビリティで不要な二重定義がない。

アプリケーションコードを変更しないため、`npm test` / `npm run build` / Playwright E2Eは文書同期そのものの必須検証にはしない。

## Completion criteria

- 現在の `main` と対象3文書の主要な差分が整理されている。
- 基本要件、アクセシビリティ要件、通常基本設計、アクセシビリティ基本設計の責務境界が定義されている。
- 通常操作の基本設計書を新設する方針が定義されている。
- Flexible Table Block対応を含む現在の対応block範囲が更新対象として整理されている。
- PC / touch / keyboard / single-pointer操作の現在の仕様が更新対象として整理されている。
- rowspan制約、Undo、focus、coachmark、visible guidance、announcement、iframe / non-iframeの更新方針が整理されている。
- 文書更新を後続Issueへ分割できる順序と単位が整理されている。
- 製品コード変更や未実装仕様をこのIssueへ含めていない。

## Notes

- `src/editor-extensions/table-reorder/README.md` には一部古いファイル名の記載が残るが、#338の主対象である要件・基本設計同期とは分けて扱う。今回のプランでは全面的なREADME更新へ範囲を広げない。
- 文書更新時は、過去Issueや旧プランの記載よりも現在の `main` の実装と現行文書の責務を優先して照合する。
