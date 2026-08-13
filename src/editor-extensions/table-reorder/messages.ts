import { __, sprintf } from '@wordpress/i18n';

/** Table Reorderで利用するtext domain。 */
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
 * keyboard並べ替え中の案内を返す。
 *
 * @return VIS-KEYBOARD-ACTIVEの翻訳済み文言。
 */
export const getKeyboardActiveMessage = (): string =>
	__(
		'Use the Up and Down arrow keys to move the row. Press Enter or Space to confirm, or Escape to cancel.',
		TEXT_DOMAIN
	);

/**
 * PC単一ポインター操作中の案内を返す。
 *
 * @return VIS-PC-POINTER-ACTIVEの翻訳済み文言。
 */
export const getPcPointerActiveMessage = (): string =>
	__( 'Click where you want to move the row. Press Escape to cancel.', TEXT_DOMAIN );

/**
 * touch並べ替えmode中の案内を返す。
 *
 * @return VIS-TOUCH-MODEの翻訳済み文言。
 */
export const getTouchModeMessage = (): string =>
	__(
		'Drag a row handle to move the row. Or tap the handle and choose a destination. Tap a cell to edit it.',
		TEXT_DOMAIN
	);

/**
 * touch単一ポインター操作中の案内を返す。
 *
 * @return VIS-TOUCH-POINTER-ACTIVEの翻訳済み文言。
 */
export const getTouchPointerActiveMessage = (): string =>
	__( 'Tap where you want to move the row.', TEXT_DOMAIN );

/**
 * touch端末で初回利用時に表示するcoachmark文言を返す。
 *
 * @return VIS-TOUCH-COACHMARKの翻訳済み文言。
 */
export const getTouchCoachmarkMessage = (): string =>
	__(
		'You can reorder the rows in this table. Tap “Reorder rows” in the toolbar to begin.',
		TEXT_DOMAIN
	);

/**
 * 行controlのaccessible nameを返す。
 *
 * @param rowNumber 1始まりの現在行位置。
 * @param rowLabel  行内容から作った代表情報。
 * @return UI-ROW-CONTROL-NAMEの翻訳済み文言。
 */
export const getRowControlName = ( rowNumber: number, rowLabel: string ): string => {
	/* translators: 1: row number, 2: representative row text. */
	const template = __( 'Reorder row %1$d: %2$s', TEXT_DOMAIN );
	return sprintf( template, rowNumber, rowLabel );
};

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
 * 行の前に挿入する移動先buttonのaccessible nameを返す。
 *
 * @param rowNumber 1始まりの移動先側の行位置。
 * @param rowLabel  行内容から作った代表情報。
 * @return UI-DESTINATION-BEFORE-NAMEの翻訳済み文言。
 */
export const getDestinationBeforeName = ( rowNumber: number, rowLabel: string ): string => {
	/* translators: 1: row number, 2: representative row text. */
	const template = __( 'Move before row %1$d: %2$s', TEXT_DOMAIN );
	return sprintf( template, rowNumber, rowLabel );
};

/**
 * Table末尾の移動先buttonのaccessible nameを返す。
 *
 * @return UI-DESTINATION-END-NAMEの翻訳済み文言。
 */
export const getDestinationEndName = (): string => __( 'Move to the end of the table.', TEXT_DOMAIN );

/**
 * touch単一ポインター操作のキャンセルbutton名を返す。
 *
 * @return UI-CANCEL-NAMEの翻訳済み文言。
 */
export const getCancelName = (): string => __( 'Cancel', TEXT_DOMAIN );

/**
 * Block ToolbarのTable Reorder入口名を返す。
 *
 * @return UI-TOOLBAR-REORDER-NAMEの翻訳済み文言。
 */
export const getToolbarReorderName = (): string => __( 'Reorder rows', TEXT_DOMAIN );

/**
 * Block ToolbarのTable Reorder入口説明を返す。
 *
 * @return UI-TOOLBAR-REORDER-DESCRIPTIONの翻訳済み文言。
 */
export const getToolbarReorderDescription = (): string =>
	__( 'Move table rows using drag and drop, the keyboard, or destination selection.', TEXT_DOMAIN );

/**
 * rowspan範囲内の移動不能行について表示する案内を返す。
 *
 * @return VIS-ROWSPAN-ERRORの翻訳済み文言。
 */
export const getRowspanErrorMessage = (): string =>
	__( 'This row cannot be moved because it is within a cell that spans multiple rows.', TEXT_DOMAIN );

/**
 * 移動可能な本文行がない場合の案内を返す。
 *
 * @return VIS-NO-MOVABLE-ROWSの翻訳済み文言。
 */
export const getNoMovableRowsMessage = (): string =>
	__( 'There are no rows that can be reordered in this table.', TEXT_DOMAIN );

/**
 * keyboard並べ替え開始を支援技術へ伝える文言を返す。
 *
 * @param rowLabel  対象行の代表情報。
 * @param rowNumber 1始まりの現在行位置。
 * @param rowCount  本文行数。
 * @return ANN-MOVE-STARTEDの翻訳済み文言。
 */
export const getMoveStartedAnnouncement = (
	rowLabel: string,
	rowNumber: number,
	rowCount: number
): string => {
	/* translators: 1: representative row text, 2: current row number, 3: total row count. */
	const template = __( 'Moving %1$s, row %2$d of %3$d.', TEXT_DOMAIN );
	return sprintf( template, rowLabel, rowNumber, rowCount );
};

/**
 * 単一ポインター操作で移動対象を選択したことを支援技術へ伝える文言を返す。
 *
 * @param rowLabel 対象行の代表情報。
 * @return ANN-DESTINATION-REQUESTEDの翻訳済み文言。
 */
export const getDestinationRequestedAnnouncement = ( rowLabel: string ): string => {
	/* translators: %s: representative row text. */
	const template = __( '%1$s selected. Choose a destination.', TEXT_DOMAIN );
	return sprintf( template, rowLabel );
};

/**
 * keyboardの移動先候補変更を支援技術へ伝える文言を返す。
 *
 * @param rowLabel  対象行の代表情報。
 * @param rowNumber 1始まりの移動先位置。
 * @param rowCount  本文行数。
 * @return ANN-DESTINATION-CHANGEDの翻訳済み文言。
 */
export const getDestinationChangedAnnouncement = (
	rowLabel: string,
	rowNumber: number,
	rowCount: number
): string => {
	/* translators: 1: representative row text, 2: destination row number, 3: total row count. */
	const template = __( 'Move %1$s to position %2$d of %3$d.', TEXT_DOMAIN );
	return sprintf( template, rowLabel, rowNumber, rowCount );
};

/**
 * 行移動の確定結果を支援技術へ伝える文言を返す。
 *
 * @param rowLabel 対象行の代表情報。
 * @param oldRow   1始まりの移動元位置。
 * @param newRow   1始まりの移動先位置。
 * @return ANN-MOVE-COMMITTEDの翻訳済み文言。
 */
export const getMoveCommittedAnnouncement = (
	rowLabel: string,
	oldRow: number,
	newRow: number
): string => {
	/* translators: 1: representative row text, 2: original row number, 3: destination row number. */
	const template = __( 'Moved %1$s from position %2$d to %3$d.', TEXT_DOMAIN );
	return sprintf( template, rowLabel, oldRow, newRow );
};

/**
 * 行移動のキャンセルを支援技術へ伝える文言を返す。
 *
 * @param rowLabel  対象行の代表情報。
 * @param rowNumber 1始まりの維持された行位置。
 * @return ANN-MOVE-CANCELEDの翻訳済み文言。
 */
export const getMoveCanceledAnnouncement = ( rowLabel: string, rowNumber: number ): string => {
	/* translators: 1: representative row text, 2: unchanged row number. */
	const template = __( 'Canceled moving %1$s. It remains at position %2$d.', TEXT_DOMAIN );
	return sprintf( template, rowLabel, rowNumber );
};

/** keyboard境界通知で利用する方向。 */
export type MoveDirection = 'up' | 'down';

/**
 * 先頭・末尾でそれ以上移動できないことを支援技術へ伝える文言を返す。
 *
 * @param rowLabel  対象行の代表情報。
 * @param direction 移動できない方向。
 * @return ANN-MOVE-BOUNDARYの翻訳済み文言。
 */
export const getMoveBoundaryAnnouncement = (
	rowLabel: string,
	direction: MoveDirection
): string => {
	const directionLabel =
		direction === 'up' ? __( 'up', TEXT_DOMAIN ) : __( 'down', TEXT_DOMAIN );
	/* translators: 1: representative row text, 2: translated movement direction. */
	const template = __( '%1$s cannot move any farther %2$s.', TEXT_DOMAIN );
	return sprintf( template, rowLabel, directionLabel );
};

/**
 * rowspan制約で行を移動できないことを支援技術へ伝える文言を返す。
 *
 * @param rowLabel 対象行の代表情報。
 * @return ANN-ROWSPAN-BLOCKEDの翻訳済み文言。
 */
export const getRowspanBlockedAnnouncement = ( rowLabel: string ): string => {
	/* translators: %s: representative row text. */
	const template = __(
		'%1$s cannot be moved because it is within a cell that spans multiple rows.',
		TEXT_DOMAIN
	);
	return sprintf( template, rowLabel );
};

/**
 * 移動可能な本文行がないことを支援技術へ伝える文言を返す。
 *
 * @return ANN-NO-MOVABLE-ROWSの翻訳済み文言。
 */
export const getNoMovableRowsAnnouncement = (): string => getNoMovableRowsMessage();
