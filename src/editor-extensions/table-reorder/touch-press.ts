/**
 * Table Reorderのtouch press追跡を管理する。
 *
 * touch / pen pointerのpress状態、長押しtimer、移動threshold、短いtap判定を所有する。
 * SortableJS lifecycleやReact stateは扱わず、結果は狭いcallbackで呼び出し元へ通知する。
 */

/** touch modeでdrag開始と長押し通知に使う待機時間。 */
export const TOUCH_DRAG_DELAY_MS = 300;

/** touch pressをtapではなく移動として扱う距離。 */
export const TOUCH_START_THRESHOLD_PX = 5;

/** touch press trackerが呼び出し元から受け取る設定。 */
export type TouchPressTrackerOptions = {
	isDragging: () => boolean;
	nonMovableRowIndices: readonly number[];
	onNonMovableRowLongPress: () => void;
	onRequestTouchModeExit: () => void;
	tbody: HTMLTableSectionElement;
	view: Window;
};

/** touch press trackerのcleanup境界。 */
export type TouchPressTracker = {
	destroy: () => void;
};

/** pointerdownからpointerup / cancelまで保持するpress情報。 */
type TouchPress = {
	longPressReached: boolean;
	moved: boolean;
	noticeTimer: number | null;
	pointerId: number;
	startX: number;
	startY: number;
	startedAt: number;
};

/**
 * tbody上のtouch pressを追跡し、長押し警告と短いtapをcallbackへ変換する。
 *
 * trackerはpointer listenerと長押しtimerを所有し、`destroy()`で必ず解除する。
 * 移動不可行の長押しでは警告callbackを呼び、dragが始まらない短いtapでは
 * touch並び替えモード終了callbackを呼ぶ。
 *
 * @param options touch press追跡に必要なDOM、状態参照、callback。
 */
export const createTouchPressTracker = ( options: TouchPressTrackerOptions ): TouchPressTracker => {
	const {
		isDragging,
		nonMovableRowIndices,
		onNonMovableRowLongPress,
		onRequestTouchModeExit,
		tbody,
		view,
	} = options;
	const nonMovableRows = new Set( nonMovableRowIndices );
	let touchPress: TouchPress | null = null;

	const clearNoticeTimer = () => {
		if ( touchPress?.noticeTimer !== null && touchPress?.noticeTimer !== undefined ) {
			view.clearTimeout( touchPress.noticeTimer );
			touchPress.noticeTimer = null;
		}
	};
	const resetTouchPress = () => {
		clearNoticeTimer();
		touchPress = null;
	};
	const onPointerDown = ( event: PointerEvent ) => {
		if ( event.pointerType === 'mouse' ) {
			return;
		}

		const target = event.target as Element | null;
		const row = target?.closest< HTMLTableRowElement >( 'tr' ) ?? null;
		if ( ! row || row.parentElement !== tbody ) {
			return;
		}

		const rowIndex = Array.from( tbody.rows ).indexOf( row );
		if ( rowIndex < 0 ) {
			return;
		}

		resetTouchPress();
		touchPress = {
			longPressReached: false,
			moved: false,
			noticeTimer: null,
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			startedAt: view.performance.now(),
		};

		if ( nonMovableRows.has( rowIndex ) ) {
			touchPress.noticeTimer = view.setTimeout( () => {
				if ( ! touchPress || touchPress.moved ) {
					return;
				}

				touchPress.longPressReached = true;
				onNonMovableRowLongPress();
			}, TOUCH_DRAG_DELAY_MS );
		}
	};
	const onPointerMove = ( event: PointerEvent ) => {
		if ( ! touchPress || event.pointerId !== touchPress.pointerId ) {
			return;
		}

		const movedDistance = Math.hypot(
			event.clientX - touchPress.startX,
			event.clientY - touchPress.startY
		);
		if ( movedDistance > TOUCH_START_THRESHOLD_PX ) {
			touchPress.moved = true;
			clearNoticeTimer();
		}
	};
	const onPointerUp = ( event: PointerEvent ) => {
		if ( ! touchPress || event.pointerId !== touchPress.pointerId ) {
			return;
		}

		const pressDuration = view.performance.now() - touchPress.startedAt;
		const shouldExitReorderMode =
			! touchPress.moved &&
			! touchPress.longPressReached &&
			! isDragging() &&
			pressDuration < TOUCH_DRAG_DELAY_MS;
		resetTouchPress();

		if ( shouldExitReorderMode ) {
			onRequestTouchModeExit();
		}
	};
	const onPointerCancel = ( event: PointerEvent ) => {
		if ( touchPress && event.pointerId === touchPress.pointerId ) {
			resetTouchPress();
		}
	};

	tbody.addEventListener( 'pointerdown', onPointerDown );
	tbody.addEventListener( 'pointermove', onPointerMove );
	tbody.addEventListener( 'pointerup', onPointerUp );
	tbody.addEventListener( 'pointercancel', onPointerCancel );

	return {
		destroy: () => {
			resetTouchPress();
			tbody.removeEventListener( 'pointerdown', onPointerDown );
			tbody.removeEventListener( 'pointermove', onPointerMove );
			tbody.removeEventListener( 'pointerup', onPointerUp );
			tbody.removeEventListener( 'pointercancel', onPointerCancel );
		},
	};
};
