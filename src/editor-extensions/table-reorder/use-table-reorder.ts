/**
 * Table ReorderのReact state / effect lifecycleとcontroller接続を管理する。
 *
 * hover capability、touch並び替えmode、block選択解除時のreset、初回coachmarkの永続化を所有し、
 * 解決済みTable contextとrowspan制約からSortableJS controllerを生成・破棄する。DOM装飾やdrag sessionの
 * 命令的処理は下位モジュールへ委譲し、WordPress notice APIとsetAttributesは狭いcallbackへ変換する。
 */

import { useDispatch, useSelect } from '@wordpress/data';
import { useEffect, useRef, useState, type RefObject } from '@wordpress/element';
import { store as noticesStore } from '@wordpress/notices';

import { announceLiveStatus } from './controller/reorder-ui';
import {
	createSortableController,
	type ReorderInteractionMode,
	type SortableController,
} from './controller/sortable-controller';
import {
	getNoMovableRowsAnnouncement,
	getNoMovableRowsMessage,
	getRowspanErrorMessage,
} from './messages';
import { getForbiddenInsertionIndices, getNonMovableRowIndices, getRowspanRanges } from './rowspan';
import { resolveTableContext } from './table-context';

/** hover操作を利用できる端末を判定するmedia query。 */
const HOVER_REORDER_MEDIA_QUERY = '(hover: hover) and (pointer: fine)';

/** WordPress preferences storeへ保存するscope。 */
const PREFERENCES_SCOPE = 'yamabiko-editor-tools';

/** touch初回coachmarkのdismiss状態を保存するpreference名。 */
const TOUCH_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderTouchCoachmarkDismissed';

/** WordPress preferences selectorの利用部分。 */
type PreferencesSelector = {
	get: ( scope: string, name: string ) => unknown;
};

/** WordPress preferences actionsの利用部分。 */
type PreferencesActions = {
	set: ( scope: string, name: string, value: unknown ) => Promise< unknown > | unknown;
};

/** SortableJS runtime URLを公開するeditor windowの設定。 */
type TableReorderConfigWindow = Window & {
	yamabikoEditorToolsTableReorder?: {
		runtimeUrl?: string;
	};
};

/** custom hookへ渡すGutenberg側の入力。 */
export type UseTableReorderOptions = {
	body: unknown;
	clientId: string;
	enabled: boolean;
	isSelected: boolean;
	setAttributes: ( attributes: { body: unknown[] } ) => void;
};

/** HOCが描画とtoolbar操作に利用する最小state。 */
export type TableReorderHookResult = {
	anchorRef: RefObject< HTMLSpanElement >;
	dismissTouchCoachmark: () => void;
	isHoverCapable: boolean;
	isTouchCoachmarkVisible: boolean;
	isTouchReorderMode: boolean;
	requestRowControlFocus: () => void;
	toggleTouchReorderMode: () => void;
};

/**
 * Table ReorderのReact lifecycleを所有し、必要な期間だけSortableJS controllerを接続する。
 *
 * @param options Table blockのbody、選択状態、clientId、attribute更新callback。
 * @return Toolbar描画と操作に必要なstate / callback。
 */
export const useTableReorder = ( options: UseTableReorderOptions ): TableReorderHookResult => {
	const { body, clientId, enabled, isSelected, setAttributes } = options;
	const anchorRef = useRef< HTMLSpanElement >( null );
	const controllerRef = useRef< SortableController | null >( null );
	const pendingFocusRowIndexRef = useRef< number | null >( null );
	const { createNotice } = useDispatch( noticesStore );
	const preferencesActions = useDispatch( 'core/preferences' ) as unknown as PreferencesActions;
	const isTouchCoachmarkDismissed = useSelect( ( registrySelect ) => {
		const preferences = registrySelect( 'core/preferences' ) as unknown as PreferencesSelector;
		return preferences.get( PREFERENCES_SCOPE, TOUCH_COACHMARK_DISMISSED_PREFERENCE ) === true;
	}, [] );
	const createNoticeRef = useRef( createNotice );
	const setAttributesRef = useRef( setAttributes );
	const [ isHoverCapable, setIsHoverCapable ] = useState(
		() => window.matchMedia( HOVER_REORDER_MEDIA_QUERY ).matches
	);
	const [ isTouchReorderMode, setIsTouchReorderMode ] = useState( false );
	const [ isTouchCoachmarkVisible, setIsTouchCoachmarkVisible ] = useState( false );
	let interactionMode: ReorderInteractionMode | null = null;
	if ( isHoverCapable ) {
		interactionMode = 'hover';
	} else if ( isSelected && isTouchReorderMode ) {
		interactionMode = 'touch';
	}

	useEffect( () => {
		createNoticeRef.current = createNotice;
	}, [ createNotice ] );

	useEffect( () => {
		setAttributesRef.current = setAttributes;
	}, [ setAttributes ] );

	useEffect( () => {
		if ( ! enabled ) {
			return;
		}

		const hoverMedia = window.matchMedia( HOVER_REORDER_MEDIA_QUERY );
		const syncHoverCapability = () => {
			setIsHoverCapable( hoverMedia.matches );
			if ( hoverMedia.matches ) {
				setIsTouchReorderMode( false );
				setIsTouchCoachmarkVisible( false );
			}
		};

		syncHoverCapability();
		hoverMedia.addEventListener( 'change', syncHoverCapability );
		return () => {
			hoverMedia.removeEventListener( 'change', syncHoverCapability );
		};
	}, [ enabled ] );

	useEffect( () => {
		if ( ! isSelected ) {
			setIsTouchReorderMode( false );
			setIsTouchCoachmarkVisible( false );
		}
	}, [ isSelected ] );

	useEffect( () => {
		if ( ! enabled || ! isSelected || isHoverCapable || isTouchReorderMode ) {
			setIsTouchCoachmarkVisible( false );
			return;
		}

		setIsTouchCoachmarkVisible( ! isTouchCoachmarkDismissed );
	}, [ enabled, isHoverCapable, isSelected, isTouchCoachmarkDismissed, isTouchReorderMode ] );

	useEffect( () => {
		controllerRef.current = null;
		if ( ! enabled || ! interactionMode ) {
			return;
		}

		const anchor = anchorRef.current;
		if ( ! anchor ) {
			return;
		}

		const runtimeUrl = ( window as TableReorderConfigWindow ).yamabikoEditorToolsTableReorder
			?.runtimeUrl;
		if ( ! runtimeUrl ) {
			return;
		}

		const context = resolveTableContext( anchor, clientId );
		if ( ! context ) {
			return;
		}

		if (
			interactionMode === 'hover' &&
			! context.window.matchMedia( HOVER_REORDER_MEDIA_QUERY ).matches
		) {
			return;
		}

		const rowspanRanges = getRowspanRanges( body );
		let controller: SortableController | null = null;
		let disposed = false;

		queueMicrotask( () => {
			if ( disposed ) {
				return;
			}

			const createdController = createSortableController( {
				context,
				forbiddenInsertionIndices: getForbiddenInsertionIndices( rowspanRanges ),
				interactionMode,
				nonMovableRowIndices: getNonMovableRowIndices( rowspanRanges ),
				onCommit: ( reorderedBody, focusRowIndex ) => {
					if ( focusRowIndex !== undefined ) {
						pendingFocusRowIndexRef.current = focusRowIndex;
					}
					setAttributesRef.current( { body: reorderedBody } );
				},
				rows: Array.isArray( body ) ? body : null,
				runtimeUrl,
			} );

			if ( disposed ) {
				createdController.destroy();
				return;
			}

			controller = createdController;
			controllerRef.current = createdController;
			const pendingFocusRowIndex = pendingFocusRowIndexRef.current;
			if (
				pendingFocusRowIndex !== null &&
				createdController.focusRowControlAt( pendingFocusRowIndex )
			) {
				pendingFocusRowIndexRef.current = null;
			}
		} );

		return () => {
			disposed = true;
			const controllerToDestroy = controller;
			controller = null;
			if ( controllerRef.current === controllerToDestroy ) {
				controllerRef.current = null;
			}
			if ( controllerToDestroy ) {
				queueMicrotask( () => {
					controllerToDestroy.destroy();
				} );
			}
		};
	}, [ body, clientId, enabled, interactionMode ] );

	const dismissTouchCoachmark = () => {
		setIsTouchCoachmarkVisible( false );
		void preferencesActions.set( PREFERENCES_SCOPE, TOUCH_COACHMARK_DISMISSED_PREFERENCE, true );
	};

	const notifyTouchNoMovableRows = () => {
		void createNoticeRef.current( 'warning', getNoMovableRowsMessage(), {
			type: 'snackbar',
		} );
		const anchor = anchorRef.current;
		const context = anchor ? resolveTableContext( anchor, clientId ) : null;
		if ( context ) {
			announceLiveStatus( context.document, getNoMovableRowsAnnouncement() );
		}
	};

	return {
		anchorRef,
		dismissTouchCoachmark,
		isHoverCapable,
		isTouchCoachmarkVisible,
		isTouchReorderMode,
		requestRowControlFocus: () => {
			const result = controllerRef.current?.focusRowControl();
			if ( result === 'current-row-not-movable' ) {
				void createNoticeRef.current( 'error', getRowspanErrorMessage(), {
					type: 'snackbar',
				} );
			} else if ( result === 'no-movable-rows' ) {
				void createNoticeRef.current( 'warning', getNoMovableRowsMessage(), {
					type: 'snackbar',
				} );
			}
		},
		toggleTouchReorderMode: () => {
			setIsTouchReorderMode( ( isActive ) => {
				if ( ! isActive ) {
					dismissTouchCoachmark();
					const rowCount = Array.isArray( body ) ? body.length : 0;
					const nonMovableRowCount = getNonMovableRowIndices( getRowspanRanges( body ) ).length;
					if ( rowCount === 0 || nonMovableRowCount >= rowCount ) {
						notifyTouchNoMovableRows();
						return false;
					}
				}
				return ! isActive;
			} );
		},
	};
};
