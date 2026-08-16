/**
 * Table Reorderのdrag中だけ存在する一時DOM装飾を管理する。
 *
 * insertion line、fallback drag時のcell width固定、drop時の短い着地animationなど、
 * drag中と直後だけ必要な表示と操作補助の生成・復元、および一時DOM状態のcleanupをここで扱う。
 */

/** insertion lineに付与するclass。 */
const INSERTION_LINE_CLASS = 'yamabiko-table-reorder-insertion-line';

/** drop animation用overlayに付与するclass。 */
const DROP_ANIMATION_CLASS = 'yamabiko-table-reorder-drop-animation';

/** insertion lineの高さ。 */
const INSERTION_LINE_HEIGHT_PX = 2;

/** drop animationの継続時間。 */
const DROP_ANIMATION_DURATION_MS = 180;

/** drop位置へ落ち着く際の短い移動量。 */
const DROP_ANIMATION_OFFSET_PX = 8;

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
 * SortableJSが移動済みのrowを短時間だけfixed overlayとして保持する。
 *
 * controllerが直後に元DOM順へ復元してGutenbergへcommitしても、drop位置のrowを視覚的に残して
 * 短く収束させることで、drag中の見た目と確定後のrow位置をつなぐ。
 *
 * @param row           drag対象row。
 * @param originalIndex drag開始時のrow index。
 */
const startDropAnimation = ( row: HTMLTableRowElement, originalIndex: number ) => {
	const tbody = row.parentElement;
	const document = row.ownerDocument;
	const view = document.defaultView;
	if ( ! view || ! tbody?.matches( 'tbody' ) ) {
		return;
	}

	const currentIndex = Array.from( tbody.children ).indexOf( row );
	if ( currentIndex < 0 || currentIndex === originalIndex ) {
		return;
	}

	if ( view.matchMedia?.( '(prefers-reduced-motion: reduce)' ).matches ) {
		return;
	}

	const table = row.closest< HTMLTableElement >( 'table' );
	const rect = row.getBoundingClientRect();
	if ( ! table || rect.width <= 0 || rect.height <= 0 ) {
		return;
	}

	const overlay = table.cloneNode( false ) as HTMLTableElement;
	const overlayBody = document.createElement( 'tbody' );
	const overlayRow = row.cloneNode( true ) as HTMLTableRowElement;
	overlay.classList.add( DROP_ANIMATION_CLASS );
	overlay.removeAttribute( 'id' );
	overlay.setAttribute( 'aria-hidden', 'true' );
	overlayRow.removeAttribute( 'id' );
	for ( const element of overlayRow.querySelectorAll< HTMLElement >( '[id]' ) ) {
		element.removeAttribute( 'id' );
	}
	overlayBody.append( overlayRow );
	overlay.append( overlayBody );

	const tableStyle = view.getComputedStyle( table );
	overlay.style.borderCollapse = tableStyle.borderCollapse;
	overlay.style.borderSpacing = tableStyle.borderSpacing;
	overlay.style.tableLayout = tableStyle.tableLayout;
	const sourceCells = Array.from( row.cells );
	const overlayCells = Array.from( overlayRow.cells );
	for ( const [ index, sourceCell ] of sourceCells.entries() ) {
		const overlayCell = overlayCells[ index ];
		if ( ! overlayCell ) {
			continue;
		}
		const width = `${ sourceCell.getBoundingClientRect().width }px`;
		overlayCell.style.boxSizing = 'border-box';
		overlayCell.style.width = width;
		overlayCell.style.minWidth = width;
		overlayCell.style.maxWidth = width;
	}

	const offset = currentIndex > originalIndex ? -DROP_ANIMATION_OFFSET_PX : DROP_ANIMATION_OFFSET_PX;
	overlay.style.position = 'fixed';
	overlay.style.left = `${ rect.left }px`;
	overlay.style.top = `${ rect.top }px`;
	overlay.style.width = `${ rect.width }px`;
	overlay.style.margin = '0';
	overlay.style.pointerEvents = 'none';
	overlay.style.zIndex = '100001';
	overlay.style.opacity = '1';
	overlay.style.transform = `translateY(${ offset }px)`;
	overlay.style.transition = `transform ${ DROP_ANIMATION_DURATION_MS }ms cubic-bezier(0.2, 0, 0, 1), opacity ${ DROP_ANIMATION_DURATION_MS }ms ease-out`;
	document.body.append( overlay );

	view.requestAnimationFrame( () => {
		if ( ! overlay.isConnected ) {
			return;
		}
		overlay.style.transform = 'translateY(0)';
		overlay.style.opacity = '0';
	} );
	view.setTimeout( () => overlay.remove(), DROP_ANIMATION_DURATION_MS );
};

/**
 * fallback drag中のrow cell幅を実測値へ固定する。
 *
 * restore時にrowが別indexへ移動していれば、DOM順を戻す直前のdrop位置を短いoverlay animationで保持する。
 *
 * @param row 幅を固定するdrag対象row。
 * @return 元のinline styleへ戻す関数。
 */
export const fixFallbackRowCellWidths = ( row: HTMLElement ): ( () => void ) => {
	if ( ! row.matches( 'tr' ) ) {
		return () => undefined;
	}

	const tableRow = row as HTMLTableRowElement;
	const tbody = tableRow.parentElement;
	const originalIndex = tbody?.matches( 'tbody' )
		? Array.from( tbody.children ).indexOf( tableRow )
		: -1;
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
		if ( originalIndex >= 0 ) {
			startDropAnimation( tableRow, originalIndex );
		}
		for ( const { boxSizing, cell, maxWidth, minWidth, width } of originalStyles ) {
			cell.style.boxSizing = boxSizing;
			cell.style.width = width;
			cell.style.minWidth = minWidth;
			cell.style.maxWidth = maxWidth;
		}
	};
};
