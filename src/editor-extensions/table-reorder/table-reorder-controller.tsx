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
import type { KeyboardEvent } from 'react';
import {
	createPortal,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';

import {
	beginTableReorderDrag,
	clearTableReorderDragTarget,
	commitTableReorderDrag,
	type TableReorderDragSession,
	updateTableReorderDragTarget,
} from './drag-session';
import { TableReorderDragVisuals, type InsertionIndicator } from './drag-visuals';
import { enableFullWidthTableReorder } from './full-width';
import {
	getInsertionIndexForKeyboardDestination,
	getKeyboardDestination,
	getKeyboardMoveDirection,
	isKeyboardReorderToggleKey,
} from './keyboard-reorder';
import { getNonMovableRowIndices, getRowspanRanges } from './rowspan';
import { SortableRow } from './sortable-row';

type TableReorderControllerProps = {
	align: string | undefined;
	body: unknown;
	clientId: string;
	instructionsId: string;
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

type KeyboardReorderState = {
	destinationIndex: number;
	sourceId: string;
	sourceIndex: number;
};

const getBodyRows = ( body: unknown ): unknown[] => ( Array.isArray( body ) ? body : [] );
const ROWSPAN_REORDER_ERROR_MESSAGE = __(
	'Rows cannot be moved to a position that splits merged cells. Unmerge the cells before reordering.',
	'yamabiko-editor-tools'
);

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
	align,
	body,
	clientId,
	instructionsId,
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
	const [ keyboardReorder, setKeyboardReorder ] = useState< KeyboardReorderState | null >( null );
	const [ liveMessage, setLiveMessage ] = useState( '' );
	const [ insertionIndicator, setInsertionIndicator ] = useState< InsertionIndicator | null >(
		null
	);
	const handleElements = useRef< Map< string, HTMLButtonElement > >( new Map() );
	const isDragging = useRef( false );
	const keyboardReorderRef = useRef< KeyboardReorderState | null >( null );
	const lastAnnouncement = useRef< string | null >( null );
	const hasShownForbiddenNotice = useRef( false );
	const pendingFocusId = useRef< string | null >( null );
	const overlayElement = useRef< HTMLDivElement | null >( null );
	const dragRows = useRef< Map< string, TableRow > >( new Map() );
	const dragSession = useRef< TableReorderDragSession | null >( null );
	const rowsRef = useRef< TableRow[] >( [] );
	const scheduleRowsUpdate = useRef( () => {} );
	const stopWaitingForDragCleanup = useRef( () => {} );
	const rowElementIds = useRef< WeakMap< HTMLTableRowElement, string > >( new WeakMap() );
	const rowIds = useRef( new WeakMap< object, string >() );
	const nextRowId = useRef( 0 );
	const dragVisuals = useRef< TableReorderDragVisuals | null >( null );
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

	const clearDragVisuals = useCallback( () => {
		dragVisuals.current?.clear();
	}, [] );
	const announce = useCallback( ( message: string ) => {
		if ( lastAnnouncement.current === message ) {
			return;
		}

		lastAnnouncement.current = message;
		setLiveMessage( message );
	}, [] );
	const focusHandle = useCallback( ( id: string ) => {
		const view = anchorRef.current?.ownerDocument.defaultView;
		if ( ! view ) {
			return;
		}

		view.requestAnimationFrame( () => {
			view.requestAnimationFrame( () => {
				handleElements.current.get( id )?.focus( { preventScroll: true } );
			} );
		} );
	}, [] );
	const scrollRowIntoView = useCallback( ( row: TableRow ) => {
		const view = row.element.ownerDocument.defaultView;
		if ( ! view ) {
			return;
		}

		view.requestAnimationFrame( () => {
			row.element.scrollIntoView( {
				behavior: 'auto',
				block: 'nearest',
				inline: 'nearest',
			} );
		} );
	}, [] );
	useEffect( () => {
		const id = pendingFocusId.current;
		if ( ! id || ! rows.some( ( row ) => row.id === id ) ) {
			return;
		}

		pendingFocusId.current = null;
		focusHandle( id );
	}, [ focusHandle, rows ] );

	useEffect( () => {
		const visuals = new TableReorderDragVisuals( setInsertionIndicator );
		dragVisuals.current = visuals;

		return () => {
			visuals.clear();
			if ( dragVisuals.current === visuals ) {
				dragVisuals.current = null;
			}
		};
	}, [] );
	const showForbiddenNotice = useCallback( () => {
		if ( hasShownForbiddenNotice.current ) {
			return;
		}

		hasShownForbiddenNotice.current = true;
		createErrorNotice( ROWSPAN_REORDER_ERROR_MESSAGE, { type: 'snackbar' } );
	}, [ createErrorNotice ] );

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
			clearDragVisuals();
			disableFullWidthReorder();
			handleContainer.remove();
			setContainer( null );
		};
	}, [ align, body, clearDragVisuals, clientId, onExit ] );

	useEffect(
		() => () => {
			clearDragVisuals();
			dragSession.current = null;
			dragRows.current = new Map();
			keyboardReorderRef.current = null;
			stopWaitingForDragCleanup.current();
		},
		[ clearDragVisuals ]
	);

	const onDragStart = useCallback(
		( { operation: { source } }: DragStartEvent ) => {
			if ( keyboardReorderRef.current ) {
				return;
			}

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
			clearDragVisuals();
			setActiveRow( row );
		},
		[ body, clearDragVisuals, rows ]
	);

	const updateDragTarget = useCallback(
		( event: DragMoveEvent | DragOverEvent ) => {
			if ( keyboardReorderRef.current ) {
				event.preventDefault();
				return;
			}

			const { source, target } = event.operation;
			const session = dragSession.current;
			if ( ! session || ! isSortable( source ) || source.id !== session.sourceId ) {
				if ( session ) {
					dragSession.current = clearTableReorderDragTarget( session );
				}
				event.preventDefault();
				clearDragVisuals();
				return;
			}

			if ( ! isSortable( target ) || source.sortable.group !== target.sortable.group ) {
				dragSession.current = clearTableReorderDragTarget( session );
				event.preventDefault();
				clearDragVisuals();
				return;
			}

			const targetRow = dragRows.current.get( String( target.id ) );
			if ( ! targetRow ) {
				dragSession.current = clearTableReorderDragTarget( session );
				event.preventDefault();
				clearDragVisuals();
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
				clearDragVisuals();
				return;
			}

			if ( ! update.session.target ) {
				clearDragVisuals();
				return;
			}

			dragVisuals.current?.showCandidate(
				Array.from( dragRows.current.values(), ( row ) => ( {
					...row,
					height: row.element.getBoundingClientRect().height,
				} ) ),
				update.session.sourceId,
				update.session.target.targetId,
				update.session.target.insertionIndex
			);
		},
		[ clearDragVisuals, showForbiddenNotice ]
	);

	const onHandleKeyDown = useCallback(
		( event: KeyboardEvent< HTMLButtonElement >, id: string ) => {
			const keyboardState = keyboardReorderRef.current;
			const direction = getKeyboardMoveDirection( event.key );
			const isToggleKey = isKeyboardReorderToggleKey( event.key );
			const isCancelKey = event.key === 'Escape';
			if ( ! direction && ! isToggleKey && ! isCancelKey ) {
				return;
			}

			event.preventDefault();
			if ( keyboardState && keyboardState.sourceId !== id ) {
				return;
			}

			if ( ! keyboardState ) {
				const row = rowsRef.current.find( ( candidate ) => candidate.id === id );
				if ( ! isToggleKey || ! row ) {
					return;
				}

				if ( nonMovableRows.has( row.index ) ) {
					announce( ROWSPAN_REORDER_ERROR_MESSAGE );
					return;
				}

				const session = beginTableReorderDrag( body, row.id, row.index );
				if ( ! session ) {
					return;
				}

				const nextState = {
					destinationIndex: row.index,
					sourceId: row.id,
					sourceIndex: row.index,
				};
				keyboardReorderRef.current = nextState;
				setKeyboardReorder( nextState );
				dragRows.current = new Map(
					rowsRef.current.map( ( candidate ) => [ candidate.id, candidate ] )
				);
				dragSession.current = session;
				hasShownForbiddenNotice.current = false;
				lastAnnouncement.current = null;
				announce(
					sprintf(
						/* translators: 1: table body row number, 2: total table body rows. */
						__( 'Started reordering row %1$d of %2$d.', 'yamabiko-editor-tools' ),
						row.index + 1,
						rowsRef.current.length
					)
				);
				return;
			}

			if ( isCancelKey ) {
				clearDragVisuals();
				dragSession.current = null;
				dragRows.current = new Map();
				keyboardReorderRef.current = null;
				setKeyboardReorder( null );
				announce(
					sprintf(
						/* translators: %d: table body row number. */
						__( 'Reordering canceled. Row remains at position %d.', 'yamabiko-editor-tools' ),
						keyboardState.sourceIndex + 1
					)
				);
				focusHandle( keyboardState.sourceId );
				return;
			}

			if ( isToggleKey ) {
				const session = dragSession.current;
				const didCommit = commitTableReorderDrag(
					session,
					{
						canceled: false,
						sourceId: keyboardState.sourceId,
						targetId: session?.target?.targetId ?? null,
					},
					( nextBody ) => setAttributes( { body: nextBody } )
				);
				clearDragVisuals();
				dragSession.current = null;
				dragRows.current = new Map();
				keyboardReorderRef.current = null;
				setKeyboardReorder( null );
				if ( didCommit ) {
					pendingFocusId.current = keyboardState.sourceId;
					announce(
						sprintf(
							/* translators: 1: original table body row number, 2: destination table body row number. */
							__( 'Moved row %1$d to position %2$d.', 'yamabiko-editor-tools' ),
							keyboardState.sourceIndex + 1,
							keyboardState.destinationIndex + 1
						)
					);
				} else {
					focusHandle( keyboardState.sourceId );
				}
				return;
			}

			const destination = getKeyboardDestination(
				keyboardState.destinationIndex,
				rowsRef.current.length,
				direction!
			);
			if ( destination.reason === 'first-row' ) {
				announce( __( 'Cannot move the row any further up.', 'yamabiko-editor-tools' ) );
				return;
			}
			if ( destination.reason === 'last-row' ) {
				announce( __( 'Cannot move the row any further down.', 'yamabiko-editor-tools' ) );
				return;
			}

			const targetRow = rowsRef.current.find(
				( candidate ) => candidate.index === destination.destinationIndex
			);
			const session = dragSession.current;
			if ( ! targetRow || ! session ) {
				return;
			}

			const insertionIndex = getInsertionIndexForKeyboardDestination(
				keyboardState.sourceIndex,
				destination.destinationIndex
			);
			const update = updateTableReorderDragTarget( session, targetRow.id, insertionIndex );
			if ( update.isForbidden ) {
				showForbiddenNotice();
				announce( ROWSPAN_REORDER_ERROR_MESSAGE );
				return;
			}

			dragSession.current = update.session;
			const nextState = { ...keyboardState, destinationIndex: destination.destinationIndex };
			keyboardReorderRef.current = nextState;
			setKeyboardReorder( nextState );
			if ( update.session.target ) {
				dragVisuals.current?.showCandidate(
					Array.from( dragRows.current.values(), ( candidate ) => ( {
						...candidate,
						height: candidate.element.getBoundingClientRect().height,
					} ) ),
					update.session.sourceId,
					update.session.target.targetId,
					update.session.target.insertionIndex
				);
			} else {
				clearDragVisuals();
			}
			scrollRowIntoView( targetRow );
			announce(
				sprintf(
					/* translators: 1: destination table body row number, 2: total table body rows. */
					__( 'Moving to position %1$d of %2$d.', 'yamabiko-editor-tools' ),
					destination.destinationIndex + 1,
					rowsRef.current.length
				)
			);
		},
		[
			announce,
			body,
			clearDragVisuals,
			focusHandle,
			nonMovableRows,
			scrollRowIntoView,
			setAttributes,
			showForbiddenNotice,
		]
	);

	const onDragEnd = useCallback(
		( { canceled, operation: { source, target } }: DragEndEvent ) => {
			if ( keyboardReorderRef.current ) {
				return;
			}

			const session = dragSession.current;
			dragSession.current = null;
			dragRows.current = new Map();
			const isValidTarget =
				isSortable( source ) &&
				isSortable( target ) &&
				source.sortable.group === target.sortable.group;
			clearDragVisuals();
			commitTableReorderDrag(
				session,
				{
					canceled: canceled || ! isValidTarget,
					sourceId: isSortable( source ) ? String( source.id ) : '',
					targetId: isSortable( target ) ? String( target.id ) : null,
				},
				( nextBody ) => setAttributes( { body: nextBody } )
			);

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
		[ activeRow, clearDragVisuals, setAttributes ]
	);

	const indicatorPosition = insertionIndicator
		? rowPositions.get( insertionIndicator.rowId )
		: undefined;
	const activeRowPosition = activeRow ? rowPositions.get( activeRow.id ) : undefined;

	return (
		<>
			<span aria-hidden="true" hidden ref={ anchorRef } />
			<span
				aria-atomic="true"
				aria-live="polite"
				className="yamabiko-editor-tools-table-reorder-content__live-region"
				role="status"
			>
				{ liveMessage }
			</span>
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
									element={ row.element }
									height={ rowPositions.get( row.id )?.height ?? 0 }
									id={ row.id }
									index={ row.index }
									instructionsId={ instructionsId }
									isKeyboardReorderSource={ keyboardReorder?.sourceId === row.id }
									isNonMovable={ nonMovableRows.has( row.index ) }
									isPointerDragDisabled={ Boolean( keyboardReorder ) }
									key={ row.id }
									left={ rowPositions.get( row.id )?.left ?? 0 }
									onHandleChange={ onHandleChange }
									onKeyDown={ onHandleKeyDown }
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
