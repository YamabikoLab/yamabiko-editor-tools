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

const getBodyRows = ( body: unknown ): unknown[] => ( Array.isArray( body ) ? body : [] );

const targetIndexToInsertionIndex = ( sourceIndex: number, targetIndex: number ): number =>
	targetIndex > sourceIndex ? targetIndex + 1 : targetIndex;

const ensureIframeApi = (
	document: Document,
	view: PocWindow
): Promise< SortableJsPocApi | null > => {
	if ( view.YamabikoSortableJsPoc ) {
		return Promise.resolve( view.YamabikoSortableJsPoc );
	}

	const sourceScript = document.getElementById( CONTENT_SCRIPT_ID ) as HTMLScriptElement | null;
	if ( ! sourceScript?.src ) {
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
		runtimeScript.addEventListener( 'error', () => resolve( null ), { once: true } );
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

			const document = anchor.ownerDocument;
			const blockElement = document.querySelector< HTMLElement >(
				`[data-block="${ props.clientId }"]`
			);
			const view = blockElement?.ownerDocument.defaultView as PocWindow | null;
			if ( ! blockElement || ! view ) {
				return;
			}

			const bodyRows = getBodyRows( props.attributes.body );
			const ranges = getRowspanRanges( bodyRows );
			const forbiddenInsertionIndices = new Set( getForbiddenInsertionIndices( ranges ) );
			const nonMovableRowIndices = new Set( getNonMovableRowIndices( ranges ) );

			const onReorder = ( source: number, target: number ) => {
				if (
					source < 0 ||
					target < 0 ||
					source >= bodyRows.length ||
					target >= bodyRows.length ||
					nonMovableRowIndices.has( source )
				) {
					return;
				}

				const insertionIndex = targetIndexToInsertionIndex( source, target );
				if (
					forbiddenInsertionIndices.has( insertionIndex ) ||
					crossesRowspanBoundary( ranges, source, insertionIndex )
				) {
					return;
				}

				props.setAttributes( {
					body: reorderRows( bodyRows, source, target ),
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
