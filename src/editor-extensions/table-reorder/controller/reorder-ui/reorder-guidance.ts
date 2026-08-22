import { createElement, createRoot } from '@wordpress/element';
import { chevronUpDown, dragHandle, Icon } from '@wordpress/icons';

import {
	getKeyboardActiveMessage,
	getPcPointerActiveMessage,
	getTouchModeMessage,
	getTouchPointerActiveMessage,
} from '../../messages';

/** 操作中の案内に付与するclass。 */
const GUIDANCE_CLASS = 'yamabiko-table-reorder-pointer-guidance';

/** 操作中案内の非表示状態に付与するclass。 */
const GUIDANCE_HIDDEN_CLASS = 'is-hidden';

/** 操作中案内の内容補助iconに付与するclass。 */
const GUIDANCE_ICON_CLASS = 'yamabiko-table-reorder-guidance-icon';

/** keyboard scroll追従でviewport端に確保する最小余白。 */
const KEYBOARD_SCROLL_MARGIN_PX = 24;

/** 操作案内をviewport端から離す余白。 */
const GUIDANCE_VIEWPORT_OFFSET_PX = 8;

/** Touch操作中案内をpointer位置から離す距離。 */
const TOUCH_GUIDANCE_POINTER_OFFSET_PX = 16;

/** PC / keyboardの上側案内をGutenberg headerから離す距離。 */
const RIGHT_GUIDANCE_TOP_PX = 64;

/** Touchの微小な揺れをswipe方向の変更として扱わない距離。 */
const TOUCH_SWIPE_DIRECTION_THRESHOLD_PX = 8;

/** 操作中案内を表示するviewport側。 */
type ReorderGuidancePosition = 'top' | 'bottom';

/** 操作中案内のlifecycle。 */
export type ReorderGuidanceUi = {
	element: HTMLDivElement;
	setHidden: ( isHidden: boolean ) => void;
	cleanup: () => void;
};

/**
 * 案内文の意味に対応するWordPress標準iconを返す。
 *
 * @param message 表示する案内文。
 * @return 内容補助icon。対象外の案内文ではnull。
 */
const getGuidanceIcon = ( message: string ) => {
	if ( message === getTouchModeMessage() ) {
		return dragHandle;
	}
	if (
		message === getKeyboardActiveMessage() ||
		message === getPcPointerActiveMessage() ||
		message === getTouchPointerActiveMessage()
	) {
		return chevronUpDown;
	}
	return null;
};

/**
 * Touch swipe方向へ追従する案内文かを返す。
 *
 * @param message 表示する案内文。
 * @return Touch swipe方向へ追従する場合はtrue。
 */
const isTouchSwipeGuidance = ( message: string ) =>
	message === getTouchModeMessage() || message === getTouchPointerActiveMessage();

/**
 * viewport右側へ固定する案内文かを返す。
 *
 * Toolbarとの座標比較は行わず、PC / keyboardの操作中案内だけを常に右側へ配置する。
 *
 * @param message 表示する案内文。
 * @return 右側へ固定する場合はtrue。
 */
const isRightAlignedGuidance = ( message: string ) =>
	message === getKeyboardActiveMessage() || message === getPcPointerActiveMessage();

/**
 * Touch案内生成時にfocusされている操作要素の中央Y座標を返す。
 *
 * row control tap直後などpointer eventが終了してから案内を生成する場合の初期位置に利用する。
 *
 * @param document 案内を生成するeditor document。
 * @return focus要素の中央Y座標。利用できない場合はnull。
 */
const getFocusedTouchAnchorY = ( document: Document ): number | null => {
	const activeElement = document.activeElement;
	if ( ! activeElement || activeElement === document.body ) {
		return null;
	}

	const rect = activeElement.getBoundingClientRect();
	if ( rect.height <= 0 ) {
		return null;
	}

	return rect.top + rect.height / 2;
};

/**
 * Tableに関連付く操作中案内をowning documentへ追加する。
 *
 * fixed配置でスクロール中も確認できる状態を保つ。既定はviewport上側で、keyboard入力時は
 * ArrowUpなら下側、ArrowDownなら上側へ切り替える。Touch案内ではpointer位置付近へ表示し、
 * 一定距離以上のswipeを検出したとき、上方向ならpointerの上側、下方向なら下側へ切り替え、
 * 反対方向を検出するまで維持する。PC / keyboardの操作中案内はToolbar位置を計算せず
 * viewport右側へ固定する。対象Tableがeditorの実表示領域から完全に外れた場合は案内を隠し、
 * 戻ると再表示する。
 *
 * @param document 案内を生成するeditor document。
 * @param tbody    対象Table body。
 * @param message  表示する案内文。
 * @return 案内のlifecycle。
 */
export const createReorderGuidance = (
	document: Document,
	tbody: HTMLTableSectionElement,
	message: string
): ReorderGuidanceUi => {
	const view = document.defaultView;
	const table = tbody.closest( 'table' );
	const guidanceTarget = table ?? tbody;
	const guidance = document.createElement( 'div' );
	guidance.className = GUIDANCE_CLASS;
	guidance.contentEditable = 'false';
	const icon = getGuidanceIcon( message );
	let iconRoot: ReturnType< typeof createRoot > | null = null;
	if ( icon ) {
		const iconContainer = document.createElement( 'span' );
		iconContainer.className = GUIDANCE_ICON_CLASS;
		iconContainer.setAttribute( 'aria-hidden', 'true' );
		guidance.append( iconContainer );
		iconRoot = createRoot( iconContainer );
		iconRoot.render( createElement( Icon, { icon, size: 24 } ) );
	}
	const text = document.createElement( 'span' );
	text.textContent = message;
	guidance.append( text );
	document.body.append( guidance );
	let touchPointer: { pointerId: number; directionY: number } | null = null;
	let explicitlyHidden = false;
	const trackTouchSwipe = isTouchSwipeGuidance( message );
	const alignRight = isRightAlignedGuidance( message );
	let touchAnchorY = trackTouchSwipe ? getFocusedTouchAnchorY( document ) : null;
	let position: ReorderGuidancePosition = trackTouchSwipe ? 'bottom' : 'top';

	const updatePosition = () => {
		const viewportHeight = Math.max(
			0,
			view?.innerHeight ?? document.documentElement.clientHeight
		);
		const viewportWidth = Math.max( 0, view?.innerWidth ?? document.documentElement.clientWidth );
		const scrollContainer = view ? getVerticalScrollContainer( view, guidanceTarget ) : null;
		const containerRect = scrollContainer?.getBoundingClientRect();
		const viewportTop = Math.max( containerRect?.top ?? 0, 0 );
		const viewportBottom = Math.min( containerRect?.bottom ?? viewportHeight, viewportHeight );
		const tableRect = guidanceTarget.getBoundingClientRect();
		const isTableVisible = tableRect.bottom > viewportTop && tableRect.top < viewportBottom;
		guidance.classList.toggle( GUIDANCE_HIDDEN_CLASS, explicitlyHidden || ! isTableVisible );

		const availableViewportWidth = Math.max( 0, viewportWidth - GUIDANCE_VIEWPORT_OFFSET_PX * 2 );
		guidance.style.maxWidth = `${ availableViewportWidth }px`;

		if ( alignRight ) {
			guidance.style.left = '';
			guidance.style.right = `${ GUIDANCE_VIEWPORT_OFFSET_PX }px`;
		} else {
			const guidanceWidth = guidance.getBoundingClientRect().width;
			const minLeft = GUIDANCE_VIEWPORT_OFFSET_PX;
			const maxLeft = Math.max(
				minLeft,
				viewportWidth - guidanceWidth - GUIDANCE_VIEWPORT_OFFSET_PX
			);
			const left = Math.min( Math.max( tableRect.left, minLeft ), maxLeft );
			guidance.style.left = `${ left }px`;
			guidance.style.right = '';
		}

		const guidanceHeight = guidance.getBoundingClientRect().height;
		const browserViewportMinTop = GUIDANCE_VIEWPORT_OFFSET_PX;
		const browserViewportMaxTop = Math.max(
			browserViewportMinTop,
			viewportHeight - guidanceHeight - GUIDANCE_VIEWPORT_OFFSET_PX
		);
		let top = alignRight ? RIGHT_GUIDANCE_TOP_PX : viewportTop + GUIDANCE_VIEWPORT_OFFSET_PX;
		if ( trackTouchSwipe ) {
			if ( touchAnchorY === null ) {
				top = position === 'bottom' ? browserViewportMaxTop : browserViewportMinTop;
			} else {
				const pointerTop =
					position === 'bottom'
						? touchAnchorY + TOUCH_GUIDANCE_POINTER_OFFSET_PX
						: touchAnchorY - guidanceHeight - TOUCH_GUIDANCE_POINTER_OFFSET_PX;
				top = Math.min( Math.max( pointerTop, browserViewportMinTop ), browserViewportMaxTop );
			}
		} else if ( position === 'bottom' ) {
			top = Math.max(
				viewportTop + GUIDANCE_VIEWPORT_OFFSET_PX,
				viewportBottom - guidanceHeight - GUIDANCE_VIEWPORT_OFFSET_PX
			);
		}
		guidance.style.top = `${ top }px`;
	};
	const setPosition = ( nextPosition: ReorderGuidancePosition ) => {
		if ( position === nextPosition ) {
			return;
		}
		position = nextPosition;
		updatePosition();
	};
	const onKeyDown = ( event: KeyboardEvent ) => {
		if ( event.key === 'ArrowUp' ) {
			setPosition( 'bottom' );
		} else if ( event.key === 'ArrowDown' ) {
			setPosition( 'top' );
		}
	};
	const onPointerDown = ( event: PointerEvent ) => {
		if ( event.pointerType !== 'touch' ) {
			return;
		}
		touchPointer = { pointerId: event.pointerId, directionY: event.clientY };
		touchAnchorY = event.clientY;
		updatePosition();
	};
	const onPointerMove = ( event: PointerEvent ) => {
		if (
			event.pointerType !== 'touch' ||
			! touchPointer ||
			event.pointerId !== touchPointer.pointerId
		) {
			return;
		}

		const deltaY = event.clientY - touchPointer.directionY;
		touchAnchorY = event.clientY;
		if ( Math.abs( deltaY ) >= TOUCH_SWIPE_DIRECTION_THRESHOLD_PX ) {
			touchPointer.directionY = event.clientY;
			position = deltaY > 0 ? 'bottom' : 'top';
		}
		updatePosition();
	};
	const onPointerEnd = ( event: PointerEvent ) => {
		if ( touchPointer?.pointerId === event.pointerId ) {
			touchPointer = null;
		}
	};

	updatePosition();
	view?.addEventListener( 'resize', updatePosition );
	view?.addEventListener( 'scroll', updatePosition, true );
	document.addEventListener( 'keydown', onKeyDown, true );
	if ( trackTouchSwipe ) {
		document.addEventListener( 'pointerdown', onPointerDown, true );
		document.addEventListener( 'pointermove', onPointerMove, true );
		document.addEventListener( 'pointercancel', onPointerEnd, true );
		document.addEventListener( 'pointerup', onPointerEnd, true );
	}

	return {
		element: guidance,
		setHidden: ( isHidden ) => {
			explicitlyHidden = isHidden;
			updatePosition();
		},
		cleanup: () => {
			view?.removeEventListener( 'resize', updatePosition );
			view?.removeEventListener( 'scroll', updatePosition, true );
			document.removeEventListener( 'keydown', onKeyDown, true );
			if ( trackTouchSwipe ) {
				document.removeEventListener( 'pointerdown', onPointerDown, true );
				document.removeEventListener( 'pointermove', onPointerMove, true );
				document.removeEventListener( 'pointercancel', onPointerEnd, true );
				document.removeEventListener( 'pointerup', onPointerEnd, true );
			}
			iconRoot?.unmount();
			guidance.remove();
		},
	};
};

/**
 * 対象要素に最も近い、実際に縦scroll可能な祖先を返す。
 *
 * @param view   computed styleを取得するowning window。
 * @param target scrollable ancestorを探索する起点。
 * @return 最も近い縦scroll可能な祖先。該当しない場合はnull。
 */
const getVerticalScrollContainer = ( view: Window, target: Element ): HTMLElement | null => {
	const { body, documentElement } = target.ownerDocument;
	let ancestor = target.parentElement;
	while ( ancestor ) {
		if ( ancestor !== body && ancestor !== documentElement ) {
			const overflowY = view.getComputedStyle( ancestor ).overflowY;
			if (
				( overflowY === 'auto' || overflowY === 'scroll' ) &&
				ancestor.scrollHeight > ancestor.clientHeight
			) {
				return ancestor;
			}
		}
		ancestor = ancestor.parentElement;
	}

	return null;
};

/**
 * keyboard候補が実際にscroll containerの表示領域外へ進んだとき、その候補を確認できる位置まで
 * 必要最小限だけ縦scrollする。
 *
 * 候補が変化しない境界操作からは呼び出さない。
 *
 * @param view           owning window。
 * @param tbody          対象Table body。
 * @param insertionIndex 現在候補の挿入位置。
 */
export const scrollKeyboardDestinationIntoView = (
	view: Window,
	tbody: HTMLTableSectionElement,
	insertionIndex: number
) => {
	const nextRow = tbody.rows.item( insertionIndex );
	const lastRow = tbody.rows.item( tbody.rows.length - 1 );
	const currentY = nextRow
		? nextRow.getBoundingClientRect().top
		: lastRow?.getBoundingClientRect().bottom ?? null;
	if ( currentY === null ) {
		return;
	}

	const scrollContainer = getVerticalScrollContainer( view, tbody );
	const containerRect = scrollContainer?.getBoundingClientRect();
	const viewportTop = containerRect?.top ?? 0;
	const viewportBottom = containerRect?.bottom ?? view.innerHeight;
	if ( viewportBottom - viewportTop <= KEYBOARD_SCROLL_MARGIN_PX * 2 ) {
		return;
	}

	const lowerBound = viewportTop + KEYBOARD_SCROLL_MARGIN_PX;
	const upperBound = viewportBottom - KEYBOARD_SCROLL_MARGIN_PX;
	let delta = 0;
	if ( currentY < lowerBound ) {
		delta = currentY - lowerBound;
	} else if ( currentY > upperBound ) {
		delta = currentY - upperBound;
	}

	if ( Math.abs( delta ) >= 1 ) {
		( scrollContainer ?? view ).scrollBy( { behavior: 'auto', left: 0, top: delta } );
	}
};
