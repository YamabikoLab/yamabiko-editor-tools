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

/** 入力方式に依存しない行移動可否判定に必要な制約。 */
type RowMoveConstraints = {
	forbiddenInsertionIndices: readonly number[];
	nonMovableRowIndices: readonly number[];
	rowCount: number;
};

/** 単一ポインター操作で表示できる移動先。 */
export type RowMoveTarget = {
	insertionIndex: number;
	newIndex: number;
};

/** 行移動方向。 */
export type RowMoveDirection = 'up' | 'down';

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
 * 移動元indexと移動後indexから、移動前のDOM行順序に対する挿入位置を求める。
 *
 * 下方向へ移動した場合は、移動対象行を元の位置へ戻してからcommitする処理に合わせて
 * 1行分を補正する。上方向への移動と同位置ではnewIndexをそのまま使用する。
 *
 * @param oldIndex 移動前の行index。
 * @param newIndex 移動後の行index。
 */
export const getRowMoveInsertionIndex = ( oldIndex: number, newIndex: number ): number =>
	newIndex > oldIndex ? newIndex + 1 : newIndex;

/**
 * 移動前後のindexが同じか判定する。
 *
 * @param oldIndex 移動前の行index。
 * @param newIndex 移動後の行index。
 */
export const isNoopRowMove = ( oldIndex: number, newIndex: number ): boolean =>
	oldIndex === newIndex;

/**
 * 行移動がindex範囲とrowspan制約を満たすか判定する。
 *
 * 同位置への移動は有効なno-opとして扱う。実際にcommitするかどうかは呼び出し側が
 * `isNoopRowMove()`で判定する。
 *
 * @param oldIndex    移動元の行index。
 * @param newIndex    移動後の行index。
 * @param constraints 行数とrowspan由来の制約。
 */
export const isRowMoveAllowed = (
	oldIndex: number,
	newIndex: number,
	constraints: RowMoveConstraints
): boolean => {
	const { forbiddenInsertionIndices, nonMovableRowIndices, rowCount } = constraints;
	if (
		! Number.isInteger( rowCount ) ||
		rowCount < 1 ||
		! Number.isInteger( oldIndex ) ||
		! Number.isInteger( newIndex ) ||
		oldIndex < 0 ||
		newIndex < 0 ||
		oldIndex >= rowCount ||
		newIndex >= rowCount ||
		nonMovableRowIndices.includes( oldIndex )
	) {
		return false;
	}

	return ! forbiddenInsertionIndices.includes( getRowMoveInsertionIndex( oldIndex, newIndex ) );
};

/**
 * 現在の候補から指定方向にある次の有効な移動先indexを返す。
 *
 * rowspan途中など無効な候補は飛ばし、範囲内に有効候補がなければnullを返す。
 *
 * @param oldIndex     移動元の行index。
 * @param currentIndex 現在の移動先候補index。
 * @param direction    探索方向。
 * @param constraints  行数とrowspan由来の制約。
 */
export const getNextValidRowMoveIndex = (
	oldIndex: number,
	currentIndex: number,
	direction: RowMoveDirection,
	constraints: RowMoveConstraints
): number | null => {
	if (
		! Number.isInteger( currentIndex ) ||
		currentIndex < 0 ||
		currentIndex >= constraints.rowCount ||
		constraints.nonMovableRowIndices.includes( oldIndex )
	) {
		return null;
	}

	const step = direction === 'up' ? -1 : 1;
	for (
		let candidate = currentIndex + step;
		candidate >= 0 && candidate < constraints.rowCount;
		candidate += step
	) {
		if ( isRowMoveAllowed( oldIndex, candidate, constraints ) ) {
			return candidate;
		}
	}

	return null;
};

/**
 * 単一ポインター操作で表示できる有効な移動先一覧を返す。
 *
 * 同位置のno-opとrowspan途中などの無効位置は除外し、移動後index順で返す。
 *
 * @param oldIndex    移動元の行index。
 * @param constraints 行数とrowspan由来の制約。
 */
export const getValidRowMoveTargets = (
	oldIndex: number,
	constraints: RowMoveConstraints
): RowMoveTarget[] => {
	if (
		! Number.isInteger( constraints.rowCount ) ||
		constraints.rowCount < 1 ||
		! Number.isInteger( oldIndex ) ||
		oldIndex < 0 ||
		oldIndex >= constraints.rowCount ||
		constraints.nonMovableRowIndices.includes( oldIndex )
	) {
		return [];
	}

	const targets: RowMoveTarget[] = [];
	for ( let newIndex = 0; newIndex < constraints.rowCount; newIndex++ ) {
		if (
			isNoopRowMove( oldIndex, newIndex ) ||
			! isRowMoveAllowed( oldIndex, newIndex, constraints )
		) {
			continue;
		}

		targets.push( {
			insertionIndex: getRowMoveInsertionIndex( oldIndex, newIndex ),
			newIndex,
		} );
	}

	return targets;
};

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
