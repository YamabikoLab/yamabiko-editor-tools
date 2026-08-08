import type { BlockEditProps } from '@wordpress/blocks';
import { useEffect, useRef, type ComponentType } from '@wordpress/element';
import Sortable, { type MoveEvent, type SortableEvent } from 'sortablejs';

import { reorderRows } from '../table-reorder/reorder';
import {
	crossesRowspanBoundary,
	getForbiddenInsertionIndices,
	getNonMovableRowIndices,
	getRowspanRanges,
} from '../table-reorder/rowspan';

const GUTTER_WIDTH = 32;
const ACTIVE_CLASS = 'yamabiko-sortablejs-poc--active';
const NON_MOVABLE_CLASS = 'yamabiko-sortablejs-poc__non-movable';
const STYLE_ATTRIBUTE = 'data-yamabiko-sortablejs-poc-style';
const LOG_PREFIX = '[Yamabiko SortableJS PoC]';

type TableAttributes = Record< string, unknown > & {
	body?: unknown[];
};

type TableBlockEditProps = BlockEditProps< TableAttributes > & {
	name: string;
};

type DragSnapshot = {
	body: unknown[];
	rows: HTMLTableRowElement[];
	sourceIndex: number;
};

const getBodyRows = ( body: unknown ): unknown[] => ( Array.isArray( body ) ? body : [] );

const getEventClientX = ( event: Event ): number | null => {
	const mouseLike = event as Event & { clientX?: unknown };
	if ( typeof mouseLike.clientX === 'number' ) {
		return mouseLike.clientX;
	}

	const touchLike = event as Event & {
		changedTouches?: ArrayLike< { clientX: number } >;
		touches?: ArrayLike< { clientX: number } >;
	};
	const touch = touchLike.touches?.[ 0 ] ?? touchLike.changedTouches?.[ 0 ];
	return touch ? touch.clientX : null;
};

const isPointerInsideGutter = ( event: Event, cell: HTMLTableCellElement ): boolean => {
	const clientX = getEventClientX( event );
	const view = cell.ownerDocument.defaultView;
	if ( clientX === null || ! view ) {
		return false;
	}

	const rect = cell.getBoundingClientRect();
	const direction = view.getComputedStyle( cell ).direction;
	return direction === 'rtl'
		? clientX >= rect.right - GUTTER_WIDTH
		: clientX <= rect.left + GUTTER_WIDTH;
};

const getRowIndex = ( rows: readonly HTMLTableRowElement[], row: Element | null ): number =>
	row?.tagName === 'TR' ? rows.indexOf( row as HTMLTableRowElement ) : -1;

const getInsertionIndex = (
	rows: readonly HTMLTableRowElement[],
	related: HTMLElement,
	willInsertAfter: boolean
): number | null => {
	const relatedRow = related.closest( 'tr' );
	const relatedIndex = getRowIndex( rows, relatedRow );
	return relatedIndex < 0 ? null : relatedIndex + ( willInsertAfter ? 1 : 0 );
};

const targetIndexToInsertionIndex = ( sourceIndex: number, targetIndex: number ): number =>
	targetIndex > sourceIndex ? targetIndex + 1 : targetIndex;

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

const installStyles = ( document: Document ) => {
	if ( document.head.querySelector( `[${ STYLE_ATTRIBUTE }]` ) ) {
		return;
	}

	const style = document.createElement( 'style' );
	style.setAttribute( STYLE_ATTRIBUTE, 'true' );
	style.textContent = `
.${ ACTIVE_CLASS } tbody > tr > :first-child {
	box-sizing: border-box;
	padding-inline-start: 40px !important;
	position: relative;
}

.${ ACTIVE_CLASS } tbody > tr > :first-child::before {
	align-items: center;
	color: var(--wp-components-color-accent, #3858e9);
	content: '⋮⋮';
	display: flex;
	font-size: 18px;
	font-weight: 700;
	inset-block: 0;
	inset-inline-start: 0;
	justify-content: center;
	letter-spacing: -4px;
	pointer-events: none;
	position: absolute;
	width: ${ GUTTER_WIDTH }px;
}

.${ ACTIVE_CLASS } tbody > tr:not(.${ NON_MOVABLE_CLASS }) > :first-child {
	cursor: grab;
}

.${ ACTIVE_CLASS } tbody > tr.${ NON_MOVABLE_CLASS } > :first-child {
	cursor: not-allowed;
}

.${ ACTIVE_CLASS } tbody > tr.${ NON_MOVABLE_CLASS } > :first-child::before {
	opacity: 0.35;
}

.${ ACTIVE_CLASS } .yamabiko-sortablejs-poc__ghost {
	opacity: 0.28;
}

.${ ACTIVE_CLASS } .yamabiko-sortablejs-poc__chosen > * {
	outline: 2px solid var(--wp-components-color-accent, #3858e9);
	outline-offset: -2px;
}

@media (prefers-reduced-motion: reduce) {
	.${ ACTIVE_CLASS } tbody > tr {
		transition: none !important;
	}
}
`;
	document.head.append( style );
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
			const view = document?.defaultView ?? null;
			const table = blockElement?.querySelector< HTMLTableElement >( 'table' ) ?? null;
			const tbody = table?.tBodies.item( 0 ) ?? null;
			if ( ! blockElement || ! document || ! view || ! tbody ) {
				console.warn( LOG_PREFIX, 'selected Table tbody not found', props.clientId );
				return;
			}

			const bodyRows = getBodyRows( props.attributes.body );
			if ( tbody.rows.length !== bodyRows.length ) {
				console.warn( LOG_PREFIX, 'DOM/body row count mismatch' );
				return;
			}

			installStyles( document );
			blockElement.classList.add( ACTIVE_CLASS );

			const ranges = getRowspanRanges( bodyRows );
			const forbiddenInsertionIndices = new Set( getForbiddenInsertionIndices( ranges ) );
			const nonMovableRowIndices = new Set( getNonMovableRowIndices( ranges ) );
			const markNonMovableRows = () => {
				for ( const [ index, row ] of Array.from( tbody.rows ).entries() ) {
					row.classList.toggle( NON_MOVABLE_CLASS, nonMovableRowIndices.has( index ) );
				}
			};
			markNonMovableRows();

			let dragSnapshot: DragSnapshot | null = null;
			const sortable = Sortable.create( tbody, {
				animation: 150,
				chosenClass: 'yamabiko-sortablejs-poc__chosen',
				direction: 'vertical',
				dragClass: 'yamabiko-sortablejs-poc__drag',
				draggable: 'tr',
				easing: 'ease',
				filter: ( event, eventTarget ) => {
					const targetElement = eventTarget instanceof view.Element ? eventTarget : null;
					const row = targetElement?.closest( 'tr' ) as HTMLTableRowElement | null;
					const firstCell = row?.cells.item( 0 ) ?? null;
					if ( ! row || ! firstCell || row.parentElement !== tbody ) {
						return true;
					}

					const rowIndex = Array.from( tbody.rows ).indexOf( row );
					if ( rowIndex < 0 || nonMovableRowIndices.has( rowIndex ) ) {
						return true;
					}

					return ! isPointerInsideGutter( event, firstCell );
				},
				ghostClass: 'yamabiko-sortablejs-poc__ghost',
				handle: 'td:first-child, th:first-child',
				preventOnFilter: false,
				onStart: ( event: SortableEvent ) => {
					const rows = Array.from( tbody.rows );
					const sourceIndex = rows.indexOf( event.item as HTMLTableRowElement );
					dragSnapshot =
						sourceIndex < 0
							? null
							: { body: [ ...bodyRows ], rows, sourceIndex };
				},
				onMove: ( event: MoveEvent ) => {
					const snapshot = dragSnapshot;
					if ( ! snapshot ) {
						return false;
					}

					const insertionIndex = getInsertionIndex(
						snapshot.rows,
						event.related,
						event.willInsertAfter
					);
					return (
						insertionIndex !== null &&
						! forbiddenInsertionIndices.has( insertionIndex ) &&
						! crossesRowspanBoundary( ranges, snapshot.sourceIndex, insertionIndex )
					);
				},
				onEnd: ( event: SortableEvent ) => {
					const snapshot = dragSnapshot;
					dragSnapshot = null;
					if ( ! snapshot ) {
						return;
					}

					const targetIndex = event.newDraggableIndex ?? event.newIndex;
					restoreOriginalRowOrder( tbody, snapshot.rows );

					if (
						targetIndex === undefined ||
						targetIndex < 0 ||
						targetIndex >= snapshot.body.length ||
						targetIndex === snapshot.sourceIndex
					) {
						markNonMovableRows();
						return;
					}

					const insertionIndex = targetIndexToInsertionIndex(
						snapshot.sourceIndex,
						targetIndex
					);
					if (
						forbiddenInsertionIndices.has( insertionIndex ) ||
						crossesRowspanBoundary( ranges, snapshot.sourceIndex, insertionIndex )
					) {
						markNonMovableRows();
						return;
					}

					props.setAttributes( {
						body: reorderRows( snapshot.body, snapshot.sourceIndex, targetIndex ),
					} );
				},
			} );

			console.info( LOG_PREFIX, 'Sortable.create on iframe tbody', {
				clientId: props.clientId,
				inIframe: view !== window,
			} );

			return () => {
				sortable.destroy();
				if ( dragSnapshot ) {
					restoreOriginalRowOrder( tbody, dragSnapshot.rows );
					dragSnapshot = null;
				}
				for ( const row of Array.from( tbody.rows ) ) {
					row.classList.remove( NON_MOVABLE_CLASS );
				}
				blockElement.classList.remove( ACTIVE_CLASS );
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
