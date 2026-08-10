type SortableMoveEventLike = {
	related: HTMLElement;
	willInsertAfter: boolean;
};

export const reorderRows = (
	rows: readonly unknown[],
	oldIndex: number,
	newIndex: number
): unknown[] | null => {
	if (
		! Number.isInteger( oldIndex ) ||
		! Number.isInteger( newIndex ) ||
		oldIndex < 0 ||
		newIndex < 0 ||
		oldIndex >= rows.length ||
		newIndex >= rows.length
	) {
		return null;
	}

	const reordered = [ ...rows ];
	const [ movedRow ] = reordered.splice( oldIndex, 1 );
	reordered.splice( newIndex, 0, movedRow );
	return reordered;
};

export const getMoveInsertionIndex = (
	event: SortableMoveEventLike,
	rows: readonly HTMLTableRowElement[]
): number | null => {
	const relatedRow = event.related.closest< HTMLTableRowElement >( 'tr' );
	if ( ! relatedRow ) {
		return null;
	}

	const relatedIndex = rows.indexOf( relatedRow );
	return relatedIndex < 0 ? null : relatedIndex + ( event.willInsertAfter ? 1 : 0 );
};

export const getEndInsertionIndex = ( oldIndex: number, newIndex: number ): number =>
	newIndex > oldIndex ? newIndex + 1 : newIndex;
