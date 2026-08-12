import { __, sprintf } from '@wordpress/i18n';

/** Table Reorderの利用者向け文言で使用するtext domain。 */
const TEXT_DOMAIN = 'yamabiko-editor-tools';

/**
 * 空行を識別する代表情報を返す。
 *
 * @return 翻訳済みの空行ラベル。
 */
export const getEmptyRowLabel = (): string => __( 'Empty row', TEXT_DOMAIN );

/**
 * PCでhover中の行controlに表示する案内を返す。
 *
 * @return VIS-PC-HANDLE-HOVERの翻訳済み文言。
 */
export const getPointerHandleTooltip = (): string =>
	__( 'Drag to move this row, or click to choose a destination.', TEXT_DOMAIN );

/**
 * keyboard focus中の行controlに表示する案内を返す。
 *
 * @return VIS-ROW-HANDLE-FOCUSの翻訳済み文言。
 */
export const getKeyboardHandleTooltip = (): string =>
	__( 'Press Enter or Space to start moving this row.', TEXT_DOMAIN );

/**
 * 行controlのaccessible nameを返す。
 *
 * @param rowNumber   1始まりの現在行位置。
 * @param rowLabel    行内容から作った代表情報。
 * @return UI-ROW-CONTROL-NAMEの翻訳済み文言。
 */
export const getRowControlName = ( rowNumber: number, rowLabel: string ): string =>
	sprintf( __( 'Reorder row %1$d: %2$s', TEXT_DOMAIN ), rowNumber, rowLabel );

/**
 * PC pointer向けの行control説明を返す。
 *
 * @return UI-ROW-CONTROL-POINTER-DESCRIPTIONの翻訳済み文言。
 */
export const getRowControlPointerDescription = (): string =>
	__( 'Drag to move this row, or activate to choose a destination.', TEXT_DOMAIN );

/**
 * keyboard向けの行control説明を返す。
 *
 * @return UI-ROW-CONTROL-KEYBOARD-DESCRIPTIONの翻訳済み文言。
 */
export const getRowControlKeyboardDescription = (): string =>
	__( 'Press Enter or Space to start moving this row.', TEXT_DOMAIN );

/**
 * Block ToolbarのTable Reorder入口名を返す。
 *
 * @return UI-TOOLBAR-REORDER-NAMEの翻訳済み文言。
 */
export const getToolbarReorderName = (): string => __( 'Reorder rows', TEXT_DOMAIN );

/**
 * rowspan範囲内の移動不能行について表示する案内を返す。
 *
 * @return VIS-ROWSPAN-ERRORの翻訳済み文言。
 */
export const getRowspanErrorMessage = (): string =>
	__(
		'This row cannot be moved because it is within a cell that spans multiple rows.',
		TEXT_DOMAIN
	);

/**
 * 移動可能な本文行がない場合の案内を返す。
 *
 * @return VIS-NO-MOVABLE-ROWSの翻訳済み文言。
 */
export const getNoMovableRowsMessage = (): string =>
	__( 'There are no rows that can be reordered in this table.', TEXT_DOMAIN );
