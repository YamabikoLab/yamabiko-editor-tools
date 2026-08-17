import { createRowControls, getRowRepresentativeText, HANDLE_ZONE_CLASS } from './row-controls';

const { act } = jest.requireActual< { act: ( callback: () => void ) => void } >( 'react' );

jest.mock( '@wordpress/components', () => ( {
	Tooltip: ( { children }: { children: unknown } ) => children,
} ) );

const createTable = ( labels: string[] ) => {
	const wrapper = document.createElement( 'figure' );
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	table.append( tbody );
	wrapper.append( table );
	document.body.append( wrapper );

	for ( const label of labels ) {
		const row = document.createElement( 'tr' );
		const cell = document.createElement( 'td' );
		cell.textContent = label;
		row.append( cell );
		tbody.append( row );
	}

	return { table, tbody, wrapper };
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

	it( 'adds only the missing first-column width in touch reorder mode and restores it', () => {
		const { table, tbody, wrapper } = createTable( [ 'Alpha', 'Beta' ] );
		const sizingCell = table.rows.item( 0 )?.cells.item( 0 );
		if ( ! sizingCell ) {
			throw new Error( 'Expected sizing cell' );
		}
		table.style.minWidth = '400px';
		sizingCell.style.width = '20px';
		wrapper.style.overflowX = 'hidden';
		jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue( { width: 408 } as DOMRect );
		jest.spyOn( sizingCell, 'getBoundingClientRect' ).mockReturnValue( { width: 27 } as DOMRect );

		const controls = createRowControls( document, tbody, [], { showAll: true } );

		expect( wrapper.style.overflowX ).toBe( 'auto' );
		expect( table.style.minWidth ).toBe( '445px' );
		expect( sizingCell.style.width ).toBe( '64px' );

		controls.cleanup();

		expect( wrapper.style.overflowX ).toBe( 'hidden' );
		expect( table.style.minWidth ).toBe( '400px' );
		expect( sizingCell.style.width ).toBe( '20px' );
	} );

	it( 'keeps table width unchanged when the first column is already wide enough', () => {
		const { table, tbody, wrapper } = createTable( [ 'Alpha', 'Beta' ] );
		const sizingCell = table.rows.item( 0 )?.cells.item( 0 );
		if ( ! sizingCell ) {
			throw new Error( 'Expected sizing cell' );
		}
		jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue( { width: 408 } as DOMRect );
		jest.spyOn( sizingCell, 'getBoundingClientRect' ).mockReturnValue( { width: 80 } as DOMRect );

		const controls = createRowControls( document, tbody, [], { showAll: true } );

		expect( wrapper.style.overflowX ).toBe( '' );
		expect( table.style.minWidth ).toBe( '' );
		expect( sizingCell.style.width ).toBe( '' );

		controls.cleanup();
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

		act( () => {
			control.dispatchEvent( new FocusEvent( 'focus' ) );
		} );
		expect( control.hasAttribute( 'title' ) ).toBe( false );
		expect( control.getAttribute( 'aria-describedby' ) ).toContain( '-keyboard' );

		act( () => {
			control.dispatchEvent( new FocusEvent( 'blur' ) );
		} );
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
