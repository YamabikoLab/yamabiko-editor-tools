export const fullWidthReorderClass = 'yamabiko-editor-tools-table-reorder--full-width';

export const enableFullWidthTableReorder = (
	blockElement: HTMLElement,
	table: HTMLTableElement | null
) => {
	const fullWidthElement = table?.closest( '.alignfull, [data-align="full"]' );
	const isFullWidth =
		blockElement.matches( '.alignfull, [data-align="full"]' ) ||
		Boolean( fullWidthElement && blockElement.contains( fullWidthElement ) );

	if ( ! isFullWidth ) {
		return () => {};
	}

	blockElement.classList.add( fullWidthReorderClass );
	return () => blockElement.classList.remove( fullWidthReorderClass );
};
