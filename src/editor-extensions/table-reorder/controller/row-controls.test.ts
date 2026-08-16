import { createRowControls, getRowRepresentativeText, HANDLE_ZONE_CLASS } from './row-controls';

jest.mock( '@wordpress/components', () => ( {
	Tooltip: ( { children }: { children: unknown } ) => children,
} ) );

const createTable = ( labels: string[] ) => {
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	table.append( tbody );
	document.body.append( table );

	for ( const label of labels ) {
		const row = document.createElement( 'tr' );
		const cell = document.createElement( 'td' );
		cell.textContent = label;
		row.append( cell );
		tbody.append( row );
	}

	return { tbody };
};

describe( 'row-controls', () => {
	beforeEach( () => {
		document.body.replaceChildren();
	} );

	it( 'creates native row controls only for movable rows', () => {
		const { tbody } = createTable( [ 'Alpha', '', 'Gamma' ] );
		const firstCell = tbody.rows.item( 0 )?.cells.item( 0 );
		if ( ! firstCell ) {
			throw new Error( 'Expected first table cell' );
		}
		firstCell.style.position = 'static';
		firstCell.style.paddingInlineStart = '7px';

		const controls = createRowControls( document, tbody, [ 2 ], { showAll: false } );

		expect( controls.entries ).toHaveLength( 2 );
		expect( controls.entries[ 0 ].control ).toBeInstanceOf( HTMLButtonElement );
		expect( controls.entries[ 0 ].control.type ).toBe( 'button' );
		expect( controls.entries[ 0 ].control.getAttribute( 'aria-label' ) ).toBe(
			'Reorder row 1: Alpha'
		);
		expect( controls.entries[ 1 ].control.getAttribute( 'aria-label' ) ).toBe(
			'Reorder row 2: Empty row'
		);
		expect( controls.entries[ 0 ].control.dataset.visible ).toBe( 'false' );
		expect( controls.entries[ 0 ].control.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
		expect( tbody.rows.item( 2 )?.querySelector( `.${ HANDLE_ZONE_CLASS }` ) ).toBeNull();
		expect( firstCell.style.paddingInlineStart ).not.toBe( '7px' );

		controls.cleanup();

		expect( tbody.querySelector( `.${ HANDLE_ZONE_CLASS }` ) ).toBeNull();
		expect( firstCell.style.position ).toBe( 'static' );
		expect( firstCell.style.paddingInlineStart ).toBe( '7px' );
	} );

	it( 'keeps only one row control visible in hover mode', () => {
		const { tbody } = createTable( [ 'Alpha', 'Beta' ] );
		const controls = createRowControls( document, tbody, [], { showAll: false } );
		const [ firstEntry, secondEntry ] = controls.entries;

		controls.setVisible( firstEntry, true );
		expect( firstEntry.control.dataset.visible ).toBe( 'true' );
		expect( secondEntry.control.dataset.visible ).toBe( 'false' );

		controls.setVisible( secondEntry, true );
		expect( firstEntry.control.dataset.visible ).toBe( 'false' );
		expect( secondEntry.control.dataset.visible ).toBe( 'true' );

		controls.cleanup();
	} );

	it( 'exposes the current reorder target separately from focus state', () => {
		const { tbody } = createTable( [ 'Alpha' ] );
		const controls = createRowControls( document, tbody, [], { showAll: false } );
		const entry = controls.entries[ 0 ];

		expect( entry.control.getAttribute( 'aria-pressed' ) ).toBe( 'false' );

		entry.setPressed( true );
		expect( entry.control.getAttribute( 'aria-pressed' ) ).toBe( 'true' );
		expect( entry.control.getAttribute( 'aria-describedby' ) ).toBeNull();

		entry.setPressed( false );
		expect( entry.control.getAttribute( 'aria-pressed' ) ).toBe( 'false' );

		controls.cleanup();
	} );

	it( 'uses WordPress Tooltip instead of a native title and switches the accessible description', () => {
		const { tbody } = createTable( [ 'Alpha' ] );
		const controls = createRowControls( document, tbody, [], { showAll: false } );
		const control = controls.entries[ 0 ].control;
		const pointerDescriptionId = control.getAttribute( 'aria-describedby' );

		expect( control.hasAttribute( 'title' ) ).toBe( false );
		expect( pointerDescriptionId ).toContain( '-pointer' );

		control.dispatchEvent( new FocusEvent( 'focus' ) );
		expect( control.hasAttribute( 'title' ) ).toBe( false );
		expect( control.getAttribute( 'aria-describedby' ) ).toContain( '-keyboard' );

		control.dispatchEvent( new FocusEvent( 'blur' ) );
		expect( control.hasAttribute( 'title' ) ).toBe( false );
		expect( control.getAttribute( 'aria-describedby' ) ).toBe( pointerDescriptionId );

		controls.cleanup();
	} );

	it( 'uses the first non-empty cell as representative row text', () => {
		const { tbody } = createTable( [ '' ] );
		const row = tbody.rows.item( 0 );
		if ( ! row ) {
			throw new Error( 'Expected table row' );
		}
		row.append( document.createElement( 'td' ) );
		row.cells.item( 1 )!.textContent = 'Second cell';

		expect( getRowRepresentativeText( row ) ).toBe( 'Second cell' );
	} );
} );
