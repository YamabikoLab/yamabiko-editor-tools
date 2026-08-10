import {
	type DragEndEvent,
	type DragMoveEvent,
	type DragOverEvent,
	type DragStartEvent,
} from '@dnd-kit/dom';
import { isSortable } from '@dnd-kit/react/sortable';
import { useDispatch } from '@wordpress/data';
import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { store as noticesStore } from '@wordpress/notices';

import {
	beginTableReorderDrag,
	clearTableReorderDragTarget,
	commitTableReorderDrag,
	type TableReorderDragSession,
	updateTableReorderDragTarget,
} from './drag-session';
import { ROWSPAN_REORDER_ERROR_MESSAGE } from './use-keyboard-reorder';
import type { TableRow } from './use-table-reorder-dom';

type CandidateRow = TableRow & {
	height: number;
};

type UsePointerReorderOptions = {
	body: unknown;
	clearCandidate: () => void;
	isKeyboardReordering: boolean;
	requestRowsReconciliation: () => void;
	resumeRowsReconciliation: () => void;
	rows: readonly TableRow[];
	setAttributes: ( attributes: { body: unknown[] } ) => void;
	showCandidate: (
		rows: readonly CandidateRow[],
		sourceId: string,
		targetId: string,
		insertionIndex: number
	) => void;
	suspendRowsReconciliation: () => void;
};

export function usePointerReorder( {
	body,
	clearCandidate,
	isKeyboardReordering,
	requestRowsReconciliation,
	resumeRowsReconciliation,
	rows,
	setAttributes,
	showCandidate,
	suspendRowsReconciliation,
}: UsePointerReorderOptions ) {
	const [ activeRow, setActiveRow ] = useState< TableRow | null >( null );
	const hasShownForbiddenNotice = useRef( false );
	const overlayElement = useRef< HTMLDivElement | null >( null );
	const dragRows = useRef< Map< string, TableRow > >( new Map() );
	const dragSession = useRef< TableReorderDragSession | null >( null );
	const stopWaitingForDragCleanup = useRef( () => {} );
	const { createErrorNotice } = useDispatch( noticesStore );

	const showForbiddenNotice = useCallback( () => {
		if ( hasShownForbiddenNotice.current ) {
			return;
		}

		hasShownForbiddenNotice.current = true;
		createErrorNotice( ROWSPAN_REORDER_ERROR_MESSAGE, { type: 'snackbar' } );
	}, [ createErrorNotice ] );
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
			if ( isKeyboardReordering ) {
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
		[ body, clearCandidate, isKeyboardReordering, rows, suspendRowsReconciliation ]
	);

	const updateDragTarget = useCallback(
		( event: DragMoveEvent | DragOverEvent ) => {
			if ( isKeyboardReordering ) {
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
		[ clearCandidate, isKeyboardReordering, showCandidate, showForbiddenNotice ]
	);

	const onDragEnd = useCallback(
		( { canceled, operation: { source, target } }: DragEndEvent ) => {
			if ( isKeyboardReordering ) {
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
			isKeyboardReordering,
			requestRowsReconciliation,
			resumeRowsReconciliation,
			setAttributes,
		]
	);

	return {
		activeRow,
		onDragEnd,
		onDragStart,
		onOverlayElementChange,
		updateDragTarget,
	};
}
