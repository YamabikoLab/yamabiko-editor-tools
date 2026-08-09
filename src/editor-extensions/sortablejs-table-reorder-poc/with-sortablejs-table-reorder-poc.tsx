import type { BlockEditProps } from '@wordpress/blocks';
import { useEffect, useRef, type ComponentType } from '@wordpress/element';

const SORTABLE_SCRIPT_ID = 'yamabiko-sortablejs-poc-runtime';
const HANDLE_CLASS = 'yamabiko-sortablejs-poc-handle';
const HANDLE_ZONE_CLASS = 'yamabiko-sortablejs-poc-handle-zone';
const HOVER_REORDER_MEDIA_QUERY = '(hover: hover) and (pointer: fine)';
const HANDLE_FADE_MS = 300;
const HANDLE_GUTTER_PX = 32;

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

type SortableMoveEventLike = {
	related: HTMLElement;
	willInsertAfter: boolean;
};

type SortableInstance = {
	destroy: () => void;
};

type SortableRuntime = {
	create: (
		element: HTMLElement,
		options: {
			animation: number;
			draggable: string;
			forceFallback: boolean;
			handle: string;
			onChoose: () => void;
			onEnd: ( event: SortableEventLike ) => void;
			onMove: ( event: SortableMoveEventLike, originalEvent: Event ) => void;
			onStart: () => void;
		}
	) => SortableInstance;
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

const addMinimalHandles = (
	document: Document,
	tbody: HTMLTableSectionElement
): MinimalHandles => {
	const entries: MinimalHandle[] = [];
	const changedCells: Array< {
		cell: HTMLTableCellElement;
		paddingInlineStart: string;
		position: string;
	} > = [];
	const view = document.defaultView;

	for ( const row of Array.from( tbody.rows ) ) {
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
			setAttributes,
		} = props;
		const isTableBlock = props.name === 'core/table';

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

			const hoverMedia = view.matchMedia( HOVER_REORDER_MEDIA_QUERY );
			const { entries, restoreCellStyles } = addMinimalHandles( document, tbody );
			const entryByZone = new Map( entries.map( ( entry ) => [ entry.zone, entry ] ) );

			const blockSelectionEvents = [ 'pointerdown', 'mousedown', 'click' ] as const;
			for ( const eventName of blockSelectionEvents ) {
				tbody.addEventListener( eventName, stopHandleInteractionPropagation );
			}

			let cancelled = false;
			let sortable: SortableInstance | null = null;
			let dragRows: HTMLTableRowElement[] | null = null;
			let lastMoveRelatedIndex: number | null = null;
			let activeEntry: MinimalHandle | null = null;
			let isDragging = false;
			let blockDragSuppressed = false;
			let originalDraggable: string | null = null;

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
				if ( ! hoverMedia.matches ) {
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
			const onHoverCapabilityChange = () => {
				if ( ! hoverMedia.matches ) {
					releaseEntry();
				}
			};

			for ( const { zone } of entries ) {
				zone.addEventListener( 'pointerenter', onZonePointerEnter );
				zone.addEventListener( 'pointerleave', onZonePointerLeave );
				zone.addEventListener( 'pointerdown', onZonePointerDown );
			}
			hoverMedia.addEventListener( 'change', onHoverCapabilityChange );

			const hoveredEntry = entries.find( ( entry ) => entry.zone.matches( ':hover' ) );
			if ( hoveredEntry ) {
				activateEntry( hoveredEntry );
			}

			void ensureSortableRuntime( document, view, runtimeUrl ).then( ( Sortable ) => {
				if ( cancelled || ! Sortable ) {
					return;
				}

				sortable = Sortable.create( tbody, {
					animation: 150,
					draggable: 'tr',
					forceFallback: true,
					handle: `.${ HANDLE_ZONE_CLASS }`,
					onChoose: () => {
						dragRows = Array.from( tbody.rows );
					},
					onStart: () => {
						isDragging = true;
						lastMoveRelatedIndex = null;
						if ( activeEntry ) {
							setHandleVisible( activeEntry, true );
						}
					},
					onMove: ( event ) => {
						const relatedRow = event.related.closest( 'tr' );
						const relatedIndex = relatedRow ? Array.from( tbody.rows ).indexOf( relatedRow ) : -1;

						if ( relatedIndex !== lastMoveRelatedIndex ) {
							lastMoveRelatedIndex = relatedIndex;
						}
					},
					onEnd: ( event ) => {
						isDragging = false;

						if ( dragRows ) {
							restoreOriginalRowOrder( tbody, dragRows );
							dragRows = null;
						}
						lastMoveRelatedIndex = null;

						const hoveredAfterDrag = entries.find( ( entry ) => entry.zone.matches( ':hover' ) );
						if ( hoveredAfterDrag ) {
							activateEntry( hoveredAfterDrag );
						} else {
							releaseEntry();
						}

						const { oldIndex, newIndex } = event;
						if ( oldIndex === undefined || newIndex === undefined || oldIndex === newIndex ) {
							return;
						}

						if ( ! Array.isArray( body ) ) {
							return;
						}

						const reorderedBody = reorderRows( body, oldIndex, newIndex );
						if ( ! reorderedBody ) {
							return;
						}

						setAttributes( { body: reorderedBody } );
					},
				} );
			} );

			return () => {
				cancelled = true;
				sortable?.destroy();
				for ( const { zone } of entries ) {
					zone.removeEventListener( 'pointerenter', onZonePointerEnter );
					zone.removeEventListener( 'pointerleave', onZonePointerLeave );
					zone.removeEventListener( 'pointerdown', onZonePointerDown );
				}
				hoverMedia.removeEventListener( 'change', onHoverCapabilityChange );
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
		}, [ body, clientId, isTableBlock, setAttributes ] );

		if ( ! isTableBlock ) {
			return <BlockEdit { ...props } />;
		}

		return (
			<>
				<BlockEdit { ...props } />
				<span aria-hidden="true" hidden ref={ anchorRef } />
			</>
		);
	};
