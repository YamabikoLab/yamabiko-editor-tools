/**
 * Table Reorderの操作中UIを管理し、行control / live statusの既存APIを再公開する。
 *
 * viewport guidanceと単一ポインター用targetを所有する。行controlとlive statusは責務別moduleへ
 * 分割し、既存consumer向けのimport境界はこのfacadeで維持する。
 */

import {
	getCancelName,
	getDestinationBeforeName,
	getDestinationEndName,
	getPcPointerActiveMessage,
	getTouchPointerActiveMessage,
} from '../messages';
import { getRowRepresentativeText } from './row-controls';
import type { RowMoveDirection, RowMoveTarget } from './row-order';

export { announceLiveStatus } from './live-status';
export {
	createRowControls,
	getRowRepresentativeText,
	HANDLE_ZONE_CLASS,
	stopRowControlInteractionPropagation,
	type RowControlEntry,
	type RowControlOptions,
	type RowControls,
} from './row-controls';

/** 単一ポインター操作の移動先buttonに付与するclass。 */
export const DESTINATION_CLASS = 'yamabiko-table-reorder-destination';

/** 操作中の案内に付与するclass。 */
const GUIDANCE_CLASS = 'yamabiko-table-reorder-pointer-guidance';

/** タッチの明示的キャンセルbuttonに付与するclass。 */
const CANCEL_CLASS = 'yamabiko-table-reorder-pointer-cancel';

/** touch target上の移動をtapではなくscroll gestureとして扱う距離。 */
const POINTER_TAP_THRESHOLD_PX = 5;

/** keyboard scroll追従でviewport端に確保する最小余白。 */
const KEYBOARD_SCROLL_MARGIN_PX = 24;

/** 操作案内をviewport端から離す余白。 */
const GUIDANCE_VIEWPORT_OFFSET_PX = 8;

/** 操作中案内を表示するviewport側。 */
export type ReorderGuidancePosition = 'top' | 'bottom';

/** 操作中案内のlifecycle。 */
export type ReorderGuidanceUi = {
	element: HTMLDivElement;
	setHidden: ( isHidden: boolean ) => void;
	setPosition: ( position: ReorderGuidancePosition ) => void;
	cleanup: () => void;
};

/** 単一ポインター移動先UI生成時の設定。 */
export type RowMoveTargetsOptions = {
	isTouch: boolean;
	onCancel: () => void;
	onSelect: ( newIndex: number ) => void;
	sourceControl: HTMLButtonElement;
};

/** 単一ポインター移動先UIのlifecycle。 */
export type RowMoveTargetsUi = {
	cleanup: () => void;
};

/**
 * Tableに関連付く操作中案内をowning documentへ追加する。
 *
 * fixed配置でスクロール中も確認できる状態を保つ。既定はviewport上側で、keyboard入力時は
 * ArrowUpなら下側、ArrowDownなら上側へ切り替え、移動先を確認する方向を覆わない。
 *
 * @param document      案内を生成するeditor document。
 * @param tbody         対象Table body。
 * @param message       表示する案内文。
 * @param sourceControl 操作対象の行control。互換用に受け取る。
 * @return 案内のlifecycle。
 */
export const createReorderGuidance = (
	document: Document,
	tbody: HTMLTableSectionElement,
	message: string,
	sourceControl?: HTMLElement
): ReorderGuidanceUi => {
	void sourceControl;
	const view = document.defaultView;
	const table = tbody.closest( 'table' );
	const guidance = document.createElement( 'div' );
	guidance.className = GUIDANCE_CLASS;
	guidance.contentEditable = 'false';
	const text = document.createElement( 'span' );
	text.textContent = message;
	guidance.append( text );
	document.body.append( guidance );
	let position: ReorderGuidancePosition = 'top';

	const updatePosition = () => {
		const tableRect = ( table ?? tbody ).getBoundingClientRect();
		const viewportHeight = Math.max(
			0,
			view?.innerHeight ?? document.documentElement.clientHeight
		);
		const viewportWidth = Math.max( 0, view?.innerWidth ?? document.documentElement.clientWidth );
		const left = Math.max( GUIDANCE_VIEWPORT_OFFSET_PX, tableRect.left );
		const availableWidth =
			viewportWidth > GUIDANCE_VIEWPORT_OFFSET_PX * 2
				? viewportWidth - left - GUIDANCE_VIEWPORT_OFFSET_PX
				: tableRect.width;
		guidance.style.left = `${ left }px`;
		guidance.style.width = `${ Math.max( 0, Math.min( tableRect.width, availableWidth ) ) }px`;

		const guidanceHeight = guidance.getBoundingClientRect().height;
		const top =
			position === 'bottom'
				? Math.max(
						GUIDANCE_VIEWPORT_OFFSET_PX,
						viewportHeight - guidanceHeight - GUIDANCE_VIEWPORT_OFFSET_PX
				  )
				: GUIDANCE_VIEWPORT_OFFSET_PX;
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

	updatePosition();
	view?.addEventListener( 'resize', updatePosition );
	view?.addEventListener( 'scroll', updatePosition, true );
	document.addEventListener( 'keydown', onKeyDown, true );

	return {
		element: guidance,
		setHidden: ( isHidden ) => {
			guidance.hidden = isHidden;
		},
		setPosition,
		cleanup: () => {
			view?.removeEventListener( 'resize', updatePosition );
			view?.removeEventListener( 'scroll', updatePosition, true );
			document.removeEventListener( 'keydown', onKeyDown, true );
			guidance.remove();
		},
	};
};

/**
 * keyboard候補が実際にviewport外へ進んだとき、その候補を確認できる位置までowning windowを
 * 必要最小限だけ縦scrollする。
 *
 * 候補が変化しない境界操作からは呼び出さない。directionとnextInsertionIndexは既存呼び出しとの
 * 互換のため受け取るが、先回りした可視領域計算には利用しない。
 *
 * @param view               owning window。
 * @param tbody              対象Table body。
 * @param insertionIndex     現在候補の挿入位置。
 * @param direction          keyboard移動方向。
 * @param nextInsertionIndex 同方向側の次の有効な挿入位置。
 */
export const scrollKeyboardDestinationIntoView = (
	view: Window,
	tbody: HTMLTableSectionElement,
	insertionIndex: number,
	direction?: RowMoveDirection,
	nextInsertionIndex?: number | null
) => {
	void direction;
	void nextInsertionIndex;
	const nextRow = tbody.rows.item( insertionIndex );
	const lastRow = tbody.rows.item( tbody.rows.length - 1 );
	const currentY = nextRow
		? nextRow.getBoundingClientRect().top
		: lastRow?.getBoundingClientRect().bottom ?? null;
	if ( currentY === null ) {
		return;
	}

	const viewportHeight = view.innerHeight;
	if ( viewportHeight <= KEYBOARD_SCROLL_MARGIN_PX * 2 ) {
		return;
	}

	const lowerBound = KEYBOARD_SCROLL_MARGIN_PX;
	const upperBound = viewportHeight - KEYBOARD_SCROLL_MARGIN_PX;
	let delta = 0;
	if ( currentY < lowerBound ) {
		delta = currentY - lowerBound;
	} else if ( currentY > upperBound ) {
		delta = currentY - upperBound;
	}

	if ( Math.abs( delta ) >= 1 ) {
		view.scrollBy( { behavior: 'auto', left: 0, top: delta } );
	}
};

/**
 * 単一ポインター操作で選べる行間targetと案内をowning documentへ追加する。
 *
 * targetは`row-order.ts`が返した有効位置だけを描画する。scroll / resizeごとにTableの
 * 現在位置へ追従し、touchではtarget上のswipeをtap確定として扱わない。
 *
 * @param document targetを生成するeditor document。
 * @param tbody    対象Table body。
 * @param targets  表示する有効な移動先。
 * @param options  入力方式と確定・キャンセルcallback。
 * @return target UIのcleanup境界。
 */
export const createRowMoveTargets = (
	document: Document,
	tbody: HTMLTableSectionElement,
	targets: readonly RowMoveTarget[],
	options: RowMoveTargetsOptions
): RowMoveTargetsUi => {
	const view = document.defaultView;
	const table = tbody.closest( 'table' );
	const buttons: HTMLButtonElement[] = [];
	const cleanupListeners: Array< () => void > = [];
	const guidance = createReorderGuidance(
		document,
		tbody,
		options.isTouch ? getTouchPointerActiveMessage() : getPcPointerActiveMessage(),
		options.sourceControl
	);

	if ( options.isTouch ) {
		const cancel = document.createElement( 'button' );
		cancel.className = CANCEL_CLASS;
		cancel.type = 'button';
		cancel.textContent = getCancelName();
		cancel.setAttribute( 'aria-label', getCancelName() );
		const onCancel = ( event: MouseEvent ) => {
			event.preventDefault();
			event.stopPropagation();
			options.onCancel();
		};
		cancel.addEventListener( 'click', onCancel );
		cleanupListeners.push( () => cancel.removeEventListener( 'click', onCancel ) );
		guidance.element.append( cancel );
	}

	for ( const target of targets ) {
		const button = document.createElement( 'button' );
		button.className = DESTINATION_CLASS;
		button.type = 'button';
		button.contentEditable = 'false';
		button.dataset.newIndex = String( target.newIndex );
		const nextRow = tbody.rows.item( target.insertionIndex );
		button.setAttribute(
			'aria-label',
			nextRow
				? getDestinationBeforeName( target.insertionIndex + 1, getRowRepresentativeText( nextRow ) )
				: getDestinationEndName()
		);

		let pointerStart: { pointerId: number; x: number; y: number } | null = null;
		let suppressNextClick = false;
		const onPointerDown = ( event: PointerEvent ) => {
			if ( event.pointerType === 'mouse' ) {
				return;
			}
			pointerStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
			suppressNextClick = false;
		};
		const onPointerMove = ( event: PointerEvent ) => {
			if ( ! pointerStart || event.pointerId !== pointerStart.pointerId ) {
				return;
			}
			if (
				Math.hypot( event.clientX - pointerStart.x, event.clientY - pointerStart.y ) >
				POINTER_TAP_THRESHOLD_PX
			) {
				suppressNextClick = true;
			}
		};
		const onPointerCancel = ( event: PointerEvent ) => {
			if ( pointerStart?.pointerId === event.pointerId ) {
				suppressNextClick = true;
				pointerStart = null;
			}
		};
		const onPointerUp = ( event: PointerEvent ) => {
			if ( pointerStart?.pointerId === event.pointerId ) {
				pointerStart = null;
			}
		};
		const onClick = ( event: MouseEvent ) => {
			event.preventDefault();
			event.stopPropagation();
			if ( suppressNextClick ) {
				suppressNextClick = false;
				return;
			}
			options.onSelect( target.newIndex );
		};
		button.addEventListener( 'pointerdown', onPointerDown );
		button.addEventListener( 'pointermove', onPointerMove );
		button.addEventListener( 'pointercancel', onPointerCancel );
		button.addEventListener( 'pointerup', onPointerUp );
		button.addEventListener( 'click', onClick );
		cleanupListeners.push( () => {
			button.removeEventListener( 'pointerdown', onPointerDown );
			button.removeEventListener( 'pointermove', onPointerMove );
			button.removeEventListener( 'pointercancel', onPointerCancel );
			button.removeEventListener( 'pointerup', onPointerUp );
			button.removeEventListener( 'click', onClick );
		} );
		document.body.append( button );
		buttons.push( button );
	}

	const updatePositions = () => {
		const tableRect = ( table ?? tbody ).getBoundingClientRect();
		for ( const [ index, target ] of targets.entries() ) {
			const button = buttons[ index ];
			const nextRow = tbody.rows.item( target.insertionIndex );
			const lastRow = tbody.rows.item( tbody.rows.length - 1 );
			const boundaryY = nextRow
				? nextRow.getBoundingClientRect().top
				: lastRow?.getBoundingClientRect().bottom ?? tableRect.bottom;
			button.style.left = `${ tableRect.left }px`;
			button.style.top = `${ boundaryY }px`;
			button.style.width = `${ Math.max( 0, tableRect.width ) }px`;
		}
	};

	updatePositions();
	view?.addEventListener( 'resize', updatePositions );
	view?.addEventListener( 'scroll', updatePositions, true );

	return {
		cleanup: () => {
			view?.removeEventListener( 'resize', updatePositions );
			view?.removeEventListener( 'scroll', updatePositions, true );
			for ( const cleanupListener of cleanupListeners ) {
				cleanupListener();
			}
			for ( const button of buttons ) {
				button.remove();
			}
			guidance.cleanup();
		},
	};
};
