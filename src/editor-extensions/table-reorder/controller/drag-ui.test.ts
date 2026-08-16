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
const getDropAnimation = () =>
	document.querySelector< HTMLTableElement >( '.yamabiko-table-reorder-drop-animation' );

const setReducedMotion = ( matches: boolean ) => {
	Object.defineProperty( window, 'matchMedia', {
		configurable: true,
		value: jest.fn( () => ( { matches } ) as MediaQueryList ),
	} );
};

const mockRect = ( element: Element, top: number, width = 120, height = 20 ) => {
	jest.spyOn( element, 'getBoundingClientRect' ).mockReturnValue( {
		bottom: top + height,
		height,
		left: 10,
		right: 10 + width,
		top,
		width,
		x: 10,
		y: top,
		toJSON: () => ( {} ),
	} );
};

describe( 'drag-ui', () => {
	beforeEach( () => {
		jest.useRealTimers();
		document.head.replaceChildren();
		document.body.replaceChildren();
		setReducedMotion( false );
		Object.defineProperty( window, 'requestAnimationFrame', {
			configurable: true,
			value: jest.fn( ( callback: FrameRequestCallback ) => {
				callback( 0 );
				return 1;
			} ),
		} );
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
		mockRect( cell, 0 );

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

	it( 'keeps a moved row visible briefly while the drop result settles', () => {
		jest.useFakeTimers();
		const { tbody } = createTable( 2 );
		const row = tbody.rows.item( 0 );
		const cell = row?.cells.item( 0 );
		if ( ! row || ! cell ) {
			throw new Error( 'Expected table row and cell' );
		}
		mockRect( row, 100, 200 );
		mockRect( cell, 100, 200 );

		const restore = fixFallbackRowCellWidths( row );
		tbody.append( row );
		restore();

		const overlay = getDropAnimation();
		expect( overlay ).toBeInstanceOf( HTMLTableElement );
		expect( overlay?.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
		expect( overlay?.style.top ).toBe( '100px' );
		expect( overlay?.style.transform ).toBe( 'translateY(0)' );
		expect( overlay?.style.opacity ).toBe( '0' );

		jest.runOnlyPendingTimers();
		expect( getDropAnimation() ).toBeNull();
	} );

	it( 'does not animate a moved row when reduced motion is requested', () => {
		setReducedMotion( true );
		const { tbody } = createTable( 2 );
		const row = tbody.rows.item( 0 );
		const cell = row?.cells.item( 0 );
		if ( ! row || ! cell ) {
			throw new Error( 'Expected table row and cell' );
		}
		mockRect( row, 100, 200 );
		mockRect( cell, 100, 200 );

		const restore = fixFallbackRowCellWidths( row );
		tbody.append( row );
		restore();

		expect( getDropAnimation() ).toBeNull();
	} );
} );
