export const fullWidthReorderClass = 'yamabiko-editor-tools-table-reorder--full-width';

export const enableFullWidthTableReorder = (
	blockElement: HTMLElement,
	table: HTMLTableElement | null
) => {
	const isFullWidth =
		blockElement.matches( '.alignfull, [data-align="full"]' ) ||
		table?.closest( '.alignfull, [data-align="full"]' );

	if ( ! isFullWidth ) {
		return () => {};
	}

	blockElement.classList.add( fullWidthReorderClass );
	return () => blockElement.classList.remove( fullWidthReorderClass );
};
