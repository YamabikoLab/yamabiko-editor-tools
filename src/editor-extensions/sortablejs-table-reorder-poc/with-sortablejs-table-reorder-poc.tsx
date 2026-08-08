import type { BlockEditProps } from '@wordpress/blocks';
import { useEffect, useRef, type ComponentType } from '@wordpress/element';
import type Sortable from 'sortablejs';

const LOG_PREFIX = '[Yamabiko SortableJS PoC]';
const CONTENT_SCRIPT_ID = 'yamabiko-editor-tools-sortablejs-table-reorder-poc-content-js';
const RUNTIME_SCRIPT_ID = `${ CONTENT_SCRIPT_ID }-runtime`;

type TableAttributes = Record< string, unknown > & {
	body?: unknown[];
};

type TableBlockEditProps = BlockEditProps< TableAttributes > & {
	name: string;
};

type SortableWindow = Window & {
	Sortable?: typeof Sortable;
};

const restoreOriginalRowOrder = (
	tbody: HTMLTableSectionElement,
	rows: readonly HTMLTableRowElement[]
) => {
	for ( const row of rows ) {
		tbody.append( row );
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
): Promise< typeof Sortable | null > => {
	if ( view.Sortable ) {
		return Promise.resolve( view.Sortable );
	}

	const sourceScript = document.getElementById( CONTENT_SCRIPT_ID ) as HTMLScriptElement | null;
	if ( ! sourceScript?.src ) {
		console.warn( LOG_PREFIX, 'Sortable runtime source not found in iframe' );
		return Promise.resolve( null );
	}

	const existingRuntime = document.getElementById( RUNTIME_SCRIPT_ID ) as HTMLScriptElement | null;
	if ( existingRuntime ) {
		return new Promise( ( resolve ) => {
			const waitUntilReady = () => {
				if ( view.Sortable ) {
					resolve( view.Sortable );
					return;
				}
				view.requestAnimationFrame( waitUntilReady );
			};
			waitUntilReady();
		} );
	}

	return new Promise( ( resolve ) => {
		const runtimeScript = document.createElement( 'script' );
		runtimeScript.id = RUNTIME_SCRIPT_ID;
		runtimeScript.src = sourceScript.src;
		runtimeScript.async = false;
		runtimeScript.addEventListener(
			'load',
			() => {
				console.info( LOG_PREFIX, 'iframe Sortable runtime loaded', {
					available: Boolean( view.Sortable ),
					inIframe: view !== window,
				} );
				resolve( view.Sortable ?? null );
			},
			{ once: true }
		);
		runtimeScript.addEventListener(
			'error',
			() => {
				console.warn( LOG_PREFIX, 'failed to load iframe Sortable runtime' );
				resolve( null );
			},
			{ once: true }
		);
		document.body.append( runtimeScript );
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

			console.info( LOG_PREFIX, 'testing iframe-local Sortable', {
				clientId: props.clientId,
				inIframe: view !== window,
				rows: tbody.rows.length,
			} );

			let cancelled = false;
			let sortable: Sortable | null = null;
			let dragRows: HTMLTableRowElement[] | null = null;

			void ensureIframeSortable( document, view ).then( ( SortableRuntime ) => {
				if ( cancelled || ! SortableRuntime ) {
					return;
				}

				sortable = SortableRuntime.create( tbody, {
					animation: 150,
					draggable: 'tr',
					onChoose: () => {
						console.info( LOG_PREFIX, 'onChoose' );
					},
					onStart: () => {
						dragRows = Array.from( tbody.rows );
						console.info( LOG_PREFIX, 'onStart' );
					},
					onEnd: ( event ) => {
						if ( dragRows ) {
							restoreOriginalRowOrder( tbody, dragRows );
							dragRows = null;
						}
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
				if ( dragRows ) {
					restoreOriginalRowOrder( tbody, dragRows );
					dragRows = null;
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
