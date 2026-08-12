/**
 * Table ReorderのSortableJS instanceとdrag session lifecycleを管理する。
 *
 * SortableJS callbacks、drag session state、keyboard / single-pointer session、行control制御、
 * DOM所有権handoff、cleanupを集約する。touch pressのpointer追跡は`touch-press.ts`へ委譲し、
 * React / Gutenberg統合層とは狭いcallback境界で接続する。
 * UI描画やReact state自体は扱わず、drag中にSortableJSが変更する行DOMはcommit前またはdestroy時に元へ戻す。
 */

import {
	createInsertionLine,
	createTouchDragUi,
	fixFallbackRowCellWidths,
	NON_MOVABLE_ROW_CLASS,
	TOUCH_CHOSEN_CLASS,
} from './drag-ui';
import {
	createRowControls,
	createRowMoveTargets,
	HANDLE_ZONE_CLASS,
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
} from './row-order';
import { ensureSortableRuntime, type SortableInstance } from './sortable-runtime';
import type { TableContext } from '../table-context';
import {
	createTouchPressTracker,
	TOUCH_DRAG_DELAY_MS,
	TOUCH_START_THRESHOLD_PX,
} from './touch-press';

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
	onNonMovableRowLongPress: () => void;
	onRequestTouchModeExit: () => void;
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
	chosenClass?: string;
	delay?: number;
	draggable: string;
	forceFallback: boolean;
	handle?: string;
	onChoose: ( event: SortableChooseEventLike ) => void;
	onEnd: ( event: SortableEventLike ) => void;
	onMove: ( event: SortableMoveEventLike, originalEvent: Event ) => boolean | void;
	onStart: () => void;
	onUnchoose: () => void;
	scroll: boolean;
	scrollSensitivity: number;
	scrollSpeed: number;
	touchStartThreshold?: number;
};

/** キーボード並べ替え中だけ保持する一時状態。 */
type KeyboardSession = {
	currentIndex: number;
	entry: RowControlEntry;
	oldIndex: number;
};

/** 単一ポインターで移動先を選択中だけ保持する一時状態。 */
type SinglePointerSession = {
	entry: RowControlEntry;
	oldIndex: number;
	targetsUi: RowMoveTargetsUi;
};

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
		onNonMovableRowLongPress,
		onRequestTouchModeExit,
		rows,
		runtimeUrl,
	} = options;
	const useHoverMode = interactionMode === 'hover';
	const insertionLine = createInsertionLine( document );
	const rowControls = createRowControls( document, tbody, nonMovableRowIndices, {
		showAll: ! useHoverMode,
	} );
	const touchDragUi = useHoverMode
		? null
		: createTouchDragUi( document, tbody, nonMovableRowIndices );
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
	let activeEntry: RowControlEntry | null = null;
	let keyboardSession: KeyboardSession | null = null;
	let singlePointerSession: SinglePointerSession | null = null;
	let lastActiveRowIndex: number | null = getRowIndexFromElement(
		tbody.ownerDocument.activeElement
	);
	let isDragging = false;
	let blockDragSuppressed = false;
	let originalDraggable: string | null = null;
	let suppressPointerClickUntil = 0;
	let restoreFallbackCellWidths: () => void = () => undefined;

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
		if (
			( isDragging || keyboardSession?.entry === entry || singlePointerSession?.entry === entry ) &&
			activeEntry === entry
		) {
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
		isDragging = false;
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
	const showKeyboardCandidate = ( session: KeyboardSession ) => {
		if ( session.currentIndex === session.oldIndex ) {
			insertionLine.hide();
			return;
		}

		const insertionIndex = getRowMoveInsertionIndex( session.oldIndex, session.currentIndex );
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
		const session = keyboardSession;
		if ( ! session ) {
			return;
		}

		keyboardSession = null;
		insertionLine.hide();
		releaseEntry();
		if (
			commit &&
			rows &&
			! isNoopRowMove( session.oldIndex, session.currentIndex ) &&
			isRowMoveAllowed( session.oldIndex, session.currentIndex, constraints )
		) {
			const reorderedRows = reorderRows( rows, session.oldIndex, session.currentIndex );
			if ( reorderedRows ) {
				onCommit( reorderedRows, session.currentIndex );
				return;
			}
		}

		session.entry.control.focus();
	};
	const finishSinglePointerSession = ( newIndex?: number ) => {
		const session = singlePointerSession;
		if ( ! session ) {
			return;
		}

		singlePointerSession = null;
		session.targetsUi.cleanup();
		session.entry.setPressed( false );
		releaseEntry();

		if (
			newIndex !== undefined &&
			rows &&
			! isNoopRowMove( session.oldIndex, newIndex ) &&
			isRowMoveAllowed( session.oldIndex, newIndex, constraints )
		) {
			const reorderedRows = reorderRows( rows, session.oldIndex, newIndex );
			if ( reorderedRows ) {
				onCommit( reorderedRows, newIndex );
				return;
			}
		}

		session.entry.control.focus();
	};
	const startSinglePointerSession = ( entry: RowControlEntry ) => {
		if ( isDragging || keyboardSession || singlePointerSession || ! rows ) {
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

		activateEntry( entry );
		entry.setPressed( true );
		entry.control.focus();
		const targetsUi = createRowMoveTargets( document, tbody, targets, {
			isTouch: ! useHoverMode,
			onCancel: () => finishSinglePointerSession(),
			onSelect: ( newIndex ) => finishSinglePointerSession( newIndex ),
		} );
		singlePointerSession = { entry, oldIndex, targetsUi };
	};
	const onRowPointerEnter = ( event: PointerEvent ) => {
		if ( event.pointerType !== 'mouse' || isDragging || keyboardSession || singlePointerSession ) {
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
		if ( event.pointerType !== 'mouse' || keyboardSession || singlePointerSession ) {
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
		if ( event.detail === 0 || keyboardSession || isDragging ) {
			return;
		}
		if ( useHoverMode && view.performance.now() < suppressPointerClickUntil ) {
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
		if ( singlePointerSession?.entry === entry ) {
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
		if ( entry && keyboardSession?.entry === entry ) {
			queueMicrotask( () => {
				if ( ! destroyed && keyboardSession?.entry === entry ) {
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
		if ( ! entry || isDragging || singlePointerSession ) {
			return;
		}

		if ( event.repeat && ( event.key === 'Enter' || event.key === ' ' ) ) {
			return;
		}

		if ( ! keyboardSession ) {
			if ( event.key !== 'Enter' && event.key !== ' ' ) {
				return;
			}

			const rowIndex = Array.from( tbody.rows ).indexOf( entry.row );
			if ( rowIndex < 0 || nonMovableRows.has( rowIndex ) ) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			activateEntry( entry );
			keyboardSession = {
				currentIndex: rowIndex,
				entry,
				oldIndex: rowIndex,
			};
			entry.control.focus();
			return;
		}

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
		const nextIndex = getNextValidRowMoveIndex(
			keyboardSession.oldIndex,
			keyboardSession.currentIndex,
			event.key === 'ArrowUp' ? 'up' : 'down',
			constraints
		);
		if ( nextIndex === null ) {
			return;
		}

		keyboardSession.currentIndex = nextIndex;
		showKeyboardCandidate( keyboardSession );
	};
	const onDocumentKeyDown = ( event: KeyboardEvent ) => {
		if ( event.key === 'Escape' && useHoverMode && singlePointerSession ) {
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

	const touchPressTracker = useHoverMode
		? null
		: createTouchPressTracker( {
				isDragging: () => isDragging,
				nonMovableRowIndices,
				onNonMovableRowLongPress,
				onRequestTouchModeExit,
				tbody,
				view,
		  } );

	void ensureSortableRuntime( document, view, runtimeUrl ).then( ( Sortable ) => {
		if ( destroyed || ! Sortable ) {
			return;
		}

		const sortableOptions: SortableOptions = {
			animation: 150,
			bubbleScroll: true,
			draggable: useHoverMode ? 'tr' : `tr:not(.${ NON_MOVABLE_ROW_CLASS })`,
			forceFallback: true,
			onChoose: ( event ) => {
				insertionLine.hide();
				dragRows = Array.from( tbody.rows );
				restoreFallbackWidths();
				restoreFallbackCellWidths = fixFallbackRowCellWidths( event.item );
			},
			onStart: () => {
				if ( singlePointerSession ) {
					finishSinglePointerSession();
				}
				insertionLine.hide();
				isDragging = true;
				suppressPointerClickUntil = Number.POSITIVE_INFINITY;
				suppressBlockDrag();
				if ( activeEntry ) {
					rowControls.setVisible( activeEntry, true );
				}
			},
			onMove: ( event ) => {
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
				insertionLine.hide();
				isDragging = false;
				suppressPointerClickUntil = view.performance.now() + DRAG_CLICK_SUPPRESSION_MS;
				restoreFallbackWidths();
				restoreDragRows();

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

				const { oldIndex, newIndex } = event;
				if ( oldIndex === undefined || newIndex === undefined || ! rows ) {
					return;
				}

				if (
					isNoopRowMove( oldIndex, newIndex ) ||
					! isRowMoveAllowed( oldIndex, newIndex, constraints )
				) {
					return;
				}

				const reorderedRows = reorderRows( rows, oldIndex, newIndex );
				if ( reorderedRows ) {
					onCommit( reorderedRows );
				}
			},
			onUnchoose: () => {
				insertionLine.hide();
				suppressPointerClickUntil = view.performance.now() + DRAG_CLICK_SUPPRESSION_MS;
				restoreFallbackWidths();
			},
			scroll: true,
			scrollSensitivity: AUTO_SCROLL_SENSITIVITY_PX,
			scrollSpeed: AUTO_SCROLL_SPEED_PX,
		};

		if ( useHoverMode ) {
			sortableOptions.handle = `.${ HANDLE_ZONE_CLASS }`;
		} else {
			sortableOptions.chosenClass = TOUCH_CHOSEN_CLASS;
			sortableOptions.delay = TOUCH_DRAG_DELAY_MS;
			sortableOptions.touchStartThreshold = TOUCH_START_THRESHOLD_PX;
		}

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
				return 'no-movable-rows';
			}

			const activeRowIndex = getRowIndexFromElement( tbody.ownerDocument.activeElement );
			if ( activeRowIndex !== null ) {
				lastActiveRowIndex = activeRowIndex;
			}

			if ( lastActiveRowIndex !== null ) {
				if ( nonMovableRows.has( lastActiveRowIndex ) ) {
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
			keyboardSession = null;
			if ( singlePointerSession ) {
				singlePointerSession.targetsUi.cleanup();
				singlePointerSession.entry.setPressed( false );
				singlePointerSession = null;
			}
			sortable?.destroy();
			sortable = null;
			insertionLine.cleanup();
			touchPressTracker?.destroy();
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
			touchDragUi?.cleanup();
		},
	};
};
