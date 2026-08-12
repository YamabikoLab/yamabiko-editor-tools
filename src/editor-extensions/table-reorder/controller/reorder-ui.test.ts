import { createRowControls, getRowRepresentativeText, HANDLE_ZONE_CLASS } from './reorder-ui';

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

const flushPromises = async () => {
	await Promise.resolve();
	await Promise.resolve();
};

describe( 'reorder-ui', () => {
	beforeEach( () => {
		document.body.replaceChildren();
	} );

	it( 'creates native row controls only for movable rows', async () => {
		const { tbody } = createTable( [ 'Alpha', '', 'Gamma' ] );
		const firstCell = tbody.rows.item( 0 )?.cells.item( 0 );
		if ( ! firstCell ) {
			throw new Error( 'Expected first table cell' );
		}
		firstCell.style.position = 'static';
		firstCell.style.paddingInlineStart = '7px';

		const controls = createRowControls( document, tbody, [ 2 ], { showAll: false } );
		const firstControl = controls.entries[ 0 ].control;

		expect( controls.entries ).toHaveLength( 2 );
		expect( firstControl ).toBeInstanceOf( HTMLButtonElement );
		expect( firstControl.type ).toBe( 'button' );
		expect( firstControl.getAttribute( 'aria-label' ) ).toBe( 'Reorder row 1: Alpha' );
		expect( controls.entries[ 1 ].control.getAttribute( 'aria-label' ) ).toBe(
			'Reorder row 2: Empty row'
		);
		expect( firstControl.dataset.visible ).toBe( 'false' );
		expect( tbody.rows.item( 2 )?.querySelector( `.${ HANDLE_ZONE_CLASS }` ) ).toBeNull();
		expect( firstCell.style.paddingInlineStart ).not.toBe( '7px' );

		await flushPromises();
		expect( firstControl.isConnected ).toBe( true );
		expect( tbody.rows.item( 0 )?.querySelector( `.${ HANDLE_ZONE_CLASS }` ) ).toBe( firstControl );

		controls.cleanup();

		expect( tbody.querySelector( `.${ HANDLE_ZONE_CLASS }` ) ).toBeNull();
		expect( firstCell.style.position ).toBe( 'static' );
		expect( firstCell.style.paddingInlineStart ).toBe( '7px' );
	} );

	it( 'uses WordPress Tooltip instead of a native title and switches the accessible description', async () => {
		const { tbody } = createTable( [ 'Alpha' ] );
		const controls = createRowControls( document, tbody, [], { showAll: false } );
		const control = controls.entries[ 0 ].control;
		const pointerDescriptionId = control.getAttribute( 'aria-describedby' );

		await flushPromises();
		expect( control.isConnected ).toBe( true );
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
