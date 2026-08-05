import {
	beginTableReorderDrag,
	clearTableReorderDragTarget,
	commitTableReorderDrag,
	getCommittedTableReorderBody,
	updateTableReorderDragTarget,
} from './drag-session';

type Row = {
	cells: Array< {
		content: string;
		rowspan?: number;
	} >;
};

const createRows = (): Row[] =>
	[ '6', '7', '8', '9', '10' ].map( ( content ) => ( {
		cells: [ { content } ],
	} ) );

const getContents = ( rows: unknown[] ) => rows.map( ( row ) => ( row as Row ).cells[ 0 ].content );

describe( 'Table reorder drag session', () => {
	it( 'commits 10 above 7 from the drag-start body snapshot exactly once', () => {
		const rows = createRows();
		const session = beginTableReorderDrag( rows, 'row-10', 4 );
		const setAttributes = jest.fn();
		expect( session ).not.toBeNull();

		const update = updateTableReorderDragTarget( session!, 'row-7', 1 );
		const committed = getCommittedTableReorderBody( update.session, {
			canceled: false,
			sourceId: 'row-10',
			targetId: 'row-7',
		} );
		const didCommit = commitTableReorderDrag(
			update.session,
			{
				canceled: false,
				sourceId: 'row-10',
				targetId: 'row-7',
			},
			( body ) => setAttributes( { body } )
		);

		expect( didCommit ).toBe( true );
		expect( setAttributes ).toHaveBeenCalledTimes( 1 );
		expect( getContents( committed! ) ).toEqual( [ '6', '10', '7', '8', '9' ] );
		expect( committed?.[ 1 ] ).toBe( rows[ 4 ] );
		expect( rows ).toHaveLength( 5 );
	} );

	it( 'commits normal upward and downward moves from the same insertion model', () => {
		const rows = createRows();
		const upward = updateTableReorderDragTarget(
			beginTableReorderDrag( rows, 'row-9', 3 )!,
			'row-7',
			1
		);
		const downward = updateTableReorderDragTarget(
			beginTableReorderDrag( rows, 'row-7', 1 )!,
			'row-9',
			4
		);

		expect(
			getContents(
				getCommittedTableReorderBody( upward.session, {
					canceled: false,
					sourceId: 'row-9',
					targetId: 'row-7',
				} )!
			)
		).toEqual( [ '6', '9', '7', '8', '10' ] );
		expect(
			getContents(
				getCommittedTableReorderBody( downward.session, {
					canceled: false,
					sourceId: 'row-7',
					targetId: 'row-9',
				} )!
			)
		).toEqual( [ '6', '8', '9', '7', '10' ] );
	} );

	it( 'preserves the core Table row and cell data when committing a move', () => {
		const rows = [
			{
				cells: [
					{ content: 'first', tag: 'td' },
					{ className: 'is-emphasized', colspan: 2, content: '<strong>second</strong>', tag: 'td' },
				],
			},
			{
				cells: [
					{ content: 'third', tag: 'th' },
					{ content: 'fourth', tag: 'td' },
				],
			},
			{ cells: [ { content: 'fifth', tag: 'td' } ] },
		];
		const session = beginTableReorderDrag( rows, 'row-1', 1 )!;
		const update = updateTableReorderDragTarget( session, 'row-0', 0 );

		const committed = getCommittedTableReorderBody( update.session, {
			canceled: false,
			sourceId: 'row-1',
			targetId: 'row-0',
		} );
		const committedRows = committed as typeof rows | null;

		expect( committedRows ).toEqual( [ rows[ 1 ], rows[ 0 ], rows[ 2 ] ] );
		expect( committedRows?.[ 0 ] ).toBe( rows[ 1 ] );
		expect( committedRows?.[ 1 ]?.cells ).toBe( rows[ 0 ].cells );
		expect( committedRows?.[ 1 ]?.cells[ 1 ] ).toEqual( {
			className: 'is-emphasized',
			colspan: 2,
			content: '<strong>second</strong>',
			tag: 'td',
		} );
	} );

	it( 'does not commit a move across a rowspan range or into its interior', () => {
		const mergedRows: Row[] = [
			{ cells: [ { content: '6' } ] },
			{ cells: [ { content: '7', rowspan: 2 } ] },
			{ cells: [ { content: '8' } ] },
			{ cells: [ { content: '9' } ] },
		];
		const mergedCell = mergedRows[ 1 ].cells[ 0 ];
		const acrossRange = updateTableReorderDragTarget(
			beginTableReorderDrag( mergedRows, 'row-6', 0 )!,
			'row-9',
			3
		);
		const intoRange = updateTableReorderDragTarget(
			beginTableReorderDrag( mergedRows, 'row-9', 3 )!,
			'row-8',
			2
		);

		expect( acrossRange.isForbidden ).toBe( true );
		expect( intoRange.isForbidden ).toBe( true );
		const setAttributes = jest.fn();
		expect(
			commitTableReorderDrag(
				acrossRange.session,
				{
					canceled: false,
					sourceId: 'row-6',
					targetId: 'row-9',
				},
				( body ) => setAttributes( { body } )
			)
		).toBe( false );
		expect( setAttributes ).not.toHaveBeenCalled();
		expect(
			getCommittedTableReorderBody( acrossRange.session, {
				canceled: false,
				sourceId: 'row-6',
				targetId: 'row-9',
			} )
		).toBeNull();
		expect(
			getCommittedTableReorderBody( intoRange.session, {
				canceled: false,
				sourceId: 'row-9',
				targetId: 'row-8',
			} )
		).toBeNull();
		expect( getContents( mergedRows ) ).toEqual( [ '6', '7', '8', '9' ] );
		expect( mergedRows[ 1 ].cells[ 0 ].rowspan ).toBe( 2 );
		expect( mergedRows[ 1 ].cells[ 0 ] ).toBe( mergedCell );
	} );

	it( 'discards a valid candidate when it leaves tbody, is canceled, or ends reorder mode', () => {
		const rows = createRows();
		const session = beginTableReorderDrag( rows, 'row-10', 4 )!;
		const valid = updateTableReorderDragTarget( session, 'row-7', 1 ).session;
		const outsideTbody = clearTableReorderDragTarget( valid );

		expect(
			getCommittedTableReorderBody( outsideTbody, {
				canceled: false,
				sourceId: 'row-10',
				targetId: null,
			} )
		).toBeNull();
		expect(
			getCommittedTableReorderBody( valid, {
				canceled: true,
				sourceId: 'row-10',
				targetId: 'row-7',
			} )
		).toBeNull();
		expect(
			getCommittedTableReorderBody( null, {
				canceled: false,
				sourceId: 'row-10',
				targetId: 'row-7',
			} )
		).toBeNull();
		expect( getContents( rows ) ).toEqual( [ '6', '7', '8', '9', '10' ] );
	} );

	it( 'does not commit a same-position drop', () => {
		const rows = createRows();
		const update = updateTableReorderDragTarget(
			beginTableReorderDrag( rows, 'row-7', 1 )!,
			'row-7',
			1
		);

		expect( update.isForbidden ).toBe( false );
		expect( update.session.target ).toBeNull();
		expect(
			getCommittedTableReorderBody( update.session, {
				canceled: false,
				sourceId: 'row-7',
				targetId: 'row-7',
			} )
		).toBeNull();
	} );
} );
