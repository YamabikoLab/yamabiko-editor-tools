import { useCallback, useEffect, useRef, useState } from '@wordpress/element';

import { enableFullWidthTableReorder } from './full-width';

export type TableRow = {
	element: HTMLTableRowElement;
	id: string;
	index: number;
};

type TableRowPosition = {
	height: number;
	left: number;
	top: number;
	width: number;
};

type UseTableReorderDomOptions = {
	align: string | undefined;
	body: unknown;
	clientId: string;
	onExit: () => void;
};

const getBodyRows = ( body: unknown ): unknown[] => ( Array.isArray( body ) ? body : [] );

export function useTableReorderDom( {
	align,
	body,
	clientId,
	onExit,
}: UseTableReorderDomOptions ) {
	const anchorRef = useRef< HTMLSpanElement >( null );
	const [ container, setContainer ] = useState< HTMLDivElement | null >( null );
	const [ rows, setRows ] = useState< TableRow[] >( [] );
	const [ rowPositions, setRowPositions ] = useState< Map< string, TableRowPosition > >(
		new Map()
	);
	const rowsRef = useRef< TableRow[] >( [] );
	const rowElementIds = useRef< WeakMap< HTMLTableRowElement, string > >( new WeakMap() );
	const rowIds = useRef( new WeakMap< object, string >() );
	const nextRowId = useRef( 0 );
	const rowsReconciliationSuspended = useRef( false );
	const requestRowsReconciliationRef = useRef( () => {} );

	const getRows = useCallback( () => rowsRef.current, [] );
	const suspendRowsReconciliation = useCallback( () => {
		rowsReconciliationSuspended.current = true;
	}, [] );
	const resumeRowsReconciliation = useCallback( () => {
		rowsReconciliationSuspended.current = false;
	}, [] );
	const requestRowsReconciliation = useCallback( () => {
		requestRowsReconciliationRef.current();
	}, [] );

	useEffect( () => {
		const anchor = anchorRef.current;
		if ( ! anchor ) {
			return;
		}

		const anchorDocument = anchor.ownerDocument;
		const blockElement = anchorDocument.querySelector< HTMLElement >(
			`[data-block="${ clientId }"]`
		);

		if ( ! blockElement ) {
			return;
		}

		const document = blockElement.ownerDocument;
		const view = document.defaultView;
		if ( ! view ) {
			return;
		}
		const table = blockElement.querySelector< HTMLTableElement >( 'table' );
		const disableFullWidthReorder = enableFullWidthTableReorder( blockElement, table );
		const onPointerDown = ( event: PointerEvent ) => {
			if ( event.button !== 0 || ! ( event.target instanceof view.Element ) ) {
				return;
			}

			const cell = event.target.closest( 'td, th' );
			if ( cell && blockElement.contains( cell ) ) {
				onExit();
			}
		};

		const handleContainer = document.createElement( 'div' );
		handleContainer.className = 'yamabiko-editor-tools-table-reorder-content';
		document.body.append( handleContainer );
		setContainer( handleContainer );

		let animationFrame = 0;
		let shouldReconcileRows = false;
		let resizeObserver: ResizeObserver | undefined;

		const getRowId = ( row: unknown, index: number, element: HTMLTableRowElement ) => {
			const existingElementId = rowElementIds.current.get( element );
			let id: string;
			if ( row === null || typeof row !== 'object' ) {
				id = existingElementId ?? `row-${ index }`;
			} else {
				const existingId = rowIds.current.get( row );
				if ( existingId ) {
					id = existingId;
				} else if ( existingElementId ) {
					id = existingElementId;
					rowIds.current.set( row, id );
				} else {
					id = `row-${ nextRowId.current }`;
					nextRowId.current += 1;
					rowIds.current.set( row, id );
				}
			}

			// Gutenberg can reuse a DOM row at a different data index. Prefer the
			// data object's ID for a committed move, then update the DOM mapping.
			rowElementIds.current.set( element, id );
			return id;
		};

		const updateRowPositions = ( currentRows = rowsRef.current ) => {
			const nextPositions = new Map< string, TableRowPosition >();
			for ( const row of currentRows ) {
				const rect = row.element.getBoundingClientRect();
				nextPositions.set( row.id, {
					height: rect.height,
					left: rect.left,
					top: rect.top,
					width: rect.width,
				} );
			}

			setRowPositions( ( current ) => {
				if (
					current.size === nextPositions.size &&
					Array.from( nextPositions ).every( ( [ id, position ] ) => {
						const previous = current.get( id );
						return (
							previous?.height === position.height &&
							previous.left === position.left &&
							previous.top === position.top &&
							previous.width === position.width
						);
					} )
				) {
					return current;
				}

				return nextPositions;
			} );
		};

		const updateRows = () => {
			const tbody = table?.tBodies.item( 0 );
			const tableRows = tbody ? Array.from( tbody.rows ) : [];
			const bodyRows = getBodyRows( body );

			if ( tableRows.length !== bodyRows.length ) {
				rowsRef.current = [];
				setRows( [] );
				setRowPositions( new Map() );
				return;
			}

			const nextRows = tableRows.map( ( row, index ) => ( {
				element: row,
				id: getRowId( bodyRows[ index ], index, row ),
				index,
			} ) );
			rowsRef.current = nextRows;
			setRows( nextRows );
			updateRowPositions( nextRows );
		};

		const scheduleUpdate = ( reconcileRows: boolean ) => {
			shouldReconcileRows ||= reconcileRows;
			if ( animationFrame ) {
				view.cancelAnimationFrame( animationFrame );
			}

			animationFrame = view.requestAnimationFrame( () => {
				animationFrame = 0;
				if ( shouldReconcileRows && ! rowsReconciliationSuspended.current ) {
					shouldReconcileRows = false;
					updateRows();
					return;
				}

				shouldReconcileRows = false;
				updateRowPositions();
			} );
		};
		const schedulePositionUpdate = () => scheduleUpdate( false );
		const scheduleRowReconciliation = () => scheduleUpdate( true );
		requestRowsReconciliationRef.current = scheduleRowReconciliation;

		const mutationObserver = new view.MutationObserver( scheduleRowReconciliation );
		mutationObserver.observe( blockElement, { childList: true, subtree: true } );

		if ( view.ResizeObserver ) {
			resizeObserver = new view.ResizeObserver( schedulePositionUpdate );
			resizeObserver.observe( blockElement );
			if ( table ) {
				resizeObserver.observe( table );
			}
		}

		document.addEventListener( 'scroll', schedulePositionUpdate, true );
		document.addEventListener( 'pointerdown', onPointerDown, true );
		view.addEventListener( 'resize', schedulePositionUpdate );
		updateRows();

		return () => {
			if ( animationFrame ) {
				view.cancelAnimationFrame( animationFrame );
			}
			mutationObserver.disconnect();
			resizeObserver?.disconnect();
			document.removeEventListener( 'scroll', schedulePositionUpdate, true );
			document.removeEventListener( 'pointerdown', onPointerDown, true );
			view.removeEventListener( 'resize', schedulePositionUpdate );
			rowsRef.current = [];
			requestRowsReconciliationRef.current = () => {};
			disableFullWidthReorder();
			handleContainer.remove();
			setContainer( null );
		};
	}, [ align, body, clientId, onExit ] );

	useEffect(
		() => () => {
			rowsReconciliationSuspended.current = false;
		},
		[]
	);

	return {
		anchorRef,
		container,
		getRows,
		requestRowsReconciliation,
		resumeRowsReconciliation,
		rowPositions,
		rows,
		suspendRowsReconciliation,
	};
}
