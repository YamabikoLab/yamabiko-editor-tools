/**
 * SortableJS の onMove callback から、挿入位置の判定に必要な情報だけを表す。
 *
 * SortableJS 本体の型に直接依存させず、行順序の計算に必要な境界だけをこのモジュールで扱う。
 */
type SortableMoveEventLike = {
	related: HTMLElement;
	willInsertAfter: boolean;
};

/**
 * 行配列の要素を oldIndex から newIndex へ移動した新しい配列を返す。
 *
 * 元の配列は変更しない。index が整数でない、負数、または配列範囲外の場合は
 * 並び替えを行わず null を返す。
 */
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

/**
 * SortableJS の onMove 情報から、現在の DOM 行一覧に対する挿入位置を求める。
 *
 * related が行要素に属さない場合や、その行が rows に含まれない場合は null を返す。
 * willInsertAfter が true の場合は関連行の直後を挿入位置として扱う。
 */
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

/**
 * SortableJS の移動完了 index を、移動前の DOM 行順序に対する挿入位置へ変換する。
 *
 * 下方向へ移動した場合は、移動対象行を元の位置へ戻してから commit する処理に合わせて
 * 1 行分を補正する。上方向への移動では newIndex をそのまま使用する。
 */
export const getEndInsertionIndex = ( oldIndex: number, newIndex: number ): number =>
	newIndex > oldIndex ? newIndex + 1 : newIndex;
