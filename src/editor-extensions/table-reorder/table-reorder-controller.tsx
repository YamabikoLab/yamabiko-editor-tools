import {
	PointerSensor,
	type DragEndEvent,
	type DragMoveEvent,
	type DragOverEvent,
	type DragStartEvent,
} from '@dnd-kit/dom';
import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';
import { useDispatch } from '@wordpress/data';
import {
	createPortal,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';

import {
	beginTableReorderDrag,
	clearTableReorderDragTarget,
	commitTableReorderDrag,
	type TableReorderDragSession,
	updateTableReorderDragTarget,
} from './drag-session';
import { enableFullWidthTableReorder } from './full-width';
import { getNonMovableRowIndices, getRowspanRanges } from './rowspan';
import { SortableRow } from './sortable-row';

type TableReorderControllerProps = {
	body: unknown;
	clientId: string;
	onExit: () => void;
	setAttributes: ( attributes: { body: unknown[] } ) => void;
};

type TableRow = {
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

type InsertionIndicator = {
	below: boolean;
	rowId: string;
};

const getBodyRows = ( body: unknown ): unknown[] => ( Array.isArray( body ) ? body : [] );

function DragRowOverlay( {
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
	const setOverlayElement = useCallback(
		( overlay: HTMLDivElement | null ) => {
			overlayRef.current = overlay;
			onElementChange( overlay );
		},
		[ onElementChange ]
	);

	useEffect( () => {
		const overlay = overlayRef.current;
		const table = element.closest( 'table' );
		const tbody = element.closest( 'tbody' );
		if ( ! overlay || ! table || ! tbody ) {
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
		overlay.replaceChildren( tableContext );

		return () => overlay.replaceChildren();
	}, [ element, height, width ] );

	return (
		<div
			aria-hidden="true"
			className="yamabiko-editor-tools-table-reorder-content__overlay"
			ref={ setOverlayElement }
		/>
	);
}

export function TableReorderController( {
	body,
	clientId,
	onExit,
	setAttributes,
}: TableReorderControllerProps ) {
	const anchorRef = useRef< HTMLSpanElement >( null );
	const [ container, setContainer ] = useState< HTMLDivElement | null >( null );
	const [ rows, setRows ] = useState< TableRow[] >( [] );
	const [ rowPositions, setRowPositions ] = useState< Map< string, TableRowPosition > >(
		new Map()
	);
	const [ activeRow, setActiveRow ] = useState< TableRow | null >( null );
	const [ insertionIndicator, setInsertionIndicator ] = useState< InsertionIndicator | null >(
		null
	);
	const handleElements = useRef< Map< string, HTMLButtonElement > >( new Map() );
	const isDragging = useRef( false );
	const hasShownForbiddenNotice = useRef( false );
	const overlayElement = useRef< HTMLDivElement | null >( null );
	const dragRows = useRef< Map< string, TableRow > >( new Map() );
	const dragSession = useRef< TableReorderDragSession | null >( null );
	const rowsRef = useRef< TableRow[] >( [] );
	const scheduleRowsUpdate = useRef( () => {} );
	const stopWaitingForDragCleanup = useRef( () => {} );
	const rowElementIds = useRef< WeakMap< HTMLTableRowElement, string > >( new WeakMap() );
	const rowIds = useRef( new WeakMap< object, string >() );
	const nextRowId = useRef( 0 );
	const { createErrorNotice } = useDispatch( noticesStore );
	const rowspanRanges = useMemo( () => getRowspanRanges( body ), [ body ] );
	const nonMovableRows = useMemo(
		() => new Set( getNonMovableRowIndices( rowspanRanges ) ),
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
		setInsertionIndicator( null );
	}, [] );
	const showForbiddenNotice = useCallback( () => {
		if ( hasShownForbiddenNotice.current ) {
			return;
		}

		hasShownForbiddenNotice.current = true;
		createErrorNotice(
			__(
				'結合セルを分断する位置には行を移動できません。結合を解除してから並べ替えてください。',
				'yamabiko-editor-tools'
			),
			{ type: 'snackbar' }
		);
	}, [ createErrorNotice ] );

	const showInsertionIndicator = useCallback( ( rowId: string, below: boolean ) => {
		setInsertionIndicator( ( current ) => {
			if ( current?.rowId === rowId && current.below === below ) {
				return current;
			}

			return { below, rowId };
		} );
	}, [] );

	const onHandleChange = useCallback( ( id: string, element: HTMLButtonElement | null ) => {
		if ( element ) {
			handleElements.current.set( id, element );
			return;
		}

		handleElements.current.delete( id );
	}, [] );
	const onOverlayElementChange = useCallback( ( element: HTMLDivElement | null ) => {
		overlayElement.current = element;
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
				if ( shouldReconcileRows && ! isDragging.current ) {
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
		scheduleRowsUpdate.current = scheduleRowReconciliation;

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
			scheduleRowsUpdate.current = () => {};
			disableFullWidthReorder();
			handleContainer.remove();
			setContainer( null );
		};
	}, [ body, clientId, onExit ] );

	useEffect(
		() => () => {
			dragSession.current = null;
			dragRows.current = new Map();
			stopWaitingForDragCleanup.current();
		},
		[]
	);

	const onDragStart = useCallback(
		( { operation: { source } }: DragStartEvent ) => {
			if ( ! isSortable( source ) ) {
				return;
			}

			const row = rows.find( ( candidate ) => candidate.id === source.id );
			if ( ! row ) {
				return;
			}
			const session = beginTableReorderDrag( body, row.id, row.index );
			if ( ! session || session.nonMovableRowIndices.includes( row.index ) ) {
				return;
			}

			isDragging.current = true;
			hasShownForbiddenNotice.current = false;
			dragRows.current = new Map( rows.map( ( candidate ) => [ candidate.id, candidate ] ) );
			dragSession.current = session;
			stopWaitingForDragCleanup.current();
			clearInsertionIndicator();
			setActiveRow( row );
		},
		[ body, clearInsertionIndicator, rows ]
	);

	const updateDragTarget = useCallback(
		( event: DragMoveEvent | DragOverEvent ) => {
			const { source, target } = event.operation;
			const session = dragSession.current;
			if ( ! session || ! isSortable( source ) || source.id !== session.sourceId ) {
				event.preventDefault();
				clearInsertionIndicator();
				return;
			}

			if ( ! isSortable( target ) || source.sortable.group !== target.sortable.group ) {
				dragSession.current = clearTableReorderDragTarget( session );
				event.preventDefault();
				clearInsertionIndicator();
				return;
			}

			const targetRow = dragRows.current.get( String( target.id ) );
			if ( ! targetRow ) {
				dragSession.current = clearTableReorderDragTarget( session );
				event.preventDefault();
				clearInsertionIndicator();
				return;
			}

			const targetRect = targetRow.element.getBoundingClientRect();
			const insertionIndex =
				event.operation.position.current.y < targetRect.top + targetRect.height / 2
					? targetRow.index
					: targetRow.index + 1;
			const update = updateTableReorderDragTarget( session, targetRow.id, insertionIndex );
			dragSession.current = update.session;

			if ( update.isForbidden ) {
				event.preventDefault();
				showForbiddenNotice();
				clearInsertionIndicator();
				return;
			}

			if ( ! update.session.target ) {
				clearInsertionIndicator();
				return;
			}

			showInsertionIndicator( targetRow.id, insertionIndex > targetRow.index );
		},
		[ clearInsertionIndicator, showForbiddenNotice, showInsertionIndicator ]
	);

	const onDragEnd = useCallback(
		( { canceled, operation: { source, target } }: DragEndEvent ) => {
			const session = dragSession.current;
			dragSession.current = null;
			dragRows.current = new Map();
			const isValidTarget =
				isSortable( source ) &&
				isSortable( target ) &&
				source.sortable.group === target.sortable.group;
			commitTableReorderDrag(
				session,
				{
					canceled: canceled || ! isValidTarget,
					sourceId: isSortable( source ) ? String( source.id ) : '',
					targetId: isSortable( target ) ? String( target.id ) : null,
				},
				( nextBody ) => setAttributes( { body: nextBody } )
			);

			clearInsertionIndicator();

			const overlay = overlayElement.current?.parentElement;
			const view = activeRow?.element.ownerDocument.defaultView;
			const finish = () => {
				isDragging.current = false;
				setActiveRow( null );
				scheduleRowsUpdate.current();
			};

			if ( ! overlay || ! view ) {
				finish();
				return;
			}

			let animationFrame = 0;
			const isCleaningUp = () =>
				overlay.hasAttribute( 'data-dnd-dragging' ) || overlay.hasAttribute( 'data-dnd-dropping' );
			const observer = new view.MutationObserver( () => {
				if ( isCleaningUp() ) {
					return;
				}

				observer.disconnect();
				animationFrame = view.requestAnimationFrame( finish );
			} );
			observer.observe( overlay, {
				attributeFilter: [ 'data-dnd-dragging', 'data-dnd-dropping' ],
				attributes: true,
			} );
			if ( ! isCleaningUp() ) {
				observer.disconnect();
				animationFrame = view.requestAnimationFrame( finish );
			}

			stopWaitingForDragCleanup.current = () => {
				observer.disconnect();
				if ( animationFrame ) {
					view.cancelAnimationFrame( animationFrame );
				}
			};
		},
		[ activeRow, clearInsertionIndicator, setAttributes ]
	);

	const indicatorPosition = insertionIndicator
		? rowPositions.get( insertionIndicator.rowId )
		: undefined;
	const activeRowPosition = activeRow ? rowPositions.get( activeRow.id ) : undefined;

	return (
		<>
			<span aria-hidden="true" hidden ref={ anchorRef } />
			<DragDropProvider
				onDragEnd={ onDragEnd }
				onDragMove={ updateDragTarget }
				onDragOver={ updateDragTarget }
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
									height={ rowPositions.get( row.id )?.height ?? 0 }
									id={ row.id }
									index={ row.index }
									key={ row.id }
									left={ rowPositions.get( row.id )?.left ?? 0 }
									onHandleChange={ onHandleChange }
									top={ rowPositions.get( row.id )?.top ?? 0 }
								/>
							) ) }
							<div
								aria-hidden="true"
								className="yamabiko-editor-tools-table-reorder-content__insertion-indicator"
								hidden={ ! indicatorPosition }
								style={
									indicatorPosition
										? {
												left: `${ indicatorPosition.left }px`,
												top: `${
													insertionIndicator?.below
														? indicatorPosition.top + indicatorPosition.height
														: indicatorPosition.top
												}px`,
												width: `${ indicatorPosition.width }px`,
										  }
										: undefined
								}
							/>
						</>,
						container
					) }
				<DragOverlay>
					{ activeRow && activeRowPosition && (
						<DragRowOverlay
							element={ activeRow.element }
							height={ activeRowPosition.height }
							onElementChange={ onOverlayElementChange }
							width={ activeRowPosition.width }
						/>
					) }
				</DragOverlay>
			</DragDropProvider>
		</>
	);
}
