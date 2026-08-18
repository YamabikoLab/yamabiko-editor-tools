import { getForbiddenInsertionIndices, getNonMovableRowIndices, getRowspanRanges } from './rowspan';

const ROWSPAN_PROPERTY = 'rowspan';

describe( 'getRowspanRanges', () => {
	it( 'returns no ranges when rowspan is absent', () => {
		expect(
			getRowspanRanges( [ { cells: [ {} ] }, { cells: [ {} ] } ], ROWSPAN_PROPERTY )
		).toEqual( [] );
	} );

	it( 'accepts integer and numeric-string rowspan values', () => {
		const body = [
			{ cells: [ { rowspan: 2 } ] },
			{ cells: [ { rowspan: '3' } ] },
			{ cells: [ {} ] },
			{ cells: [ {} ] },
		];

		expect( getRowspanRanges( body, ROWSPAN_PROPERTY ) ).toEqual( [
			{ start: 0, end: 1 },
			{ start: 1, end: 3 },
		] );
	} );

	it.each( [ 1, 0, -2, 2.5, 'invalid', null, undefined, {} ] )(
		'ignores invalid rowspan value %p',
		( rowspan ) => {
			expect(
				getRowspanRanges( [ { cells: [ { rowspan } ] }, { cells: [ {} ] } ], ROWSPAN_PROPERTY )
			).toEqual( [] );
		}
	);

	it( 'treats a non-array body as empty', () => {
		expect( getRowspanRanges( null, ROWSPAN_PROPERTY ) ).toEqual( [] );
		expect( getRowspanRanges( { body: [] }, ROWSPAN_PROPERTY ) ).toEqual( [] );
	} );

	it( 'ignores rows whose cells value is not an array', () => {
		expect(
			getRowspanRanges(
				[ { cells: null }, { cells: { rowspan: 2 } }, { cells: [ {} ] } ],
				ROWSPAN_PROPERTY
			)
		).toEqual( [] );
	} );

	it( 'clamps a rowspan that extends beyond the end of the table', () => {
		expect(
			getRowspanRanges(
				[ { cells: [ {} ] }, { cells: [ { rowspan: 10 } ] }, { cells: [ {} ] } ],
				ROWSPAN_PROPERTY
			)
		).toEqual( [ { start: 1, end: 2 } ] );
	} );

	it( 'does not create a range when a clamped rowspan occupies only its starting row', () => {
		expect(
			getRowspanRanges(
				[ { cells: [ {} ] }, { cells: [ { rowspan: 2 } ] } ],
				ROWSPAN_PROPERTY
			)
		).toEqual( [] );
	} );

	it( 'keeps multiple overlapping rowspan ranges', () => {
		expect(
			getRowspanRanges(
				[
					{ cells: [ { rowspan: 3 } ] },
					{ cells: [ { rowspan: 3 } ] },
					{ cells: [ {} ] },
					{ cells: [ {} ] },
				],
				ROWSPAN_PROPERTY
			)
		).toEqual( [
			{ start: 0, end: 2 },
			{ start: 1, end: 3 },
		] );
	} );
} );

describe( 'getNonMovableRowIndices', () => {
	it( 'deduplicates overlapping ranges and sorts indices', () => {
		expect(
			getNonMovableRowIndices( [
				{ start: 3, end: 4 },
				{ start: 0, end: 2 },
				{ start: 1, end: 3 },
			] )
		).toEqual( [ 0, 1, 2, 3, 4 ] );
	} );

	it( 'returns an empty list for no rowspan ranges', () => {
		expect( getNonMovableRowIndices( [] ) ).toEqual( [] );
	} );
} );

describe( 'getForbiddenInsertionIndices', () => {
	it( 'forbids insertion positions that split a rowspan range', () => {
		expect( getForbiddenInsertionIndices( [ { start: 1, end: 3 } ] ) ).toEqual( [ 2, 3 ] );
	} );

	it( 'keeps positions before and after a rowspan range available', () => {
		const forbidden = getForbiddenInsertionIndices( [ { start: 1, end: 3 } ] );

		expect( forbidden ).not.toContain( 1 );
		expect( forbidden ).not.toContain( 4 );
	} );

	it( 'deduplicates and sorts forbidden positions from overlapping ranges', () => {
		expect(
			getForbiddenInsertionIndices( [
				{ start: 2, end: 4 },
				{ start: 0, end: 3 },
			] )
		).toEqual( [ 1, 2, 3, 4 ] );
	} );
} );