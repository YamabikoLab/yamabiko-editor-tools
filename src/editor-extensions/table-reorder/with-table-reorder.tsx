import { BlockControls } from '@wordpress/block-editor';
import type { BlockEditProps } from '@wordpress/blocks';
import { ToolbarButton } from '@wordpress/components';
import { useDispatch } from '@wordpress/data';
import { useEffect, useRef, useState, type ComponentType } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';

import {
	createHoverHandles,
	createInsertionLine,
	createTouchDragUi,
	fixFallbackRowCellWidths,
	HANDLE_ZONE_CLASS,
	type HoverHandleEntry,
	NON_MOVABLE_ROW_CLASS,
	stopHoverHandleInteractionPropagation,
	TOUCH_CHOSEN_CLASS,
} from './drag-ui';
import { getEndInsertionIndex, getMoveInsertionIndex, reorderRows } from './row-order';
import { getForbiddenInsertionIndices, getNonMovableRowIndices, getRowspanRanges } from './rowspan';
import { ensureSortableRuntime } from './sortable-runtime';
import { findBlockElement, resolveTableContext } from './table-context';

const HOVER_REORDER_MEDIA_QUERY = '(hover: hover) and (pointer: fine)';
const AUTO_SCROLL_SENSITIVITY_PX = 80;
const AUTO_SCROLL_SPEED_PX = 8;
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

type TableReorderConfigWindow = Window & {
	yamabikoEditorToolsTableReorder?: {
		runtimeUrl?: string;
	};
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

export const withTableReorder = ( BlockEdit: ComponentType< TableBlockEditProps > ) =>
	function WithTableReorder( props: TableBlockEditProps ) {
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

			const runtimeUrl = ( window as TableReorderConfigWindow ).yamabikoEditorToolsTableReorder
				?.runtimeUrl;
			if ( ! runtimeUrl ) {
				return;
			}

			const context = resolveTableContext( anchor, clientId );
			if ( ! context ) {
				return;
			}
			const { blockElement, document, window: view, tbody } = context;

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
			const hoverHandles = useHoverMode
				? createHoverHandles( document, tbody, nonMovableRowIndices )
				: null;
			const touchDragUi = useTouchMode
				? createTouchDragUi( document, tbody, nonMovableRowIndices )
				: null;
			const entries = hoverHandles?.entries ?? [];
			const entryByZone = new Map( entries.map( ( entry ) => [ entry.zone, entry ] ) );
			const blockSelectionEvents = [ 'pointerdown', 'mousedown', 'click' ] as const;
			for ( const eventName of blockSelectionEvents ) {
				tbody.addEventListener( eventName, stopHoverHandleInteractionPropagation );
			}

			let cancelled = false;
			let sortable: SortableInstance | null = null;
			let dragRows: HTMLTableRowElement[] | null = null;
			let activeEntry: HoverHandleEntry | null = null;
			let isDragging = false;
			let blockDragSuppressed = false;
			let originalDraggable: string | null = null;
			let touchPress: TouchPress | null = null;
			let restoreFallbackCellWidths: () => void = () => undefined;

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
			const activateEntry = ( entry: HoverHandleEntry ) => {
				if ( ! useHoverMode || ! hoverHandles ) {
					return;
				}

				if ( activeEntry && activeEntry !== entry ) {
					hoverHandles.setVisible( activeEntry, false );
				}
				activeEntry = entry;
				suppressBlockDrag();
				hoverHandles.setVisible( entry, true );
			};
			const deactivateEntry = ( entry: HoverHandleEntry ) => {
				if ( isDragging && activeEntry === entry ) {
					return;
				}

				hoverHandles?.setVisible( entry, false );
				if ( activeEntry === entry ) {
					activeEntry = null;
					restoreBlockDrag();
				}
			};
			const releaseEntry = () => {
				isDragging = false;
				if ( activeEntry ) {
					hoverHandles?.setVisible( activeEntry, false );
				}
				activeEntry = null;
				restoreBlockDrag();
			};
			const onZonePointerEnter = ( event: PointerEvent ) => {
				if ( event.pointerType !== 'mouse' || isDragging ) {
					return;
				}

				const entry = entryByZone.get( event.currentTarget as HTMLElement );
				if ( entry ) {
					activateEntry( entry );
				}
			};
			const onZonePointerLeave = ( event: PointerEvent ) => {
				if ( event.pointerType !== 'mouse' ) {
					return;
				}

				const entry = entryByZone.get( event.currentTarget as HTMLElement );
				if ( entry ) {
					deactivateEntry( entry );
				}
			};
			const onZonePointerDown = ( event: PointerEvent ) => {
				if ( event.pointerType !== 'mouse' ) {
					return;
				}

				const entry = entryByZone.get( event.currentTarget as HTMLElement );
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
						insertionLine.hide();
						dragRows = Array.from( tbody.rows );
						restoreFallbackCellWidths();
						restoreFallbackCellWidths = fixFallbackRowCellWidths( event.item );
					},
					onStart: () => {
						insertionLine.hide();
						isDragging = true;
						suppressBlockDrag();
						if ( activeEntry ) {
							hoverHandles?.setVisible( activeEntry, true );
						}
					},
					onMove: ( event ) => {
						if ( ! dragRows ) {
							insertionLine.hide();
							return;
						}

						const insertionIndex = getMoveInsertionIndex( event, dragRows );
						if ( insertionIndex === null ) {
							insertionLine.hide();
							return;
						}

						if ( forbiddenInsertionIndices.includes( insertionIndex ) ) {
							insertionLine.hide();
							return false;
						}

						const relatedRow = event.related.closest< HTMLTableRowElement >( 'tr' );
						if ( ! relatedRow || relatedRow.parentElement !== tbody ) {
							insertionLine.hide();
							return;
						}

						insertionLine.show( relatedRow, event.willInsertAfter );
					},
					onEnd: ( event ) => {
						insertionLine.hide();
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
						insertionLine.hide();
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
				insertionLine.cleanup();
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
				}
				for ( const eventName of blockSelectionEvents ) {
					tbody.removeEventListener( eventName, stopHoverHandleInteractionPropagation );
				}
				if ( dragRows ) {
					restoreOriginalRowOrder( tbody, dragRows );
					dragRows = null;
				}
				releaseEntry();
				hoverHandles?.cleanup();
				touchDragUi?.cleanup();
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

export { findBlockElement, restoreOriginalRowOrder };
