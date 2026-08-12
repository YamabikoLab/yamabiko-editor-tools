/**
 * Table Reorderのdrag中だけ存在する一時DOM装飾を管理する。
 *
 * insertion line、touch chosen style、fallback drag時のcell width固定など、drag中だけ必要な
 * 表示と操作補助の生成・復元、および一時DOM状態のcleanupをここで扱う。
 */

/** touch modeで並び替え対象外の行に付与するclass。 */
export const NON_MOVABLE_ROW_CLASS = 'yamabiko-table-reorder-non-movable-row';

/** insertion lineに付与するclass。 */
const INSERTION_LINE_CLASS = 'yamabiko-table-reorder-insertion-line';

/** touch dragで選択中の行に付与するclass。 */
export const TOUCH_CHOSEN_CLASS = 'yamabiko-table-reorder-touch-chosen';

/** insertion lineの高さ。 */
const INSERTION_LINE_HEIGHT_PX = 2;

/** insertion lineの表示制御とcleanupをまとめた一時UI。 */
export type InsertionLine = {
	element: HTMLDivElement;
	hide: () => void;
	show: ( row: HTMLTableRowElement, willInsertAfter: boolean ) => void;
	cleanup: () => void;
};

/** touch modeで追加する一時DOM状態とcleanupをまとめたUI。 */
export type TouchDragUi = {
	cleanup: () => void;
};

/**
 * drag先を示すinsertion lineをdocument bodyへ追加する。
 *
 * @param document insertion lineを追加するeditor document。
 * @return insertion lineの表示制御とcleanup境界。
 */
export const createInsertionLine = ( document: Document ): InsertionLine => {
	const line = document.createElement( 'div' );
	line.className = INSERTION_LINE_CLASS;
	line.setAttribute( 'aria-hidden', 'true' );
	line.style.position = 'fixed';
	line.style.height = `${ INSERTION_LINE_HEIGHT_PX }px`;
	line.style.background = 'var(--wp-admin-theme-color, #3858e9)';
	line.style.pointerEvents = 'none';
	line.style.zIndex = '100000';
	line.style.display = 'none';
	line.style.transform = 'translateY(-50%)';
	document.body.append( line );

	return {
		element: line,
		hide: () => {
			line.style.display = 'none';
		},
		show: ( row, willInsertAfter ) => {
			const rect = row.getBoundingClientRect();
			line.style.left = `${ rect.left }px`;
			line.style.top = `${ willInsertAfter ? rect.bottom : rect.top }px`;
			line.style.width = `${ rect.width }px`;
			line.style.display = 'block';
		},
		cleanup: () => {
			line.remove();
		},
	};
};

/**
 * touch mode中だけ必要なDOM状態を追加する。
 *
 * contenteditable要素のpointer events抑止、選択行style、tbodyのuser-select、移動不可行classを
 * まとめて所有し、返した`cleanup`で開始前の状態へ戻す。
 *
 * @param document             touch chosen styleを追加するeditor document。
 * @param tbody                touch操作対象となるTable body。
 * @param nonMovableRowIndices 移動不可classを付与する行index。
 * @return touch modeのcleanup境界。
 */
export const createTouchDragUi = (
	document: Document,
	tbody: HTMLTableSectionElement,
	nonMovableRowIndices: readonly number[]
): TouchDragUi => {
	const editableElements = Array.from(
		tbody.querySelectorAll< HTMLElement >( '[contenteditable="true"]' )
	);
	const originalPointerEvents = editableElements.map( ( element ) => ( {
		element,
		pointerEvents: element.style.pointerEvents,
	} ) );
	const originalUserSelect = tbody.style.userSelect;

	for ( const element of editableElements ) {
		element.style.pointerEvents = 'none';
	}
	tbody.style.userSelect = 'none';
	for ( const rowIndex of nonMovableRowIndices ) {
		tbody.rows.item( rowIndex )?.classList.add( NON_MOVABLE_ROW_CLASS );
	}

	const chosenStyle = document.createElement( 'style' );
	chosenStyle.textContent = `.${ TOUCH_CHOSEN_CLASS } { outline: 2px solid var(--wp-admin-theme-color, #3858e9); outline-offset: -2px; }`;
	document.head.append( chosenStyle );

	return {
		cleanup: () => {
			for ( const { element, pointerEvents } of originalPointerEvents ) {
				element.style.pointerEvents = pointerEvents;
			}
			tbody.style.userSelect = originalUserSelect;
			chosenStyle.remove();
			for ( const rowIndex of nonMovableRowIndices ) {
				tbody.rows.item( rowIndex )?.classList.remove( NON_MOVABLE_ROW_CLASS );
			}
		},
	};
};

/**
 * fallback drag中のrow cell幅を実測値へ固定する。
 *
 * @param row 幅を固定するdrag対象row。
 * @return 元のinline styleへ戻す関数。
 */
export const fixFallbackRowCellWidths = ( row: HTMLElement ): ( () => void ) => {
	if ( ! row.matches( 'tr' ) ) {
		return () => undefined;
	}

	const cells = Array.from( row.querySelectorAll< HTMLElement >( ':scope > td, :scope > th' ) );
	const originalStyles = cells.map( ( cell ) => ( {
		boxSizing: cell.style.boxSizing,
		cell,
		maxWidth: cell.style.maxWidth,
		minWidth: cell.style.minWidth,
		width: cell.style.width,
	} ) );

	for ( const cell of cells ) {
		const width = `${ cell.getBoundingClientRect().width }px`;
		cell.style.boxSizing = 'border-box';
		cell.style.width = width;
		cell.style.minWidth = width;
		cell.style.maxWidth = width;
	}

	return () => {
		for ( const { boxSizing, cell, maxWidth, minWidth, width } of originalStyles ) {
			cell.style.boxSizing = boxSizing;
			cell.style.width = width;
			cell.style.minWidth = minWidth;
			cell.style.maxWidth = maxWidth;
		}
	};
};
