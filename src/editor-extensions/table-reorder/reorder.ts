export const reorderRows = < Row >(
	rows: Row[],
	sourceIndex: number,
	targetIndex: number
): Row[] => {
	if (
		! Number.isInteger( sourceIndex ) ||
		! Number.isInteger( targetIndex ) ||
		sourceIndex < 0 ||
		targetIndex < 0 ||
		sourceIndex >= rows.length ||
		targetIndex >= rows.length ||
		sourceIndex === targetIndex
	) {
		return rows;
	}

	const nextRows = [ ...rows ];
	const [ row ] = nextRows.splice( sourceIndex, 1 );
	nextRows.splice( targetIndex, 0, row );

	return nextRows;
};
