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
type InsertionLine = {
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
			trace317( '[yet:#317] insertionLine updatePosition: no target' );

			return;
		}

		if ( ! activeTarget.row.isConnected ) {
			trace317( '[yet:#317] insertionLine target disconnected', activeTarget.row );

			line.style.display = 'none';
			return;
		}

		const rect = activeTarget.row.getBoundingClientRect();
		line.style.left = `${ rect.left }px`;
		line.style.top = `${ activeTarget.willInsertAfter ? rect.bottom : rect.top }px`;
		line.style.width = `${ rect.width }px`;
		line.style.display = 'block';

		trace317( '[yet:#317] insertionLine positioned', {
			targetRect: {
				top: rect.top,
				bottom: rect.bottom,
				left: rect.left,
				right: rect.right,
				width: rect.width,
				height: rect.height,
			},
			lineStyle: {
				display: line.style.display,
				position: line.style.position,
				top: line.style.top,
				left: line.style.left,
				width: line.style.width,
				zIndex: line.style.zIndex,
			},
			viewport: {
				width: document.defaultView?.innerWidth,
				height: document.defaultView?.innerHeight,
			},
		} );
	};
	const onViewportChange = () => {
		updatePosition();
	};
	document.addEventListener( 'scroll', onViewportChange, true );
	document.defaultView?.addEventListener( 'resize', onViewportChange );

	return {
		hide: () => {
			trace317( '[yet:#317] insertionLine.hide', {
				activeTarget,
				stack: new Error().stack,
			} );

			activeTarget = null;
			line.style.display = 'none';
		},
		show: ( row, willInsertAfter ) => {
			trace317( '[yet:#317] insertionLine.show', {
				row,
				willInsertAfter,
				connected: row.isConnected,
			} );

			activeTarget = { row, willInsertAfter };
			updatePosition();
		},
		cleanup: () => {
			trace317( '[yet:#317] insertionLine.cleanup', {
				activeTarget,
				stack: new Error().stack,
			} );

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

type Yet317TraceEntry = {
	time: number;
	event: string;
	data?: unknown;
};

const trace317 = ( event: string, data?: unknown ) => {
	const traceWindow = window as typeof window & {
		__yet317Trace?: Yet317TraceEntry[];
	};

	traceWindow.__yet317Trace ??= [];

	traceWindow.__yet317Trace.push( {
		time: performance.now(),
		event,
		data,
	} );
};
