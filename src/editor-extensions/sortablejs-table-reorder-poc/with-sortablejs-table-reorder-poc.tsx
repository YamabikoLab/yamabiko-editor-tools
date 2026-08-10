import { BlockControls } from '@wordpress/block-editor';
import type { BlockEditProps } from '@wordpress/blocks';
import { ToolbarButton } from '@wordpress/components';
import { useDispatch } from '@wordpress/data';
import { useEffect, useRef, useState, type ComponentType } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';

import { getForbiddenInsertionIndices, getNonMovableRowIndices, getRowspanRanges } from './rowspan';

const SORTABLE_SCRIPT_ID = 'yamabiko-sortablejs-poc-runtime';
const HANDLE_CLASS = 'yamabiko-sortablejs-poc-handle';
const HANDLE_ZONE_CLASS = 'yamabiko-sortablejs-poc-handle-zone';
const NON_MOVABLE_ROW_CLASS = 'yamabiko-sortablejs-poc-non-movable-row';
const INSERTION_LINE_CLASS = 'yamabiko-sortablejs-poc-insertion-line';
const TOUCH_CHOSEN_CLASS = 'yamabiko-sortablejs-poc-touch-chosen';
const HOVER_REORDER_MEDIA_QUERY = '(hover: hover) and (pointer: fine)';
const AUTO_SCROLL_SENSITIVITY_PX = 80;
const AUTO_SCROLL_SPEED_PX = 8;
const HANDLE_FADE_MS = 300;
const HANDLE_GUTTER_PX = 32;
const INSERTION_LINE_HEIGHT_PX = 2;
const TOUCH_DRAG_DELAY_MS = 300;
const TOUCH_START_THRESHOLD_PX = 5;

type TableAttributes = Record< string, unknown > & {
	body?: unknown[];
};

type TableBlockEditProps = BlockEditProps< TableAttributes > & {
	name: string;
};

type SortableEventLike = {
	newIndex?: number;
	oldIndex?: number;
};

type SortableChooseEventLike = {
	item: HTMLElement;
};

type SortableMoveEventLike = {
	related: HTMLElement;
	willInsertAfter: boolean;
};

type SortableInstance = {
	destroy: () => void;
};

type SortableOptions = {
	animation: number;
	bubbleScroll: boolean;
	chosenClass?: string;
	delay?: number;
	draggable: string;
	forceFallback: boolean;
	handle?: string;
	onChoose: ( event: SortableChooseEventLike ) => void;
	onEnd: ( event: SortableEventLike ) => void;
	onMove: ( event: SortableMoveEventLike, originalEvent: Event ) => boolean | void;
	onStart: () => void;
	onUnchoose: () => void;
	scroll: boolean;
	scrollSensitivity: number;
	scrollSpeed: number;
	touchStartThreshold?: number;
};

type SortableRuntime = {
	create: ( element: HTMLElement, options: SortableOptions ) => SortableInstance;
};

type SortableWindow = Window & {
	Sortable?: SortableRuntime;
};

type PocConfigWindow = Window & {
	yamabikoEditorToolsSortableJsPoc?: {
		runtimeUrl?: string;
	};
};

type MinimalHandle = {
	handle: HTMLElement;
	zone: HTMLElement;
};

type MinimalHandles = {
	entries: MinimalHandle[];
	restoreCellStyles: () => void;
};

type TouchPress = {
	longPressReached: boolean;
	moved: boolean;
	noticeTimer: number | null;
	pointerId: number;
	rowIndex: number;
	startX: number;
	startY: number;
	startedAt: number;
};

const restoreOriginalRowOrder = (
	tbody: HTMLTableSectionElement,
	rows: readonly HTMLTableRowElement[]
) => {
	for ( const row of rows ) {
		tbody.append( row );
	}
};

const reorderRows = (
	rows: readonly unknown[],
	oldIndex: number,
	newIndex: number
): unknown[] | null => {
	if (
		! Number.isInteger( oldIndex ) ||
		! Number.isInteger( newIndex ) ||
		oldIndex < 0 ||
		newIndex < 0 ||
		oldIndex >= rows.length ||
		newIndex >= rows.length
	) {
		return null;
	}

	const reordered = [ ...rows ];
	const [ movedRow ] = reordered.splice( oldIndex, 1 );
	reordered.splice( newIndex, 0, movedRow );
	return reordered;
};

const getMoveInsertionIndex = (
	event: SortableMoveEventLike,
	rows: readonly HTMLTableRowElement[]
): number | null => {
	const relatedRow = event.related.closest< HTMLTableRowElement >( 'tr' );
	if ( ! relatedRow ) {
		return null;
	}

	const relatedIndex = rows.indexOf( relatedRow );
	return relatedIndex < 0 ? null : relatedIndex + ( event.willInsertAfter ? 1 : 0 );
};

const getEndInsertionIndex = ( oldIndex: number, newIndex: number ): number =>
	newIndex > oldIndex ? newIndex + 1 : newIndex;

const createInsertionLine = ( document: Document ): HTMLDivElement => {
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
	return line;
};

const hideInsertionLine = ( line: HTMLElement ) => {
	line.style.display = 'none';
};

const showInsertionLine = (
	line: HTMLElement,
	row: HTMLTableRowElement,
	willInsertAfter: boolean
) => {
	const rect = row.getBoundingClientRect();
	line.style.left = `${ rect.left }px`;
	line.style.top = `${ willInsertAfter ? rect.bottom : rect.top }px`;
	line.style.width = `${ rect.width }px`;
	line.style.display = 'block';
};

const createTouchChosenStyle = ( document: Document ): HTMLStyleElement => {
	const style = document.createElement( 'style' );
	style.textContent = `.${ TOUCH_CHOSEN_CLASS } { outline: 2px solid var(--wp-admin-theme-color, #3858e9); outline-offset: -2px; }`;
	document.head.append( style );
	return style;
};

const disableTouchCellEditing = ( tbody: HTMLTableSectionElement ): ( () => void ) => {
	const editableElements = Array.from(
		tbody.querySelectorAll< HTMLElement >( '[contenteditable="true"]' )
	);
	const originalPointerEvents = editableElements.map( ( element ) => ( {
		element,
		pointerEvents: element.style.pointerEvents,
	} ) );

	for ( const element of editableElements ) {
		element.style.pointerEvents = 'none';
	}

	return () => {
		for ( const { element, pointerEvents } of originalPointerEvents ) {
			element.style.pointerEvents = pointerEvents;
		}
	};
};

const fixRowCellWidthsForFallback = ( row: HTMLElement ): ( () => void ) => {
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

const addMinimalHandles = (
	document: Document,
	tbody: HTMLTableSectionElement,
	nonMovableRowIndices: readonly number[]
): MinimalHandles => {
	const entries: MinimalHandle[] = [];
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
		restoreCellStyles: () => {
			for ( const { cell, paddingInlineStart, position } of changedCells ) {
				cell.style.paddingInlineStart = paddingInlineStart;
				cell.style.position = position;
			}
		},
	};
};

const setHandleVisible = ( entry: MinimalHandle, isVisible: boolean ) => {
	entry.handle.style.opacity = isVisible ? '1' : '0';
};

const isHandleInteraction = ( event: Event ): boolean => {
	const target = event.target as Element | null;
	return Boolean( target?.closest?.( `.${ HANDLE_ZONE_CLASS }` ) );
};

const stopHandleInteractionPropagation = ( event: Event ) => {
	if ( isHandleInteraction( event ) ) {
		event.stopPropagation();
	}
};

const findBlockElement = ( rootDocument: Document, clientId: string ): HTMLElement | null => {
	const selector = `[data-block="${ clientId }"]`;
	const directBlock = rootDocument.querySelector< HTMLElement >( selector );
	if ( directBlock ) {
		return directBlock;
	}

	const iframe = rootDocument.querySelector< HTMLIFrameElement >( 'iframe[name="editor-canvas"]' );
	return iframe?.contentDocument?.querySelector< HTMLElement >( selector ) ?? null;
};

const ensureSortableRuntime = (
	document: Document,
	view: SortableWindow,
	runtimeUrl: string
): Promise< SortableRuntime | null > => {
	if ( view.Sortable ) {
		return Promise.resolve( view.Sortable );
	}

	const existingScript = document.getElementById( SORTABLE_SCRIPT_ID ) as HTMLScriptElement | null;
	if ( existingScript ) {
		return new Promise( ( resolve ) => {
			const onLoad = () => resolve( view.Sortable ?? null );
			const onError = () => resolve( null );
			existingScript.addEventListener( 'load', onLoad, { once: true } );
			existingScript.addEventListener( 'error', onError, { once: true } );

			view.setTimeout( () => {
				if ( view.Sortable ) {
					resolve( view.Sortable );
				}
			}, 0 );
		} );
	}

	return new Promise( ( resolve ) => {
		const script = document.createElement( 'script' );
		script.id = SORTABLE_SCRIPT_ID;
		script.src = runtimeUrl;
		script.addEventListener(
			'load',
			() => {
				resolve( view.Sortable ?? null );
			},
			{ once: true }
		);
		script.addEventListener(
			'error',
			() => {
				resolve( null );
			},
			{ once: true }
		);
		document.head.append( script );
	} );
};

export const withSortableJsTableReorderPoc = ( BlockEdit: ComponentType< TableBlockEditProps > ) =>
	function WithSortableJsTableReorderPoc( props: TableBlockEditProps ) {
		const anchorRef = useRef< HTMLSpanElement >( null );
		const {
			attributes: { body },
			clientId,
			isSelected,
			setAttributes,
		} = props;
		const isTableBlock = props.name === 'core/table';
		const { createNotice } = useDispatch( noticesStore );
		const [ isHoverCapable, setIsHoverCapable ] = useState(
			() => window.matchMedia( HOVER_REORDER_MEDIA_QUERY ).matches
		);
		const [ isTouchReorderMode, setIsTouchReorderMode ] = useState( false );

		useEffect( () => {
			if ( ! isTableBlock ) {
				return;
			}

			const hoverMedia = window.matchMedia( HOVER_REORDER_MEDIA_QUERY );
			const syncHoverCapability = () => {
				setIsHoverCapable( hoverMedia.matches );
				if ( hoverMedia.matches ) {
					setIsTouchReorderMode( false );
				}
			};

			syncHoverCapability();
			hoverMedia.addEventListener( 'change', syncHoverCapability );
			return () => {
				hoverMedia.removeEventListener( 'change', syncHoverCapability );
			};
		}, [ isTableBlock ] );

		useEffect( () => {
			if ( ! isSelected ) {
				setIsTouchReorderMode( false );
			}
		}, [ isSelected ] );

		useEffect( () => {
			if ( ! isTableBlock ) {
				return;
			}

			const anchor = anchorRef.current;
			if ( ! anchor ) {
				return;
			}

			const runtimeUrl = ( window as PocConfigWindow ).yamabikoEditorToolsSortableJsPoc?.runtimeUrl;
			if ( ! runtimeUrl ) {
				return;
			}

			const blockElement = findBlockElement( anchor.ownerDocument, clientId );
			const document = blockElement?.ownerDocument ?? null;
			const view = document?.defaultView as SortableWindow | null;
			const table = blockElement?.querySelector< HTMLTableElement >( 'table' ) ?? null;
			const tbody = table?.tBodies.item( 0 ) ?? null;
			if ( ! blockElement || ! document || ! view || ! table || ! tbody ) {
				return;
			}

			const rowspanRanges = getRowspanRanges( body );
			const nonMovableRowIndices = getNonMovableRowIndices( rowspanRanges );
			const nonMovableRows = new Set( nonMovableRowIndices );
			const hoverMedia = view.matchMedia( HOVER_REORDER_MEDIA_QUERY );
			const useHoverMode = isHoverCapable && hoverMedia.matches;
			const useTouchMode = ! useHoverMode && isSelected && isTouchReorderMode;
			if ( ! useHoverMode && ! useTouchMode ) {
				return;
			}

			const forbiddenInsertionIndices = getForbiddenInsertionIndices( rowspanRanges );
			const insertionLine = createInsertionLine( document );

			let entries: MinimalHandle[] = [];
			let restoreCellStyles: () => void = () => undefined;
			let restoreTouchCellEditing: () => void = () => undefined;
			let restoreFallbackCellWidths: () => void = () => undefined;
			let touchChosenStyle: HTMLStyleElement | null = null;
			if ( useHoverMode ) {
				const handles = addMinimalHandles( document, tbody, nonMovableRowIndices );
				entries = handles.entries;
				restoreCellStyles = handles.restoreCellStyles;
			} else {
				restoreTouchCellEditing = disableTouchCellEditing( tbody );
				touchChosenStyle = createTouchChosenStyle( document );
			}

			const entryByZone = new Map( entries.map( ( entry ) => [ entry.zone, entry ] ) );
			const blockSelectionEvents = [ 'pointerdown', 'mousedown', 'click' ] as const;
			for ( const eventName of blockSelectionEvents ) {
				tbody.addEventListener( eventName, stopHandleInteractionPropagation );
			}

			let cancelled = false;
			let sortable: SortableInstance | null = null;
			let dragRows: HTMLTableRowElement[] | null = null;
			let activeEntry: MinimalHandle | null = null;
			let isDragging = false;
			let blockDragSuppressed = false;
			let originalDraggable: string | null = null;
			let touchPress: TouchPress | null = null;
			const originalUserSelect = tbody.style.userSelect;

			const suppressBlockDrag = () => {
				if ( blockDragSuppressed ) {
					return;
				}

				originalDraggable = blockElement.getAttribute( 'draggable' );
				blockElement.draggable = false;
				blockDragSuppressed = true;
			};
			const restoreBlockDrag = () => {
				if ( ! blockDragSuppressed ) {
					return;
				}

				if ( originalDraggable === null ) {
					blockElement.removeAttribute( 'draggable' );
				} else {
					blockElement.setAttribute( 'draggable', originalDraggable );
				}
				originalDraggable = null;
				blockDragSuppressed = false;
			};
			const activateEntry = ( entry: MinimalHandle ) => {
				if ( ! useHoverMode ) {
					return;
				}

				if ( activeEntry && activeEntry !== entry ) {
					setHandleVisible( activeEntry, false );
				}
				activeEntry = entry;
				suppressBlockDrag();
				setHandleVisible( entry, true );
			};
			const deactivateEntry = ( entry: MinimalHandle ) => {
				if ( isDragging && activeEntry === entry ) {
					return;
				}

				setHandleVisible( entry, false );
				if ( activeEntry === entry ) {
					activeEntry = null;
					restoreBlockDrag();
				}
			};
			const releaseEntry = () => {
				isDragging = false;
				if ( activeEntry ) {
					setHandleVisible( activeEntry, false );
				}
				activeEntry = null;
				restoreBlockDrag();
			};
			const onZonePointerEnter = ( event: PointerEvent ) => {
				if ( event.pointerType !== 'mouse' || isDragging ) {
					return;
				}

				const zone = event.currentTarget as HTMLElement;
				const entry = entryByZone.get( zone );
				if ( entry ) {
					activateEntry( entry );
				}
			};
			const onZonePointerLeave = ( event: PointerEvent ) => {
				if ( event.pointerType !== 'mouse' ) {
					return;
				}

				const zone = event.currentTarget as HTMLElement;
				const entry = entryByZone.get( zone );
				if ( entry ) {
					deactivateEntry( entry );
				}
			};
			const onZonePointerDown = ( event: PointerEvent ) => {
				if ( event.pointerType !== 'mouse' ) {
					return;
				}

				const zone = event.currentTarget as HTMLElement;
				const entry = entryByZone.get( zone );
				if ( entry ) {
					activateEntry( entry );
				}
			};

			const clearTouchNoticeTimer = () => {
				if ( touchPress?.noticeTimer !== null && touchPress?.noticeTimer !== undefined ) {
					view.clearTimeout( touchPress.noticeTimer );
					touchPress.noticeTimer = null;
				}
			};
			const resetTouchPress = () => {
				clearTouchNoticeTimer();
				touchPress = null;
			};
			const onTouchPointerDown = ( event: PointerEvent ) => {
				if ( event.pointerType === 'mouse' ) {
					return;
				}

				const target = event.target as Element | null;
				const row = target?.closest< HTMLTableRowElement >( 'tr' ) ?? null;
				if ( ! row || row.parentElement !== tbody ) {
					return;
				}

				const rowIndex = Array.from( tbody.rows ).indexOf( row );
				if ( rowIndex < 0 ) {
					return;
				}

				resetTouchPress();
				touchPress = {
					longPressReached: false,
					moved: false,
					noticeTimer: null,
					pointerId: event.pointerId,
					rowIndex,
					startX: event.clientX,
					startY: event.clientY,
					startedAt: view.performance.now(),
				};

				if ( nonMovableRows.has( rowIndex ) ) {
					touchPress.noticeTimer = view.setTimeout( () => {
						if ( ! touchPress || touchPress.moved ) {
							return;
						}

						touchPress.longPressReached = true;
						void createNotice(
							'warning',
							__( '縦結合を含む行は並び替えできません。', 'yamabiko-editor-tools' ),
							{ type: 'snackbar' }
						);
					}, TOUCH_DRAG_DELAY_MS );
				}
			};
			const onTouchPointerMove = ( event: PointerEvent ) => {
				if ( ! touchPress || event.pointerId !== touchPress.pointerId ) {
					return;
				}

				const movedDistance = Math.hypot(
					event.clientX - touchPress.startX,
					event.clientY - touchPress.startY
				);
				if ( movedDistance > TOUCH_START_THRESHOLD_PX ) {
					touchPress.moved = true;
					clearTouchNoticeTimer();
				}
			};
			const onTouchPointerUp = ( event: PointerEvent ) => {
				if ( ! touchPress || event.pointerId !== touchPress.pointerId ) {
					return;
				}

				const pressDuration = view.performance.now() - touchPress.startedAt;
				const shouldExitReorderMode =
					! touchPress.moved &&
					! touchPress.longPressReached &&
					! isDragging &&
					pressDuration < TOUCH_DRAG_DELAY_MS;
				resetTouchPress();

				if ( shouldExitReorderMode ) {
					setIsTouchReorderMode( false );
				}
			};
			const onTouchPointerCancel = ( event: PointerEvent ) => {
				if ( touchPress && event.pointerId === touchPress.pointerId ) {
					resetTouchPress();
				}
			};

			if ( useHoverMode ) {
				for ( const { zone } of entries ) {
					zone.addEventListener( 'pointerenter', onZonePointerEnter );
					zone.addEventListener( 'pointerleave', onZonePointerLeave );
					zone.addEventListener( 'pointerdown', onZonePointerDown );
				}

				const hoveredEntry = entries.find( ( entry ) => entry.zone.matches( ':hover' ) );
				if ( hoveredEntry ) {
					activateEntry( hoveredEntry );
				}
			} else {
				tbody.style.userSelect = 'none';
				for ( const rowIndex of nonMovableRowIndices ) {
					tbody.rows.item( rowIndex )?.classList.add( NON_MOVABLE_ROW_CLASS );
				}
				tbody.addEventListener( 'pointerdown', onTouchPointerDown );
				tbody.addEventListener( 'pointermove', onTouchPointerMove );
				tbody.addEventListener( 'pointerup', onTouchPointerUp );
				tbody.addEventListener( 'pointercancel', onTouchPointerCancel );
			}

			void ensureSortableRuntime( document, view, runtimeUrl ).then( ( Sortable ) => {
				if ( cancelled || ! Sortable ) {
					return;
				}

				const options: SortableOptions = {
					animation: 150,
					bubbleScroll: true,
					draggable: useTouchMode ? `tr:not(.${ NON_MOVABLE_ROW_CLASS })` : 'tr',
					forceFallback: true,
					onChoose: ( event ) => {
						hideInsertionLine( insertionLine );
						dragRows = Array.from( tbody.rows );
						restoreFallbackCellWidths();
						restoreFallbackCellWidths = fixRowCellWidthsForFallback( event.item );
					},
					onStart: () => {
						hideInsertionLine( insertionLine );
						isDragging = true;
						suppressBlockDrag();
						if ( activeEntry ) {
							setHandleVisible( activeEntry, true );
						}
					},
					onMove: ( event ) => {
						if ( ! dragRows ) {
							hideInsertionLine( insertionLine );
							return;
						}

						const insertionIndex = getMoveInsertionIndex( event, dragRows );
						if ( insertionIndex === null ) {
							hideInsertionLine( insertionLine );
							return;
						}

						if ( forbiddenInsertionIndices.includes( insertionIndex ) ) {
							hideInsertionLine( insertionLine );
							return false;
						}

						const relatedRow = event.related.closest< HTMLTableRowElement >( 'tr' );
						if ( ! relatedRow || relatedRow.parentElement !== tbody ) {
							hideInsertionLine( insertionLine );
							return;
						}

						showInsertionLine( insertionLine, relatedRow, event.willInsertAfter );
					},
					onEnd: ( event ) => {
						hideInsertionLine( insertionLine );
						isDragging = false;
						restoreFallbackCellWidths();

						if ( dragRows ) {
							restoreOriginalRowOrder( tbody, dragRows );
							dragRows = null;
						}

						if ( useHoverMode ) {
							const hoveredAfterDrag = entries.find( ( entry ) => entry.zone.matches( ':hover' ) );
							if ( hoveredAfterDrag ) {
								activateEntry( hoveredAfterDrag );
							} else {
								releaseEntry();
							}
						} else {
							restoreBlockDrag();
						}

						const { oldIndex, newIndex } = event;
						if ( oldIndex === undefined || newIndex === undefined || oldIndex === newIndex ) {
							return;
						}

						if ( ! Array.isArray( body ) ) {
							return;
						}

						const insertionIndex = getEndInsertionIndex( oldIndex, newIndex );
						if (
							nonMovableRowIndices.includes( oldIndex ) ||
							forbiddenInsertionIndices.includes( insertionIndex )
						) {
							return;
						}

						const reorderedBody = reorderRows( body, oldIndex, newIndex );
						if ( ! reorderedBody ) {
							return;
						}

						setAttributes( { body: reorderedBody } );
					},
					onUnchoose: () => {
						hideInsertionLine( insertionLine );
						restoreFallbackCellWidths();
					},
					scroll: true,
					scrollSensitivity: AUTO_SCROLL_SENSITIVITY_PX,
					scrollSpeed: AUTO_SCROLL_SPEED_PX,
				};

				if ( useHoverMode ) {
					options.handle = `.${ HANDLE_ZONE_CLASS }`;
				} else {
					options.chosenClass = TOUCH_CHOSEN_CLASS;
					options.delay = TOUCH_DRAG_DELAY_MS;
					options.touchStartThreshold = TOUCH_START_THRESHOLD_PX;
				}

				sortable = Sortable.create( tbody, options );
			} );

			return () => {
				cancelled = true;
				sortable?.destroy();
				hideInsertionLine( insertionLine );
				insertionLine.remove();
				resetTouchPress();
				restoreFallbackCellWidths();
				if ( useHoverMode ) {
					for ( const { zone } of entries ) {
						zone.removeEventListener( 'pointerenter', onZonePointerEnter );
						zone.removeEventListener( 'pointerleave', onZonePointerLeave );
						zone.removeEventListener( 'pointerdown', onZonePointerDown );
					}
				} else {
					tbody.removeEventListener( 'pointerdown', onTouchPointerDown );
					tbody.removeEventListener( 'pointermove', onTouchPointerMove );
					tbody.removeEventListener( 'pointerup', onTouchPointerUp );
					tbody.removeEventListener( 'pointercancel', onTouchPointerCancel );
					tbody.style.userSelect = originalUserSelect;
					restoreTouchCellEditing();
					touchChosenStyle?.remove();
					for ( const rowIndex of nonMovableRowIndices ) {
						tbody.rows.item( rowIndex )?.classList.remove( NON_MOVABLE_ROW_CLASS );
					}
				}
				for ( const eventName of blockSelectionEvents ) {
					tbody.removeEventListener( eventName, stopHandleInteractionPropagation );
				}
				if ( dragRows ) {
					restoreOriginalRowOrder( tbody, dragRows );
					dragRows = null;
				}
				releaseEntry();
				for ( const { zone } of entries ) {
					zone.remove();
				}
				restoreCellStyles();
			};
		}, [
			body,
			clientId,
			createNotice,
			isHoverCapable,
			isSelected,
			isTableBlock,
			isTouchReorderMode,
			setAttributes,
		] );

		if ( ! isTableBlock ) {
			return <BlockEdit { ...props } />;
		}

		return (
			<>
				<BlockEdit { ...props } />
				{ ! isHoverCapable && isSelected && (
					<BlockControls>
						<ToolbarButton
							icon="sort"
							isPressed={ isTouchReorderMode }
							label={ __( '行を並び替え', 'yamabiko-editor-tools' ) }
							onClick={ () => setIsTouchReorderMode( ( isActive ) => ! isActive ) }
							showTooltip
						/>
					</BlockControls>
				) }
				<span aria-hidden="true" hidden ref={ anchorRef } />
			</>
		);
	};
