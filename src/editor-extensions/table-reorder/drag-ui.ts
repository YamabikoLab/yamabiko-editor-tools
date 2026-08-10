/**
 * Table Reorderのdrag中だけ存在する一時DOM装飾を管理する。
 *
 * hover handle、insertion line、touch chosen style、fallback drag時のcell width固定など、
 * drag表示と操作補助の生成・復元をここで扱う。SortableJS instance lifecycleやReact stateは扱わない。
 */

/** hover handle本体に付与するclass。 */
const HANDLE_CLASS = 'yamabiko-table-reorder-handle';

/** hover handleの操作領域に付与するclass。 */
export const HANDLE_ZONE_CLASS = 'yamabiko-table-reorder-handle-zone';

/** touch modeで並び替え対象外の行に付与するclass。 */
export const NON_MOVABLE_ROW_CLASS = 'yamabiko-table-reorder-non-movable-row';

/** insertion lineに付与するclass。 */
const INSERTION_LINE_CLASS = 'yamabiko-table-reorder-insertion-line';

/** touch dragで選択中の行に付与するclass。 */
export const TOUCH_CHOSEN_CLASS = 'yamabiko-table-reorder-touch-chosen';

/** hover handleを表示・非表示にするときのfade時間。 */
const HANDLE_FADE_MS = 300;

/** hover handle用に先頭cellへ確保するinline方向の幅。 */
const HANDLE_GUTTER_PX = 32;

/** insertion lineの高さ。 */
const INSERTION_LINE_HEIGHT_PX = 2;

/** hover handle 1件を構成するDOM node。 */
export type HoverHandleEntry = {
	handle: HTMLElement;
	zone: HTMLElement;
};

/** hover handle群と、その表示・cleanupをまとめた一時UI。 */
export type HoverHandles = {
	entries: HoverHandleEntry[];
	setVisible: ( entry: HoverHandleEntry, isVisible: boolean ) => void;
	cleanup: () => void;
};

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
 * 返した`cleanup`がline nodeの削除を所有する。
 *
 * @param document insertion lineを追加するeditor document。
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
 * hover mode用のhandleを移動可能行へ追加する。
 *
 * handle追加のために変更した先頭cellの`position`と`paddingInlineStart`は、返した`cleanup`で
 * 元のinline styleへ戻す。生成したhandle zoneの削除も同じ`cleanup`が所有する。
 *
 * @param document             handleを生成するeditor document。
 * @param tbody                handleを追加するTable body。
 * @param nonMovableRowIndices handleを作成しない行index。
 */
export const createHoverHandles = (
	document: Document,
	tbody: HTMLTableSectionElement,
	nonMovableRowIndices: readonly number[]
): HoverHandles => {
	const entries: HoverHandleEntry[] = [];
	const changedCells: Array< {
		cell: HTMLTableCellElement;
		paddingInlineStart: string;
		position: string;
	} > = [];
	const view = document.defaultView;
	const nonMovableRows = new Set( nonMovableRowIndices );

	for ( const [ rowIndex, row ] of Array.from( tbody.rows ).entries() ) {
		if ( nonMovableRows.has( rowIndex ) ) {
			continue;
		}

		const firstCell = row.cells.item( 0 );
		if ( ! firstCell ) {
			continue;
		}

		const computedStyle = view?.getComputedStyle( firstCell );
		changedCells.push( {
			cell: firstCell,
			paddingInlineStart: firstCell.style.paddingInlineStart,
			position: firstCell.style.position,
		} );

		if ( computedStyle?.position === 'static' ) {
			firstCell.style.position = 'relative';
		}
		firstCell.style.paddingInlineStart = computedStyle
			? `calc(${ computedStyle.paddingInlineStart } + ${ HANDLE_GUTTER_PX }px)`
			: `${ HANDLE_GUTTER_PX }px`;

		const zone = document.createElement( 'span' );
		zone.className = HANDLE_ZONE_CLASS;
		zone.setAttribute( 'contenteditable', 'false' );
		zone.setAttribute( 'aria-hidden', 'true' );
		zone.style.position = 'absolute';
		zone.style.insetInlineStart = '0';
		zone.style.top = '0';
		zone.style.bottom = '0';
		zone.style.width = `${ HANDLE_GUTTER_PX }px`;
		zone.style.display = 'flex';
		zone.style.alignItems = 'center';
		zone.style.justifyContent = 'center';
		zone.style.cursor = 'grab';
		zone.style.userSelect = 'none';
		zone.style.zIndex = '1';

		const handle = document.createElement( 'span' );
		handle.className = HANDLE_CLASS;
		handle.setAttribute( 'aria-hidden', 'true' );
		handle.textContent = '⋮⋮';
		handle.style.padding = '2px 4px';
		handle.style.border = '1px solid currentColor';
		handle.style.borderRadius = '2px';
		handle.style.lineHeight = '1';
		handle.style.pointerEvents = 'none';
		handle.style.opacity = '0';
		handle.style.transition = `opacity ${ HANDLE_FADE_MS }ms ease`;

		zone.append( handle );
		firstCell.prepend( zone );
		entries.push( { handle, zone } );
	}

	return {
		entries,
		setVisible: ( entry, isVisible ) => {
			entry.handle.style.opacity = isVisible ? '1' : '0';
		},
		cleanup: () => {
			for ( const { zone } of entries ) {
				zone.remove();
			}
			for ( const { cell, paddingInlineStart, position } of changedCells ) {
				cell.style.paddingInlineStart = paddingInlineStart;
				cell.style.position = position;
			}
		},
	};
};

/**
 * hover handle zone上のeventがGutenberg側へ伝播しないよう停止する。
 *
 * @param event handle操作か判定するDOM event。
 */
export const stopHoverHandleInteractionPropagation = ( event: Event ) => {
	const target = event.target as Element | null;
	if ( target?.closest?.( `.${ HANDLE_ZONE_CLASS }` ) ) {
		event.stopPropagation();
	}
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
 * SortableJSのfallback cloneでcell幅が崩れないよう`width`、`minWidth`、`maxWidth`、
 * `boxSizing`を一時変更し、返したrestore関数で元のinline styleへ戻す。
 *
 * @param row 幅を固定するdrag対象row。
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
