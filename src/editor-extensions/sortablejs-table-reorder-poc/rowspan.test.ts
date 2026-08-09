import { getRowSpanRanges, getTableRows, isIndexInRowSpan, wouldSplitRowSpan } from './rowspan';

describe( 'table reorder rowspan constraints', () => {
	it( 'builds vertical rowspan ranges from table rows', () => {
		const rows = [
			{ cells: [ { content: 'A', rowspan: '2' } ] },
			{ cells: [ { content: 'B' } ] },
			{ cells: [ { content: 'C', rowspan: 3 } ] },
			{ cells: [ { content: 'D' } ] },
			{ cells: [ { content: 'E' } ] },
		];

		expect( getRowSpanRanges( rows ) ).toEqual( [
			{ start: 0, end: 1 },
			{ start: 2, end: 4 },
		] );
	} );

	it( 'filters malformed row data instead of throwing', () => {
		expect( getTableRows( undefined ) ).toEqual( [] );
		expect( getTableRows( [ null, 'row', { cells: [] } ] ) ).toEqual( [
			{ cells: [] },
		] );
	} );

	it( 'detects rows that participate in a vertical rowspan', () => {
		const ranges = [ { start: 1, end: 2 } ];

		expect( isIndexInRowSpan( 0, ranges ) ).toBe( false );
		expect( isIndexInRowSpan( 1, ranges ) ).toBe( true );
		expect( isIndexInRowSpan( 2, ranges ) ).toBe( true );
	} );

	it( 'rejects moving an unrelated row into a rowspan range', () => {
		const ranges = [ { start: 1, end: 2 } ];

		expect( wouldSplitRowSpan( 0, 1, ranges ) ).toBe( true );
		expect( wouldSplitRowSpan( 3, 2, ranges ) ).toBe( true );
		expect( wouldSplitRowSpan( 0, 3, ranges ) ).toBe( true );
		expect( wouldSplitRowSpan( 3, 0, ranges ) ).toBe( true );
	} );

	it( 'rejects moving a row that participates in rowspan', () => {
		const ranges = [ { start: 1, end: 2 } ];

		expect( wouldSplitRowSpan( 1, 0, ranges ) ).toBe( true );
		expect( wouldSplitRowSpan( 2, 3, ranges ) ).toBe( true );
	} );

	it( 'allows moves that stay fully outside rowspan ranges', () => {
		const ranges = [ { start: 2, end: 3 } ];

		expect( wouldSplitRowSpan( 0, 1, ranges ) ).toBe( false );
		expect( wouldSplitRowSpan( 4, 5, ranges ) ).toBe( false );
	} );
} );
