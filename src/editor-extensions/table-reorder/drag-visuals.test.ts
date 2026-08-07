import {
	getRowDisplacements,
	getSourceTranslateY,
	TableReorderDragVisuals,
	type InsertionIndicator,
	type TableReorderRowPlacement,
	type TableReorderVisualRow,
} from './drag-visuals';

const placements: TableReorderRowPlacement[] = [
	{ height: 24, id: 'row-6', index: 0 },
	{ height: 36, id: 'row-7', index: 1 },
	{ height: 48, id: 'row-8', index: 2 },
	{ height: 60, id: 'row-9', index: 3 },
	{ height: 72, id: 'row-10', index: 4 },
];

const createVisualRows = (): TableReorderVisualRow[] => {
	document.body.innerHTML = `<table><tbody>${ placements
		.map( ( row ) => `<tr data-row-id="${ row.id }"><td>${ row.id }</td></tr>` )
		.join( '' ) }</tbody></table>`;

	return placements.map( ( row ) => ( {
		...row,
		element: document.querySelector< HTMLTableRowElement >( `[data-row-id="${ row.id }"]` )!,
	} ) );
};

describe( 'getRowDisplacements', () => {
	it( 'uses the dragged row height when moving rows upward or downward', () => {
		expect( getRowDisplacements( placements, 'row-10', 1 ) ).toEqual( [
			{ id: 'row-7', translateY: 72 },
			{ id: 'row-8', translateY: 72 },
			{ id: 'row-9', translateY: 72 },
		] );
		expect( getRowDisplacements( placements, 'row-7', 4 ) ).toEqual( [
			{ id: 'row-8', translateY: -36 },
			{ id: 'row-9', translateY: -36 },
		] );
	} );

	it( 'does not produce a visual move for an invalid or same-position insertion', () => {
		expect( getRowDisplacements( placements, 'row-7', 1 ) ).toEqual( [] );
		expect( getRowDisplacements( placements, 'row-7', 2 ) ).toEqual( [] );
		expect( getRowDisplacements( placements, 'missing', 1 ) ).toEqual( [] );
		expect( getRowDisplacements( placements, 'row-7', -1 ) ).toEqual( [] );
	} );
} );

describe( 'getSourceTranslateY', () => {
	it( 'moves the keyboard source to the pending destination', () => {
		expect( getSourceTranslateY( placements, 'row-10', 1 ) ).toBe( -144 );
		expect( getSourceTranslateY( placements, 'row-7', 4 ) ).toBe( 108 );
	} );

	it( 'does not move the source for an invalid or same-position insertion', () => {
		expect( getSourceTranslateY( placements, 'row-7', 1 ) ).toBe( 0 );
		expect( getSourceTranslateY( placements, 'row-7', 2 ) ).toBe( 0 );
		expect( getSourceTranslateY( placements, 'missing', 1 ) ).toBe( 0 );
		expect( getSourceTranslateY( placements, 'row-7', -1 ) ).toBe( 0 );
	} );
} );

describe( 'TableReorderDragVisuals', () => {
	it( 'moves only the visual rows and clears transforms and the insertion candidate', () => {
		const rows = createVisualRows();
		const setInsertionIndicator = jest.fn< void, [ InsertionIndicator | null ] >();
		const visuals = new TableReorderDragVisuals( setInsertionIndicator );
		const source = rows[ 4 ].element;
		const firstDisplaced = rows[ 1 ].element;
		const secondDisplaced = rows[ 2 ].element;
		const thirdDisplaced = rows[ 3 ].element;
		source.style.opacity = '0.75';
		firstDisplaced.style.transform = 'scale(1)';
		secondDisplaced.style.transition = 'color 1s linear';

		visuals.showCandidate( rows, 'row-10', 'row-7', 1 );

		expect( Array.from( document.querySelectorAll( 'tbody tr' ) ) ).toEqual(
			rows.map( ( row ) => row.element )
		);
		expect( source.style.opacity ).toBe( '0' );
		expect( firstDisplaced.style.transform ).toBe( 'scale(1) translateY(72px)' );
		expect( secondDisplaced.style.transform ).toBe( 'translateY(72px)' );
		expect( thirdDisplaced.style.transform ).toBe( 'translateY(72px)' );
		expect( setInsertionIndicator ).toHaveBeenLastCalledWith( {
			below: false,
			rowId: 'row-7',
		} );

		visuals.clear();

		expect( source.style.opacity ).toBe( '0.75' );
		expect( firstDisplaced.style.transform ).toBe( 'scale(1)' );
		expect( secondDisplaced.style.transition ).toBe( 'color 1s linear' );
		expect( thirdDisplaced.style.transform ).toBe( '' );
		expect( setInsertionIndicator ).toHaveBeenLastCalledWith( null );
	} );

	it( 'keeps the keyboard source visible while moving it to the candidate position', () => {
		const rows = createVisualRows();
		const setInsertionIndicator = jest.fn< void, [ InsertionIndicator | null ] >();
		const visuals = new TableReorderDragVisuals( setInsertionIndicator );
		const source = rows[ 4 ].element;
		const handle = document.createElement( 'button' );
		handle.className =
			'yamabiko-editor-tools-table-reorder-content__handle is-keyboard-reordering';
		handle.dataset.tableReorderRowId = 'row-10';
		document.body.append( handle );
		source.style.opacity = '0.75';

		visuals.showCandidate( rows, 'row-10', 'row-7', 1 );

		expect( source.style.opacity ).toBe( '0.75' );
		expect( source.style.transform ).toBe( 'translateY(-144px)' );

		visuals.clear();

		expect( source.style.opacity ).toBe( '0.75' );
		expect( source.style.transform ).toBe( '' );
	} );

	it( 'notifies once when the insertion candidate is unchanged', () => {
		const rows = createVisualRows();
		const setInsertionIndicator = jest.fn< void, [ InsertionIndicator | null ] >();
		const visuals = new TableReorderDragVisuals( setInsertionIndicator );

		visuals.showCandidate( rows, 'row-10', 'row-7', 1 );
		visuals.showCandidate( rows, 'row-10', 'row-7', 1 );

		expect( setInsertionIndicator ).toHaveBeenCalledTimes( 1 );
		expect( setInsertionIndicator ).toHaveBeenCalledWith( {
			below: false,
			rowId: 'row-7',
		} );
	} );
} );
