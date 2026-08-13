import { __, sprintf } from '@wordpress/i18n';

/**
 * 空行を識別する代表情報を返す。
 *
 * @return 翻訳済みの空行ラベル。
 */
export const getEmptyRowLabel = (): string => __( 'Empty row', 'yamabiko-editor-tools' );

/**
 * PCでhover中の行controlに表示する案内を返す。
 *
 * @return VIS-PC-HANDLE-HOVERの翻訳済み文言。
 */
export const getPointerHandleTooltip = (): string =>
	__( 'Drag to move this row, or click to choose a destination.', 'yamabiko-editor-tools' );

/**
 * keyboard focus中の行controlに表示する案内を返す。
 *
 * @return VIS-ROW-HANDLE-FOCUSの翻訳済み文言。
 */
export const getKeyboardHandleTooltip = (): string =>
	__( 'Press Enter or Space to start moving this row.', 'yamabiko-editor-tools' );

/**
 * PC単一ポインター操作中の案内を返す。
 *
 * @return VIS-PC-POINTER-ACTIVEの翻訳済み文言。
 */
export const getPcPointerActiveMessage = (): string =>
	__( 'Click where you want to move the row. Press Escape to cancel.', 'yamabiko-editor-tools' );

/**
 * touch単一ポインター操作中の案内を返す。
 *
 * @return VIS-TOUCH-POINTER-ACTIVEの翻訳済み文言。
 */
export const getTouchPointerActiveMessage = (): string =>
	__( 'Tap where you want to move the row.', 'yamabiko-editor-tools' );

/**
 * 行controlのaccessible nameを返す。
 *
 * @param rowNumber 1始まりの現在行位置。
 * @param rowLabel  行内容から作った代表情報。
 * @return UI-ROW-CONTROL-NAMEの翻訳済み文言。
 */
export const getRowControlName = ( rowNumber: number, rowLabel: string ): string => {
	/* translators: 1: row number, 2: representative row text. */
	const template = __( 'Reorder row %1$d: %2$s', 'yamabiko-editor-tools' );
	return sprintf( template, rowNumber, rowLabel );
};

/**
 * PC pointer向けの行control説明を返す。
 *
 * @return UI-ROW-CONTROL-POINTER-DESCRIPTIONの翻訳済み文言。
 */
export const getRowControlPointerDescription = (): string =>
	__( 'Drag to move this row, or activate to choose a destination.', 'yamabiko-editor-tools' );

/**
 * keyboard向けの行control説明を返す。
 *
 * @return UI-ROW-CONTROL-KEYBOARD-DESCRIPTIONの翻訳済み文言。
 */
export const getRowControlKeyboardDescription = (): string =>
	__( 'Press Enter or Space to start moving this row.', 'yamabiko-editor-tools' );

/**
 * 行の前に挿入する移動先buttonのaccessible nameを返す。
 *
 * @param rowNumber 1始まりの移動先側の行位置。
 * @param rowLabel  行内容から作った代表情報。
 * @return UI-DESTINATION-BEFORE-NAMEの翻訳済み文言。
 */
export const getDestinationBeforeName = ( rowNumber: number, rowLabel: string ): string => {
	/* translators: 1: row number, 2: representative row text. */
	const template = __( 'Move before row %1$d: %2$s', 'yamabiko-editor-tools' );
	return sprintf( template, rowNumber, rowLabel );
};

/**
 * Table末尾の移動先buttonのaccessible nameを返す。
 *
 * @return UI-DESTINATION-END-NAMEの翻訳済み文言。
 */
export const getDestinationEndName = (): string =>
	__( 'Move to the end of the table.', 'yamabiko-editor-tools' );

/**
 * touch単一ポインター操作のキャンセルbutton名を返す。
 *
 * @return UI-CANCEL-NAMEの翻訳済み文言。
 */
export const getCancelName = (): string => __( 'Cancel', 'yamabiko-editor-tools' );

/**
 * Block ToolbarのTable Reorder入口名を返す。
 *
 * @return UI-TOOLBAR-REORDER-NAMEの翻訳済み文言。
 */
export const getToolbarReorderName = (): string => __( 'Reorder rows', 'yamabiko-editor-tools' );

/**
 * rowspan範囲内の移動不能行について表示する案内を返す。
 *
 * @return VIS-ROWSPAN-ERRORの翻訳済み文言。
 */
export const getRowspanErrorMessage = (): string =>
	__(
		'This row cannot be moved because it is within a cell that spans multiple rows.',
		'yamabiko-editor-tools'
	);

/**
 * 移動可能な本文行がない場合の案内を返す。
 *
 * @return VIS-NO-MOVABLE-ROWSの翻訳済み文言。
 */
export const getNoMovableRowsMessage = (): string =>
	__( 'There are no rows that can be reordered in this table.', 'yamabiko-editor-tools' );
