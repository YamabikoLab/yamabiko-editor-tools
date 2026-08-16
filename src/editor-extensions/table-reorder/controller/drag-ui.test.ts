import { createInsertionLine, fixFallbackRowCellWidths } from './drag-ui';

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

const getInsertionLine = () =>
	document.querySelector< HTMLDivElement >( '.yamabiko-table-reorder-insertion-line' );

describe( 'drag-ui', () => {
	beforeEach( () => {
		document.head.replaceChildren();
		document.body.replaceChildren();
	} );

	it( 'removes the insertion line from the document on cleanup', () => {
		const insertionLine = createInsertionLine( document );
		const element = getInsertionLine();

		expect( element ).toBeInstanceOf( HTMLDivElement );
		expect( element?.isConnected ).toBe( true );

		insertionLine.cleanup();

		expect( element?.isConnected ).toBe( false );
	} );

	it( 'repositions the insertion line when the editor scrolls', () => {
		const { tbody } = createTable( 1 );
		const row = tbody.rows.item( 0 );
		if ( ! row ) {
			throw new Error( 'Expected table row' );
		}
		const getRect = jest.spyOn( row, 'getBoundingClientRect' );
		getRect.mockReturnValue( {
			bottom: 120,
			height: 20,
			left: 10,
			right: 210,
			top: 100,
			width: 200,
			x: 10,
			y: 100,
			toJSON: () => ( {} ),
		} );
		const insertionLine = createInsertionLine( document );
		const element = getInsertionLine();
		insertionLine.show( row, false );
		expect( element?.style.top ).toBe( '100px' );

		getRect.mockReturnValue( {
			bottom: 70,
			height: 20,
			left: 10,
			right: 210,
			top: 50,
			width: 200,
			x: 10,
			y: 50,
			toJSON: () => ( {} ),
		} );
		document.dispatchEvent( new Event( 'scroll' ) );

		expect( element?.style.top ).toBe( '50px' );
		insertionLine.cleanup();
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
