import {
	getInsertionIndexForKeyboardDestination,
	getKeyboardDestination,
	getKeyboardMoveDirection,
	getKeyboardTabDestinationIndex,
	isKeyboardReorderToggleKey,
} from './keyboard-reorder';

describe( 'keyboard table reorder', () => {
	it( 'moves the destination by one row from the current pending position', () => {
		const startedAt = 2;
		const firstMove = getKeyboardDestination( startedAt, 5, 'down' );
		expect( firstMove ).toEqual( {
			destinationIndex: 3,
			reason: 'valid',
		} );

		const secondMove = getKeyboardDestination( firstMove.destinationIndex, 5, 'down' );
		expect( secondMove ).toEqual( {
			destinationIndex: 4,
			reason: 'valid',
		} );

		const reversedMove = getKeyboardDestination( secondMove.destinationIndex, 5, 'up' );
		expect( reversedMove ).toEqual( {
			destinationIndex: 3,
			reason: 'valid',
		} );
	} );

	it( 'keeps the pending destination at the table boundaries', () => {
		expect( getKeyboardDestination( 0, 5, 'up' ) ).toEqual( {
			destinationIndex: 0,
			reason: 'first-row',
		} );
		expect( getKeyboardDestination( 4, 5, 'down' ) ).toEqual( {
			destinationIndex: 4,
			reason: 'last-row',
		} );
	} );

	it( 'keeps source and destination concepts separate while moving repeatedly', () => {
		const sourceIndex = 2;
		const upwardDestination = getKeyboardDestination( sourceIndex, 5, 'up' );
		const upwardInsertion = getInsertionIndexForKeyboardDestination(
			sourceIndex,
			upwardDestination.destinationIndex
		);
		const downwardDestination = getKeyboardDestination( sourceIndex, 5, 'down' );
		const downwardInsertion = getInsertionIndexForKeyboardDestination(
			sourceIndex,
			downwardDestination.destinationIndex
		);

		expect( upwardDestination.destinationIndex ).toBe( 1 );
		expect( upwardInsertion ).toBe( 1 );
		expect( downwardDestination.destinationIndex ).toBe( 3 );
		expect( downwardInsertion ).toBe( 4 );
		expect( sourceIndex ).toBe( 2 );
	} );

	it( 'moves Tab focus between adjacent row handles and releases it at the edges', () => {
		expect( getKeyboardTabDestinationIndex( 2, 5, false ) ).toBe( 3 );
		expect( getKeyboardTabDestinationIndex( 2, 5, true ) ).toBe( 1 );
		expect( getKeyboardTabDestinationIndex( 4, 5, false ) ).toBeNull();
		expect( getKeyboardTabDestinationIndex( 0, 5, true ) ).toBeNull();
	} );

	it.each( [
		[ -1, 5 ],
		[ 5, 5 ],
		[ 0, 0 ],
		[ 0.5, 5 ],
		[ 0, 2.5 ],
	] )( 'rejects invalid Tab navigation state (%s, %s)', ( currentIndex, rowCount ) => {
		expect( getKeyboardTabDestinationIndex( currentIndex, rowCount, false ) ).toBeNull();
	} );

	it( 'converts destination indices to the shared insertion model', () => {
		expect( getInsertionIndexForKeyboardDestination( 2, 1 ) ).toBe( 1 );
		expect( getInsertionIndexForKeyboardDestination( 2, 3 ) ).toBe( 4 );
		expect( getInsertionIndexForKeyboardDestination( 2, 2 ) ).toBe( 2 );
	} );

	it( 'recognizes only supported reorder keys', () => {
		expect( getKeyboardMoveDirection( 'ArrowUp' ) ).toBe( 'up' );
		expect( getKeyboardMoveDirection( 'ArrowDown' ) ).toBe( 'down' );
		expect( getKeyboardMoveDirection( 'ArrowLeft' ) ).toBeNull();
		expect( getKeyboardMoveDirection( 'Enter' ) ).toBeNull();
		expect( isKeyboardReorderToggleKey( 'Enter' ) ).toBe( true );
		expect( isKeyboardReorderToggleKey( ' ' ) ).toBe( true );
		expect( isKeyboardReorderToggleKey( 'Spacebar' ) ).toBe( true );
		expect( isKeyboardReorderToggleKey( 'Escape' ) ).toBe( false );
	} );
} );
