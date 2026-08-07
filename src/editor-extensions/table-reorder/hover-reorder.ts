const HOVER_REORDER_MEDIA_QUERY = '(hover: hover) and (pointer: fine)';
const HANDLE_SELECTOR = '.yamabiko-editor-tools-table-reorder-content__handle';

const isMousePointer = ( event: PointerEvent ) => event.pointerType === 'mouse';

export const enableTableHoverReorder = (
	blockElement: HTMLElement,
	table: HTMLTableElement | null,
	onActiveChange: ( isActive: boolean ) => void
) => {
	const document = blockElement.ownerDocument;
	const view = document.defaultView;
	if ( ! view || ! table || typeof view.matchMedia !== 'function' ) {
		return () => {};
	}

	const hoverMedia = view.matchMedia( HOVER_REORDER_MEDIA_QUERY );
	const instructionsId = `yamabiko-editor-tools-table-reorder-${ blockElement.dataset.block }-instructions`;
	let isActive = false;

	const canUseHover = () => hoverMedia.matches;
	const isWithinHoverRegion = ( target: EventTarget | null ) => {
		if ( ! ( target instanceof view.Element ) ) {
			return false;
		}
		if ( blockElement.contains( target ) ) {
			return true;
		}

		const handle = target.closest< HTMLButtonElement >( HANDLE_SELECTOR );
		return handle?.getAttribute( 'aria-describedby' ) === instructionsId;
	};
	const setActive = ( nextActive: boolean ) => {
		if ( isActive === nextActive ) {
			return;
		}

		isActive = nextActive;
		onActiveChange( nextActive );
	};
	const onPointerEnter = ( event: PointerEvent ) => {
		if ( canUseHover() && isMousePointer( event ) ) {
			setActive( true );
		}
	};
	const onPointerMove = ( event: PointerEvent ) => {
		if ( ! isActive || ! isMousePointer( event ) || event.buttons !== 0 ) {
			return;
		}
		if ( ! isWithinHoverRegion( event.target ) ) {
			setActive( false );
		}
	};
	const onPointerUp = ( event: PointerEvent ) => {
		if ( isActive && isMousePointer( event ) && ! isWithinHoverRegion( event.target ) ) {
			setActive( false );
		}
	};
	const onPointerCancel = ( event: PointerEvent ) => {
		if ( isMousePointer( event ) ) {
			setActive( false );
		}
	};
	const onHoverCapabilityChange = () => {
		if ( ! canUseHover() ) {
			setActive( false );
		}
	};

	table.addEventListener( 'pointerenter', onPointerEnter );
	document.addEventListener( 'pointermove', onPointerMove, true );
	document.addEventListener( 'pointerup', onPointerUp, true );
	document.addEventListener( 'pointercancel', onPointerCancel, true );
	hoverMedia.addEventListener( 'change', onHoverCapabilityChange );

	return () => {
		table.removeEventListener( 'pointerenter', onPointerEnter );
		document.removeEventListener( 'pointermove', onPointerMove, true );
		document.removeEventListener( 'pointerup', onPointerUp, true );
		document.removeEventListener( 'pointercancel', onPointerCancel, true );
		hoverMedia.removeEventListener( 'change', onHoverCapabilityChange );
	};
};
