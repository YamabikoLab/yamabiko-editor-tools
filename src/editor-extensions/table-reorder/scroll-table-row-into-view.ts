export function scrollTableRowIntoView( row: HTMLTableRowElement ) {
	const view = row.ownerDocument.defaultView;
	if ( ! view ) {
		return;
	}

	const scrollX = view.scrollX;
	const ancestorScrollLefts: Array< [ HTMLElement, number ] > = [];
	let ancestor = row.parentElement;
	while ( ancestor ) {
		ancestorScrollLefts.push( [ ancestor, ancestor.scrollLeft ] );
		ancestor = ancestor.parentElement;
	}

	row.scrollIntoView( {
		behavior: 'auto',
		block: 'nearest',
		inline: 'nearest',
	} );
	if ( view.scrollX !== scrollX ) {
		view.scrollTo( { behavior: 'auto', left: scrollX, top: view.scrollY } );
	}
	for ( const [ element, initialScrollLeft ] of ancestorScrollLefts ) {
		if ( element.scrollLeft !== initialScrollLeft ) {
			element.scrollLeft = initialScrollLeft;
		}
	}
}
