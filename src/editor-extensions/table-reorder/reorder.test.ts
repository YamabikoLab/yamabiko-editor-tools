import { reorderRows } from './reorder';

type Row = {
	cells: Array< {
		content: string;
		colspan?: number;
		className?: string;
	} >;
};

const rows: Row[] = [
	{ cells: [ { content: 'first', className: 'is-first' } ] },
	{ cells: [ { content: 'second', colspan: 2 } ] },
	{ cells: [ { content: 'third' } ] },
];

describe( 'reorderRows', () => {
	it( 'moves one row upward without changing row or cell references', () => {
		const result = reorderRows( rows, 2, 0 );

		expect( result ).toEqual( [ rows[ 2 ], rows[ 0 ], rows[ 1 ] ] );
		expect( result[ 0 ] ).toBe( rows[ 2 ] );
		expect( result[ 1 ].cells[ 0 ] ).toBe( rows[ 0 ].cells[ 0 ] );
		expect( rows ).toEqual( [
			{ cells: [ { content: 'first', className: 'is-first' } ] },
			{ cells: [ { content: 'second', colspan: 2 } ] },
			{ cells: [ { content: 'third' } ] },
		] );
	} );

	it( 'moves one row downward', () => {
		expect( reorderRows( rows, 0, 2 ) ).toEqual( [ rows[ 1 ], rows[ 2 ], rows[ 0 ] ] );
	} );

	it.each( [
		[ 1, 1 ],
		[ -1, 1 ],
		[ 1, -1 ],
		[ 3, 1 ],
		[ 1, 3 ],
		[ 1.5, 0 ],
	] )( 'returns the original rows for an invalid move from %s to %s', ( source, target ) => {
		expect( reorderRows( rows, source, target ) ).toBe( rows );
	} );
} );
