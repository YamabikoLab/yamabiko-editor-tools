import {
	PointerSensor,
	type DragEndEvent,
	type DragOverEvent,
	type DragStartEvent,
} from '@dnd-kit/dom';
import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';
import {
	createPortal,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

import {
	crossesRowspanBoundary,
	getForbiddenInsertionIndices,
	getNonMovableRowIndices,
	getRowspanRanges,
} from './rowspan';
import { SortableRow } from './sortable-row';

type TableReorderControllerProps = {
	body: unknown;
	clientId: string;
};

type TableRow = {
	element: HTMLTableRowElement;
	height: number;
	id: string;
	index: number;
	left: number;
	top: number;
	width: number;
};

const getBodyRows = ( body: unknown ): unknown[] => ( Array.isArray( body ) ? body : [] );

export function TableReorderController( { body, clientId }: TableReorderControllerProps ) {
	const anchorRef = useRef< HTMLSpanElement >( null );
	const [ container, setContainer ] = useState< HTMLDivElement | null >( null );
	const [ rows, setRows ] = useState< TableRow[] >( [] );
	const [ activeRow, setActiveRow ] = useState< TableRow | null >( null );
	const handleElements = useRef< Map< string, HTMLButtonElement > >( new Map() );
	const insertionIndicatorRef = useRef< HTMLDivElement >( null );
	const isDragging = useRef( false );
	const rowElementIds = useRef< WeakMap< HTMLTableRowElement, string > >( new WeakMap() );
	const rowIds = useRef( new WeakMap< object, string >() );
	const nextRowId = useRef( 0 );
	const rowspanRanges = useMemo( () => getRowspanRanges( body ), [ body ] );
	const nonMovableRows = useMemo(
		() => new Set( getNonMovableRowIndices( rowspanRanges ) ),
		[ rowspanRanges ]
	);
	const forbiddenInsertionIndices = useMemo(
		() => new Set( getForbiddenInsertionIndices( rowspanRanges ) ),
		[ rowspanRanges ]
	);
	const sensors = useMemo(
		() => [
			PointerSensor.configure( {
				activatorElements: ( source ) => [ handleElements.current.get( String( source.id ) ) ],
			} ),
		],
		[]
	);

	const clearInsertionIndicator = useCallback( () => {
		const indicator = insertionIndicatorRef.current;
		if ( indicator ) {
			indicator.hidden = true;
		}
	}, [] );

	const showInsertionIndicator = useCallback( ( row: TableRow, below: boolean ) => {
		const indicator = insertionIndicatorRef.current;
		if ( ! indicator ) {
			return;
		}

		indicator.hidden = false;
		indicator.style.left = `${ row.left }px`;
		indicator.style.top = `${ below ? row.top + row.height : row.top }px`;
		indicator.style.width = `${ row.width }px`;
	}, [] );

	const onHandleChange = useCallback( ( id: string, element: HTMLButtonElement | null ) => {
		if ( element ) {
			handleElements.current.set( id, element );
			return;
		}

		handleElements.current.delete( id );
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

		const handleContainer = document.createElement( 'div' );
		handleContainer.className = 'yamabiko-editor-tools-table-reorder-content';
		document.body.append( handleContainer );
		setContainer( handleContainer );

		let animationFrame = 0;
		let resizeObserver: ResizeObserver | undefined;

		const getRowId = ( row: unknown, index: number, element: HTMLTableRowElement ) => {
			const existingElementId = rowElementIds.current.get( element );
			if ( existingElementId ) {
				return existingElementId;
			}

			let id: string;
			if ( row === null || typeof row !== 'object' ) {
				id = `row-${ index }`;
			} else {
				const existingId = rowIds.current.get( row );
				if ( existingId ) {
					id = existingId;
				} else {
					id = `row-${ nextRowId.current }`;
					nextRowId.current += 1;
					rowIds.current.set( row, id );
				}
			}

			rowElementIds.current.set( element, id );
			return id;
		};

		const updateRows = () => {
			if ( isDragging.current ) {
				return;
			}

			const table = blockElement.querySelector( 'table' );
			const tbody = table?.tBodies.item( 0 );
			const tableRows = tbody ? Array.from( tbody.rows ) : [];
			const bodyRows = getBodyRows( body );

			if ( tableRows.length !== bodyRows.length ) {
				setRows( [] );
				return;
			}

			setRows(
				tableRows.map( ( row, index ) => {
					const rect = row.getBoundingClientRect();

					return {
						element: row,
						height: rect.height,
						id: getRowId( bodyRows[ index ], index, row ),
						index,
						left: rect.left,
						top: rect.top,
						width: rect.width,
					};
				} )
			);
		};

		const scheduleUpdate = () => {
			if ( animationFrame ) {
				view.cancelAnimationFrame( animationFrame );
			}

			animationFrame = view.requestAnimationFrame( updateRows );
		};

		const mutationObserver = new view.MutationObserver( scheduleUpdate );
		mutationObserver.observe( blockElement, { childList: true, subtree: true } );

		if ( view.ResizeObserver ) {
			resizeObserver = new view.ResizeObserver( scheduleUpdate );
			resizeObserver.observe( blockElement );
		}

		document.addEventListener( 'scroll', scheduleUpdate, true );
		view.addEventListener( 'resize', scheduleUpdate );
		updateRows();

		return () => {
			if ( animationFrame ) {
				view.cancelAnimationFrame( animationFrame );
			}
			mutationObserver.disconnect();
			resizeObserver?.disconnect();
			document.removeEventListener( 'scroll', scheduleUpdate, true );
			view.removeEventListener( 'resize', scheduleUpdate );
			handleContainer.remove();
			setContainer( null );
		};
	}, [ body, clientId ] );

	const onDragStart = useCallback(
		( { operation: { source } }: DragStartEvent ) => {
			if ( ! isSortable( source ) ) {
				return;
			}

			const row = rows.find( ( candidate ) => candidate.id === source.id );
			if ( ! row ) {
				return;
			}

			isDragging.current = true;
			clearInsertionIndicator();
			setActiveRow( row );
		},
		[ clearInsertionIndicator, rows ]
	);

	const onDragOver = useCallback(
		( event: DragOverEvent ) => {
			const { source, target } = event.operation;
			if (
				! isSortable( source ) ||
				! isSortable( target ) ||
				source.sortable.group !== target.sortable.group ||
				source.id === target.id
			) {
				event.preventDefault();
				clearInsertionIndicator();
				return;
			}

			const sourceIndex = source.sortable.initialIndex;
			const targetIndex = target.sortable.index;
			const insertionIndex = sourceIndex < targetIndex ? targetIndex + 1 : targetIndex;
			const isForbidden =
				forbiddenInsertionIndices.has( insertionIndex ) ||
				crossesRowspanBoundary( rowspanRanges, sourceIndex, insertionIndex );
			const targetRow = rows.find( ( row ) => row.id === target.id );

			if ( isForbidden || ! targetRow ) {
				event.preventDefault();
				clearInsertionIndicator();
				return;
			}

			showInsertionIndicator( targetRow, sourceIndex < targetIndex );
		},
		[
			clearInsertionIndicator,
			forbiddenInsertionIndices,
			rows,
			rowspanRanges,
			showInsertionIndicator,
		]
	);

	const onDragEnd = useCallback(
		( { operation: { source } }: DragEndEvent ) => {
			if ( isSortable( source ) ) {
				const { initialIndex, index } = source.sortable;
				if ( initialIndex !== index ) {
					// The commit and feedback phase persists this confirmed position.
				}
			}

			isDragging.current = false;
			clearInsertionIndicator();
			setActiveRow( null );
		},
		[ clearInsertionIndicator ]
	);

	return (
		<>
			<span aria-hidden="true" hidden ref={ anchorRef } />
			<DragDropProvider
				onDragEnd={ onDragEnd }
				onDragOver={ onDragOver }
				onDragStart={ onDragStart }
				sensors={ sensors }
			>
				{ container &&
					createPortal(
						<>
							{ rows.map( ( row ) => (
								<SortableRow
									disabled={ nonMovableRows.has( row.index ) }
									element={ row.element }
									height={ row.height }
									id={ row.id }
									index={ row.index }
									key={ row.id }
									left={ row.left }
									onHandleChange={ onHandleChange }
									top={ row.top }
								/>
							) ) }
							<div
								aria-hidden="true"
								className="yamabiko-editor-tools-table-reorder-content__insertion-indicator"
								hidden
								ref={ insertionIndicatorRef }
							/>
						</>,
						container
					) }
				<DragOverlay>
					{ activeRow && (
						<div
							className="yamabiko-editor-tools-table-reorder-content__overlay"
							style={ { height: `${ activeRow.height }px`, width: `${ activeRow.width }px` } }
						>
							{ sprintf(
								/* translators: %d: table body row number. */
								__( '%d 行目を移動中', 'yamabiko-editor-tools' ),
								activeRow.index + 1
							) }
						</div>
					) }
				</DragOverlay>
			</DragDropProvider>
		</>
	);
}
