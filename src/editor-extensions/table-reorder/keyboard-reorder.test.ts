import {
	getInsertionIndexForKeyboardDestination,
	getKeyboardDestination,
	getKeyboardMoveDirection,
	getKeyboardTabDestinationIndex,
	isKeyboardReorderToggleKey,
} from './keyboard-reorder';

describe( 'keyboard table reorder', () => {
	it( 'moves the destination by one row from the source position', () => {
		expect( getKeyboardDestination( 2, 5, 'up' ) ).toEqual( {
			destinationIndex: 1,
			reason: 'valid',
		} );
		expect( getKeyboardDestination( 2, 5, 'down' ) ).toEqual( {
			destinationIndex: 3,
			reason: 'valid',
		} );
	} );

	it( 'keeps the destination at the table boundaries', () => {
		expect( getKeyboardDestination( 0, 5, 'up' ) ).toEqual( {
			destinationIndex: 0,
			reason: 'first-row',
		} );
		expect( getKeyboardDestination( 4, 5, 'down' ) ).toEqual( {
			destinationIndex: 4,
			reason: 'last-row',
		} );
	} );

	it( 'moves Tab focus between adjacent row handles and releases it at the edges', () => {
		expect( getKeyboardTabDestinationIndex( 2, 5, false ) ).toBe( 3 );
		expect( getKeyboardTabDestinationIndex( 2, 5, true ) ).toBe( 1 );
		expect( getKeyboardTabDestinationIndex( 4, 5, false ) ).toBeNull();
		expect( getKeyboardTabDestinationIndex( 0, 5, true ) ).toBeNull();
		expect( getKeyboardTabDestinationIndex( -1, 5, false ) ).toBeNull();
	} );

	it( 'converts destination indices to the shared insertion model', () => {
		expect( getInsertionIndexForKeyboardDestination( 2, 1 ) ).toBe( 1 );
		expect( getInsertionIndexForKeyboardDestination( 2, 3 ) ).toBe( 4 );
	} );

	it( 'recognizes only supported reorder keys', () => {
		expect( getKeyboardMoveDirection( 'ArrowUp' ) ).toBe( 'up' );
		expect( getKeyboardMoveDirection( 'ArrowDown' ) ).toBe( 'down' );
		expect( getKeyboardMoveDirection( 'ArrowLeft' ) ).toBeNull();
		expect( isKeyboardReorderToggleKey( 'Enter' ) ).toBe( true );
		expect( isKeyboardReorderToggleKey( ' ' ) ).toBe( true );
		expect( isKeyboardReorderToggleKey( 'Escape' ) ).toBe( false );
	} );
} );
