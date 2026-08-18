import {
	getKeyboardActiveMessage,
	getTouchModeMessage,
} from '../../messages';
import {
	createReorderGuidance,
	scrollKeyboardDestinationIntoView,
} from './reorder-guidance';
import { createRowControls, getRowRepresentativeText } from './row-controls';
import { createRowMoveTargets } from './row-move-targets';

const { act } = jest.requireActual< {
	act: ( callback: () => void | Promise< void > ) => Promise< void >;
} >( 'react' );

jest.mock( '@wordpress/components', () => ( {
	Tooltip: ( { children }: { children: unknown } ) => children,
} ) );

const createRect = ( top: number, bottom: number, left = 0, width = 400 ): DOMRect =>
	( {
		bottom,
		height: bottom - top,
		left,
		right: left + width,
		top,
		width,
		x: left,
		y: top,
		toJSON: () => ( {} ),
	} ) as DOMRect;

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

	return { table, tbody };
};

const getDestination = () => {
	const destination = document.querySelector< HTMLButtonElement >(
		'.yamabiko-table-reorder-destination'
	);
	if ( ! destination ) {
		throw new Error( 'Expected destination button' );
	}
	return destination;
};

const dispatchPointer = (
	target: EventTarget,
	type: string,
	{
		x,
		y,
		pointerId = 1,
		pointerType = 'touch',
	}: {
		x: number;
		y: number;
		pointerId?: number;
		pointerType?: string;
	}
) => {
	const event = new Event( type, { bubbles: true, cancelable: true } );
	Object.defineProperties( event, {
		clientX: { value: x },
		clientY: { value: y },
		pointerId: { value: pointerId },
		pointerType: { value: pointerType },
	} );
	target.dispatchEvent( event );
};

describe( 'reorder-ui guard branches', () => {
	beforeEach( () => {
		document.body.replaceChildren();
	} );

	afterEach( () => {
		jest.restoreAllMocks();
	} );

	it( 'ignores mouse pointerdown and unrelated pointer movement for row move targets', () => {
		const { tbody } = createTable( [ 'Alpha', 'Beta', 'Gamma' ] );
		const onSelect = jest.fn();
		const targets = createRowMoveTargets( document, tbody, [ { insertionIndex: 2, newIndex: 1 } ], {
			isTouch: false,
			onCancel: jest.fn(),
			onSelect,
		} );
		const destination = getDestination();

		dispatchPointer( destination, 'pointerdown', {
			pointerType: 'mouse',
			x: 10,
			y: 10,
		} );
		dispatchPointer( destination, 'pointermove', { x: 30, y: 30 } );
		dispatchPointer( destination, 'pointerdown', { x: 10, y: 10 } );
		dispatchPointer( destination, 'pointermove', { pointerId: 2, x: 30, y: 30 } );
		dispatchPointer( destination, 'pointerup', { x: 10, y: 10 } );
		destination.click();

		expect( onSelect ).toHaveBeenCalledTimes( 1 );
		targets.cleanup();
	} );

	it( 'suppresses the click following a cancelled touch target gesture', () => {
		const { tbody } = createTable( [ 'Alpha', 'Beta', 'Gamma' ] );
		const onSelect = jest.fn();
		const targets = createRowMoveTargets( document, tbody, [ { insertionIndex: 2, newIndex: 1 } ], {
			isTouch: true,
			onCancel: jest.fn(),
			onSelect,
		} );
		const destination = getDestination();

		dispatchPointer( destination, 'pointerdown', { x: 10, y: 10 } );
		dispatchPointer( destination, 'pointercancel', { x: 10, y: 10 } );
		destination.click();
		expect( onSelect ).not.toHaveBeenCalled();

		destination.click();
		expect( onSelect ).toHaveBeenCalledTimes( 1 );
		targets.cleanup();
	} );

	it( 'truncates long representative row text to the accessible label limit', () => {
		const longLabel = 'A'.repeat( 81 );
		const { tbody } = createTable( [ longLabel ] );
		const row = tbody.rows.item( 0 );
		if ( ! row ) {
			throw new Error( 'Expected table row' );
		}

		expect( getRowRepresentativeText( row ) ).toBe( `${ 'A'.repeat( 79 ) }…` );
	} );

	it( 'skips rows without a first cell', () => {
		const { tbody } = createTable( [] );
		tbody.append( document.createElement( 'tr' ) );

		const controls = createRowControls( document, tbody, [], { showAll: false } );

		expect( controls.entries ).toHaveLength( 0 );
		controls.cleanup();
	} );

	it( 'keeps setPressed idempotent when the requested state is unchanged', () => {
		const { tbody } = createTable( [ 'Alpha' ] );
		const controls = createRowControls( document, tbody, [], { showAll: false } );
		const entry = controls.entries[ 0 ];

		entry.setPressed( false );
		expect( entry.control.getAttribute( 'aria-pressed' ) ).toBe( 'false' );

		controls.cleanup();
	} );

	it( 'removes the keyboard description again after blur in touch reorder mode', async () => {
		const { tbody } = createTable( [ 'Alpha' ] );
		const controls = createRowControls( document, tbody, [], { showAll: true } );
		const control = controls.entries[ 0 ].control;

		Object.assign( globalThis, { IS_REACT_ACT_ENVIRONMENT: true } );
		try {
			await act( async () => {
				control.dispatchEvent( new FocusEvent( 'focus' ) );
			} );
			expect( control.getAttribute( 'aria-describedby' ) ).toContain( '-keyboard' );

			await act( async () => {
				control.dispatchEvent( new FocusEvent( 'blur' ) );
			} );
			expect( control.getAttribute( 'aria-describedby' ) ).toBeNull();
		} finally {
			Object.assign( globalThis, { IS_REACT_ACT_ENVIRONMENT: false } );
			controls.cleanup();
		}
	} );

	it( 'moves keyboard guidance away from the arrow-key travel direction', () => {
		const { table, tbody } = createTable( [ 'Alpha' ] );
		jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue( createRect( 100, 300 ) );
		const guidance = createReorderGuidance( document, tbody, getKeyboardActiveMessage() );

		document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'ArrowUp' } ) );
		expect( guidance.element.style.top ).toBe( `${ window.innerHeight - 8 }px` );

		document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'ArrowDown' } ) );
		expect( guidance.element.style.top ).toBe( '64px' );

		guidance.cleanup();
	} );

	it( 'ignores non-touch and unrelated pointer events for touch guidance', () => {
		const { table, tbody } = createTable( [ 'Alpha' ] );
		jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue( createRect( 100, 300 ) );
		const guidance = createReorderGuidance( document, tbody, getTouchModeMessage() );

		dispatchPointer( document, 'pointerdown', {
			pointerType: 'mouse',
			x: 0,
			y: 100,
		} );
		dispatchPointer( document, 'pointermove', { x: 0, y: 120 } );
		dispatchPointer( document, 'pointermove', {
			pointerType: 'mouse',
			x: 0,
			y: 120,
		} );
		dispatchPointer( document, 'pointerdown', { x: 0, y: 100 } );
		dispatchPointer( document, 'pointermove', { pointerId: 2, x: 0, y: 120 } );

		expect( guidance.element.style.top ).toBe( '8px' );
		guidance.cleanup();
	} );

	it( 'does not scroll without a destination boundary or with a tiny viewport', () => {
		const scrollBy = jest.spyOn( window, 'scrollBy' ).mockImplementation( () => undefined );
		const emptyTbody = document.createElement( 'tbody' );

		scrollKeyboardDestinationIntoView( window, emptyTbody, 0 );
		expect( scrollBy ).not.toHaveBeenCalled();

		const { tbody } = createTable( [ 'Alpha' ] );
		const row = tbody.rows.item( 0 );
		if ( ! row ) {
			throw new Error( 'Expected table row' );
		}
		jest.spyOn( row, 'getBoundingClientRect' ).mockReturnValue( createRect( 100, 120 ) );
		const originalInnerHeight = window.innerHeight;
		Object.defineProperty( window, 'innerHeight', { configurable: true, value: 40 } );
		try {
			scrollKeyboardDestinationIntoView( window, tbody, 0 );
			expect( scrollBy ).not.toHaveBeenCalled();
		} finally {
			Object.defineProperty( window, 'innerHeight', {
				configurable: true,
				value: originalInnerHeight,
			} );
		}
	} );

	it( 'scrolls down when the end destination is below the keyboard viewport margin', () => {
		const scrollBy = jest.spyOn( window, 'scrollBy' ).mockImplementation( () => undefined );
		const { tbody } = createTable( [ 'Alpha' ] );
		const row = tbody.rows.item( 0 );
		if ( ! row ) {
			throw new Error( 'Expected table row' );
		}
		jest.spyOn( row, 'getBoundingClientRect' ).mockReturnValue( createRect( 180, 200 ) );
		const originalInnerHeight = window.innerHeight;
		Object.defineProperty( window, 'innerHeight', { configurable: true, value: 100 } );
		try {
			scrollKeyboardDestinationIntoView( window, tbody, 1 );
			expect( scrollBy ).toHaveBeenCalledWith( {
				behavior: 'auto',
				left: 0,
				top: 124,
			} );
		} finally {
			Object.defineProperty( window, 'innerHeight', {
				configurable: true,
				value: originalInnerHeight,
			} );
		}
	} );
} );
