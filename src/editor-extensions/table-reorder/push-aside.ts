export type TableReorderPoint = {
	x: number;
	y: number;
};

export type TableReorderRow = {
	id: string;
	index: number;
};

export type TableReorderRowPosition = {
	height: number;
	left: number;
	top: number;
	width: number;
};

export type TableReorderDropTarget = {
	insertionIndex: number;
	targetId: string;
};

export const getTableReorderDropTarget = (
	rows: readonly TableReorderRow[],
	positions: ReadonlyMap< string, TableReorderRowPosition >,
	point: TableReorderPoint
): TableReorderDropTarget | null => {
	const positionedRows = rows
		.map( ( row ) => ( { position: positions.get( row.id ), row } ) )
		.filter(
			( candidate ): candidate is { position: TableReorderRowPosition; row: TableReorderRow } =>
				candidate.position !== undefined
		)
		.sort( ( left, right ) => left.row.index - right.row.index );
	const first = positionedRows[ 0 ];
	const last = positionedRows.at( -1 );

	if (
		! first ||
		! last ||
		point.x < first.position.left ||
		point.x > first.position.left + first.position.width ||
		point.y < first.position.top ||
		point.y > last.position.top + last.position.height
	) {
		return null;
	}

	const candidate = positionedRows.find(
		( { position } ) => point.y <= position.top + position.height
	);
	if ( ! candidate ) {
		return null;
	}

	return {
		insertionIndex:
			point.y < candidate.position.top + candidate.position.height / 2
				? candidate.row.index
				: candidate.row.index + 1,
		targetId: candidate.row.id,
	};
};

export const getTableReorderPushAsideOffsets = (
	rows: readonly TableReorderRow[],
	{
		insertionIndex,
		sourceHeight,
		sourceIndex,
	}: {
		insertionIndex: number;
		sourceHeight: number;
		sourceIndex: number;
	}
): Map< string, number > => {
	if ( ! Number.isFinite( sourceHeight ) || sourceHeight <= 0 ) {
		return new Map();
	}

	if ( insertionIndex === sourceIndex || insertionIndex === sourceIndex + 1 ) {
		return new Map();
	}

	const offset = insertionIndex < sourceIndex ? sourceHeight : -sourceHeight;
	return new Map(
		rows
			.filter( ( row ) =>
				insertionIndex < sourceIndex
					? row.index >= insertionIndex && row.index < sourceIndex
					: row.index > sourceIndex && row.index < insertionIndex
			)
			.map( ( row ) => [ row.id, offset ] )
	);
};
