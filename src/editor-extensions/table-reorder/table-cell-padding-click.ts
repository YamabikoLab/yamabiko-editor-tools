const isWithin = ( value: number, start: number, end: number ) => value >= start && value <= end;

const isInteractiveTarget = ( target: EventTarget | null, defaultView: Window ) => {
	const ElementConstructor = ( defaultView as unknown as { Element: typeof Element } ).Element;
	if ( ! ElementConstructor || ! ( target instanceof ElementConstructor ) ) {
		return false;
	}

	return Boolean(
		target.closest(
			'a, button, input, select, textarea, option, summary, [contenteditable="true"], [role="button"], [role="link"]'
		)
	);
};

const getEditableAtPointer = ( event: PointerEvent, blockElement: HTMLElement ) => {
	const table = blockElement.querySelector( 'table' );
	if ( ! table ) {
		return null;
	}

	const tableRect = table.getBoundingClientRect();
	if (
		! isWithin( event.clientX, tableRect.left, tableRect.right ) ||
		! isWithin( event.clientY, tableRect.top, tableRect.bottom )
	) {
		return null;
	}

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
	const { defaultView } = blockElement.ownerDocument;
	if (
		event.button !== 0 ||
		event.defaultPrevented ||
		event.shiftKey ||
		event.ctrlKey ||
		event.metaKey ||
		event.altKey ||
		! defaultView ||
		isInteractiveTarget( event.target, defaultView )
	) {
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
