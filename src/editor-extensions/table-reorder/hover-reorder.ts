const HOVER_REORDER_MEDIA_QUERY = '(hover: hover) and (pointer: fine)';

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
	let animationFrame = 0;

	const canUseHover = () => hoverMedia.matches;
	const deactivateAfterPointerUp = () => {
		if ( animationFrame ) {
			view.cancelAnimationFrame( animationFrame );
		}

		animationFrame = view.requestAnimationFrame( () => {
			animationFrame = 0;
			if ( ! blockElement.matches( ':hover' ) ) {
				onActiveChange( false );
			}
		} );
	};
	const onPointerEnter = ( event: PointerEvent ) => {
		if ( canUseHover() && isMousePointer( event ) ) {
			onActiveChange( true );
		}
	};
	const onPointerLeave = ( event: PointerEvent ) => {
		if ( isMousePointer( event ) && event.buttons === 0 ) {
			onActiveChange( false );
		}
	};
	const onPointerUp = ( event: PointerEvent ) => {
		if ( isMousePointer( event ) ) {
			deactivateAfterPointerUp();
		}
	};
	const onPointerCancel = ( event: PointerEvent ) => {
		if ( isMousePointer( event ) ) {
			onActiveChange( false );
		}
	};
	const onHoverCapabilityChange = () => {
		if ( ! canUseHover() ) {
			onActiveChange( false );
		}
	};

	table.addEventListener( 'pointerenter', onPointerEnter );
	blockElement.addEventListener( 'pointerleave', onPointerLeave );
	document.addEventListener( 'pointerup', onPointerUp, true );
	document.addEventListener( 'pointercancel', onPointerCancel, true );
	hoverMedia.addEventListener( 'change', onHoverCapabilityChange );

	return () => {
		if ( animationFrame ) {
			view.cancelAnimationFrame( animationFrame );
		}
		table.removeEventListener( 'pointerenter', onPointerEnter );
		blockElement.removeEventListener( 'pointerleave', onPointerLeave );
		document.removeEventListener( 'pointerup', onPointerUp, true );
		document.removeEventListener( 'pointercancel', onPointerCancel, true );
		hoverMedia.removeEventListener( 'change', onHoverCapabilityChange );
	};
};
