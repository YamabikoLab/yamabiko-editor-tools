/**
 * Table Reorderの待機中から存在する行controlを管理する。
 *
 * 移動可能行ごとのnative button、accessible name / description、表示状態、先頭cellの
 * handle gutter、focus時の案内切り替えとcleanupを所有する。drag中だけの一時UIは扱わない。
 */

import {
	getEmptyRowLabel,
	getKeyboardHandleTooltip,
	getPointerHandleTooltip,
	getRowControlKeyboardDescription,
	getRowControlName,
	getRowControlPointerDescription,
} from '../messages';

/** 行control本体に付与するclass。SortableJSのhandle selectorとしても利用する。 */
export const HANDLE_ZONE_CLASS = 'yamabiko-table-reorder-handle-zone';

/** 行control内のdrag handle表示に付与するclass。 */
const HANDLE_CLASS = 'yamabiko-table-reorder-handle';

/** 支援技術向け説明文に付与するclass。 */
const DESCRIPTION_CLASS = 'yamabiko-table-reorder-description';

/** 行control用に先頭cellへ確保するinline方向の幅。 */
const HANDLE_GUTTER_PX = 32;

/** accessible nameへ含める代表情報の最大文字数。 */
const MAX_ROW_LABEL_LENGTH = 80;

/** 行controlの説明要素へ一意なIDを割り当てるための連番。 */
let descriptionSequence = 0;

/** 行control 1件を構成するDOM node。 */
export type RowControlEntry = {
	control: HTMLButtonElement;
	handle: HTMLSpanElement;
	row: HTMLTableRowElement;
};

/** 行control群と、その表示・cleanupをまとめたUI。 */
export type RowControls = {
	entries: RowControlEntry[];
	setVisible: ( entry: RowControlEntry, isVisible: boolean ) => void;
	cleanup: () => void;
};

/** 行control生成時の表示mode。 */
export type RowControlOptions = {
	showAll: boolean;
};

/**
 * 行内容からaccessible nameへ使う短い代表情報を返す。
 *
 * 先頭から最初の空でないcell内容を採用し、空行では基本設計の翻訳対象fallbackを返す。
 * 既にTable Reorderのcontrolが存在する場合は、その一時DOMを代表情報へ含めない。
 *
 * @param row 代表情報を取得する本文行。
 * @return 行内容の代表情報。
 */
export const getRowRepresentativeText = ( row: HTMLTableRowElement ): string => {
	for ( const cell of Array.from( row.cells ) ) {
		const clone = cell.cloneNode( true ) as HTMLTableCellElement;
		clone.querySelectorAll( `.${ HANDLE_ZONE_CLASS }` ).forEach( ( control ) => control.remove() );
		const text = clone.textContent?.replace( /\s+/g, ' ' ).trim() ?? '';
		if ( ! text ) {
			continue;
		}

		if ( text.length <= MAX_ROW_LABEL_LENGTH ) {
			return text;
		}

		return `${ text.slice( 0, MAX_ROW_LABEL_LENGTH - 1 ) }…`;
	}

	return getEmptyRowLabel();
};

/**
 * 移動可能行へ共通の行controlを追加する。
 *
 * hover modeではcontrolをDOMとTab順へ常設しつつ通常時は視覚的に隠し、controllerからのhover表示と
 * native focusで見えるようにする。touch reorder modeでは全controlを表示する。変更した先頭cellの
 * inline styleと生成DOMは`cleanup()`で開始前へ戻す。
 *
 * @param document             controlを生成するeditor document。
 * @param tbody                controlを追加するTable body。
 * @param nonMovableRowIndices controlを作成しない行index。
 * @param options              controlの表示mode。
 * @return 生成した行control群。
 */
export const createRowControls = (
	document: Document,
	tbody: HTMLTableSectionElement,
	nonMovableRowIndices: readonly number[],
	options: RowControlOptions
): RowControls => {
	const entries: RowControlEntry[] = [];
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

		const rowLabel = getRowRepresentativeText( row );
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

		const control = document.createElement( 'button' );
		control.type = 'button';
		control.className = HANDLE_ZONE_CLASS;
		control.setAttribute( 'contenteditable', 'false' );
		control.setAttribute( 'aria-label', getRowControlName( rowIndex + 1, rowLabel ) );
		control.dataset.visible = options.showAll ? 'true' : 'false';

		const handle = document.createElement( 'span' );
		handle.className = HANDLE_CLASS;
		handle.setAttribute( 'aria-hidden', 'true' );
		handle.textContent = '⋮⋮';

		descriptionSequence += 1;
		const descriptionBaseId = `yamabiko-table-reorder-description-${ descriptionSequence }`;
		const pointerDescription = document.createElement( 'span' );
		pointerDescription.id = `${ descriptionBaseId }-pointer`;
		pointerDescription.className = DESCRIPTION_CLASS;
		pointerDescription.textContent = getRowControlPointerDescription();

		const keyboardDescription = document.createElement( 'span' );
		keyboardDescription.id = `${ descriptionBaseId }-keyboard`;
		keyboardDescription.className = DESCRIPTION_CLASS;
		keyboardDescription.textContent = getRowControlKeyboardDescription();

		const usePointerDescription = ! options.showAll;
		if ( usePointerDescription ) {
			control.title = getPointerHandleTooltip();
			control.setAttribute( 'aria-describedby', pointerDescription.id );
		}

		const onFocus = () => {
			control.title = getKeyboardHandleTooltip();
			control.setAttribute( 'aria-describedby', keyboardDescription.id );
		};
		const onBlur = () => {
			if ( usePointerDescription ) {
				control.title = getPointerHandleTooltip();
				control.setAttribute( 'aria-describedby', pointerDescription.id );
				return;
			}

			control.removeAttribute( 'title' );
			control.removeAttribute( 'aria-describedby' );
		};
		control.addEventListener( 'focus', onFocus );
		control.addEventListener( 'blur', onBlur );

		control.append( handle, pointerDescription, keyboardDescription );
		firstCell.prepend( control );
		entries.push( { control, handle, row } );
	}

	return {
		entries,
		setVisible: ( entry, isVisible ) => {
			entry.control.dataset.visible = isVisible ? 'true' : 'false';
		},
		cleanup: () => {
			for ( const { control } of entries ) {
				control.remove();
			}
			for ( const { cell, paddingInlineStart, position } of changedCells ) {
				cell.style.paddingInlineStart = paddingInlineStart;
				cell.style.position = position;
			}
		},
	};
};

/**
 * 行control上のeventがGutenberg側へ伝播しないよう停止する。
 *
 * native button自身のfocus / click既定動作は維持し、Table ReorderのcontrollerとSortableJSが
 * 同じcontrolを操作入口として扱えるよう`preventDefault()`は行わない。
 *
 * @param event 行control操作か判定するDOM event。
 */
export const stopRowControlInteractionPropagation = ( event: Event ) => {
	const target = event.target as Element | null;
	if ( target?.closest?.( `.${ HANDLE_ZONE_CLASS }` ) ) {
		event.stopPropagation();
	}
};
