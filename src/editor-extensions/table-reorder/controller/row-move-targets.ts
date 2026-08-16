import {
	getCancelName,
	getDestinationBeforeName,
	getDestinationEndName,
	getPcPointerActiveMessage,
	getTouchPointerActiveMessage,
} from '../messages';
import { createReorderGuidance } from './reorder-guidance';
import { getRowRepresentativeText } from './row-controls';
import type { RowMoveTarget } from './row-order';

/** 単一ポインター操作の移動先buttonに付与するclass。 */
export const DESTINATION_CLASS = 'yamabiko-table-reorder-destination';

/** タッチの明示的キャンセルbuttonに付与するclass。 */
const CANCEL_CLASS = 'yamabiko-table-reorder-pointer-cancel';

/** touch target上の移動をtapではなくscroll gestureとして扱う距離。 */
const POINTER_TAP_THRESHOLD_PX = 5;

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
