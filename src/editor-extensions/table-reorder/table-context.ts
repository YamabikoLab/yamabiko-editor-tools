/**
 * Table Reorderが利用する editor DOM contextを解決する。
 *
 * anchorのowning documentをrootとして優先し、対象blockがrootに存在しない場合だけ
 * `iframe[name="editor-canvas"]`へfallbackする。ここではDOM / document / window / tableの
 * 対応関係だけを扱い、SortableJS runtimeやinstance lifecycleは扱わない。
 */

/**
 * 解決済みTable blockが利用するDOM context。
 *
 * `blockElement`、`table`、`tbody`はすべて`document`に属し、`window`はその
 * `document.defaultView`であることを保証する。
 */
export type TableContext = {
	blockElement: HTMLElement;
	document: Document;
	window: Window;
	table: HTMLTableElement;
	tbody: HTMLTableSectionElement;
};

/**
 * clientIdに対応するTable block elementをroot documentから解決する。
 *
 * root documentに対象blockがあれば必ずそれを採用し、存在しない場合だけeditor canvas
 * iframeを探索する。Issue #177で固定したiframe / non-iframeの優先順位を維持する。
 *
 * @param rootDocument 探索を開始するanchorのowning document。
 * @param clientId 解決対象となるGutenberg blockのclientId。
 */
export const findBlockElement = (
	rootDocument: Document,
	clientId: string
): HTMLElement | null => {
	const selector = `[data-block="${ clientId }"]`;
	const directBlock = rootDocument.querySelector< HTMLElement >( selector );
	if ( directBlock ) {
		return directBlock;
	}

	const iframe = rootDocument.querySelector< HTMLIFrameElement >( 'iframe[name="editor-canvas"]' );
	return iframe?.contentDocument?.querySelector< HTMLElement >( selector ) ?? null;
};

/**
 * anchorのowning documentを起点に、Table Reorderが必要とするDOM contextを解決する。
 *
 * block、owning window、table、先頭tbodyのいずれかを解決できない場合は`null`を返す。
 *
 * @param anchor Table blockの探索起点となるDOM element。
 * @param clientId 解決対象となるGutenberg blockのclientId。
 */
export const resolveTableContext = ( anchor: Element, clientId: string ): TableContext | null => {
	const blockElement = findBlockElement( anchor.ownerDocument, clientId );
	if ( ! blockElement ) {
		return null;
	}

	const document = blockElement.ownerDocument;
	const view = document.defaultView;
	const table = blockElement.querySelector< HTMLTableElement >( 'table' );
	const tbody = table?.tBodies.item( 0 ) ?? null;
	if ( ! view || ! table || ! tbody ) {
		return null;
	}

	return {
		blockElement,
		document,
		window: view,
		table,
		tbody,
	};
};
