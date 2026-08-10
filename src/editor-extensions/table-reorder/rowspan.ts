/**
 * Table Reorderのrowspan制約を行indexの範囲として扱うモジュール。
 *
 * GutenbergのTable body attributeからrowspan範囲を抽出し、
 * 移動できない行indexとrowspanを分断する挿入indexを計算する。
 * DOMやSortableJS instanceは扱わず、rowspanに関する純粋な計算だけを担当する。
 */

/**
 * rowspanが占有する本文行のindex範囲。
 *
 * startとendはどちらも範囲に含む。
 */
export type RowspanRange = {
	end: number;
	start: number;
};

/**
 * Gutenberg Table body内のcellで、このモジュールが参照する最小構造。
 */
type TableCell = {
	rowspan?: unknown;
};

/**
 * unknown値がpropertyを参照できるobjectか判定する。
 *
 * @param value 判定対象の値。
 */
const isRecord = ( value: unknown ): value is Record< string, unknown > =>
	value !== null && typeof value === 'object';

/**
 * Table body attributeを行配列として正規化する。
 *
 * 配列でない場合は空配列を返す。
 *
 * @param body Gutenberg Table blockのbody attribute。
 */
const getRows = ( body: unknown ): unknown[] => ( Array.isArray( body ) ? body : [] );

/**
 * 行から有効なcell objectだけを取得する。
 *
 * cellsが配列でない場合や、objectでないcellは無視する。
 *
 * @param row Table body内の1行。
 */
const getCells = ( row: unknown ): TableCell[] =>
	isRecord( row ) && Array.isArray( row.cells )
		? row.cells.filter( ( cell ): cell is TableCell => isRecord( cell ) )
		: [];

/**
 * cellのrowspanを有効な行数として取得する。
 *
 * 2以上の整数または数値文字列だけを採用し、それ以外はnullを返す。
 *
 * @param cell 判定対象のTable cell。
 */
const getRowspan = ( cell: TableCell ): number | null => {
	const value =
		typeof cell.rowspan === 'number' || typeof cell.rowspan === 'string'
			? Number( cell.rowspan )
			: null;

	return value !== null && Number.isInteger( value ) && value >= 2 ? value : null;
};

/**
 * startからendまで、両端を含むindex配列を生成する。
 *
 * @param start 開始index。
 * @param end   終了index。
 */
const range = ( start: number, end: number ): number[] =>
	Array.from( { length: end - start + 1 }, ( _, index ) => start + index );

/**
 * Table bodyからrowspanが占有する行範囲を抽出する。
 *
 * rowspanがTable末尾を越える場合は最終行までに収める。
 * 無効なbody、row、cell、rowspanは無視する。
 *
 * @param body Gutenberg Table blockのbody attribute。
 */
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

/**
 * rowspan範囲に含まれる、移動できない行indexを返す。
 *
 * 重複する範囲はまとめ、indexを昇順で返す。
 *
 * @param ranges rowspanが占有する行範囲。
 */
export const getNonMovableRowIndices = ( ranges: readonly RowspanRange[] ): number[] =>
	[ ...new Set( ranges.flatMap( ( { start, end } ) => range( start, end ) ) ) ].sort(
		( left, right ) => left - right
	);

/**
 * rowspan範囲を分断するため、挿入できない行間indexを返す。
 *
 * rowspan範囲の直前と直後への挿入は許可し、範囲内部だけを禁止する。
 * 重複するindexはまとめ、昇順で返す。
 *
 * @param ranges rowspanが占有する行範囲。
 */
export const getForbiddenInsertionIndices = ( ranges: readonly RowspanRange[] ): number[] =>
	[ ...new Set( ranges.flatMap( ( { start, end } ) => range( start + 1, end ) ) ) ].sort(
		( left, right ) => left - right
	);
