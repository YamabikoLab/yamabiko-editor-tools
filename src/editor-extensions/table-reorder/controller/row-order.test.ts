import {
	getEndInsertionIndex,
	getMoveInsertionIndex,
	reorderRows,
	restoreOriginalRowOrder,
} from './row-order';

const createTableRows = ( count: number ) => {
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	table.append( tbody );

	for ( let index = 0; index < count; index++ ) {
		const row = document.createElement( 'tr' );
		row.dataset.index = String( index );
		const cell = document.createElement( 'td' );
		cell.textContent = `row-${ index }`;
		row.append( cell );
		tbody.append( row );
	}

	return { tbody, rows: Array.from( tbody.rows ) };
};

describe( 'reorderRows', () => {
	it( 'moves a row from top to bottom', () => {
		expect( reorderRows( [ 'a', 'b', 'c', 'd' ], 0, 3 ) ).toEqual( [ 'b', 'c', 'd', 'a' ] );
	} );

	it( 'moves a row from bottom to top', () => {
		expect( reorderRows( [ 'a', 'b', 'c', 'd' ], 3, 0 ) ).toEqual( [ 'd', 'a', 'b', 'c' ] );
	} );

	it( 'returns an equivalent copy when moving to the same position', () => {
		const rows = [ 'a', 'b', 'c' ];
		const reordered = reorderRows( rows, 1, 1 );

		expect( reordered ).toEqual( rows );
		expect( reordered ).not.toBe( rows );
	} );

	it.each( [
		[ -1, 0 ],
		[ 0, -1 ],
		[ 3, 0 ],
		[ 0, 3 ],
		[ 0.5, 1 ],
		[ 0, 1.5 ],
	] )( 'returns null for invalid indices %p -> %p', ( oldIndex, newIndex ) => {
		expect( reorderRows( [ 'a', 'b', 'c' ], oldIndex, newIndex ) ).toBeNull();
	} );

	it( 'does not mutate the source array', () => {
		const rows = [ { id: 'a' }, { id: 'b' }, { id: 'c' } ];
		const snapshot = [ ...rows ];

		expect( reorderRows( rows, 0, 2 ) ).toEqual( [ rows[ 1 ], rows[ 2 ], rows[ 0 ] ] );
		expect( rows ).toEqual( snapshot );
	} );
} );

describe( 'getMoveInsertionIndex', () => {
	it( 'uses the related tr itself for insertion before the row', () => {
		const { rows } = createTableRows( 3 );

		expect( getMoveInsertionIndex( { relatedElement: rows[ 1 ], insertAfter: false }, rows ) ).toBe(
			1
		);
	} );

	it( 'resolves a child element to its containing tr', () => {
		const { rows } = createTableRows( 3 );
		const child = rows[ 2 ].querySelector< HTMLElement >( 'td' );

		expect( child ).not.toBeNull();
		expect(
			getMoveInsertionIndex( { relatedElement: child as HTMLElement, insertAfter: false }, rows )
		).toBe( 2 );
	} );

	it( 'returns the position after the related row when requested', () => {
		const { rows } = createTableRows( 4 );

		expect( getMoveInsertionIndex( { relatedElement: rows[ 1 ], insertAfter: true }, rows ) ).toBe(
			2
		);
		expect( getMoveInsertionIndex( { relatedElement: rows[ 3 ], insertAfter: true }, rows ) ).toBe(
			4
		);
	} );

	it( 'supports insertion positions used while moving upward and downward', () => {
		const { rows } = createTableRows( 4 );

		expect( getMoveInsertionIndex( { relatedElement: rows[ 0 ], insertAfter: false }, rows ) ).toBe(
			0
		);
		expect( getMoveInsertionIndex( { relatedElement: rows[ 2 ], insertAfter: true }, rows ) ).toBe(
			3
		);
	} );

	it( 'returns null when the related tr is not in the supplied rows', () => {
		const { rows } = createTableRows( 2 );
		const unrelatedRow = document.createElement( 'tr' );

		expect(
			getMoveInsertionIndex( { relatedElement: unrelatedRow, insertAfter: false }, rows )
		).toBeNull();
	} );

	it( 'returns null when no related tr can be identified', () => {
		const { rows } = createTableRows( 2 );
		const unrelatedElement = document.createElement( 'div' );

		expect(
			getMoveInsertionIndex( { relatedElement: unrelatedElement, insertAfter: false }, rows )
		).toBeNull();
	} );
} );

describe( 'getEndInsertionIndex', () => {
	it( 'uses newIndex + 1 when moving downward', () => {
		expect( getEndInsertionIndex( 1, 3 ) ).toBe( 4 );
	} );

	it( 'uses newIndex when moving upward', () => {
		expect( getEndInsertionIndex( 3, 1 ) ).toBe( 1 );
	} );

	it( 'uses newIndex when the position is unchanged', () => {
		expect( getEndInsertionIndex( 2, 2 ) ).toBe( 2 );
	} );

	it( 'returns rows.length for a downward move to the last row', () => {
		const rowsLength = 4;

		expect( getEndInsertionIndex( 0, rowsLength - 1 ) ).toBe( rowsLength );
	} );
} );

describe( 'restoreOriginalRowOrder', () => {
	it( 'restores the original tr order after temporary DOM reordering', () => {
		const { tbody, rows } = createTableRows( 3 );
		tbody.prepend( rows[ 2 ] );

		expect( Array.from( tbody.rows ).map( ( row ) => row.dataset.index ) ).toEqual( [
			'2',
			'0',
			'1',
		] );

		restoreOriginalRowOrder( tbody, rows );

		expect( Array.from( tbody.rows ).map( ( row ) => row.dataset.index ) ).toEqual( [
			'0',
			'1',
			'2',
		] );
	} );
} );
