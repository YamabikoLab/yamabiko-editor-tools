const isWithin = ( value: number, start: number, end: number ) => value >= start && value <= end;

const getEditableAtPointer = ( event: PointerEvent, blockElement: HTMLElement ) => {
	const { defaultView } = blockElement.ownerDocument;
	if ( ! defaultView || ! ( event.target instanceof defaultView.Element ) ) {
		return null;
	}

	const figure = event.target.closest( 'figure.wp-block-table' );
	if ( event.target !== figure || ! figure || ! blockElement.contains( figure ) ) {
		return null;
	}

	const table = figure.querySelector( 'table' );
	const cell = Array.from( table?.querySelectorAll< HTMLTableCellElement >( 'td, th' ) ?? [] ).find(
		( candidate ) => {
			const rect = candidate.getBoundingClientRect();
			return (
				isWithin( event.clientX, rect.left, rect.right ) &&
				isWithin( event.clientY, rect.top, rect.bottom )
			);
		}
	);

	return cell?.querySelector< HTMLElement >( ':scope > [contenteditable="true"]' ) ?? null;
};

export const focusTableCellFromPaddingClick = (
	event: PointerEvent,
	blockElement: HTMLElement
): boolean => {
	if ( event.button !== 0 ) {
		return false;
	}

	const editable = getEditableAtPointer( event, blockElement );
	if ( ! editable ) {
		return false;
	}

	event.preventDefault();
	event.stopPropagation();
	editable.focus( { preventScroll: true } );
	return true;
};
