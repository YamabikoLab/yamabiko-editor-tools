/**
 * Table ReorderのSortableJS instanceとdrag session lifecycleを管理する。
 *
 * SortableJS callbacks、drag session state、hover handle制御、DOM所有権handoff、cleanupを集約する。
 * touch pressのpointer追跡は`touch-press.ts`へ委譲し、React / Gutenberg統合層とは狭いcallback境界で接続する。
 * UI描画やReact state自体は扱わず、drag中にSortableJSが変更する行DOMはcommit前またはdestroy時に元へ戻す。
 */

import {
	createHoverHandles,
	createInsertionLine,
	createTouchDragUi,
	fixFallbackRowCellWidths,
	HANDLE_ZONE_CLASS,
	type HoverHandleEntry,
	NON_MOVABLE_ROW_CLASS,
	stopHoverHandleInteractionPropagation,
	TOUCH_CHOSEN_CLASS,
} from './drag-ui';
import {
	getEndInsertionIndex,
	getMoveInsertionIndex,
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
 * controllerはSortableJS instance、drag callbacks、hover listener、一時DOM装飾、fallback style、
 * Gutenberg block drag抑止を所有する。touch press listenerとtimerは専用trackerへ委譲し、
 * `destroy()`から同じcleanup境界で破棄する。runtime読み込み完了前に`destroy()`された場合は、
 * 遅れて読み込みが完了しても古いSortableJS instanceを生成しない。
 *
 * @param options controller生成に必要なcontext、制約、callback。
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
	const hoverHandles = useHoverMode
		? createHoverHandles( document, tbody, nonMovableRowIndices )
		: null;
	const touchDragUi = useHoverMode
		? null
		: createTouchDragUi( document, tbody, nonMovableRowIndices );
	const entries = hoverHandles?.entries ?? [];
	const entryByZone = new Map( entries.map( ( entry ) => [ entry.zone, entry ] ) );
	const entryByRow = new Map< HTMLTableRowElement, HoverHandleEntry >();
	for ( const entry of entries ) {
		const row = entry.zone.closest< HTMLTableRowElement >( 'tr' );
		if ( row ) {
			entryByRow.set( row, entry );
		}
	}
	const blockSelectionEvents = [ 'pointerdown', 'mousedown', 'click' ] as const;

	let destroyed = false;
	let sortable: SortableInstance | null = null;
	let dragRows: HTMLTableRowElement[] | null = null;
	let activeEntry: HoverHandleEntry | null = null;
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
	const activateEntry = ( entry: HoverHandleEntry ) => {
		if ( ! hoverHandles ) {
			return;
		}

		if ( activeEntry && activeEntry !== entry ) {
			hoverHandles.setVisible( activeEntry, false );
		}
		activeEntry = entry;
		suppressBlockDrag();
		hoverHandles.setVisible( entry, true );
	};
	const deactivateEntry = ( entry: HoverHandleEntry ) => {
		if ( isDragging && activeEntry === entry ) {
			return;
		}

		hoverHandles?.setVisible( entry, false );
		if ( activeEntry === entry ) {
			activeEntry = null;
			restoreBlockDrag();
		}
	};
	const releaseEntry = () => {
		isDragging = false;
		if ( activeEntry ) {
			hoverHandles?.setVisible( activeEntry, false );
		}
		activeEntry = null;
		restoreBlockDrag();
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
	const onZonePointerDown = ( event: PointerEvent ) => {
		if ( event.pointerType !== 'mouse' ) {
			return;
		}

		const entry = entryByZone.get( event.currentTarget as HTMLElement );
		if ( entry ) {
			activateEntry( entry );
		}
	};

	for ( const eventName of blockSelectionEvents ) {
		tbody.addEventListener( eventName, stopHoverHandleInteractionPropagation );
	}
	if ( useHoverMode ) {
		for ( const [ row, entry ] of entryByRow ) {
			row.addEventListener( 'pointerenter', onRowPointerEnter );
			row.addEventListener( 'pointerleave', onRowPointerLeave );
			entry.zone.addEventListener( 'pointerdown', onZonePointerDown );
		}

		const hoveredEntry = entries.find( ( entry ) =>
			entry.zone.closest< HTMLTableRowElement >( 'tr' )?.matches( ':hover' )
		);
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
					hoverHandles?.setVisible( activeEntry, true );
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
					const hoveredAfterDrag = entries.find( ( entry ) =>
						entry.zone.closest< HTMLTableRowElement >( 'tr' )?.matches( ':hover' )
					);
					if ( hoveredAfterDrag ) {
						activateEntry( hoveredAfterDrag );
					} else {
						releaseEntry();
					}
				} else {
					restoreBlockDrag();
				}

				const { oldIndex, newIndex } = event;
				if ( oldIndex === undefined || newIndex === undefined || oldIndex === newIndex ) {
					return;
				}
				if ( ! rows ) {
					return;
				}

				const insertionIndex = getEndInsertionIndex( oldIndex, newIndex );
				if (
					nonMovableRowIndices.includes( oldIndex ) ||
					forbiddenInsertionIndices.includes( insertionIndex )
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
			if ( useHoverMode ) {
				for ( const [ row, entry ] of entryByRow ) {
					row.removeEventListener( 'pointerenter', onRowPointerEnter );
					row.removeEventListener( 'pointerleave', onRowPointerLeave );
					entry.zone.removeEventListener( 'pointerdown', onZonePointerDown );
				}
			}
			for ( const eventName of blockSelectionEvents ) {
				tbody.removeEventListener( eventName, stopHoverHandleInteractionPropagation );
			}
			restoreDragRows();
			releaseEntry();
			hoverHandles?.cleanup();
			touchDragUi?.cleanup();
		},
	};
};