import type { RowMoveDirection } from '../row-order';

/** 操作中の案内に付与するclass。 */
const GUIDANCE_CLASS = 'yamabiko-table-reorder-pointer-guidance';

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
