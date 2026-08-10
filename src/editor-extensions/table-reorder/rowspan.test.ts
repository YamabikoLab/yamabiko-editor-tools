import {
	crossesRowspanBoundary,
	getForbiddenInsertionIndices,
	getNonMovableRowIndices,
	getRowspanRanges,
} from './rowspan';

const row = ( ...cells: object[] ) => ( { cells } );

describe( 'rowspan constraints', () => {
	it( 'extracts every rowspan range from the table body', () => {
		const ranges = getRowspanRanges( [
			row( { rowspan: '2' } ),
			row(),
			row(),
			row( { rowspan: 3 } ),
			row(),
			row(),
		] );

		expect( ranges ).toEqual( [
			{ start: 0, end: 1 },
			{ start: 3, end: 5 },
		] );
	} );

	it( 'marks every row occupied by a rowspan as non-movable', () => {
		const ranges = getRowspanRanges( [
			row(),
			row( { rowspan: 2 } ),
			row(),
			row( { rowspan: 3 } ),
			row(),
			row(),
		] );

		expect( getNonMovableRowIndices( ranges ) ).toEqual( [ 1, 2, 3, 4, 5 ] );
	} );

	it( 'forbids insertion positions inside a rowspan range', () => {
		const ranges = getRowspanRanges( [
			row( { rowspan: 2 } ),
			row(),
			row(),
			row( { rowspan: 3 } ),
			row(),
			row(),
		] );

		expect( getForbiddenInsertionIndices( ranges ) ).toEqual( [ 1, 4, 5 ] );
	} );

	it( 'rejects moves that cross a rowspan boundary', () => {
		const ranges = getRowspanRanges( [ row(), row(), row( { rowspan: 2 } ), row(), row() ] );

		expect( crossesRowspanBoundary( ranges, 1, 4 ) ).toBe( true );
		expect( crossesRowspanBoundary( ranges, 4, 2 ) ).toBe( true );
		expect( crossesRowspanBoundary( ranges, 0, 2 ) ).toBe( false );
		expect( crossesRowspanBoundary( ranges, 4, 4 ) ).toBe( false );
	} );

	it( 'allows rows with only colspan cells', () => {
		const ranges = getRowspanRanges( [ row( { colspan: 2 } ), row(), row() ] );

		expect( ranges ).toEqual( [] );
		expect( getNonMovableRowIndices( ranges ) ).toEqual( [] );
		expect( getForbiddenInsertionIndices( ranges ) ).toEqual( [] );
	} );
} );
