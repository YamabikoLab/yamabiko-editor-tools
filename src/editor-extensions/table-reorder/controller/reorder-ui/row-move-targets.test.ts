import { createRowMoveTargets } from './row-move-targets';

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

const dispatchTouchPointer = (
	target: Element,
	type: string,
	{ x, y }: { x: number; y: number }
) => {
	const event = new Event( type, { bubbles: true, cancelable: true } );
	Object.defineProperties( event, {
		clientX: { value: x },
		clientY: { value: y },
		pointerId: { value: 1 },
		pointerType: { value: 'touch' },
	} );
	target.dispatchEvent( event );
};

describe( 'row-move-targets', () => {
	beforeEach( () => {
		document.body.replaceChildren();
	} );

	it( 'keeps row move target labels and cleanup scoped to the target UI', () => {
		const { tbody } = createTable( [ 'Alpha', 'Beta', 'Gamma' ] );
		const onCancel = jest.fn();
		const onSelect = jest.fn();
		const targets = createRowMoveTargets( document, tbody, [ { insertionIndex: 2, newIndex: 1 } ], {
			isTouch: true,
			onCancel,
			onSelect,
		} );
		const destination = document.querySelector< HTMLButtonElement >(
			'.yamabiko-table-reorder-destination'
		);
		const cancel = document.querySelector< HTMLButtonElement >(
			'.yamabiko-table-reorder-pointer-cancel'
		);

		expect( destination?.getAttribute( 'aria-label' ) ).toBe( 'Move before row 3: Gamma' );
		expect( cancel?.getAttribute( 'aria-label' ) ).toBe( 'Cancel' );
		cancel?.click();
		expect( onCancel ).toHaveBeenCalledTimes( 1 );

		targets.cleanup();

		expect( document.querySelector( '.yamabiko-table-reorder-destination' ) ).toBeNull();
		expect( document.querySelector( '.yamabiko-table-reorder-pointer-guidance' ) ).toBeNull();
	} );

	it( 'selects a row move target once for a touch tap within the threshold', () => {
		const { tbody } = createTable( [ 'Alpha', 'Beta', 'Gamma' ] );
		const onSelect = jest.fn();
		const targets = createRowMoveTargets( document, tbody, [ { insertionIndex: 2, newIndex: 1 } ], {
			isTouch: true,
			onCancel: jest.fn(),
			onSelect,
		} );
		const destination = document.querySelector< HTMLButtonElement >(
			'.yamabiko-table-reorder-destination'
		);
		if ( ! destination ) {
			throw new Error( 'Expected destination button' );
		}

		dispatchTouchPointer( destination, 'pointerdown', { x: 10, y: 10 } );
		dispatchTouchPointer( destination, 'pointermove', { x: 13, y: 13 } );
		dispatchTouchPointer( destination, 'pointerup', { x: 13, y: 13 } );
		destination.click();

		expect( onSelect ).toHaveBeenCalledTimes( 1 );
		expect( onSelect ).toHaveBeenCalledWith( 1 );

		targets.cleanup();
	} );
} );
