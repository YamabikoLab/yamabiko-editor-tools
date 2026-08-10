export type RowspanRange = {
	end: number;
	start: number;
};

type TableCell = {
	rowspan?: unknown;
};

const getRows = ( body: unknown ): unknown[] => ( Array.isArray( body ) ? body : [] );

const getCells = ( row: unknown ): TableCell[] =>
	isRecord( row ) && Array.isArray( row.cells )
		? row.cells.filter( ( cell ): cell is TableCell => isRecord( cell ) )
		: [];

const isRecord = ( value: unknown ): value is Record< string, unknown > =>
	value !== null && typeof value === 'object';

const getRowspan = ( cell: TableCell ): number | null => {
	const value =
		typeof cell.rowspan === 'number' || typeof cell.rowspan === 'string'
			? Number( cell.rowspan )
			: null;

	return value !== null && Number.isInteger( value ) && value >= 2 ? value : null;
};

export const getRowspanRanges = ( body: unknown ): RowspanRange[] => {
	const rows = getRows( body );

	return rows.flatMap( ( row, start ) =>
		getCells( row ).flatMap( ( cell ) => {
			const rowspan = getRowspan( cell );
			if ( rowspan === null ) {
				return [];
			}

			const end = Math.min( start + rowspan - 1, rows.length - 1 );
			return end > start ? [ { start, end } ] : [];
		} )
	);
};

export const getNonMovableRowIndices = ( ranges: readonly RowspanRange[] ): number[] =>
	[ ...new Set( ranges.flatMap( ( { start, end } ) => range( start, end ) ) ) ].sort(
		( left, right ) => left - right
	);

export const getForbiddenInsertionIndices = ( ranges: readonly RowspanRange[] ): number[] =>
	[ ...new Set( ranges.flatMap( ( { start, end } ) => range( start + 1, end ) ) ) ].sort(
		( left, right ) => left - right
	);

export const crossesRowspanBoundary = (
	ranges: readonly RowspanRange[],
	sourceIndex: number,
	insertionIndex: number
): boolean =>
	ranges.some(
		( { start, end } ) =>
			( sourceIndex < start && insertionIndex > end ) ||
			( sourceIndex > end && insertionIndex <= start )
	);

const range = ( start: number, end: number ): number[] =>
	Array.from( { length: end - start + 1 }, ( _, index ) => start + index );
