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
	useLayoutEffect,
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
import { getNonMovableRowIndices, getRowspanRanges } from './rowspan';
import { SortableRow } from './sortable-row';
import {
	getTableReorderDropTarget,
	getTableReorderPushAsideOffsets,
	type TableReorderPoint,
	type TableReorderRowPosition,
} from './push-aside';

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

type InsertionIndicator = {
	below: boolean;
	rowId: string;
};

const getBodyRows = ( body: unknown ): unknown[] => ( Array.isArray( body ) ? body : [] );

const hasSameOffsets = (
	left: ReadonlyMap< string, number >,
	right: ReadonlyMap< string, number >
) =>
	left.size === right.size &&
	Array.from( left ).every( ( [ id, offset ] ) => right.get( id ) === offset );

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
	const [ rowPositions, setRowPositions ] = useState< Map< string, TableReorderRowPosition > >(
		new Map()
	);
	const [ activeRow, setActiveRow ] = useState< TableRow | null >( null );
	const [ insertionIndicator, setInsertionIndicator ] = useState< InsertionIndicator | null >(
		null
	);
	const [ pushAsideOffsets, setPushAsideOffsets ] = useState< Map< string, number > >( new Map() );
	const handleElements = useRef< Map< string, HTMLButtonElement > >( new Map() );
	const isDragging = useRef( false );
	const hasShownForbiddenNotice = useRef( false );
	const overlayElement = useRef< HTMLDivElement | null >( null );
	const dragRows = useRef< Map< string, TableRow > >( new Map() );
	const dragSession = useRef< TableReorderDragSession | null >( null );
	const lastDragPoint = useRef< TableReorderPoint | null >( null );
	const lastDragSource = useRef< DragMoveEvent[ 'operation' ][ 'source' ] | null >( null );
	const rowsRef = useRef< TableRow[] >( [] );
	const rowPositionsRef = useRef< Map< string, TableReorderRowPosition > >( new Map() );
	const pushAsideOffsetsRef = useRef< Map< string, number > >( new Map() );
	const displacedRows = useRef< Map< string, HTMLTableRowElement > >( new Map() );
	const dragSourceElement = useRef< HTMLTableRowElement | null >( null );
	const scheduleRowsUpdate = useRef( () => {} );
	const stopWaitingForDragCleanup = useRef( () => {} );
	const updateDragTargetForPoint = useRef< ( point: TableReorderPoint ) => void >( () => {} );
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
	const clearPushAsideStyles = useCallback( () => {
		for ( const row of displacedRows.current.values() ) {
			row.classList.remove( 'yamabiko-editor-tools-table-reorder-content__row', 'is-displaced' );
			row.style.removeProperty( '--yamabiko-editor-tools-table-reorder-row-offset' );
		}
		displacedRows.current = new Map();
	}, [] );
	const clearDragSourceStyle = useCallback( () => {
		dragSourceElement.current?.classList.remove(
			'yamabiko-editor-tools-table-reorder-content__row',
			'is-drag-source'
		);
		dragSourceElement.current = null;
	}, [] );
	const clearPushAside = useCallback( () => {
		pushAsideOffsetsRef.current = new Map();
		clearPushAsideStyles();
		setPushAsideOffsets( new Map() );
	}, [ clearPushAsideStyles ] );
	const setPushAside = useCallback( ( nextOffsets: Map< string, number > ) => {
		if ( hasSameOffsets( pushAsideOffsetsRef.current, nextOffsets ) ) {
			return;
		}

		pushAsideOffsetsRef.current = nextOffsets;
		setPushAsideOffsets( nextOffsets );
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

	useLayoutEffect( () => {
		const nextDisplacedRows = new Map< string, HTMLTableRowElement >();
		for ( const [ id, row ] of displacedRows.current ) {
			if ( pushAsideOffsets.has( id ) && rows.some( ( candidate ) => candidate.element === row ) ) {
				continue;
			}

			row.classList.remove( 'yamabiko-editor-tools-table-reorder-content__row', 'is-displaced' );
			row.style.removeProperty( '--yamabiko-editor-tools-table-reorder-row-offset' );
		}

		for ( const row of rows ) {
			const offset = pushAsideOffsets.get( row.id );
			if ( offset === undefined ) {
				continue;
			}

			row.element.classList.add(
				'yamabiko-editor-tools-table-reorder-content__row',
				'is-displaced'
			);
			row.element.style.setProperty(
				'--yamabiko-editor-tools-table-reorder-row-offset',
				`${ offset }px`
			);
			nextDisplacedRows.set( row.id, row.element );
		}

		displacedRows.current = nextDisplacedRows;
	}, [ pushAsideOffsets, rows ] );

	useLayoutEffect( () => {
		const nextSource = activeRow?.element ?? null;
		if ( dragSourceElement.current && dragSourceElement.current !== nextSource ) {
			clearDragSourceStyle();
		}
		if ( ! nextSource ) {
			return;
		}

		nextSource.classList.add(
			'yamabiko-editor-tools-table-reorder-content__row',
			'is-drag-source'
		);
		dragSourceElement.current = nextSource;
	}, [ activeRow, clearDragSourceStyle ] );

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
			const nextPositions = new Map< string, TableReorderRowPosition >();
			for ( const row of currentRows ) {
				const rect = row.element.getBoundingClientRect();
				const offset = pushAsideOffsetsRef.current.get( row.id ) ?? 0;
				nextPositions.set( row.id, {
					height: rect.height,
					left: rect.left,
					top: rect.top - offset,
					width: rect.width,
				} );
			}
			rowPositionsRef.current = nextPositions;

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

			if ( isDragging.current && lastDragPoint.current ) {
				updateDragTargetForPoint.current( lastDragPoint.current );
			}
		};

		const updateRows = () => {
			const table = blockElement.querySelector( 'table' );
			const tbody = table?.tBodies.item( 0 );
			const tableRows = tbody ? Array.from( tbody.rows ) : [];
			const bodyRows = getBodyRows( body );

			if ( tableRows.length !== bodyRows.length ) {
				rowsRef.current = [];
				rowPositionsRef.current = new Map();
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
			handleContainer.remove();
			setContainer( null );
		};
	}, [ body, clientId, onExit ] );

	useEffect(
		() => () => {
			dragSession.current = null;
			dragRows.current = new Map();
			lastDragPoint.current = null;
			lastDragSource.current = null;
			clearPushAsideStyles();
			clearDragSourceStyle();
			stopWaitingForDragCleanup.current();
		},
		[ clearDragSourceStyle, clearPushAsideStyles ]
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
			lastDragPoint.current = null;
			lastDragSource.current = null;
			stopWaitingForDragCleanup.current();
			clearInsertionIndicator();
			clearPushAside();
			setActiveRow( row );
		},
		[ body, clearInsertionIndicator, clearPushAside, rows ]
	);

	const updateDragTarget = useCallback(
		( event: DragMoveEvent | DragOverEvent ) => {
			const { source } = event.operation;
			const point = event.operation.position.current;
			lastDragPoint.current = point;
			lastDragSource.current = source;
			const session = dragSession.current;
			if ( ! session || ! isSortable( source ) || source.id !== session.sourceId ) {
				event.preventDefault();
				clearInsertionIndicator();
				clearPushAside();
				return;
			}

			const target = getTableReorderDropTarget(
				[ ...dragRows.current.values() ],
				rowPositionsRef.current,
				point
			);
			if ( ! target ) {
				dragSession.current = clearTableReorderDragTarget( session );
				event.preventDefault();
				clearInsertionIndicator();
				clearPushAside();
				return;
			}

			const targetRow = dragRows.current.get( target.targetId );
			if ( ! targetRow ) {
				dragSession.current = clearTableReorderDragTarget( session );
				event.preventDefault();
				clearInsertionIndicator();
				clearPushAside();
				return;
			}

			const update = updateTableReorderDragTarget( session, targetRow.id, target.insertionIndex );
			dragSession.current = update.session;

			if ( update.isForbidden ) {
				event.preventDefault();
				showForbiddenNotice();
				clearInsertionIndicator();
				clearPushAside();
				return;
			}

			if ( ! update.session.target ) {
				clearInsertionIndicator();
				clearPushAside();
				return;
			}

			const sourcePosition = rowPositionsRef.current.get( session.sourceId );
			if ( ! sourcePosition ) {
				clearInsertionIndicator();
				clearPushAside();
				return;
			}

			showInsertionIndicator( targetRow.id, target.insertionIndex > targetRow.index );
			setPushAside(
				getTableReorderPushAsideOffsets( [ ...dragRows.current.values() ], {
					insertionIndex: target.insertionIndex,
					sourceHeight: sourcePosition.height,
					sourceIndex: session.sourceIndex,
				} )
			);
		},
		[
			clearInsertionIndicator,
			clearPushAside,
			setPushAside,
			showForbiddenNotice,
			showInsertionIndicator,
		]
	);
	useEffect( () => {
		updateDragTargetForPoint.current = ( point ) => {
			const source = lastDragSource.current;
			if ( ! source ) {
				return;
			}

			updateDragTarget( {
				operation: { position: { current: point }, source },
				preventDefault: () => {},
			} as unknown as DragMoveEvent );
		};
	}, [ updateDragTarget ] );

	const onDragEnd = useCallback(
		( { canceled, operation: { source } }: DragEndEvent ) => {
			const session = dragSession.current;
			dragSession.current = null;
			dragRows.current = new Map();
			lastDragPoint.current = null;
			lastDragSource.current = null;
			commitTableReorderDrag(
				session,
				{
					canceled: canceled || ! isSortable( source ),
					sourceId: isSortable( source ) ? String( source.id ) : '',
					targetId: session?.target?.targetId ?? null,
				},
				( nextBody ) => setAttributes( { body: nextBody } )
			);

			clearInsertionIndicator();
			clearPushAside();
			clearDragSourceStyle();

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
		[ activeRow, clearDragSourceStyle, clearInsertionIndicator, clearPushAside, setAttributes ]
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
