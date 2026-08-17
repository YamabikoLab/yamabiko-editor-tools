import { Tooltip } from '@wordpress/components';
import { createElement, createRoot, flushSync } from '@wordpress/element';
import { dragHandle, Icon } from '@wordpress/icons';

import {
	getEmptyRowLabel,
	getKeyboardHandleTooltip,
	getPointerHandleTooltip,
	getRowControlKeyboardDescription,
	getRowControlName,
	getRowControlPointerDescription,
} from '../../messages';

/** 行control本体に付与するclass。SortableJSのhandle selectorとしても利用する。 */
export const HANDLE_ZONE_CLASS = 'yamabiko-table-reorder-handle-zone';

/** 行control内のdrag handle表示に付与するclass。 */
const HANDLE_CLASS = 'yamabiko-table-reorder-handle';

/** 支援技術向け説明文に付与するclass。 */
const DESCRIPTION_CLASS = 'yamabiko-table-reorder-description';

/** 行control用に先頭cellへ確保するinline方向の幅。 */
const HANDLE_GUTTER_PX = 32;

/** touch reorder modeで先頭cell本文に確保する最小幅。 */
const MIN_FIRST_COLUMN_CONTENT_WIDTH_PX = 32;

/** accessible nameへ含める代表情報の最大文字数。 */
const MAX_ROW_LABEL_LENGTH = 80;

/** 行controlの説明要素へ一意なIDを割り当てるための連番。 */
let descriptionSequence = 0;

/** 行control 1件を構成するDOM node。 */
export type RowControlEntry = {
	control: HTMLButtonElement;
	row: HTMLTableRowElement;
	setPressed: ( isPressed: boolean ) => void;
};

/** 行control群と、その表示・cleanupをまとめたUI。 */
type RowControls = {
	entries: RowControlEntry[];
	setVisible: ( entry: RowControlEntry, isVisible: boolean ) => void;
	cleanup: () => void;
};

/** 行control生成時の表示mode。 */
type RowControlOptions = {
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
	const cleanupControlRoots: Array< () => void > = [];
	const changedCells: Array< {
		cell: HTMLTableCellElement;
		paddingInlineStart: string;
		position: string;
	} > = [];
	const view = document.defaultView;
	const nonMovableRows = new Set( nonMovableRowIndices );
	const table = tbody.closest< HTMLTableElement >( 'table' );
	const overflowContainer = table?.parentElement ?? null;
	const sizingCell = table?.rows.item( 0 )?.cells.item( 0 ) ?? null;
	const originalTableMinWidth = table?.style.minWidth ?? '';
	const originalSizingCellWidth = sizingCell?.style.width ?? '';
	const originalOverflowX = overflowContainer?.style.overflowX ?? '';

	if ( options.showAll && table && overflowContainer && sizingCell ) {
		const tableWidth = table.getBoundingClientRect().width;
		const firstColumnWidth = sizingCell.getBoundingClientRect().width;
		const requiredFirstColumnWidth = HANDLE_GUTTER_PX + MIN_FIRST_COLUMN_CONTENT_WIDTH_PX;
		const extraWidth = Math.max( 0, requiredFirstColumnWidth - firstColumnWidth );

		if ( extraWidth > 0 ) {
			overflowContainer.style.overflowX = 'auto';
			table.style.minWidth = `${ tableWidth + extraWidth }px`;
			sizingCell.style.width = `${ firstColumnWidth + extraWidth }px`;
		}
	}

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

		descriptionSequence += 1;
		const descriptionBaseId = `yamabiko-table-reorder-description-${ descriptionSequence }`;
		const pointerDescriptionId = `${ descriptionBaseId }-pointer`;
		const keyboardDescriptionId = `${ descriptionBaseId }-keyboard`;
		const rowControlName = getRowControlName( rowIndex + 1, rowLabel );
		const pointerDescription = getRowControlPointerDescription();
		const keyboardDescription = getRowControlKeyboardDescription();
		const usePointerDescription = ! options.showAll;

		const mount = document.createElement( 'span' );
		mount.style.display = 'contents';
		firstCell.prepend( mount );
		const root = createRoot( mount );
		let isPressed = false;
		let tooltipText: string | undefined = usePointerDescription
			? getPointerHandleTooltip()
			: undefined;
		let descriptionId: string | undefined = usePointerDescription
			? pointerDescriptionId
			: undefined;

		const renderControl = () => {
			const anchor = createElement(
				'button',
				{
					'aria-describedby': isPressed ? undefined : descriptionId,
					'aria-label': rowControlName,
					'aria-pressed': isPressed,
					className: HANDLE_ZONE_CLASS,
					contentEditable: false,
					type: 'button',
				},
				createElement(
					'span',
					{
						'aria-hidden': true,
						className: HANDLE_CLASS,
					},
					createElement( Icon, {
						icon: dragHandle,
						size: 20,
					} )
				),
				createElement(
					'span',
					{
						className: DESCRIPTION_CLASS,
						id: pointerDescriptionId,
					},
					pointerDescription
				),
				createElement(
					'span',
					{
						className: DESCRIPTION_CLASS,
						id: keyboardDescriptionId,
					},
					keyboardDescription
				)
			);
			root.render(
				createElement( Tooltip, {
					children: anchor,
					text: isPressed ? undefined : tooltipText,
				} )
			);
		};

		flushSync( renderControl );
		const renderedControl = mount.querySelector< HTMLButtonElement >( `.${ HANDLE_ZONE_CLASS }` );
		if ( ! renderedControl ) {
			root.unmount();
			mount.remove();
			continue;
		}

		const handle = renderedControl.querySelector< HTMLSpanElement >( `.${ HANDLE_CLASS }` );
		if ( ! handle ) {
			root.unmount();
			mount.remove();
			continue;
		}

		renderedControl.dataset.visible = options.showAll ? 'true' : 'false';

		const setPressed = ( nextIsPressed: boolean ) => {
			if ( isPressed === nextIsPressed ) {
				return;
			}
			isPressed = nextIsPressed;
			flushSync( renderControl );
		};
		const onFocus = () => {
			tooltipText = getKeyboardHandleTooltip();
			descriptionId = keyboardDescriptionId;
			renderControl();
		};
		const onBlur = () => {
			if ( usePointerDescription ) {
				tooltipText = getPointerHandleTooltip();
				descriptionId = pointerDescriptionId;
			} else {
				tooltipText = undefined;
				descriptionId = undefined;
			}
			renderControl();
		};
		renderedControl.addEventListener( 'focus', onFocus );
		renderedControl.addEventListener( 'blur', onBlur );

		cleanupControlRoots.push( () => {
			renderedControl.removeEventListener( 'focus', onFocus );
			renderedControl.removeEventListener( 'blur', onBlur );
			root.unmount();
			mount.remove();
		} );
		entries.push( { control: renderedControl, row, setPressed } );
	}

	const setVisible = ( entry: RowControlEntry, isVisible: boolean ) => {
		if ( isVisible && ! options.showAll ) {
			for ( const otherEntry of entries ) {
				if ( otherEntry !== entry ) {
					otherEntry.control.dataset.visible = 'false';
				}
			}
		}
		entry.control.dataset.visible = isVisible ? 'true' : 'false';
	};

	const cleanup = () => {
		for ( const cleanupControlRoot of cleanupControlRoots ) {
			cleanupControlRoot();
		}
		for ( const { cell, paddingInlineStart, position } of changedCells ) {
			cell.style.paddingInlineStart = paddingInlineStart;
			cell.style.position = position;
		}
		if ( table ) {
			table.style.minWidth = originalTableMinWidth;
		}
		if ( sizingCell ) {
			sizingCell.style.width = originalSizingCellWidth;
		}
		if ( overflowContainer ) {
			overflowContainer.style.overflowX = originalOverflowX;
		}
	};

	return { entries, setVisible, cleanup };
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
