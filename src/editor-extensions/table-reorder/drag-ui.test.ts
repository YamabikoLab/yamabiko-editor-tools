import {
	createHoverHandles,
	createInsertionLine,
	createTouchDragUi,
	fixFallbackRowCellWidths,
	HANDLE_ZONE_CLASS,
	NON_MOVABLE_ROW_CLASS,
	TOUCH_CHOSEN_CLASS,
} from './drag-ui';

const createTable = ( rowCount = 3 ) => {
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	table.append( tbody );
	document.body.append( table );

	for ( let index = 0; index < rowCount; index++ ) {
		const row = document.createElement( 'tr' );
		const cell = document.createElement( 'td' );
		cell.textContent = `row-${ index }`;
		row.append( cell );
		tbody.append( row );
	}

	return { tbody };
};

describe( 'drag-ui', () => {
	beforeEach( () => {
		document.head.replaceChildren();
		document.body.replaceChildren();
	} );

	it( 'restores changed first-cell inline styles when hover handles are cleaned up', () => {
		const { tbody } = createTable( 1 );
		const cell = tbody.rows.item( 0 )?.cells.item( 0 );
		if ( ! cell ) {
			throw new Error( 'Expected first table cell' );
		}
		cell.style.position = 'static';
		cell.style.paddingInlineStart = '7px';

		const handles = createHoverHandles( document, tbody, [] );
		expect( cell.querySelector( `.${ HANDLE_ZONE_CLASS }` ) ).not.toBeNull();
		expect( cell.style.paddingInlineStart ).not.toBe( '7px' );

		handles.cleanup();

		expect( cell.querySelector( `.${ HANDLE_ZONE_CLASS }` ) ).toBeNull();
		expect( cell.style.position ).toBe( 'static' );
		expect( cell.style.paddingInlineStart ).toBe( '7px' );
	} );

	it( 'does not create a hover handle for non-movable rows', () => {
		const { tbody } = createTable( 3 );
		const handles = createHoverHandles( document, tbody, [ 1 ] );

		expect( handles.entries ).toHaveLength( 2 );
		expect( tbody.rows.item( 0 )?.querySelector( `.${ HANDLE_ZONE_CLASS }` ) ).not.toBeNull();
		expect( tbody.rows.item( 1 )?.querySelector( `.${ HANDLE_ZONE_CLASS }` ) ).toBeNull();
		expect( tbody.rows.item( 2 )?.querySelector( `.${ HANDLE_ZONE_CLASS }` ) ).not.toBeNull();

		handles.cleanup();
	} );

	it( 'removes the insertion line from the document on cleanup', () => {
		const insertionLine = createInsertionLine( document );

		expect( document.body.contains( insertionLine.element ) ).toBe( true );

		insertionLine.cleanup();

		expect( document.body.contains( insertionLine.element ) ).toBe( false );
	} );

	it( 'restores touch-mode DOM changes on cleanup', () => {
		const { tbody } = createTable( 2 );
		const editable = tbody.rows.item( 0 )?.cells.item( 0 );
		if ( ! editable ) {
			throw new Error( 'Expected editable table cell' );
		}
		editable.contentEditable = 'true';
		editable.style.pointerEvents = 'auto';
		tbody.style.userSelect = 'text';

		const touchUi = createTouchDragUi( document, tbody, [ 1 ] );
		expect( editable.style.pointerEvents ).toBe( 'none' );
		expect( tbody.style.userSelect ).toBe( 'none' );
		expect( tbody.rows.item( 1 )?.classList.contains( NON_MOVABLE_ROW_CLASS ) ).toBe( true );
		expect( document.head.querySelector( `style` )?.textContent ).toContain( TOUCH_CHOSEN_CLASS );

		touchUi.cleanup();

		expect( editable.style.pointerEvents ).toBe( 'auto' );
		expect( tbody.style.userSelect ).toBe( 'text' );
		expect( tbody.rows.item( 1 )?.classList.contains( NON_MOVABLE_ROW_CLASS ) ).toBe( false );
		expect( document.head.querySelector( 'style' ) ).toBeNull();
	} );

	it( 'restores fallback cell width styles', () => {
		const { tbody } = createTable( 1 );
		const row = tbody.rows.item( 0 );
		const cell = row?.cells.item( 0 );
		if ( ! row || ! cell ) {
			throw new Error( 'Expected table row and cell' );
		}
		cell.style.width = '25%';
		cell.style.minWidth = '10px';
		cell.style.maxWidth = '80px';
		cell.style.boxSizing = 'content-box';
		jest.spyOn( cell, 'getBoundingClientRect' ).mockReturnValue( {
			bottom: 20,
			height: 20,
			left: 0,
			right: 120,
			top: 0,
			width: 120,
			x: 0,
			y: 0,
			toJSON: () => ( {} ),
		} );

		const restore = fixFallbackRowCellWidths( row );
		expect( cell.style.width ).toBe( '120px' );
		expect( cell.style.minWidth ).toBe( '120px' );
		expect( cell.style.maxWidth ).toBe( '120px' );
		expect( cell.style.boxSizing ).toBe( 'border-box' );

		restore();

		expect( cell.style.width ).toBe( '25%' );
		expect( cell.style.minWidth ).toBe( '10px' );
		expect( cell.style.maxWidth ).toBe( '80px' );
		expect( cell.style.boxSizing ).toBe( 'content-box' );
	} );
} );
