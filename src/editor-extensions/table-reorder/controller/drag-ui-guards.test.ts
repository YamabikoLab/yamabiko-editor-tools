import { createInsertionLine, fixFallbackRowCellWidths } from './drag-ui';

const getInsertionLine = ( document: Document ) =>
	document.querySelector< HTMLDivElement >( '.yamabiko-table-reorder-insertion-line' );

const createRow = ( document: Document ) => {
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	const row = document.createElement( 'tr' );
	const cell = document.createElement( 'td' );
	row.append( cell );
	tbody.append( row );
	table.append( tbody );
	document.body.append( table );
	return { cell, row };
};

describe( 'drag-ui guard branches', () => {
	beforeEach( () => {
		document.body.replaceChildren();
	} );

	it( 'hides the insertion line when its active row leaves the document', () => {
		const { row } = createRow( document );
		jest.spyOn( row, 'getBoundingClientRect' ).mockReturnValue( {
			bottom: 40,
			height: 20,
			left: 10,
			right: 110,
			top: 20,
			width: 100,
			x: 10,
			y: 20,
			toJSON: () => ( {} ),
		} );
		const insertionLine = createInsertionLine( document );
		const element = getInsertionLine( document );

		insertionLine.show( row, true );
		expect( element?.style.display ).toBe( 'block' );
		expect( element?.style.top ).toBe( '40px' );

		row.remove();
		document.dispatchEvent( new Event( 'scroll' ) );

		expect( element?.style.display ).toBe( 'none' );
		insertionLine.cleanup();
	} );

	it( 'does not reposition after hide clears the active target', () => {
		const { row } = createRow( document );
		const getRect = jest.spyOn( row, 'getBoundingClientRect' ).mockReturnValue( {
			bottom: 40,
			height: 20,
			left: 10,
			right: 110,
			top: 20,
			width: 100,
			x: 10,
			y: 20,
			toJSON: () => ( {} ),
		} );
		const insertionLine = createInsertionLine( document );
		insertionLine.show( row, false );
		expect( getRect ).toHaveBeenCalledTimes( 1 );

		insertionLine.hide();
		document.dispatchEvent( new Event( 'scroll' ) );

		expect( getRect ).toHaveBeenCalledTimes( 1 );
		expect( getInsertionLine( document )?.style.display ).toBe( 'none' );
		insertionLine.cleanup();
	} );

	it( 'works with a document that has no defaultView', () => {
		const detachedDocument = document.implementation.createHTMLDocument( 'detached' );
		expect( detachedDocument.defaultView ).toBeNull();

		const insertionLine = createInsertionLine( detachedDocument );
		expect( getInsertionLine( detachedDocument ) ).toBeInstanceOf( detachedDocument.defaultView?.HTMLDivElement ?? HTMLElement );

		insertionLine.cleanup();
		expect( getInsertionLine( detachedDocument ) ).toBeNull();
	} );

	it( 'leaves non-row fallback elements untouched', () => {
		const element = document.createElement( 'div' );
		const cellLikeChild = document.createElement( 'td' );
		cellLikeChild.style.width = '25%';
		element.append( cellLikeChild );

		const restore = fixFallbackRowCellWidths( element );
		restore();

		expect( cellLikeChild.style.width ).toBe( '25%' );
	} );
} );
