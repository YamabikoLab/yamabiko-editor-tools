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
import { store as noticesStore } from '@wordpress/notices';

import {
	beginTableReorderDrag,
	clearTableReorderDragTarget,
	commitTableReorderDrag,
	type TableReorderDragSession,
	updateTableReorderDragTarget,
} from './drag-session';
import { TableReorderDragVisuals, type InsertionIndicator } from './drag-visuals';
import { DragRowOverlay } from './drag-row-overlay';
import { getNonMovableRowIndices, getRowspanRanges } from './rowspan';
import { SortableRow } from './sortable-row';
import { ROWSPAN_REORDER_ERROR_MESSAGE, useKeyboardReorder } from './use-keyboard-reorder';
import { type TableRow, useTableReorderDom } from './use-table-reorder-dom';

type TableReorderControllerProps = {
	align: string | undefined;
	body: unknown;
	clientId: string;
	instructionsId: string;
	onExit: () => void;
	setAttributes: ( attributes: { body: unknown[] } ) => void;
};

export function TableReorderController( {
	align,
	body,
	clientId,
	instructionsId,
	onExit,
	setAttributes,
}: TableReorderControllerProps ) {
	const {
		anchorRef,
		container,
		getRows,
		requestRowsReconciliation,
		resumeRowsReconciliation,
		rowPositions,
		rows,
		suspendRowsReconciliation,
	} = useTableReorderDom( { align, body, clientId, onExit } );
	const [ activeRow, setActiveRow ] = useState< TableRow | null >( null );
	const [ insertionIndicator, setInsertionIndicator ] = useState< InsertionIndicator | null >(
		null
	);
	const handleElements = useRef< Map< string, HTMLButtonElement > >( new Map() );
	const hasShownForbiddenNotice = useRef( false );
	const overlayElement = useRef< HTMLDivElement | null >( null );
	const dragRows = useRef< Map< string, TableRow > >( new Map() );
	const dragSession = useRef< TableReorderDragSession | null >( null );
	const stopWaitingForDragCleanup = useRef( () => {} );
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

	const clearCandidate = useCallback( () => {
		dragVisuals.current?.clear();
	}, [] );
	const showCandidate = useCallback(
		( ...args: Parameters< TableReorderDragVisuals[ 'showCandidate' ] > ) => {
			dragVisuals.current?.showCandidate( ...args );
		},
		[]
	);
	const focusHandle = useCallback(
		( id: string ) => {
			const view = anchorRef.current?.ownerDocument.defaultView;
			if ( ! view ) {
				return;
			}

			view.requestAnimationFrame( () => {
				view.requestAnimationFrame( () => {
					handleElements.current.get( id )?.focus( { preventScroll: true } );
				} );
			} );
		},
		[ anchorRef ]
	);

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

	const { keyboardReorder, liveMessage, onHandleKeyDown } = useKeyboardReorder( {
		body,
		clearCandidate,
		focusHandle,
		getRows,
		nonMovableRows,
		rows,
		setAttributes,
		showCandidate,
	} );

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

	useEffect(
		() => () => {
			clearCandidate();
			dragSession.current = null;
			dragRows.current = new Map();
			stopWaitingForDragCleanup.current();
			resumeRowsReconciliation();
		},
		[ clearCandidate, resumeRowsReconciliation ]
	);

	const onDragStart = useCallback(
		( { operation: { source } }: DragStartEvent ) => {
			if ( keyboardReorder ) {
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

			suspendRowsReconciliation();
			hasShownForbiddenNotice.current = false;
			dragRows.current = new Map( rows.map( ( candidate ) => [ candidate.id, candidate ] ) );
			dragSession.current = session;
			stopWaitingForDragCleanup.current();
			clearCandidate();
			setActiveRow( row );
		},
		[ body, clearCandidate, keyboardReorder, rows, suspendRowsReconciliation ]
	);

	const updateDragTarget = useCallback(
		( event: DragMoveEvent | DragOverEvent ) => {
			if ( keyboardReorder ) {
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
				clearCandidate();
				return;
			}

			if ( ! isSortable( target ) || source.sortable.group !== target.sortable.group ) {
				dragSession.current = clearTableReorderDragTarget( session );
				event.preventDefault();
				clearCandidate();
				return;
			}

			const targetRow = dragRows.current.get( String( target.id ) );
			if ( ! targetRow ) {
				dragSession.current = clearTableReorderDragTarget( session );
				event.preventDefault();
				clearCandidate();
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
				clearCandidate();
				return;
			}

			if ( ! update.session.target ) {
				clearCandidate();
				return;
			}

			showCandidate(
				Array.from( dragRows.current.values(), ( row ) => ( {
					...row,
					height: row.element.getBoundingClientRect().height,
				} ) ),
				update.session.sourceId,
				update.session.target.targetId,
				update.session.target.insertionIndex
			);
		},
		[ clearCandidate, keyboardReorder, showCandidate, showForbiddenNotice ]
	);

	const onDragEnd = useCallback(
		( { canceled, operation: { source, target } }: DragEndEvent ) => {
			if ( keyboardReorder ) {
				return;
			}

			const session = dragSession.current;
			dragSession.current = null;
			dragRows.current = new Map();
			const isValidTarget =
				isSortable( source ) &&
				isSortable( target ) &&
				source.sortable.group === target.sortable.group;
			clearCandidate();
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
				resumeRowsReconciliation();
				setActiveRow( null );
				requestRowsReconciliation();
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
		[
			activeRow,
			clearCandidate,
			keyboardReorder,
			requestRowsReconciliation,
			resumeRowsReconciliation,
			setAttributes,
		]
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
