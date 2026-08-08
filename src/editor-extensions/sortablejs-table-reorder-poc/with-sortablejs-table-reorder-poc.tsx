import type { BlockEditProps } from '@wordpress/blocks';
import { useEffect, useRef, type ComponentType } from '@wordpress/element';

import { reorderRows } from '../table-reorder/reorder';
import {
	crossesRowspanBoundary,
	getForbiddenInsertionIndices,
	getNonMovableRowIndices,
	getRowspanRanges,
} from '../table-reorder/rowspan';

const ENABLE_ATTRIBUTE = 'data-yamabiko-sortablejs-poc';
const REORDER_EVENT = 'yamabiko-sortablejs-poc-reorder';

type TableAttributes = Record< string, unknown > & {
	body?: unknown[];
};

type TableBlockEditProps = BlockEditProps< TableAttributes > & {
	name: string;
};

type ReorderEventDetail = {
	clientId?: string;
	sourceIndex?: number;
	targetIndex?: number;
};

const getBodyRows = ( body: unknown ): unknown[] => ( Array.isArray( body ) ? body : [] );

const targetIndexToInsertionIndex = ( sourceIndex: number, targetIndex: number ): number =>
	targetIndex > sourceIndex ? targetIndex + 1 : targetIndex;

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
			if ( ! blockElement ) {
				return;
			}

			const bodyRows = getBodyRows( props.attributes.body );
			const ranges = getRowspanRanges( bodyRows );
			const forbiddenInsertionIndices = new Set( getForbiddenInsertionIndices( ranges ) );
			const nonMovableRowIndices = new Set( getNonMovableRowIndices( ranges ) );

			const onReorder = ( event: Event ) => {
				const detail = ( event as CustomEvent< ReorderEventDetail > ).detail;
				const sourceIndex = detail?.sourceIndex;
				const targetIndex = detail?.targetIndex;
				if (
					detail?.clientId !== props.clientId ||
					! Number.isInteger( sourceIndex ) ||
					! Number.isInteger( targetIndex )
				) {
					return;
				}

				const source = sourceIndex as number;
				const target = targetIndex as number;
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

			blockElement.setAttribute( ENABLE_ATTRIBUTE, 'true' );
			blockElement.addEventListener( REORDER_EVENT, onReorder );

			return () => {
				blockElement.removeEventListener( REORDER_EVENT, onReorder );
				blockElement.removeAttribute( ENABLE_ATTRIBUTE );
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
