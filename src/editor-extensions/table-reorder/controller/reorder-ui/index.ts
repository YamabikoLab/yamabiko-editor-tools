/**
 * Table Reorderの操作中UIに関する既存APIを再公開するfacade。
 */

export { announceLiveStatus } from './live-status';
export {
	createReorderGuidance,
	scrollKeyboardDestinationIntoView,
	type ReorderGuidanceUi,
} from './reorder-guidance';
export {
	createRowControls,
	getRowRepresentativeText,
	HANDLE_ZONE_CLASS,
	stopRowControlInteractionPropagation,
	type RowControlEntry,
} from './row-controls';
export { createRowMoveTargets, type RowMoveTargetsUi } from './row-move-targets';
