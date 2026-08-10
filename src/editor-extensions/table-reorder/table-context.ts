/**
 * Table Reorder が利用する editor DOM context を解決する。
 *
 * anchor の owning document を root として優先し、対象 block が root に存在しない場合だけ
 * `iframe[name="editor-canvas"]` へ fallback する。ここでは DOM / document / window / table の
 * 対応関係だけを扱い、SortableJS runtime や instance lifecycle は扱わない。
 */

/**
 * 解決済み Table block が利用する DOM context。
 *
 * `blockElement`、`table`、`tbody` はすべて `document` に属し、`window` はその
 * `document.defaultView` であることを保証する。
 */
export type TableContext = {
	blockElement: HTMLElement;
	document: Document;
	window: Window;
	table: HTMLTableElement;
	tbody: HTMLTableSectionElement;
};

/**
 * clientId に対応する Table block element を root document から解決する。
 *
 * root document に対象 block があれば必ずそれを採用し、存在しない場合だけ editor canvas
 * iframe を探索する。Issue #177 で固定した iframe / non-iframe の優先順位を維持する。
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
 * anchor の owning document を起点に、Table Reorder が必要とする DOM context を解決する。
 *
 * block、owning window、table、先頭 tbody のいずれかを解決できない場合は `null` を返す。
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
