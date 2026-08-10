/**
 * Table Reorderの行順序計算を扱うモジュール。
 *
 * React / Gutenbergの状態管理やSortableJS instanceのlifecycleは扱わず、
 * 行配列の並び替えと、drag中・drag完了時の挿入index計算だけを担当する。
 * DOMの一時的な並び替えをsource of truthにせず、Gutenbergへcommitするための
 * 決定的な行順序計算をこのファイルに集約する。
 */

/**
 * SortableJSのonMove callbackから、挿入位置の判定に必要な情報だけを表す。
 *
 * SortableJS本体の型に直接依存させず、行順序の計算に必要な境界だけをこのモジュールで扱う。
 */
type SortableMoveEventLike = {
	related: HTMLElement;
	willInsertAfter: boolean;
};

/**
 * 行配列の要素をoldIndexからnewIndexへ移動した新しい配列を返す。
 *
 * 元の配列は変更しない。indexが整数でない、負数、または配列範囲外の場合は
 * 並び替えを行わずnullを返す。
 * @param rows
 * @param oldIndex
 * @param newIndex
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
 * SortableJSのonMove情報から、現在のDOM行一覧に対する挿入位置を求める。
 *
 * relatedが行要素に属さない場合や、その行がrowsに含まれない場合はnullを返す。
 * willInsertAfterがtrueの場合は関連行の直後を挿入位置として扱う。
 * @param event
 * @param rows
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
 * SortableJSの移動完了indexを、移動前のDOM行順序に対する挿入位置へ変換する。
 *
 * 下方向へ移動した場合は、移動対象行を元の位置へ戻してからcommitする処理に合わせて
 * 1行分を補正する。上方向への移動ではnewIndexをそのまま使用する。
 * @param oldIndex
 * @param newIndex
 */
export const getEndInsertionIndex = ( oldIndex: number, newIndex: number ): number =>
	newIndex > oldIndex ? newIndex + 1 : newIndex;
