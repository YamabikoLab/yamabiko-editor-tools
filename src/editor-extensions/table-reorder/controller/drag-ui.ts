/**
 * Table Reorderのdrag中だけ存在する一時DOM装飾を管理する。
 *
 * insertion line、fallback drag時のcell width固定など、drag中だけ必要な
 * 表示と操作補助の生成・復元、および一時DOM状態のcleanupをここで扱う。
 */

/** insertion lineに付与するclass。 */
const INSERTION_LINE_CLASS = 'yamabiko-table-reorder-insertion-line';

/** insertion lineの高さ。 */
const INSERTION_LINE_HEIGHT_PX = 2;

/** insertion lineの表示制御とcleanupをまとめた一時UI。 */
export type InsertionLine = {
	element: HTMLDivElement;
	hide: () => void;
	show: ( row: HTMLTableRowElement, willInsertAfter: boolean ) => void;
	cleanup: () => void;
};

/**
 * drag先を示すinsertion lineをdocument bodyへ追加する。
 *
 * 表示中は対象行を保持し、editor内の縦スクロールやwindow resizeに合わせて位置を再計測する。
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

	let activeTarget: {
		row: HTMLTableRowElement;
		willInsertAfter: boolean;
	} | null = null;
	const updatePosition = () => {
		if ( ! activeTarget ) {
			return;
		}

		if ( ! activeTarget.row.isConnected ) {
			line.style.display = 'none';
			return;
		}

		const rect = activeTarget.row.getBoundingClientRect();
		line.style.left = `${ rect.left }px`;
		line.style.top = `${ activeTarget.willInsertAfter ? rect.bottom : rect.top }px`;
		line.style.width = `${ rect.width }px`;
		line.style.display = 'block';
	};
	const onViewportChange = () => {
		updatePosition();
	};
	document.addEventListener( 'scroll', onViewportChange, true );
	document.defaultView?.addEventListener( 'resize', onViewportChange );

	return {
		element: line,
		hide: () => {
			activeTarget = null;
			line.style.display = 'none';
		},
		show: ( row, willInsertAfter ) => {
			activeTarget = { row, willInsertAfter };
			updatePosition();
		},
		cleanup: () => {
			activeTarget = null;
			document.removeEventListener( 'scroll', onViewportChange, true );
			document.defaultView?.removeEventListener( 'resize', onViewportChange );
			line.remove();
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
