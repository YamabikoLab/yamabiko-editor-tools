type TableCell = {
	rowspan?: unknown;
};

type TableRow = {
	cells?: unknown;
};

type RowSpanRange = {
	end: number;
	start: number;
};

export const getTableRows = ( value: unknown ): TableRow[] =>
	Array.isArray( value ) ? value.filter( ( row ): row is TableRow => Boolean( row ) && typeof row === 'object' ) : [];

const parseRowSpan = ( value: unknown ): number => {
	if ( typeof value === 'number' ) {
		return Number.isInteger( value ) && value > 1 ? value : 1;
	}

	if ( typeof value === 'string' && /^[0-9]+$/.test( value ) ) {
		const parsed = Number.parseInt( value, 10 );
		return parsed > 1 ? parsed : 1;
	}

	return 1;
};

const getRowCells = ( row: TableRow ): TableCell[] =>
	Array.isArray( row.cells )
		? row.cells.filter(
				( cell ): cell is TableCell =>
					Boolean( cell ) && typeof cell === 'object'
		  )
		: [];

export const getRowSpanRanges = ( rows: TableRow[] ): RowSpanRange[] => {
	const ranges: RowSpanRange[] = [];

	for ( let rowIndex = 0; rowIndex < rows.length; rowIndex++ ) {
		for ( const cell of getRowCells( rows[ rowIndex ] ) ) {
			const rowSpan = parseRowSpan( cell.rowspan );
			if ( rowSpan <= 1 ) {
				continue;
			}

			ranges.push( {
				start: rowIndex,
				end: Math.min( rows.length - 1, rowIndex + rowSpan - 1 ),
			} );
		}
	}

	return ranges;
};

export const isIndexInRowSpan = ( index: number, ranges: RowSpanRange[] ): boolean =>
	ranges.some( ( range ) => index >= range.start && index <= range.end );

export const wouldSplitRowSpan = ( oldIndex: number, newIndex: number, ranges: RowSpanRange[] ): boolean => {
	if ( isIndexInRowSpan( oldIndex, ranges ) ) {
		return true;
	}

	return ranges.some( ( range ) => {
		if ( oldIndex < range.start ) {
			return newIndex >= range.start;
		}

		if ( oldIndex > range.end ) {
			return newIndex <= range.end;
		}

		return false;
	} );
};
