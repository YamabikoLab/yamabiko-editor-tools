import { store as blockEditorStore } from '@wordpress/block-editor';
import { dispatch, select, subscribe } from '@wordpress/data';
import Sortable, { type SortableEvent } from 'sortablejs';

import { reorderRows } from '../table-reorder/reorder';

const GUTTER_WIDTH = 32;
const ACTIVE_CLASS = 'yamabiko-sortablejs-poc--active';
const STYLE_ATTRIBUTE = 'data-yamabiko-sortablejs-poc-style';

type TableAttributes = Record< string, unknown > & {
	body?: unknown[];
};

type DragSnapshot = {
	body: unknown[];
	rows: HTMLTableRowElement[];
	sourceIndex: number;
};

type BlockEditorSelectors = {
	getBlockAttributes: ( clientId: string ) => TableAttributes | null;
	getBlockName: ( clientId: string ) => string | null;
	getSelectedBlockClientId: () => string | null;
};

type BlockEditorActions = {
	updateBlockAttributes: ( clientId: string, attributes: TableAttributes ) => void;
};

type SortableBinding = {
	block: HTMLElement;
	sortable: Sortable;
};

const bindings = new Map< HTMLTableSectionElement, SortableBinding >();

const getSelectors = () => select( blockEditorStore ) as unknown as BlockEditorSelectors;
const getActions = () => dispatch( blockEditorStore ) as unknown as BlockEditorActions;

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

const restoreOriginalRowOrder = (
	tbody: HTMLTableSectionElement,
	rows: readonly HTMLTableRowElement[]
) => {
	for ( const row of rows ) {
		tbody.append( row );
	}
};

const installStyles = () => {
	if ( document.head.querySelector( `[${ STYLE_ATTRIBUTE }]` ) ) {
		return;
	}

	const style = document.createElement( 'style' );
	style.setAttribute( STYLE_ATTRIBUTE, 'true' );
	style.textContent = `
.${ ACTIVE_CLASS } tbody > tr > :first-child {
	box-sizing: border-box;
	cursor: grab;
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

const createBinding = (
	clientId: string,
	block: HTMLElement,
	tbody: HTMLTableSectionElement
) => {
	let dragSnapshot: DragSnapshot | null = null;

	const sortable = Sortable.create( tbody, {
		animation: 150,
		chosenClass: 'yamabiko-sortablejs-poc__chosen',
		direction: 'vertical',
		dragClass: 'yamabiko-sortablejs-poc__drag',
		draggable: 'tr',
		easing: 'ease',
		filter: ( event, target ) => {
			const row = target.closest( 'tr' ) as HTMLTableRowElement | null;
			const firstCell = row?.cells.item( 0 ) ?? null;
			if ( ! row || ! firstCell || row.parentElement !== tbody ) {
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
			const attributes = getSelectors().getBlockAttributes( clientId );
			const body = getBodyRows( attributes?.body );

			dragSnapshot =
				sourceIndex < 0 || body.length !== rows.length
					? null
					: { body: [ ...body ], rows, sourceIndex };
		},
		onEnd: ( event: SortableEvent ) => {
			const snapshot = dragSnapshot;
			dragSnapshot = null;
			if ( ! snapshot ) {
				return;
			}

			const targetIndex = event.newDraggableIndex ?? event.newIndex;

			// SortableJS owns the DOM only during the gesture. Restore Gutenberg's
			// original order first, then let the block-editor store render the new
			// canonical row order from attributes.
			restoreOriginalRowOrder( tbody, snapshot.rows );

			if (
				targetIndex === undefined ||
				targetIndex < 0 ||
				targetIndex >= snapshot.body.length ||
				targetIndex === snapshot.sourceIndex
			) {
				return;
			}

			getActions().updateBlockAttributes( clientId, {
				body: reorderRows( snapshot.body, snapshot.sourceIndex, targetIndex ),
			} );
		},
	} );

	bindings.set( tbody, { block, sortable } );
};

const syncBindings = () => {
	installStyles();

	const selectors = getSelectors();
	const selectedClientId = selectors.getSelectedBlockClientId();
	const activeTbodies = new Set< HTMLTableSectionElement >();

	if (
		selectedClientId &&
		selectors.getBlockName( selectedClientId ) === 'core/table'
	) {
		const block = document.querySelector< HTMLElement >(
			`[data-block="${ selectedClientId }"]`
		);
		const table = block?.querySelector< HTMLTableElement >( 'table' ) ?? null;
		const tbody = table?.tBodies.item( 0 ) ?? null;

		if ( block && tbody ) {
			activeTbodies.add( tbody );
			block.classList.add( ACTIVE_CLASS );
			if ( ! bindings.has( tbody ) ) {
				createBinding( selectedClientId, block, tbody );
			}
		}
	}

	for ( const [ tbody, binding ] of bindings ) {
		if ( activeTbodies.has( tbody ) && tbody.isConnected ) {
			continue;
		}

		binding.sortable.destroy();
		binding.block.classList.remove( ACTIVE_CLASS );
		bindings.delete( tbody );
	}
};

const observer = new MutationObserver( syncBindings );
observer.observe( document.documentElement, {
	childList: true,
	subtree: true,
} );

const unsubscribe = subscribe( syncBindings );

window.addEventListener(
	'unload',
	() => {
		observer.disconnect();
		unsubscribe();
		for ( const { sortable } of bindings.values() ) {
			sortable.destroy();
		}
		bindings.clear();
	},
	{ once: true }
);

syncBindings();
