import type { BlockEditProps } from '@wordpress/blocks';
import { useEffect, useRef, type ComponentType } from '@wordpress/element';

import { reorderRows } from '../table-reorder/reorder';
import {
	crossesRowspanBoundary,
	getForbiddenInsertionIndices,
	getNonMovableRowIndices,
	getRowspanRanges,
} from '../table-reorder/rowspan';

type TableAttributes = Record< string, unknown > & {
	body?: unknown[];
};

type TableBlockEditProps = BlockEditProps< TableAttributes > & {
	name: string;
};

type SortableJsPocApi = {
	bind: (
		block: HTMLElement,
		options: {
			onReorder: ( sourceIndex: number, targetIndex: number ) => void;
		}
	) => () => void;
};

type PocWindow = Window & {
	YamabikoSortableJsPoc?: SortableJsPocApi;
};

const CONTENT_SCRIPT_ID = 'yamabiko-editor-tools-sortablejs-table-reorder-poc-content-js';
const RUNTIME_SCRIPT_ID = `${ CONTENT_SCRIPT_ID }-runtime`;
const LOG_PREFIX = '[Yamabiko SortableJS PoC]';

const getBodyRows = ( body: unknown ): unknown[] => ( Array.isArray( body ) ? body : [] );

const targetIndexToInsertionIndex = ( sourceIndex: number, targetIndex: number ): number =>
	targetIndex > sourceIndex ? targetIndex + 1 : targetIndex;

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

const ensureIframeApi = (
	document: Document,
	view: PocWindow
): Promise< SortableJsPocApi | null > => {
	if ( view.YamabikoSortableJsPoc ) {
		return Promise.resolve( view.YamabikoSortableJsPoc );
	}

	const sourceScript = document.getElementById( CONTENT_SCRIPT_ID ) as HTMLScriptElement | null;
	if ( ! sourceScript?.src ) {
		console.warn( LOG_PREFIX, 'iframe content script source not found' );
		return Promise.resolve( null );
	}

	const existingRuntime = document.getElementById( RUNTIME_SCRIPT_ID ) as HTMLScriptElement | null;
	if ( existingRuntime ) {
		return new Promise( ( resolve ) => {
			const waitUntilReady = () => {
				if ( view.YamabikoSortableJsPoc ) {
					resolve( view.YamabikoSortableJsPoc );
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
			() => resolve( view.YamabikoSortableJsPoc ?? null ),
			{ once: true }
		);
		runtimeScript.addEventListener(
			'error',
			() => {
				console.warn( LOG_PREFIX, 'failed to load iframe runtime script' );
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
			const view = document?.defaultView as PocWindow | null;
			if ( ! blockElement || ! document || ! view ) {
				console.warn( LOG_PREFIX, 'selected Table DOM not found', props.clientId );
				return;
			}

			console.info( LOG_PREFIX, 'selected Table DOM found', {
				clientId: props.clientId,
				inIframe: view !== window,
			} );

			const bodyRows = getBodyRows( props.attributes.body );
			const ranges = getRowspanRanges( bodyRows );
			const forbiddenInsertionIndices = new Set( getForbiddenInsertionIndices( ranges ) );
			const nonMovableRowIndices = new Set( getNonMovableRowIndices( ranges ) );

			const onReorder = ( source: number, targetIndex: number ) => {
				if (
					source < 0 ||
					targetIndex < 0 ||
					source >= bodyRows.length ||
					targetIndex >= bodyRows.length ||
					nonMovableRowIndices.has( source )
				) {
					return;
				}

				const insertionIndex = targetIndexToInsertionIndex( source, targetIndex );
				if (
					forbiddenInsertionIndices.has( insertionIndex ) ||
					crossesRowspanBoundary( ranges, source, insertionIndex )
				) {
					return;
				}

				props.setAttributes( {
					body: reorderRows( bodyRows, source, targetIndex ),
				} );
			};

			let unbind: ( () => void ) | null = null;
			let cancelled = false;

			void ensureIframeApi( document, view ).then( ( api ) => {
				if ( cancelled || ! api ) {
					return;
				}
				unbind = api.bind( blockElement, { onReorder } );
			} );

			return () => {
				cancelled = true;
				unbind?.();
			};
		}, [
			isTableBlock,
			props.attributes.body,
			props.clientId,
			props.isSelected,
			props.setAttributes,
		] );

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
