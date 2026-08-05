import {
	crossesRowspanBoundary,
	getForbiddenInsertionIndices,
	getNonMovableRowIndices,
	getRowspanRanges,
	type RowspanRange,
} from './rowspan';
import { reorderRows } from './reorder';

type DragCandidate = {
	insertionIndex: number;
	targetId: string;
};

export type TableReorderDragSession = {
	body: unknown[];
	forbiddenInsertionIndices: readonly number[];
	nonMovableRowIndices: readonly number[];
	ranges: readonly RowspanRange[];
	sourceId: string;
	sourceIndex: number;
	target: DragCandidate | null;
};

type CandidateUpdate = {
	isForbidden: boolean;
	session: TableReorderDragSession;
};

const getBodyRows = ( body: unknown ): unknown[] => ( Array.isArray( body ) ? body : [] );

const getTargetIndex = ( sourceIndex: number, insertionIndex: number ): number | null => {
	const targetIndex = insertionIndex > sourceIndex ? insertionIndex - 1 : insertionIndex;

	return targetIndex === sourceIndex ? null : targetIndex;
};

export const beginTableReorderDrag = (
	body: unknown,
	sourceId: string,
	sourceIndex: number
): TableReorderDragSession | null => {
	const snapshot = [ ...getBodyRows( body ) ];
	if ( sourceIndex < 0 || sourceIndex >= snapshot.length ) {
		return null;
	}

	const ranges = getRowspanRanges( snapshot );

	return {
		body: snapshot,
		forbiddenInsertionIndices: getForbiddenInsertionIndices( ranges ),
		nonMovableRowIndices: getNonMovableRowIndices( ranges ),
		ranges,
		sourceId,
		sourceIndex,
		target: null,
	};
};

export const clearTableReorderDragTarget = (
	session: TableReorderDragSession
): TableReorderDragSession => ( { ...session, target: null } );

export const updateTableReorderDragTarget = (
	session: TableReorderDragSession,
	targetId: string,
	insertionIndex: number
): CandidateUpdate => {
	const isForbidden =
		! Number.isInteger( insertionIndex ) ||
		insertionIndex < 0 ||
		insertionIndex > session.body.length ||
		session.nonMovableRowIndices.includes( session.sourceIndex ) ||
		session.forbiddenInsertionIndices.includes( insertionIndex ) ||
		crossesRowspanBoundary( session.ranges, session.sourceIndex, insertionIndex );

	if ( isForbidden ) {
		return {
			isForbidden: true,
			session: clearTableReorderDragTarget( session ),
		};
	}

	const targetIndex = getTargetIndex( session.sourceIndex, insertionIndex );
	if ( targetIndex === null ) {
		return {
			isForbidden: false,
			session: clearTableReorderDragTarget( session ),
		};
	}

	return {
		isForbidden: false,
		session: {
			...session,
			target: { insertionIndex, targetId },
		},
	};
};

export const getCommittedTableReorderBody = (
	session: TableReorderDragSession | null,
	{
		canceled,
		sourceId,
		targetId,
	}: {
		canceled: boolean;
		sourceId: string;
		targetId: string | null;
	}
): unknown[] | null => {
	if (
		! session ||
		canceled ||
		session.sourceId !== sourceId ||
		session.target?.targetId !== targetId
	) {
		return null;
	}

	const targetIndex = getTargetIndex( session.sourceIndex, session.target.insertionIndex );
	return targetIndex === null
		? null
		: reorderRows( session.body, session.sourceIndex, targetIndex );
};

export const commitTableReorderDrag = (
	session: TableReorderDragSession | null,
	completion: {
		canceled: boolean;
		sourceId: string;
		targetId: string | null;
	},
	commit: ( body: unknown[] ) => void
): boolean => {
	const body = getCommittedTableReorderBody( session, completion );
	if ( ! body ) {
		return false;
	}

	commit( body );
	return true;
};
