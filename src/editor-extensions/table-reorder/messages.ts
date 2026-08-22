import { __, sprintf } from '@wordpress/i18n';

/** 空行を識別する代表情報を返す。 */
export const getEmptyRowLabel = (): string => __( 'Empty row', 'yamabiko-table-reorder' );

/** PCでhover中の行controlに表示する案内を返す。 */
export const getPointerHandleTooltip = (): string =>
	__( 'Drag to move, or click to choose a destination.', 'yamabiko-table-reorder' );

/** keyboard focus中の行controlに表示する案内を返す。 */
export const getKeyboardHandleTooltip = (): string =>
	__( 'Enter / Space: start moving', 'yamabiko-table-reorder' );

/** keyboard並べ替え中の案内を返す。 */
export const getKeyboardActiveMessage = (): string =>
	__( '↑↓ Move　Enter / Space Confirm　Esc Cancel', 'yamabiko-table-reorder' );

/** PC単一ポインター操作中の案内を返す。 */
export const getPcPointerActiveMessage = (): string =>
	__( 'Click destination　Esc Cancel', 'yamabiko-table-reorder' );

/** touch並べ替えmode中の案内を返す。 */
export const getTouchModeMessage = (): string =>
	__(
		'Handle: drag to move / tap to choose destination　Cell: tap to edit',
		'yamabiko-table-reorder'
	);

/** touch単一ポインター操作中の案内を返す。 */
export const getTouchPointerActiveMessage = (): string =>
	__( 'Tap destination', 'yamabiko-table-reorder' );

/** PC keyboard利用時に初回だけ表示するcoachmark文言を返す。 */
export const getKeyboardCoachmarkMessage = (): string =>
	__(
		'Reorder rows with the keyboard. Select “Reorder rows” in the toolbar, then use Tab / Shift+Tab to choose a row to reorder.',
		'yamabiko-table-reorder'
	);

/** touch端末で初回利用時に表示するcoachmark文言を返す。 */
export const getTouchCoachmarkMessage = (): string =>
	__( 'Tap “Reorder rows” in the toolbar to begin.', 'yamabiko-table-reorder' );

/**
 * 行controlのaccessible nameを返す。
 *
 * @param rowNumber 1始まりの現在行位置。
 * @param rowLabel  行内容から作った代表情報。
 */
export const getRowControlName = ( rowNumber: number, rowLabel: string ): string => {
	/* translators: 1: row number, 2: representative row text. */
	const template = __( 'Reorder row %1$d: %2$s', 'yamabiko-table-reorder' );
	return sprintf( template, rowNumber, rowLabel );
};

/** PC pointer向けの行control説明を返す。 */
export const getRowControlPointerDescription = (): string =>
	__( 'Drag to move this row, or activate to choose a destination.', 'yamabiko-table-reorder' );

/** keyboard向けの行control説明を返す。 */
export const getRowControlKeyboardDescription = (): string =>
	__( 'Press Enter or Space to start moving this row.', 'yamabiko-table-reorder' );

/**
 * 行の前に挿入する移動先buttonのaccessible nameを返す。
 *
 * @param rowNumber 1始まりの移動先側の行位置。
 * @param rowLabel  行内容から作った代表情報。
 */
export const getDestinationBeforeName = ( rowNumber: number, rowLabel: string ): string => {
	/* translators: 1: row number, 2: representative row text. */
	const template = __( 'Move before row %1$d: %2$s', 'yamabiko-table-reorder' );
	return sprintf( template, rowNumber, rowLabel );
};

/** Table末尾の移動先buttonのaccessible nameを返す。 */
export const getDestinationEndName = (): string =>
	__( 'Move to the end of the table.', 'yamabiko-table-reorder' );

/** touch単一ポインター操作のキャンセルbutton名を返す。 */
export const getCancelName = (): string => __( 'Cancel', 'yamabiko-table-reorder' );

/** 操作案内を閉じるbutton名を返す。 */
export const getCloseGuidanceName = (): string => __( 'Close guidance', 'yamabiko-table-reorder' );

/** Block ToolbarのTable Reorder入口名を返す。 */
export const getToolbarReorderName = (): string => __( 'Reorder rows', 'yamabiko-table-reorder' );

/** Block ToolbarのTable Reorder入口説明を返す。 */
export const getToolbarReorderDescription = (): string =>
	__(
		'Move table rows using drag and drop, the keyboard, or destination selection.',
		'yamabiko-table-reorder'
	);

/** rowspan範囲内の移動不能行について表示する案内を返す。 */
export const getRowspanErrorMessage = (): string =>
	__( 'This row is in a row-spanning cell and can’t be moved.', 'yamabiko-table-reorder' );

/** 移動可能な本文行がない場合の案内を返す。 */
export const getNoMovableRowsMessage = (): string =>
	__( 'No rows can be reordered.', 'yamabiko-table-reorder' );

/**
 * keyboard並べ替え開始を支援技術へ伝える文言を返す。
 *
 * @param rowLabel  対象行の代表情報。
 * @param rowNumber 1始まりの現在行位置。
 * @param rowCount  本文行数。
 */
export const getMoveStartedAnnouncement = (
	rowLabel: string,
	rowNumber: number,
	rowCount: number
): string => {
	/* translators: 1: representative row text, 2: current row number, 3: total row count. */
	const template = __( 'Moving %1$s, row %2$d of %3$d.', 'yamabiko-table-reorder' );
	return sprintf( template, rowLabel, rowNumber, rowCount );
};

/**
 * 単一ポインター操作で移動対象を選択したことを支援技術へ伝える文言を返す。
 *
 * @param rowLabel 対象行の代表情報。
 */
export const getDestinationRequestedAnnouncement = ( rowLabel: string ): string => {
	/* translators: 1: representative row text. */
	const template = __( '%1$s selected. Choose a destination.', 'yamabiko-table-reorder' );
	return sprintf( template, rowLabel );
};

/**
 * keyboardの移動先候補変更を支援技術へ伝える文言を返す。
 *
 * @param rowLabel  対象行の代表情報。
 * @param rowNumber 1始まりの移動先位置。
 * @param rowCount  本文行数。
 */
export const getDestinationChangedAnnouncement = (
	rowLabel: string,
	rowNumber: number,
	rowCount: number
): string => {
	/* translators: 1: representative row text, 2: destination row number, 3: total row count. */
	const template = __( 'Move %1$s to position %2$d of %3$d.', 'yamabiko-table-reorder' );
	return sprintf( template, rowLabel, rowNumber, rowCount );
};

/**
 * 行移動の確定結果を支援技術へ伝える文言を返す。
 *
 * @param rowLabel 対象行の代表情報。
 * @param oldRow   1始まりの移動元位置。
 * @param newRow   1始まりの移動先位置。
 */
export const getMoveCommittedAnnouncement = (
	rowLabel: string,
	oldRow: number,
	newRow: number
): string => {
	/* translators: 1: representative row text, 2: original row number, 3: destination row number. */
	const template = __( 'Moved %1$s from position %2$d to %3$d.', 'yamabiko-table-reorder' );
	return sprintf( template, rowLabel, oldRow, newRow );
};

/**
 * 行移動のキャンセルを支援技術へ伝える文言を返す。
 *
 * @param rowLabel  対象行の代表情報。
 * @param rowNumber 1始まりの維持された行位置。
 */
export const getMoveCanceledAnnouncement = ( rowLabel: string, rowNumber: number ): string => {
	/* translators: 1: representative row text, 2: unchanged row number. */
	const template = __(
		'Canceled moving %1$s. It remains at position %2$d.',
		'yamabiko-table-reorder'
	);
	return sprintf( template, rowLabel, rowNumber );
};

/** keyboard境界通知で利用する方向。 */
type MoveDirection = 'up' | 'down';

/**
 * 先頭・末尾でそれ以上移動できないことを支援技術へ伝える文言を返す。
 *
 * @param rowLabel  対象行の代表情報。
 * @param direction 移動できない方向。
 */
export const getMoveBoundaryAnnouncement = (
	rowLabel: string,
	direction: MoveDirection
): string => {
	const directionLabel =
		direction === 'up'
			? __( 'up', 'yamabiko-table-reorder' )
			: __( 'down', 'yamabiko-table-reorder' );
	/* translators: 1: representative row text, 2: translated movement direction. */
	const template = __( '%1$s cannot move any farther %2$s.', 'yamabiko-table-reorder' );
	return sprintf( template, rowLabel, directionLabel );
};

/**
 * rowspan制約で行を移動できないことを支援技術へ伝える文言を返す。
 *
 * @param rowLabel 対象行の代表情報。
 */
export const getRowspanBlockedAnnouncement = ( rowLabel: string ): string => {
	/* translators: 1: representative row text. */
	const template = __(
		'%1$s cannot be moved because it is within a cell that spans multiple rows.',
		'yamabiko-table-reorder'
	);
	return sprintf( template, rowLabel );
};

/** 移動可能な本文行がないことを支援技術へ伝える文言を返す。 */
export const getNoMovableRowsAnnouncement = (): string =>
	__( 'There are no rows that can be reordered in this table.', 'yamabiko-table-reorder' );
