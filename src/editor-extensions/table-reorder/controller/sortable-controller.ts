/**
 * Table ReorderのSortableJS instanceとdrag session lifecycleを管理する。
 *
 * SortableJS callbacks、drag session state、行control制御、DOM所有権handoff、cleanupを集約する。
 * touch pressのpointer追跡は`touch-press.ts`へ委譲し、React / Gutenberg統合層とは狭いcallback境界で接続する。
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
	HANDLE_ZONE_CLASS,
	type RowControlEntry,
	stopRowControlInteractionPropagation,
} from './reorder-ui';
import {
	getMoveInsertionIndex,
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
	onCommit: ( reorderedRows: unknown[] ) => void;
	onNonMovableRowLongPress: () => void;
	onRequestTouchModeExit: () => void;
	rows: readonly unknown[] | null;
	runtimeUrl: string;
};

/** React側へ公開するcontroller lifecycleの最小interface。 */
export type SortableController = {
	destroy: () => void;
	focusRowControl: () => FocusRowControlResult;
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

	let destroyed = false;
	let sortable: SortableInstance | null = null;
	let dragRows: HTMLTableRowElement[] | null = null;
	let activeEntry: RowControlEntry | null = null;
	let lastActiveRowIndex: number | null = getRowIndexFromElement(
		tbody.ownerDocument.activeElement
	);
	let isDragging = false;
	let blockDragSuppressed = false;
	let originalDraggable: string | null = null;
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
		if ( isDragging && activeEntry === entry ) {
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
	const onRowPointerEnter = ( event: PointerEvent ) => {
		if ( event.pointerType !== 'mouse' || isDragging ) {
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
		if ( event.pointerType !== 'mouse' ) {
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
	const onControlFocus = ( event: FocusEvent ) => {
		const entry = entryByControl.get( event.currentTarget as HTMLButtonElement );
		if ( entry ) {
			lastActiveRowIndex = Array.from( tbody.rows ).indexOf( entry.row );
			rowControls.setVisible( entry, true );
		}
	};
	const onControlBlur = ( event: FocusEvent ) => {
		const entry = entryByControl.get( event.currentTarget as HTMLButtonElement );
		if ( entry && useHoverMode && activeEntry !== entry ) {
			rowControls.setVisible( entry, false );
		}
	};

	for ( const eventName of blockSelectionEvents ) {
		tbody.addEventListener( eventName, stopRowControlInteractionPropagation );
	}
	tbody.addEventListener( 'focusin', rememberRowFromEvent );
	tbody.addEventListener( 'pointerdown', rememberRowFromEvent );
	for ( const entry of entries ) {
		entry.control.addEventListener( 'focus', onControlFocus );
		entry.control.addEventListener( 'blur', onControlBlur );
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
				insertionLine.hide();
				isDragging = true;
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

				const constraints = {
					forbiddenInsertionIndices,
					nonMovableRowIndices,
					rowCount: rows.length,
				};
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

				const currentRow = tbody.rows.item( lastActiveRowIndex );
				const currentEntry = currentRow ? entryByRow.get( currentRow ) : undefined;
				if ( currentEntry ) {
					rowControls.setVisible( currentEntry, true );
					currentEntry.control.focus();
					return 'focused';
				}
			}

			rowControls.setVisible( entries[ 0 ], true );
			entries[ 0 ].control.focus();
			return 'focused';
		},
		destroy: () => {
			if ( destroyed ) {
				return;
			}

			destroyed = true;
			sortable?.destroy();
			sortable = null;
			insertionLine.cleanup();
			touchPressTracker?.destroy();
			restoreFallbackWidths();
			for ( const entry of entries ) {
				entry.control.removeEventListener( 'focus', onControlFocus );
				entry.control.removeEventListener( 'blur', onControlBlur );
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