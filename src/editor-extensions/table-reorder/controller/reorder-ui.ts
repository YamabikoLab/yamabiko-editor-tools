/**
 * Table Reorderの待機中から存在する行controlと操作中UIを管理する。
 *
 * 移動可能行ごとのnative button、accessible name / description、表示状態、先頭cellの
 * handle gutter、操作中の案内、live status、単一ポインター用targetとcleanupを所有する。
 * drag中だけの一時UIは扱わない。
 */

import { Tooltip } from '@wordpress/components';
import { createElement, createRoot, flushSync } from '@wordpress/element';
import { dragHandle, Icon } from '@wordpress/icons';

import {
	getCancelName,
	getDestinationBeforeName,
	getDestinationEndName,
	getEmptyRowLabel,
	getKeyboardHandleTooltip,
	getPcPointerActiveMessage,
	getPointerHandleTooltip,
	getRowControlKeyboardDescription,
	getRowControlName,
	getRowControlPointerDescription,
	getTouchPointerActiveMessage,
} from '../messages';
import type { RowMoveTarget } from './row-order';

/** 行control本体に付与するclass。SortableJSのhandle selectorとしても利用する。 */
export const HANDLE_ZONE_CLASS = 'yamabiko-table-reorder-handle-zone';

/** 行control内のdrag handle表示に付与するclass。 */
const HANDLE_CLASS = 'yamabiko-table-reorder-handle';

/** 支援技術向け説明文に付与するclass。 */
const DESCRIPTION_CLASS = 'yamabiko-table-reorder-description';

/** 単一ポインター操作の移動先buttonに付与するclass。 */
export const DESTINATION_CLASS = 'yamabiko-table-reorder-destination';

/** 操作中の案内に付与するclass。 */
const GUIDANCE_CLASS = 'yamabiko-table-reorder-pointer-guidance';

/** タッチの明示的キャンセルbuttonに付与するclass。 */
const CANCEL_CLASS = 'yamabiko-table-reorder-pointer-cancel';

/** live statusに付与するclass。 */
const LIVE_STATUS_CLASS = 'yamabiko-table-reorder-live-status';

/** 行control用に先頭cellへ確保するinline方向の幅。 */
const HANDLE_GUTTER_PX = 32;

/** accessible nameへ含める代表情報の最大文字数。 */
const MAX_ROW_LABEL_LENGTH = 80;

/** touch target上の移動をtapではなくscroll gestureとして扱う距離。 */
const POINTER_TAP_THRESHOLD_PX = 5;

/** keyboard scroll追従でviewport端に確保する最小余白。 */
const KEYBOARD_SCROLL_MARGIN_PX = 24;

/** 操作案内をviewport端から離す余白。 */
const GUIDANCE_VIEWPORT_OFFSET_PX = 8;

/** 行controlの説明要素へ一意なIDを割り当てるための連番。 */
let descriptionSequence = 0;

/** owning documentごとに一つだけ共有するlive status。 */
const liveStatusByDocument = new WeakMap< Document, HTMLElement >();

/** 行control 1件を構成するDOM node。 */
export type RowControlEntry = {
	control: HTMLButtonElement;
	handle: HTMLSpanElement;
	row: HTMLTableRowElement;
	setPressed: ( isPressed: boolean ) => void;
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
 * owning document内のlive statusへ一つの通知を送る。
 *
 * 同一nodeをdocumentごとに共有し、同じ文言を再通知する必要がある場合にもDOM更新が発生するよう
 * 一度空にしてからmicrotaskで設定する。連続通知の抑制は操作状態を知るcontroller側が担当する。
 *
 * @param document 通知先のeditor document。
 * @param message  支援技術へ通知する文言。
 */
export const announceLiveStatus = ( document: Document, message: string ) => {
	let status = liveStatusByDocument.get( document );
	if ( ! status || ! status.isConnected ) {
		status = document.createElement( 'div' );
		status.className = `${ DESCRIPTION_CLASS } ${ LIVE_STATUS_CLASS }`;
		status.setAttribute( 'role', 'status' );
		status.setAttribute( 'aria-live', 'polite' );
		status.setAttribute( 'aria-atomic', 'true' );
		document.body.append( status );
		liveStatusByDocument.set( document, status );
	}

	status.textContent = '';
	queueMicrotask( () => {
		if ( status?.isConnected ) {
			status.textContent = message;
		}
	} );
};

/**
 * Tableに関連付く操作中案内をowning documentへ追加する。
 *
 * fixed配置でスクロール中も確認できる状態を保つ。既定はviewport上側で、利用者が確認したい
 * 移動方向を覆わないよう必要に応じて上側 / 下側を切り替えられる。
 *
 * @param document 案内を生成するeditor document。
 * @param tbody    対象Table body。
 * @param message  表示する案内文。
 * @return 案内のlifecycle。
 */
export const createReorderGuidance = (
	document: Document,
	tbody: HTMLTableSectionElement,
	message: string
): ReorderGuidanceUi => {
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

	updatePosition();
	view?.addEventListener( 'resize', updatePosition );
	view?.addEventListener( 'scroll', updatePosition, true );

	return {
		element: guidance,
		setHidden: ( isHidden ) => {
			guidance.hidden = isHidden;
		},
		setPosition: ( nextPosition ) => {
			if ( position === nextPosition ) {
				return;
			}
			position = nextPosition;
			updatePosition();
		},
		cleanup: () => {
			view?.removeEventListener( 'resize', updatePosition );
			view?.removeEventListener( 'scroll', updatePosition, true );
			guidance.remove();
		},
	};
};

/**
 * keyboard候補が実際にviewport外へ進んだとき、その候補を確認できる位置までowning windowを
 * 必要最小限だけ縦scrollする。
 *
 * 候補が変化しない境界操作からは呼び出さない。
 *
 * @param view           owning window。
 * @param tbody          対象Table body。
 * @param insertionIndex 現在候補の挿入位置。
 */
export const scrollKeyboardDestinationIntoView = (
	view: Window,
	tbody: HTMLTableSectionElement,
	insertionIndex: number
) => {
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
			flushSync( renderControl );
		};
		const onBlur = () => {
			if ( usePointerDescription ) {
				tooltipText = getPointerHandleTooltip();
				descriptionId = pointerDescriptionId;
			} else {
				tooltipText = undefined;
				descriptionId = undefined;
			}
			flushSync( renderControl );
		};
		renderedControl.addEventListener( 'focus', onFocus );
		renderedControl.addEventListener( 'blur', onBlur );

		cleanupControlRoots.push( () => {
			renderedControl.removeEventListener( 'focus', onFocus );
			renderedControl.removeEventListener( 'blur', onBlur );
			root.unmount();
			mount.remove();
		} );
		entries.push( { control: renderedControl, handle, row, setPressed } );
	}

	return {
		entries,
		setVisible: ( entry, isVisible ) => {
			if ( isVisible && ! options.showAll ) {
				for ( const otherEntry of entries ) {
					if ( otherEntry !== entry ) {
						otherEntry.control.dataset.visible = 'false';
					}
				}
			}
			entry.control.dataset.visible = isVisible ? 'true' : 'false';
		},
		cleanup: () => {
			for ( const cleanupControlRoot of cleanupControlRoots ) {
				cleanupControlRoot();
			}
			for ( const { cell, paddingInlineStart, position } of changedCells ) {
				cell.style.paddingInlineStart = paddingInlineStart;
				cell.style.position = position;
			}
		},
	};
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
		options.isTouch ? getTouchPointerActiveMessage() : getPcPointerActiveMessage()
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