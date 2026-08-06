export type KeyboardMoveDirection = 'up' | 'down';

export type KeyboardDestination =
	| { destinationIndex: number; reason: 'valid' }
	| { destinationIndex: number; reason: 'first-row' | 'last-row' };

export const getKeyboardMoveDirection = ( key: string ): KeyboardMoveDirection | null => {
	if ( key === 'ArrowUp' ) {
		return 'up';
	}

	if ( key === 'ArrowDown' ) {
		return 'down';
	}

	return null;
};

export const isKeyboardReorderToggleKey = ( key: string ): boolean =>
	key === 'Enter' || key === ' ' || key === 'Spacebar';

export const getKeyboardDestination = (
	destinationIndex: number,
	rowCount: number,
	direction: KeyboardMoveDirection
): KeyboardDestination => {
	const nextDestinationIndex = destinationIndex + ( direction === 'up' ? -1 : 1 );
	if ( nextDestinationIndex < 0 ) {
		return { destinationIndex, reason: 'first-row' };
	}

	if ( nextDestinationIndex >= rowCount ) {
		return { destinationIndex, reason: 'last-row' };
	}

	return { destinationIndex: nextDestinationIndex, reason: 'valid' };
};

export const getInsertionIndexForKeyboardDestination = (
	sourceIndex: number,
	destinationIndex: number
): number => ( destinationIndex > sourceIndex ? destinationIndex + 1 : destinationIndex );
