/**
 * Table Reorderの行順序計算を扱うモジュール。
 *
 * 行配列の並び替え、drag中・drag完了時の挿入index計算、元DOM順序への復元を担当する。
 * DOMの一時的な並び替えをsource of truthにせず、Gutenbergへcommitするための
 * 決定的な行順序計算と元DOM順序への復元をこのファイルに集約する。
 */

/** drag中の挿入位置計算に必要な汎用入力。 */
type MoveInsertionTarget = {
	relatedElement: HTMLElement;
	insertAfter: boolean;
};

/**
 * 行配列の要素をoldIndexからnewIndexへ移動した新しい配列を返す。
 *
 * 元の配列は変更しない。indexが整数でない、負数、または配列範囲外の場合は
 * 並び替えを行わずnullを返す。
 *
 * @param rows     並び替える元配列。
 * @param oldIndex 移動する要素のindex。
 * @param newIndex 移動先のindex。
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
 * drag中の移動先情報から、現在のDOM行一覧に対する挿入位置を求める。
 *
 * relatedElementが行要素に属さない場合や、その行がrowsに含まれない場合はnullを返す。
 * insertAfterがtrueの場合は関連行の直後を挿入位置として扱う。
 *
 * @param target drag中の関連要素と挿入方向。
 * @param rows   drag開始時に取得したDOM行一覧。
 */
export const getMoveInsertionIndex = (
	target: MoveInsertionTarget,
	rows: readonly HTMLTableRowElement[]
): number | null => {
	const relatedRow = target.relatedElement.closest< HTMLTableRowElement >( 'tr' );
	if ( ! relatedRow ) {
		return null;
	}

	const relatedIndex = rows.indexOf( relatedRow );
	return relatedIndex < 0 ? null : relatedIndex + ( target.insertAfter ? 1 : 0 );
};

/**
 * SortableJSの移動完了indexを、移動前のDOM行順序に対する挿入位置へ変換する。
 *
 * 下方向へ移動した場合は、移動対象行を元の位置へ戻してからcommitする処理に合わせて
 * 1行分を補正する。上方向への移動ではnewIndexをそのまま使用する。
 *
 * @param oldIndex drag開始前の行index。
 * @param newIndex SortableJSが返した移動後index。
 */
export const getEndInsertionIndex = ( oldIndex: number, newIndex: number ): number =>
	newIndex > oldIndex ? newIndex + 1 : newIndex;

/**
 * SortableJSが一時的に変更したtbodyの行DOMをdrag開始時の順序へ戻す。
 *
 * Gutenbergへattributeをcommitする前、またはdrag sessionを破棄するときに呼び出し、
 * SortableJSが変更したDOMをsource of truthとして残さない。
 *
 * @param tbody 元の行順序へ戻すTable body。
 * @param rows  drag開始時に取得した行DOM一覧。
 */
export const restoreOriginalRowOrder = (
	tbody: HTMLTableSectionElement,
	rows: readonly HTMLTableRowElement[]
) => {
	for ( const row of rows ) {
		tbody.append( row );
	}
};
