const HOVER_REORDER_MEDIA_QUERY = '(hover: hover) and (pointer: fine)';
const HANDLE_SELECTOR = '.yamabiko-editor-tools-table-reorder-content__handle';
const HOVER_HANDLE_CLASS = 'is-hover-reorder-handle';
const HOVER_HANDLE_VISIBLE_CLASS = 'is-hover-reorder-visible';
const HOVER_HANDLE_FADE_MS = 300;

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
	let fadeTimeout = 0;
	let showAnimationFrame = 0;
	let handleObserver: MutationObserver | null = null;

	const canUseHover = () => hoverMedia.matches;
	const isExplicitReorderMode = () => document.getElementById( instructionsId ) !== null;
	const getHandles = () =>
		Array.from( document.querySelectorAll< HTMLButtonElement >( HANDLE_SELECTOR ) ).filter(
			( handle ) => handle.getAttribute( 'aria-describedby' ) === instructionsId
		);
	const isWithinHoverRegion = ( target: EventTarget | null ) => {
		if ( ! ( target instanceof view.Element ) ) {
			return false;
		}
		if ( table.contains( target ) ) {
			return true;
		}

		const handle = target.closest< HTMLButtonElement >( HANDLE_SELECTOR );
		return handle?.getAttribute( 'aria-describedby' ) === instructionsId;
	};
	const cancelFadeTimeout = () => {
		if ( fadeTimeout ) {
			view.clearTimeout( fadeTimeout );
			fadeTimeout = 0;
		}
	};
	const stopObservingHandles = () => {
		handleObserver?.disconnect();
		handleObserver = null;
	};
	const showHoverHandles = () => {
		if ( ! isActive || isExplicitReorderMode() ) {
			return;
		}

		const handles = getHandles();
		if ( handles.length === 0 ) {
			return;
		}

		for ( const handle of handles ) {
			handle.classList.add( HOVER_HANDLE_CLASS );
		}
		if ( showAnimationFrame ) {
			view.cancelAnimationFrame( showAnimationFrame );
		}
		showAnimationFrame = view.requestAnimationFrame( () => {
			showAnimationFrame = 0;
			if ( ! isActive || isExplicitReorderMode() ) {
				return;
			}
			for ( const handle of getHandles() ) {
				handle.classList.add( HOVER_HANDLE_CLASS, HOVER_HANDLE_VISIBLE_CLASS );
			}
		} );
	};
	const hideHoverHandles = () => {
		for ( const handle of getHandles() ) {
			handle.classList.remove( HOVER_HANDLE_VISIBLE_CLASS );
		}
	};
	const releaseHoverHandles = () => {
		for ( const handle of getHandles() ) {
			handle.classList.remove( HOVER_HANDLE_CLASS, HOVER_HANDLE_VISIBLE_CLASS );
		}
	};
	const startObservingHandles = () => {
		if ( handleObserver ) {
			return;
		}

		handleObserver = new view.MutationObserver( showHoverHandles );
		handleObserver.observe( document.body, { childList: true, subtree: true } );
	};
	const releaseToExplicitMode = () => {
		cancelFadeTimeout();
		stopObservingHandles();
		releaseHoverHandles();
		if ( isActive ) {
			isActive = false;
			onActiveChange( false );
		}
	};
	const activate = () => {
		if ( isExplicitReorderMode() ) {
			releaseToExplicitMode();
			return;
		}

		cancelFadeTimeout();
		if ( ! isActive ) {
			isActive = true;
			onActiveChange( true );
			startObservingHandles();
		}
		showHoverHandles();
	};
	const deactivate = () => {
		if ( ! isActive || fadeTimeout ) {
			return;
		}
		if ( isExplicitReorderMode() ) {
			releaseToExplicitMode();
			return;
		}

		hideHoverHandles();
		fadeTimeout = view.setTimeout( () => {
			fadeTimeout = 0;
			if ( isExplicitReorderMode() ) {
				releaseToExplicitMode();
				return;
			}

			isActive = false;
			stopObservingHandles();
			onActiveChange( false );
		}, HOVER_HANDLE_FADE_MS );
	};
	const onPointerEnter = ( event: PointerEvent ) => {
		if ( canUseHover() && isMousePointer( event ) ) {
			activate();
		}
	};
	const onPointerMove = ( event: PointerEvent ) => {
		if ( ! isMousePointer( event ) ) {
			return;
		}
		if ( isExplicitReorderMode() ) {
			releaseToExplicitMode();
			return;
		}
		if ( canUseHover() && isWithinHoverRegion( event.target ) ) {
			activate();
			return;
		}
		if ( isActive && event.buttons === 0 ) {
			deactivate();
		}
	};
	const onPointerUp = ( event: PointerEvent ) => {
		if ( ! isMousePointer( event ) ) {
			return;
		}
		if ( isExplicitReorderMode() ) {
			releaseToExplicitMode();
			return;
		}
		if ( isActive && ! isWithinHoverRegion( event.target ) ) {
			deactivate();
		}
	};
	const onPointerCancel = ( event: PointerEvent ) => {
		if ( isMousePointer( event ) ) {
			deactivate();
		}
	};
	const onHoverCapabilityChange = () => {
		if ( ! canUseHover() ) {
			deactivate();
		}
	};

	table.addEventListener( 'pointerenter', onPointerEnter );
	document.addEventListener( 'pointermove', onPointerMove, true );
	document.addEventListener( 'pointerup', onPointerUp, true );
	document.addEventListener( 'pointercancel', onPointerCancel, true );
	hoverMedia.addEventListener( 'change', onHoverCapabilityChange );

	return () => {
		cancelFadeTimeout();
		if ( showAnimationFrame ) {
			view.cancelAnimationFrame( showAnimationFrame );
		}
		stopObservingHandles();
		releaseHoverHandles();
		table.removeEventListener( 'pointerenter', onPointerEnter );
		document.removeEventListener( 'pointermove', onPointerMove, true );
		document.removeEventListener( 'pointerup', onPointerUp, true );
		document.removeEventListener( 'pointercancel', onPointerCancel, true );
		hoverMedia.removeEventListener( 'change', onHoverCapabilityChange );
	};
};
