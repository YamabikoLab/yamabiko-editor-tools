import {
	getTableReorderDropTarget,
	getTableReorderPushAsideOffsets,
	type TableReorderRow,
	type TableReorderRowPosition,
} from './push-aside';

const rows: TableReorderRow[] = [
	{ id: 'row-1', index: 0 },
	{ id: 'row-2', index: 1 },
	{ id: 'row-3', index: 2 },
	{ id: 'row-4', index: 3 },
	{ id: 'row-5', index: 4 },
];

const positions = new Map< string, TableReorderRowPosition >( [
	[ 'row-1', { height: 20, left: 40, top: 100, width: 300 } ],
	[ 'row-2', { height: 60, left: 40, top: 120, width: 300 } ],
	[ 'row-3', { height: 30, left: 40, top: 180, width: 300 } ],
	[ 'row-4', { height: 40, left: 40, top: 210, width: 300 } ],
	[ 'row-5', { height: 25, left: 40, top: 250, width: 300 } ],
] );

describe( 'Table reorder push-aside presentation', () => {
	it( 'moves only the rows between an upward insertion point and the source', () => {
		expect(
			getTableReorderPushAsideOffsets( rows, {
				insertionIndex: 1,
				sourceHeight: 45,
				sourceIndex: 4,
			} )
		).toEqual(
			new Map( [
				[ 'row-2', 45 ],
				[ 'row-3', 45 ],
				[ 'row-4', 45 ],
			] )
		);
	} );

	it( 'moves only the rows between a downward insertion point and the source', () => {
		expect(
			getTableReorderPushAsideOffsets( rows, {
				insertionIndex: 4,
				sourceHeight: 30,
				sourceIndex: 1,
			} )
		).toEqual(
			new Map( [
				[ 'row-3', -30 ],
				[ 'row-4', -30 ],
			] )
		);
	} );

	it( 'does not apply an offset when the insertion leaves the source in place', () => {
		expect(
			getTableReorderPushAsideOffsets( rows, {
				insertionIndex: 3,
				sourceHeight: 40,
				sourceIndex: 2,
			} )
		).toEqual( new Map() );
	} );

	it( 'derives the insertion from untransformed row positions with different heights', () => {
		expect( getTableReorderDropTarget( rows, positions, { x: 100, y: 125 } ) ).toEqual( {
			insertionIndex: 1,
			targetId: 'row-2',
		} );
		expect( getTableReorderDropTarget( rows, positions, { x: 100, y: 170 } ) ).toEqual( {
			insertionIndex: 2,
			targetId: 'row-2',
		} );
		expect( getTableReorderDropTarget( rows, positions, { x: 100, y: 268 } ) ).toEqual( {
			insertionIndex: 5,
			targetId: 'row-5',
		} );
	} );

	it( 'has no candidate outside the table bounds', () => {
		expect( getTableReorderDropTarget( rows, positions, { x: 30, y: 150 } ) ).toBeNull();
		expect( getTableReorderDropTarget( rows, positions, { x: 100, y: 90 } ) ).toBeNull();
		expect( getTableReorderDropTarget( rows, positions, { x: 100, y: 280 } ) ).toBeNull();
	} );
} );
