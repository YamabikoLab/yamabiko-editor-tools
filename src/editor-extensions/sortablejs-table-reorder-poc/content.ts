import Sortable, { type SortableEvent } from 'sortablejs';

const GUTTER_WIDTH = 32;
const ACTIVE_CLASS = 'yamabiko-sortablejs-poc--active';
const STYLE_ATTRIBUTE = 'data-yamabiko-sortablejs-poc-style';
const LOG_PREFIX = '[Yamabiko SortableJS PoC]';

type BindOptions = {
	onReorder: ( sourceIndex: number, targetIndex: number ) => void;
};

type DragSnapshot = {
	rows: HTMLTableRowElement[];
	sourceIndex: number;
};

type SortableJsPocApi = {
	bind: ( block: HTMLElement, options: BindOptions ) => () => void;
};

type PocWindow = Window & {
	YamabikoSortableJsPoc?: SortableJsPocApi;
};

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

const installStyles = ( document: Document ) => {
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

const bind: SortableJsPocApi[ 'bind' ] = ( block, { onReorder } ) => {
	const document = block.ownerDocument;
	const table = block.querySelector< HTMLTableElement >( 'table' );
	const tbody = table?.tBodies.item( 0 ) ?? null;
	if ( ! tbody ) {
		return () => {};
	}

	installStyles( document );
	block.classList.add( ACTIVE_CLASS );
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
			dragSnapshot = sourceIndex < 0 ? null : { rows, sourceIndex };
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
				targetIndex >= snapshot.rows.length ||
				targetIndex === snapshot.sourceIndex
			) {
				return;
			}

			onReorder( snapshot.sourceIndex, targetIndex );
		},
	} );

	console.info( LOG_PREFIX, 'bound inside iframe' );

	return () => {
		sortable.destroy();
		if ( dragSnapshot ) {
			restoreOriginalRowOrder( tbody, dragSnapshot.rows );
			dragSnapshot = null;
		}
		block.classList.remove( ACTIVE_CLASS );
	};
};

( window as PocWindow ).YamabikoSortableJsPoc = { bind };
console.info( LOG_PREFIX, 'iframe API ready', window !== window.parent );
