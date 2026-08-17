/**
 * Table Reorderが対応するblock固有差分を提供する薄いsupport境界。
 */

/** Table Reorderがblockごとに必要とする最小support情報。 */
export type TableReorderBlockSupport = {
	rowspanProperty: string;
};

/** 現在対応するblockと、そのblock固有差分。 */
const BLOCK_SUPPORTS: Readonly< Record< string, TableReorderBlockSupport > > = {
	'core/table': {
		rowspanProperty: 'rowspan',
	},
};

/**
 * block nameに対応するTable Reorder supportを取得する。
 *
 * @param blockName Gutenberg block name。
 * @return 対応blockのsupport。非対応blockではnull。
 */
export const getTableReorderBlockSupport = ( blockName: string ): TableReorderBlockSupport | null =>
	BLOCK_SUPPORTS[ blockName ] ?? null;
