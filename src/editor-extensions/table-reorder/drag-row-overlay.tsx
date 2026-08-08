import { useCallback, useEffect, useRef } from '@wordpress/element';
import { dragHandle } from '@wordpress/icons';

export function DragRowOverlay( {
	element,
	height,
	onElementChange,
	width,
}: {
	element: HTMLTableRowElement;
	height: number;
	onElementChange: ( element: HTMLDivElement | null ) => void;
	width: number;
} ) {
	const overlayRef = useRef< HTMLDivElement | null >( null );
	const overlayContentRef = useRef< HTMLDivElement | null >( null );
	const setOverlayElement = useCallback(
		( overlay: HTMLDivElement | null ) => {
			overlayRef.current = overlay;
			onElementChange( overlay );
		},
		[ onElementChange ]
	);

	useEffect( () => {
		const overlay = overlayRef.current;
		const overlayContent = overlayContentRef.current;
		const table = element.closest( 'table' );
		const tbody = element.closest( 'tbody' );
		if ( ! overlay || ! overlayContent || ! table || ! tbody ) {
			return;
		}

		const document = element.ownerDocument;
		overlay.setAttribute( 'inert', '' );
		const tableContext = table.parentElement
			? ( table.parentElement.cloneNode( false ) as HTMLElement )
			: document.createElement( 'div' );
		const tableClone = table.cloneNode( false ) as HTMLTableElement;
		const tbodyClone = tbody.cloneNode( false ) as HTMLTableSectionElement;
		const rowClone = element.cloneNode( true ) as HTMLTableRowElement;

		tableContext.removeAttribute( 'id' );
		tableContext.removeAttribute( 'data-block' );
		tableContext.removeAttribute( 'contenteditable' );
		tableContext.removeAttribute( 'tabindex' );
		tableContext.style.width = `${ width }px`;
		tableClone.removeAttribute( 'id' );
		tableClone.style.tableLayout = 'fixed';
		tableClone.style.width = `${ width }px`;
		rowClone.removeAttribute( 'id' );
		rowClone.style.height = `${ height }px`;

		for ( const descendant of rowClone.querySelectorAll< HTMLElement >(
			'[id], [contenteditable], [tabindex]'
		) ) {
			descendant.removeAttribute( 'id' );
			descendant.removeAttribute( 'contenteditable' );
			descendant.removeAttribute( 'tabindex' );
		}

		const sourceCells = Array.from( element.cells );
		const clonedCells = Array.from( rowClone.cells );
		for ( const [ index, cell ] of sourceCells.entries() ) {
			const clonedCell = clonedCells[ index ];
			if ( clonedCell ) {
				clonedCell.style.boxSizing = 'border-box';
				clonedCell.style.width = `${ cell.getBoundingClientRect().width }px`;
			}
		}

		for ( const child of Array.from( table.children ) ) {
			if ( child.tagName === 'COLGROUP' ) {
				tableClone.append( child.cloneNode( true ) );
			}
		}

		tbodyClone.append( rowClone );
		tableClone.append( tbodyClone );
		tableContext.append( tableClone );
		overlayContent.replaceChildren( tableContext );

		return () => overlayContent.replaceChildren();
	}, [ element, height, width ] );

	return (
		<div
			aria-hidden="true"
			className="yamabiko-editor-tools-table-reorder-content__overlay"
			ref={ setOverlayElement }
		>
			<span className="yamabiko-editor-tools-table-reorder-content__overlay-handle">
				{ dragHandle }
			</span>
			<div
				className="yamabiko-editor-tools-table-reorder-content__overlay-content"
				ref={ overlayContentRef }
			/>
		</div>
	);
}
