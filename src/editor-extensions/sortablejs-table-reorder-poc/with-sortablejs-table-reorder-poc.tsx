import type { BlockEditProps } from '@wordpress/blocks';
import { useEffect, useRef, type ComponentType } from '@wordpress/element';

const LOG_PREFIX = '[Yamabiko SortableJS PoC]';
const SORTABLE_SCRIPT_ID = 'yamabiko-sortablejs-poc-runtime';
const SORTABLE_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.7/Sortable.min.js';
const HANDLE_CLASS = 'yamabiko-sortablejs-poc-handle';

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

const restoreOriginalRowOrder = (
	tbody: HTMLTableSectionElement,
	rows: readonly HTMLTableRowElement[]
) => {
	for ( const row of rows ) {
		tbody.append( row );
	}
};

const addMinimalHandles = (
	document: Document,
	tbody: HTMLTableSectionElement
): HTMLElement[] => {
	const handles: HTMLElement[] = [];

	for ( const row of Array.from( tbody.rows ) ) {
		const firstCell = row.cells.item( 0 );
		if ( ! firstCell ) {
			continue;
		}

		const handle = document.createElement( 'span' );
		handle.className = HANDLE_CLASS;
		handle.setAttribute( 'contenteditable', 'false' );
		handle.setAttribute( 'aria-hidden', 'true' );
		handle.textContent = '⋮⋮';
		handle.style.display = 'inline-block';
		handle.style.marginInlineEnd = '8px';
		handle.style.padding = '2px 4px';
		handle.style.border = '1px solid currentColor';
		handle.style.borderRadius = '2px';
		handle.style.cursor = 'grab';
		handle.style.lineHeight = '1';
		handle.style.userSelect = 'none';

		firstCell.prepend( handle );
		handles.push( handle );
	}

	return handles;
};

const isHandleInteraction = ( event: Event ): boolean => {
	const target = event.target as Element | null;
	return Boolean( target?.closest?.( `.${ HANDLE_CLASS }` ) );
};

const stopHandleInteractionPropagation = ( event: Event ) => {
	if ( isHandleInteraction( event ) ) {
		event.stopPropagation();
	}
};

const findBlockElement = (
	rootDocument: Document,
	clientId: string
): { block: HTMLElement; document: Document } | null => {
	const selector = `[data-block="${ clientId }"]`;
	const directBlock = rootDocument.querySelector< HTMLElement >( selector );
	if ( directBlock ) {
		return { block: directBlock, document: rootDocument };
	}

	const iframe = rootDocument.querySelector< HTMLIFrameElement >( 'iframe[name="editor-canvas"]' );
	const iframeDocument = iframe?.contentDocument ?? null;
	const iframeBlock = iframeDocument?.querySelector< HTMLElement >( selector ) ?? null;
	return iframeBlock && iframeDocument ? { block: iframeBlock, document: iframeDocument } : null;
};

const ensureIframeSortable = (
	document: Document,
	view: SortableWindow
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
		script.src = SORTABLE_SCRIPT_URL;
		script.addEventListener(
			'load',
			() => {
				console.info( LOG_PREFIX, 'iframe CDN runtime loaded', {
					available: Boolean( view.Sortable ),
					inIframe: view !== window,
				} );
				resolve( view.Sortable ?? null );
			},
			{ once: true }
		);
		script.addEventListener(
			'error',
			() => {
				console.warn( LOG_PREFIX, 'failed to load SortableJS inside iframe' );
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
		const isTableBlock = props.name === 'core/table';

		useEffect( () => {
			if ( ! isTableBlock || ! props.isSelected ) {
				return;
			}

			const anchor = anchorRef.current;
			if ( ! anchor ) {
				return;
			}

			const target = findBlockElement( anchor.ownerDocument, props.clientId );
			const blockElement = target?.block ?? null;
			const document = target?.document ?? null;
			const view = document?.defaultView as SortableWindow | null;
			const table = blockElement?.querySelector< HTMLTableElement >( 'table' ) ?? null;
			const tbody = table?.tBodies.item( 0 ) ?? null;
			if ( ! blockElement || ! document || ! view || ! tbody ) {
				console.warn( LOG_PREFIX, 'selected Table tbody not found', props.clientId );
				return;
			}

			console.info( LOG_PREFIX, 'testing iframe CDN Sortable', {
				clientId: props.clientId,
				inIframe: view !== window,
				rows: tbody.rows.length,
			} );

			const handles = addMinimalHandles( document, tbody );
			console.info( LOG_PREFIX, 'minimal handles added', {
				handles: handles.length,
			} );

			const blockSelectionEvents = [ 'pointerdown', 'mousedown', 'click' ] as const;
			for ( const eventName of blockSelectionEvents ) {
				tbody.addEventListener( eventName, stopHandleInteractionPropagation );
			}

			let cancelled = false;
			let sortable: SortableInstance | null = null;
			let dragRows: HTMLTableRowElement[] | null = null;
			let lastMoveRelatedIndex: number | null = null;

			void ensureIframeSortable( document, view ).then( ( Sortable ) => {
				if ( cancelled || ! Sortable ) {
					return;
				}

				sortable = Sortable.create( tbody, {
					animation: 150,
					draggable: 'tr',
					handle: `.${ HANDLE_CLASS }`,
					onChoose: () => {
						console.info( LOG_PREFIX, 'onChoose' );
					},
					onStart: () => {
						dragRows = Array.from( tbody.rows );
						lastMoveRelatedIndex = null;
						console.info( LOG_PREFIX, 'onStart' );
					},
					onMove: ( event, originalEvent ) => {
						const relatedRow = event.related.closest( 'tr' );
						const relatedIndex = relatedRow
							? Array.from( tbody.rows ).indexOf( relatedRow )
							: -1;

						if ( relatedIndex !== lastMoveRelatedIndex ) {
							lastMoveRelatedIndex = relatedIndex;
							console.info( LOG_PREFIX, 'onMove', {
								originalEvent: originalEvent.type,
								relatedIndex,
								willInsertAfter: event.willInsertAfter,
							} );
						}
					},
					onEnd: ( event ) => {
						if ( dragRows ) {
							restoreOriginalRowOrder( tbody, dragRows );
							dragRows = null;
						}
						lastMoveRelatedIndex = null;
						console.info( LOG_PREFIX, 'onEnd', {
							newIndex: event.newIndex,
							oldIndex: event.oldIndex,
						} );
					},
				} );

				console.info( LOG_PREFIX, 'Sortable.create via iframe window' );
			} );

			return () => {
				cancelled = true;
				sortable?.destroy();
				for ( const eventName of blockSelectionEvents ) {
					tbody.removeEventListener( eventName, stopHandleInteractionPropagation );
				}
				if ( dragRows ) {
					restoreOriginalRowOrder( tbody, dragRows );
					dragRows = null;
				}
				for ( const handle of handles ) {
					handle.remove();
				}
			};
		}, [ isTableBlock, props.clientId, props.isSelected ] );

		if ( ! isTableBlock ) {
			return <BlockEdit { ...props } />;
		}

		return (
			<>
				<BlockEdit { ...props } />
				{ props.isSelected && <span aria-hidden="true" hidden ref={ anchorRef } /> }
			</>
		);
	};