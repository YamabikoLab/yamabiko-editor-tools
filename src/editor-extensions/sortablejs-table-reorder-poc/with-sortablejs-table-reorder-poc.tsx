import { BlockControls } from '@wordpress/block-editor';
import type { BlockEditProps } from '@wordpress/blocks';
import { ToolbarButton } from '@wordpress/components';
import { useEffect, useRef, useState, type ComponentType } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { dragHandle } from '@wordpress/icons';
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

const getRowIndex = ( rows: readonly HTMLTableRowElement[], row: Element | null ): number =>
	row?.tagName === 'TR' ? rows.indexOf( row as HTMLTableRowElement ) : -1;

const getInsertionIndex = (
	rows: readonly HTMLTableRowElement[],
	related: HTMLElement,
	willInsertAfter: boolean
): number | null => {
	const relatedRow = related.closest( 'tr' );
	const relatedIndex = getRowIndex( rows, relatedRow );
	if ( relatedIndex < 0 ) {
		return null;
	}

	return relatedIndex + ( willInsertAfter ? 1 : 0 );
};

const targetIndexToInsertionIndex = ( sourceIndex: number, targetIndex: number ): number =>
	targetIndex > sourceIndex ? targetIndex + 1 : targetIndex;

const restoreOriginalRowOrder = ( tbody: HTMLTableSectionElement, rows: readonly HTMLTableRowElement[] ) => {
	for ( const row of rows ) {
		tbody.append( row );
	}
};

const installStyles = ( document: Document ) => {
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

.yamabiko-sortablejs-poc__fallback {
	box-shadow: 0 4px 12px rgb(0 0 0 / 20%);
	opacity: 0.92;
}

@media (prefers-reduced-motion: reduce) {
	.${ ACTIVE_CLASS } tbody > tr {
		transition: none !important;
	}
}
`;
	document.head.append( style );
	return () => style.remove();
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

export const withSortableJsTableReorderPoc = (
	BlockEdit: ComponentType< TableBlockEditProps >
) =>
	function WithSortableJsTableReorderPoc( props: TableBlockEditProps ) {
		const [ isEnabled, setIsEnabled ] = useState( false );
		const anchorRef = useRef< HTMLSpanElement >( null );
		const dragSnapshotRef = useRef< DragSnapshot | null >( null );
		const isTableBlock = props.name === 'core/table';

		useEffect( () => {
			if ( ! props.isSelected ) {
				setIsEnabled( false );
			}
		}, [ props.isSelected ] );

		useEffect( () => {
			if ( ! isEnabled || ! props.isSelected ) {
				return;
			}

			const anchor = anchorRef.current;
			if ( ! anchor ) {
				return;
			}

			const document = anchor.ownerDocument;
			const view = document.defaultView;
			const blockElement = document.querySelector< HTMLElement >(
				`[data-block="${ props.clientId }"]`
			);
			const table = blockElement?.querySelector< HTMLTableElement >( 'table' ) ?? null;
			const tbody = table?.tBodies.item( 0 ) ?? null;
			if ( ! view || ! blockElement || ! tbody ) {
				return;
			}

			const bodyRows = getBodyRows( props.attributes.body );
			if ( tbody.rows.length !== bodyRows.length ) {
				return;
			}

			blockElement.classList.add( ACTIVE_CLASS );
			const uninstallStyles = installStyles( document );
			const ranges = getRowspanRanges( bodyRows );
			const forbiddenInsertionIndices = new Set( getForbiddenInsertionIndices( ranges ) );
			const nonMovableRowIndices = new Set( getNonMovableRowIndices( ranges ) );

			const markNonMovableRows = () => {
				const currentRows = Array.from( tbody.rows ) as HTMLTableRowElement[];
				currentRows.forEach( ( row, index ) => {
					row.classList.toggle( NON_MOVABLE_CLASS, nonMovableRowIndices.has( index ) );
				} );
			};
			markNonMovableRows();

			const sortable = Sortable.create( tbody, {
				animation: 150,
				chosenClass: 'yamabiko-sortablejs-poc__chosen',
				direction: 'vertical',
				dragClass: 'yamabiko-sortablejs-poc__drag',
				draggable: 'tr',
				easing: 'ease',
				fallbackClass: 'yamabiko-sortablejs-poc__fallback',
				fallbackOnBody: true,
				fallbackTolerance: 3,
				filter: ( event, target ) => {
					let targetElement: Element | null = null;
					if ( target instanceof view.Element ) {
						targetElement = target as Element;
					} else if ( event.target instanceof view.Element ) {
						targetElement = event.target as Element;
					}
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
				forceFallback: true,
				ghostClass: 'yamabiko-sortablejs-poc__ghost',
				handle: 'td:first-child, th:first-child',
				preventOnFilter: false,
				onStart: ( event: SortableEvent ) => {
					const rows = Array.from( tbody.rows );
					const sourceIndex = rows.indexOf( event.item as HTMLTableRowElement );
					if ( sourceIndex < 0 ) {
						dragSnapshotRef.current = null;
						return;
					}

					dragSnapshotRef.current = {
						body: [ ...bodyRows ],
						rows,
						sourceIndex,
					};
				},
				onMove: ( event: MoveEvent ) => {
					const snapshot = dragSnapshotRef.current;
					if ( ! snapshot ) {
						return false;
					}

					const insertionIndex = getInsertionIndex(
						snapshot.rows,
						event.related,
						event.willInsertAfter
					);
					if ( insertionIndex === null ) {
						return false;
					}

					return ! (
						forbiddenInsertionIndices.has( insertionIndex ) ||
						crossesRowspanBoundary( ranges, snapshot.sourceIndex, insertionIndex )
					);
				},
				onEnd: ( event: SortableEvent ) => {
					const snapshot = dragSnapshotRef.current;
					dragSnapshotRef.current = null;
					if ( ! snapshot ) {
						return;
					}

					const targetIndex = event.newDraggableIndex ?? event.newIndex;

					// SortableJS owns the DOM only during the gesture. Restore Gutenberg's
					// original DOM order before committing the attribute change so React
					// sees the DOM tree it expects.
					restoreOriginalRowOrder( tbody, snapshot.rows );

					if (
						targetIndex === undefined ||
						targetIndex === snapshot.sourceIndex ||
						targetIndex < 0 ||
						targetIndex >= snapshot.body.length
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

			return () => {
				sortable.destroy();
				const snapshot = dragSnapshotRef.current;
				if ( snapshot ) {
					restoreOriginalRowOrder( tbody, snapshot.rows );
					dragSnapshotRef.current = null;
				}
				for ( const row of Array.from( tbody.rows ) as HTMLTableRowElement[] ) {
					row.classList.remove( NON_MOVABLE_CLASS );
				}
				blockElement.classList.remove( ACTIVE_CLASS );
				uninstallStyles();
			};
		}, [
			isEnabled,
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
				<span aria-hidden="true" hidden ref={ anchorRef } />
				{ props.isSelected && (
					<BlockControls>
						<ToolbarButton
							icon={ dragHandle }
							isPressed={ isEnabled }
							label={ __( 'SortableJS row reorder PoC', 'yamabiko-editor-tools' ) }
							onClick={ () => setIsEnabled( ( current: boolean ) => ! current ) }
						/>
					</BlockControls>
				) }
			</>
		);
	};
