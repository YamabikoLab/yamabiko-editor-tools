/**
 * Table ReorderのSortableJS instanceとdrag session lifecycleを管理する。
 *
 * SortableJS callbacks、drag session state、keyboard / single-pointer session、行control制御、
 * DOM所有権handoff、cleanupを集約し、React / Gutenberg統合層とは狭いcallback境界で接続する。
 * UI描画やReact state自体は扱わず、drag中にSortableJSが変更する行DOMはcommit前またはdestroy時に元へ戻す。
 */

import {
	getDestinationChangedAnnouncement,
	getDestinationRequestedAnnouncement,
	getKeyboardActiveMessage,
	getMoveBoundaryAnnouncement,
	getMoveCanceledAnnouncement,
	getMoveCommittedAnnouncement,
	getMoveStartedAnnouncement,
	getNoMovableRowsAnnouncement,
	getRowspanBlockedAnnouncement,
	getTouchModeMessage,
} from '../messages';
import type { TableContext } from '../table-context';
import { createInsertionLine, fixFallbackRowCellWidths } from './drag-ui';
import {
	announceLiveStatus,
	createReorderGuidance,
	createRowControls,
	createRowMoveTargets,
	getRowRepresentativeText,
	HANDLE_ZONE_CLASS,
	scrollKeyboardDestinationIntoView,
	type ReorderGuidanceUi,
	type RowControlEntry,
	type RowMoveTargetsUi,
	stopRowControlInteractionPropagation,
} from './reorder-ui';
import {
	getMoveInsertionIndex,
	getNextValidRowMoveIndex,
	getRowMoveInsertionIndex,
	getValidRowMoveTargets,
	isNoopRowMove,
	isRowMoveAllowed,
	reorderRows,
	restoreOriginalRowOrder,
	type RowMoveDirection,
} from './row-order';
import { ensureSortableRuntime, type SortableInstance } from './sortable-runtime';

/** SortableJSのauto-scrollを開始する端からの距離。 */
const AUTO_SCROLL_SENSITIVITY_PX = 80;

/** SortableJSのauto-scroll速度。 */
const AUTO_SCROLL_SPEED_PX = 8;

/** drag完了直後に同じhandleへ発生するclickを単一ポインター開始として扱わない時間。 */
const DRAG_CLICK_SUPPRESSION_MS = 250;

/** Table Reorderが利用する操作方式。 */
export type ReorderInteractionMode = 'hover' | 'touch';

/** Toolbar focus要求の結果。 */
export type FocusRowControlResult = 'focused' | 'current-row-not-movable' | 'no-movable-rows';

/** React / Gutenberg統合層からcontrollerへ渡す設定。 */
export type SortableControllerOptions = {
	context: TableContext;
	forbiddenInsertionIndices: readonly number[];
	interactionMode: ReorderInteractionMode;
	nonMovableRowIndices: readonly number[];
	onCommit: ( reorderedRows: unknown[], focusRowIndex?: number ) => void;
	rows: readonly unknown[] | null;
	runtimeUrl: string;
};

/** React側へ公開するcontroller lifecycleの最小interface。 */
export type SortableController = {
	destroy: () => void;
	focusRowControl: () => FocusRowControlResult;
	focusRowControlAt: ( rowIndex: number ) => boolean;
};

/** SortableJSのonEndで利用するindex情報。 */
type SortableEventLike = {
	newIndex?: number;
	oldIndex?: number;
};

/** SortableJSのonChooseで利用するdrag対象要素。 */
type SortableChooseEventLike = {
	item: HTMLElement;
};

/** SortableJSのonMoveで利用する挿入位置情報。 */
type SortableMoveEventLike = {
	related: HTMLElement;
	willInsertAfter: boolean;
};

/** controllerがSortableJSへ渡すoptionsのうち、現在利用している項目。 */
type SortableOptions = {
	animation: number;
	bubbleScroll: boolean;
	draggable: string;
	forceFallback: boolean;
	handle: string;
	onChoose: ( event: SortableChooseEventLike ) => void;
	onEnd: ( event: SortableEventLike ) => void;
	onMove: ( event: SortableMoveEventLike, originalEvent: Event ) => boolean | void;
	onStart: () => void;
	onUnchoose: () => void;
	scroll: boolean;
	scrollSensitivity: number;
	scrollSpeed: number;
};

/** controllerが保持する排他的な並べ替え操作状態。 */
type ReorderSession =
	| { kind: 'idle' }
	| {
			kind: 'keyboard';
			currentIndex: number;
			entry: RowControlEntry;
			lastBoundaryDirection: RowMoveDirection | null;
			oldIndex: number;
			rowLabel: string;
			guidance: ReorderGuidanceUi;
	  }
	| {
			kind: 'pointer';
			entry: RowControlEntry;
			oldIndex: number;
			rowLabel: string;
			targetsUi: RowMoveTargetsUi;
	  }
	| { kind: 'dragging' };

/**
 * 解決済みTable contextと制約からSortableJS controllerを生成する。
 *
 * @param options controller生成に必要なcontext、制約、callback。
 * @return controller lifecycleとToolbar focus入口。
 */
export const createSortableController = (
	options: SortableControllerOptions
): SortableController => {
	const {
		context: { blockElement, document, tbody, window: view },
		forbiddenInsertionIndices,
		interactionMode,
		nonMovableRowIndices,
		onCommit,
		rows,
		runtimeUrl,
	} = options;
	const useHoverMode = interactionMode === 'hover';
	const insertionLine = createInsertionLine( document );
	const rowControls = createRowControls( document, tbody, nonMovableRowIndices, {
		showAll: ! useHoverMode,
	} );
	const entries = rowControls.entries;
	const entryByControl = new Map( entries.map( ( entry ) => [ entry.control, entry ] ) );
	const entryByRow = new Map< HTMLTableRowElement, RowControlEntry >(
		entries.map( ( entry ) => [ entry.row, entry ] )
	);
	const nonMovableRows = new Set( nonMovableRowIndices );
	const blockSelectionEvents = [ 'pointerdown', 'mousedown', 'click' ] as const;
	const getRowIndexFromElement = ( element: Element | null ): number | null => {
		const row = element?.closest< HTMLTableRowElement >( 'tr' ) ?? null;
		if ( ! row || row.parentElement !== tbody ) {
			return null;
		}

		const rowIndex = Array.from( tbody.rows ).indexOf( row );
		return rowIndex >= 0 ? rowIndex : null;
	};
	const constraints = {
		forbiddenInsertionIndices,
		nonMovableRowIndices,
		rowCount: rows?.length ?? tbody.rows.length,
	};

	let destroyed = false;
	let sortable: SortableInstance | null = null;
	let dragRows: HTMLTableRowElement[] | null = null;
	let draggedRowLabel: string | null = null;
	let activeEntry: RowControlEntry | null = null;
	let session: ReorderSession = { kind: 'idle' };
	let touchModeGuidance: ReorderGuidanceUi | null = useHoverMode
		? null
		: createReorderGuidance( document, tbody, getTouchModeMessage() );
	let lastActiveRowIndex: number | null = getRowIndexFromElement(
		tbody.ownerDocument.activeElement
	);
	let blockDragSuppressed = false;
	let originalDraggable: string | null = null;
	let suppressPointerClickUntil = 0;
	let restoreFallbackCellWidths: () => void = () => undefined;

	const announce = ( message: string ) => announceLiveStatus( document, message );
	const restoreFallbackWidths = () => {
		restoreFallbackCellWidths();
		restoreFallbackCellWidths = () => undefined;
	};
	const restoreDragRows = () => {
		if ( ! dragRows ) {
			return;
		}

		restoreOriginalRowOrder( tbody, dragRows );
		dragRows = null;
	};
	const suppressBlockDrag = () => {
		if ( blockDragSuppressed ) {
			return;
		}

		originalDraggable = blockElement.getAttribute( 'draggable' );
		blockElement.draggable = false;
		blockDragSuppressed = true;
	};
	const restoreBlockDrag = () => {
		if ( ! blockDragSuppressed ) {
			return;
		}

		if ( originalDraggable === null ) {
			blockElement.removeAttribute( 'draggable' );
		} else {
			blockElement.setAttribute( 'draggable', originalDraggable );
		}
		originalDraggable = null;
		blockDragSuppressed = false;
	};
	const activateEntry = ( entry: RowControlEntry ) => {
		if ( activeEntry && activeEntry !== entry ) {
			rowControls.setVisible( activeEntry, false );
		}
		activeEntry = entry;
		suppressBlockDrag();
		rowControls.setVisible( entry, true );
	};
	const deactivateEntry = ( entry: RowControlEntry ) => {
		const sessionEntry =
			session.kind === 'keyboard' || session.kind === 'pointer' ? session.entry : null;
		if ( ( session.kind === 'dragging' || sessionEntry === entry ) && activeEntry === entry ) {
			return;
		}

		if ( ! entry.control.matches( ':focus' ) ) {
			rowControls.setVisible( entry, false );
		}
		if ( activeEntry === entry ) {
			activeEntry = null;
			restoreBlockDrag();
		}
	};
	const releaseEntry = () => {
		if ( activeEntry && ! activeEntry.control.matches( ':focus' ) ) {
			rowControls.setVisible( activeEntry, false );
		}
		activeEntry = null;
		restoreBlockDrag();
	};
	const rememberRowFromEvent = ( event: Event ) => {
		const rowIndex = getRowIndexFromElement( event.target as Element | null );
		if ( rowIndex !== null ) {
			lastActiveRowIndex = rowIndex;
		}
	};
	const showKeyboardCandidate = (
		keyboardSession: Extract< ReorderSession, { kind: 'keyboard' } >
	) => {
		if ( keyboardSession.currentIndex === keyboardSession.oldIndex ) {
			insertionLine.hide();
			return;
		}

		const insertionIndex = getRowMoveInsertionIndex(
			keyboardSession.oldIndex,
			keyboardSession.currentIndex
		);
		if ( insertionIndex <= 0 ) {
			const firstRow = tbody.rows.item( 0 );
			if ( firstRow ) {
				insertionLine.show( firstRow, false );
			}
			return;
		}

		if ( insertionIndex >= tbody.rows.length ) {
			const lastRow = tbody.rows.item( tbody.rows.length - 1 );
			if ( lastRow ) {
				insertionLine.show( lastRow, true );
			}
			return;
		}

		const nextRow = tbody.rows.item( insertionIndex );
		if ( nextRow ) {
			insertionLine.show( nextRow, false );
		}
	};
	const finishKeyboardSession = ( commit: boolean ) => {
		if ( session.kind !== 'keyboard' ) {
			return;
		}
		const keyboardSession = session;

		keyboardSession.guidance.cleanup();
		insertionLine.hide();
		keyboardSession.entry.setPressed( false );
		session = { kind: 'idle' };
		releaseEntry();
		if (
			commit &&
			rows &&
			! isNoopRowMove( keyboardSession.oldIndex, keyboardSession.currentIndex ) &&
			isRowMoveAllowed( keyboardSession.oldIndex, keyboardSession.currentIndex, constraints )
		) {
			const reorderedRows = reorderRows(
				rows,
				keyboardSession.oldIndex,
				keyboardSession.currentIndex
			);
			if ( reorderedRows ) {
				announce(
					getMoveCommittedAnnouncement(
						keyboardSession.rowLabel,
						keyboardSession.oldIndex + 1,
						keyboardSession.currentIndex + 1
					)
				);
				onCommit( reorderedRows, keyboardSession.currentIndex );
				return;
			}
		}

		if ( ! commit ) {
			announce(
				getMoveCanceledAnnouncement( keyboardSession.rowLabel, keyboardSession.oldIndex + 1 )
			);
		}
		touchModeGuidance?.setHidden( false );
		keyboardSession.entry.control.focus();
	};
	const finishSinglePointerSession = ( newIndex?: number, announceCancellation = true ) => {
		if ( session.kind !== 'pointer' ) {
			return;
		}
		const pointerSession = session;

		pointerSession.targetsUi.cleanup();
		pointerSession.entry.setPressed( false );
		session = { kind: 'idle' };
		releaseEntry();

		if (
			newIndex !== undefined &&
			rows &&
			! isNoopRowMove( pointerSession.oldIndex, newIndex ) &&
			isRowMoveAllowed( pointerSession.oldIndex, newIndex, constraints )
		) {
			const reorderedRows = reorderRows( rows, pointerSession.oldIndex, newIndex );
			if ( reorderedRows ) {
				announce(
					getMoveCommittedAnnouncement(
						pointerSession.rowLabel,
						pointerSession.oldIndex + 1,
						newIndex + 1
					)
				);
				onCommit( reorderedRows, newIndex );
				return;
			}
		}

		if ( announceCancellation ) {
			announce(
				getMoveCanceledAnnouncement( pointerSession.rowLabel, pointerSession.oldIndex + 1 )
			);
		}
		touchModeGuidance?.setHidden( false );
		pointerSession.entry.control.focus();
	};
	const startSinglePointerSession = ( entry: RowControlEntry ) => {
		if ( session.kind !== 'idle' || ! rows ) {
			return;
		}

		const oldIndex = Array.from( tbody.rows ).indexOf( entry.row );
		if ( oldIndex < 0 || nonMovableRows.has( oldIndex ) ) {
			return;
		}

		const targets = getValidRowMoveTargets( oldIndex, constraints );
		if ( targets.length === 0 ) {
			entry.control.focus();
			return;
		}

		const rowLabel = getRowRepresentativeText( entry.row );
		activateEntry( entry );
		entry.setPressed( true );
		entry.control.focus();
		touchModeGuidance?.setHidden( true );
		const targetsUi = createRowMoveTargets( document, tbody, targets, {
			isTouch: ! useHoverMode,
			onCancel: () => finishSinglePointerSession(),
			onSelect: ( newIndex ) => finishSinglePointerSession( newIndex ),
			sourceControl: entry.control,
		} );
		session = { kind: 'pointer', entry, oldIndex, rowLabel, targetsUi };
		announce( getDestinationRequestedAnnouncement( rowLabel ) );
	};
	const onRowPointerEnter = ( event: PointerEvent ) => {
		if ( event.pointerType !== 'mouse' || session.kind !== 'idle' ) {
			return;
		}

		const entry = entryByRow.get( event.currentTarget as HTMLTableRowElement );
		if ( entry ) {
			activateEntry( entry );
		}
	};
	const onRowPointerLeave = ( event: PointerEvent ) => {
		if ( event.pointerType !== 'mouse' ) {
			return;
		}

		const entry = entryByRow.get( event.currentTarget as HTMLTableRowElement );
		if ( entry ) {
			deactivateEntry( entry );
		}
	};
	const onControlPointerDown = ( event: PointerEvent ) => {
		if ( event.pointerType !== 'mouse' || session.kind !== 'idle' ) {
			return;
		}

		const entry = entryByControl.get( event.currentTarget as HTMLButtonElement );
		if ( entry ) {
			activateEntry( entry );
			suppressBlockDrag();
		}
	};
	const onControlMouseDown = ( event: MouseEvent ) => {
		if ( event.button === 0 ) {
			event.preventDefault();
		}
	};
	const onControlClick = ( event: MouseEvent ) => {
		if ( event.detail === 0 || session.kind === 'keyboard' || session.kind === 'dragging' ) {
			return;
		}
		if ( view.performance.now() < suppressPointerClickUntil ) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}

		const entry = entryByControl.get( event.currentTarget as HTMLButtonElement );
		if ( ! entry ) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		if ( session.kind === 'pointer' && session.entry === entry ) {
			return;
		}
		startSinglePointerSession( entry );
	};
	const onControlFocus = ( event: FocusEvent ) => {
		const entry = entryByControl.get( event.currentTarget as HTMLButtonElement );
		if ( entry ) {
			lastActiveRowIndex = Array.from( tbody.rows ).indexOf( entry.row );
			rowControls.setVisible( entry, true );
		}
	};
	const onControlBlur = ( event: FocusEvent ) => {
		const entry = entryByControl.get( event.currentTarget as HTMLButtonElement );
		if ( entry && session.kind === 'keyboard' && session.entry === entry ) {
			queueMicrotask( () => {
				if ( ! destroyed && session.kind === 'keyboard' && session.entry === entry ) {
					entry.control.focus();
				}
			} );
			return;
		}
		if ( entry && useHoverMode && activeEntry !== entry ) {
			rowControls.setVisible( entry, false );
		}
	};
	const onControlKeyDown = ( event: KeyboardEvent ) => {
		const entry = entryByControl.get( event.currentTarget as HTMLButtonElement );
		if ( ! entry || session.kind === 'dragging' || session.kind === 'pointer' ) {
			return;
		}

		if ( event.repeat && ( event.key === 'Enter' || event.key === ' ' ) ) {
			return;
		}

		if ( session.kind === 'idle' ) {
			if ( event.key !== 'Enter' && event.key !== ' ' ) {
				return;
			}

			const rowIndex = Array.from( tbody.rows ).indexOf( entry.row );
			if ( rowIndex < 0 || nonMovableRows.has( rowIndex ) ) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			const rowLabel = getRowRepresentativeText( entry.row );
			activateEntry( entry );
			touchModeGuidance?.setHidden( true );
			entry.setPressed( true );
			const guidance = createReorderGuidance(
				document,
				tbody,
				getKeyboardActiveMessage(),
				entry.control
			);
			session = {
				kind: 'keyboard',
				currentIndex: rowIndex,
				entry,
				lastBoundaryDirection: null,
				oldIndex: rowIndex,
				rowLabel,
				guidance,
			};
			announce( getMoveStartedAnnouncement( rowLabel, rowIndex + 1, constraints.rowCount ) );
			entry.control.focus();
			return;
		}

		const keyboardSession = session;
		if ( keyboardSession.entry !== entry ) {
			return;
		}

		if ( event.key === 'Tab' ) {
			event.preventDefault();
			event.stopPropagation();
			entry.control.focus();
			return;
		}
		if ( event.key === 'Escape' ) {
			event.preventDefault();
			event.stopPropagation();
			finishKeyboardSession( false );
			return;
		}
		if ( event.key === 'Enter' || event.key === ' ' ) {
			event.preventDefault();
			event.stopPropagation();
			finishKeyboardSession( true );
			return;
		}
		if ( event.key !== 'ArrowUp' && event.key !== 'ArrowDown' ) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		const direction: RowMoveDirection = event.key === 'ArrowUp' ? 'up' : 'down';
		const nextIndex = getNextValidRowMoveIndex(
			keyboardSession.oldIndex,
			keyboardSession.currentIndex,
			direction,
			constraints
		);
		if ( nextIndex === null ) {
			if ( keyboardSession.lastBoundaryDirection !== direction ) {
				announce( getMoveBoundaryAnnouncement( keyboardSession.rowLabel, direction ) );
				keyboardSession.lastBoundaryDirection = direction;
			}
			return;
		}

		keyboardSession.currentIndex = nextIndex;
		keyboardSession.lastBoundaryDirection = null;
		showKeyboardCandidate( keyboardSession );
		announce(
			getDestinationChangedAnnouncement(
				keyboardSession.rowLabel,
				nextIndex + 1,
				constraints.rowCount
			)
		);
		const followingIndex = getNextValidRowMoveIndex(
			keyboardSession.oldIndex,
			nextIndex,
			direction,
			constraints
		);
		scrollKeyboardDestinationIntoView(
			view,
			tbody,
			getRowMoveInsertionIndex( keyboardSession.oldIndex, nextIndex ),
			direction,
			followingIndex === null
				? null
				: getRowMoveInsertionIndex( keyboardSession.oldIndex, followingIndex )
		);
	};
	const onDocumentKeyDown = ( event: KeyboardEvent ) => {
		if ( event.key === 'Escape' && useHoverMode && session.kind === 'pointer' ) {
			event.preventDefault();
			event.stopPropagation();
			finishSinglePointerSession();
		}
	};

	for ( const eventName of blockSelectionEvents ) {
		tbody.addEventListener( eventName, stopRowControlInteractionPropagation );
	}
	document.addEventListener( 'keydown', onDocumentKeyDown, true );
	tbody.addEventListener( 'focusin', rememberRowFromEvent );
	tbody.addEventListener( 'pointerdown', rememberRowFromEvent );
	for ( const entry of entries ) {
		entry.control.addEventListener( 'focus', onControlFocus );
		entry.control.addEventListener( 'blur', onControlBlur );
		entry.control.addEventListener( 'click', onControlClick );
		entry.control.addEventListener( 'keydown', onControlKeyDown );
		entry.control.addEventListener( 'pointerdown', onControlPointerDown );
		if ( useHoverMode ) {
			entry.control.addEventListener( 'mousedown', onControlMouseDown );
			entry.row.addEventListener( 'pointerenter', onRowPointerEnter );
			entry.row.addEventListener( 'pointerleave', onRowPointerLeave );
		}
	}

	if ( useHoverMode ) {
		const hoveredEntry = entries.find( ( entry ) => entry.row.matches( ':hover' ) );
		if ( hoveredEntry ) {
			activateEntry( hoveredEntry );
		}
	}

	void ensureSortableRuntime( document, view, runtimeUrl ).then( ( Sortable ) => {
		if ( destroyed || ! Sortable ) {
			return;
		}

		const sortableOptions: SortableOptions = {
			animation: 150,
			bubbleScroll: true,
			draggable: 'tr',
			forceFallback: true,
			handle: `.${ HANDLE_ZONE_CLASS }`,
			onChoose: ( event ) => {
				if ( session.kind !== 'keyboard' ) {
					insertionLine.hide();
				}
				dragRows = Array.from( tbody.rows );
				draggedRowLabel = getRowRepresentativeText( event.item as HTMLTableRowElement );
				restoreFallbackWidths();
				restoreFallbackCellWidths = fixFallbackRowCellWidths( event.item );
			},
			onStart: () => {
				if ( session.kind === 'keyboard' ) {
					return;
				}
				if ( session.kind === 'pointer' ) {
					finishSinglePointerSession( undefined, false );
				}
				insertionLine.hide();
				session = { kind: 'dragging' };
				suppressPointerClickUntil = Number.POSITIVE_INFINITY;
				suppressBlockDrag();
				if ( activeEntry ) {
					rowControls.setVisible( activeEntry, true );
				}
			},
			onMove: ( event ) => {
				if ( session.kind !== 'dragging' ) {
					if ( session.kind !== 'keyboard' ) {
						insertionLine.hide();
					}
					return false;
				}
				if ( ! dragRows ) {
					insertionLine.hide();
					return;
				}

				const insertionIndex = getMoveInsertionIndex(
					{
						insertAfter: event.willInsertAfter,
						relatedElement: event.related,
					},
					dragRows
				);
				if ( insertionIndex === null ) {
					insertionLine.hide();
					return;
				}

				if ( forbiddenInsertionIndices.includes( insertionIndex ) ) {
					insertionLine.hide();
					return false;
				}

				const relatedRow = event.related.closest< HTMLTableRowElement >( 'tr' );
				if ( ! relatedRow || relatedRow.parentElement !== tbody ) {
					insertionLine.hide();
					return;
				}

				insertionLine.show( relatedRow, event.willInsertAfter );
			},
			onEnd: ( event ) => {
				const completedDrag = session.kind === 'dragging';
				if ( completedDrag ) {
					insertionLine.hide();
					session = { kind: 'idle' };
				}
				if ( completedDrag ) {
					suppressPointerClickUntil = view.performance.now() + DRAG_CLICK_SUPPRESSION_MS;
				}
				restoreFallbackWidths();
				restoreDragRows();

				if ( completedDrag ) {
					if ( useHoverMode ) {
						const hoveredAfterDrag = entries.find( ( entry ) => entry.row.matches( ':hover' ) );
						if ( hoveredAfterDrag ) {
							activateEntry( hoveredAfterDrag );
						} else {
							releaseEntry();
						}
					} else {
						restoreBlockDrag();
					}
				}

				if ( ! completedDrag ) {
					draggedRowLabel = null;
					if ( session.kind === 'keyboard' ) {
						showKeyboardCandidate( session );
					}
					return;
				}

				const { oldIndex, newIndex } = event;
				if ( oldIndex === undefined || newIndex === undefined || ! rows ) {
					draggedRowLabel = null;
					return;
				}

				if (
					isNoopRowMove( oldIndex, newIndex ) ||
					! isRowMoveAllowed( oldIndex, newIndex, constraints )
				) {
					draggedRowLabel = null;
					return;
				}

				const reorderedRows = reorderRows( rows, oldIndex, newIndex );
				if ( reorderedRows ) {
					if ( draggedRowLabel ) {
						announce( getMoveCommittedAnnouncement( draggedRowLabel, oldIndex + 1, newIndex + 1 ) );
					}
					onCommit( reorderedRows );
				}
				draggedRowLabel = null;
			},
			onUnchoose: () => {
				if ( session.kind === 'keyboard' ) {
					showKeyboardCandidate( session );
				} else {
					insertionLine.hide();
				}
				if ( suppressPointerClickUntil === Number.POSITIVE_INFINITY ) {
					suppressPointerClickUntil = view.performance.now() + DRAG_CLICK_SUPPRESSION_MS;
				}
				restoreFallbackWidths();
			},
			scroll: true,
			scrollSensitivity: AUTO_SCROLL_SENSITIVITY_PX,
			scrollSpeed: AUTO_SCROLL_SPEED_PX,
		};

		const createdSortable = Sortable.create( tbody, sortableOptions );
		if ( destroyed ) {
			createdSortable.destroy();
			return;
		}
		sortable = createdSortable;
	} );

	const focusRowControlAt = ( rowIndex: number ): boolean => {
		const row = tbody.rows.item( rowIndex );
		const entry = row ? entryByRow.get( row ) : undefined;
		if ( ! entry ) {
			return false;
		}

		lastActiveRowIndex = rowIndex;
		rowControls.setVisible( entry, true );
		entry.control.focus();
		return true;
	};

	return {
		focusRowControl: () => {
			if ( entries.length === 0 ) {
				announce( getNoMovableRowsAnnouncement() );
				return 'no-movable-rows';
			}

			const activeRowIndex = getRowIndexFromElement( tbody.ownerDocument.activeElement );
			if ( activeRowIndex !== null ) {
				lastActiveRowIndex = activeRowIndex;
			}

			if ( lastActiveRowIndex !== null ) {
				if ( nonMovableRows.has( lastActiveRowIndex ) ) {
					const row = tbody.rows.item( lastActiveRowIndex );
					if ( row ) {
						announce( getRowspanBlockedAnnouncement( getRowRepresentativeText( row ) ) );
					}
					return 'current-row-not-movable';
				}
				if ( focusRowControlAt( lastActiveRowIndex ) ) {
					return 'focused';
				}
			}

			focusRowControlAt( Array.from( tbody.rows ).indexOf( entries[ 0 ].row ) );
			return 'focused';
		},
		focusRowControlAt,
		destroy: () => {
			if ( destroyed ) {
				return;
			}

			destroyed = true;
			if ( session.kind === 'keyboard' ) {
				session.entry.setPressed( false );
				session.guidance.cleanup();
			} else if ( session.kind === 'pointer' ) {
				announce( getMoveCanceledAnnouncement( session.rowLabel, session.oldIndex + 1 ) );
				session.targetsUi.cleanup();
				session.entry.setPressed( false );
			}
			session = { kind: 'idle' };
			touchModeGuidance?.cleanup();
			touchModeGuidance = null;
			sortable?.destroy();
			sortable = null;
			insertionLine.cleanup();
			restoreFallbackWidths();
			document.removeEventListener( 'keydown', onDocumentKeyDown, true );
			for ( const entry of entries ) {
				entry.control.removeEventListener( 'focus', onControlFocus );
				entry.control.removeEventListener( 'blur', onControlBlur );
				entry.control.removeEventListener( 'click', onControlClick );
				entry.control.removeEventListener( 'keydown', onControlKeyDown );
				entry.control.removeEventListener( 'pointerdown', onControlPointerDown );
				if ( useHoverMode ) {
					entry.control.removeEventListener( 'mousedown', onControlMouseDown );
					entry.row.removeEventListener( 'pointerenter', onRowPointerEnter );
					entry.row.removeEventListener( 'pointerleave', onRowPointerLeave );
				}
			}
			for ( const eventName of blockSelectionEvents ) {
				tbody.removeEventListener( eventName, stopRowControlInteractionPropagation );
			}
			tbody.removeEventListener( 'focusin', rememberRowFromEvent );
			tbody.removeEventListener( 'pointerdown', rememberRowFromEvent );
			restoreDragRows();
			releaseEntry();
			rowControls.cleanup();
		},
	};
};
