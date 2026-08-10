import { useDispatch } from '@wordpress/data';
import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';
import type { KeyboardEvent } from 'react';

import {
	beginTableReorderDrag,
	commitTableReorderDrag,
	type TableReorderDragSession,
	updateTableReorderDragTarget,
} from './drag-session';
import {
	getInsertionIndexForKeyboardDestination,
	getKeyboardDestination,
	getKeyboardMoveDirection,
	isKeyboardReorderToggleKey,
} from './keyboard-reorder';
import type { TableRow } from './use-table-reorder-dom';

type KeyboardReorderState = {
	destinationIndex: number;
	sourceId: string;
	sourceIndex: number;
};

type CandidateRow = TableRow & {
	height: number;
};

type UseKeyboardReorderOptions = {
	body: unknown;
	clearCandidate: () => void;
	focusHandle: ( id: string ) => void;
	getRows: () => TableRow[];
	nonMovableRows: ReadonlySet< number >;
	rows: readonly TableRow[];
	setAttributes: ( attributes: { body: unknown[] } ) => void;
	showCandidate: (
		rows: readonly CandidateRow[],
		sourceId: string,
		targetId: string,
		insertionIndex: number
	) => void;
};

export const ROWSPAN_REORDER_ERROR_MESSAGE = __(
	'Rows cannot be moved to a position that splits merged cells. Unmerge the cells before reordering.',
	'yamabiko-editor-tools'
);

export function useKeyboardReorder( {
	body,
	clearCandidate,
	focusHandle,
	getRows,
	nonMovableRows,
	rows,
	setAttributes,
	showCandidate,
}: UseKeyboardReorderOptions ) {
	const [ keyboardReorder, setKeyboardReorder ] = useState< KeyboardReorderState | null >( null );
	const [ liveMessage, setLiveMessage ] = useState( '' );
	const lastAnnouncement = useRef< string | null >( null );
	const hasShownForbiddenNotice = useRef( false );
	const pendingFocusId = useRef< string | null >( null );
	const dragRows = useRef< Map< string, TableRow > >( new Map() );
	const dragSession = useRef< TableReorderDragSession | null >( null );
	const { createErrorNotice } = useDispatch( noticesStore );

	const announce = useCallback( ( message: string ) => {
		if ( lastAnnouncement.current === message ) {
			return;
		}

		lastAnnouncement.current = message;
		setLiveMessage( message );
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
	const showForbiddenNotice = useCallback( () => {
		if ( hasShownForbiddenNotice.current ) {
			return;
		}

		hasShownForbiddenNotice.current = true;
		createErrorNotice( ROWSPAN_REORDER_ERROR_MESSAGE, { type: 'snackbar' } );
	}, [ createErrorNotice ] );

	useEffect( () => {
		const id = pendingFocusId.current;
		if ( ! id || ! rows.some( ( row ) => row.id === id ) ) {
			return;
		}

		pendingFocusId.current = null;
		focusHandle( id );
	}, [ focusHandle, rows ] );

	const onHandleKeyDown = useCallback(
		( event: KeyboardEvent< HTMLButtonElement >, id: string ) => {
			const keyboardState = keyboardReorder;
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
				const currentRows = getRows();
				const row = currentRows.find( ( candidate ) => candidate.id === id );
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
				setKeyboardReorder( nextState );
				dragRows.current = new Map(
					currentRows.map( ( candidate ) => [ candidate.id, candidate ] )
				);
				dragSession.current = session;
				hasShownForbiddenNotice.current = false;
				lastAnnouncement.current = null;
				announce(
					sprintf(
						/* translators: 1: table body row number, 2: total table body rows. */
						__( 'Started reordering row %1$d of %2$d.', 'yamabiko-editor-tools' ),
						row.index + 1,
						currentRows.length
					)
				);
				return;
			}

			if ( isCancelKey ) {
				clearCandidate();
				dragSession.current = null;
				dragRows.current = new Map();
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
				clearCandidate();
				dragSession.current = null;
				dragRows.current = new Map();
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

			const currentRows = getRows();
			const destination = getKeyboardDestination(
				keyboardState.destinationIndex,
				currentRows.length,
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

			const targetRow = currentRows.find(
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
			setKeyboardReorder( nextState );
			if ( update.session.target ) {
				showCandidate(
					Array.from( dragRows.current.values(), ( candidate ) => ( {
						...candidate,
						height: candidate.element.getBoundingClientRect().height,
					} ) ),
					update.session.sourceId,
					update.session.target.targetId,
					update.session.target.insertionIndex
				);
			} else {
				clearCandidate();
			}
			scrollRowIntoView( targetRow );
			announce(
				sprintf(
					/* translators: 1: destination table body row number, 2: total table body rows. */
					__( 'Moving to position %1$d of %2$d.', 'yamabiko-editor-tools' ),
					destination.destinationIndex + 1,
					currentRows.length
				)
			);
		},
		[
			announce,
			body,
			clearCandidate,
			focusHandle,
			getRows,
			keyboardReorder,
			nonMovableRows,
			scrollRowIntoView,
			setAttributes,
			showCandidate,
			showForbiddenNotice,
		]
	);

	return {
		keyboardReorder,
		liveMessage,
		onHandleKeyDown,
	};
}
