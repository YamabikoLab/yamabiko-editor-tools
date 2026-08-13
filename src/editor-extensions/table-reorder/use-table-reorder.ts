/**
 * Table ReorderのReact state / effect lifecycleとcontroller接続を管理する。
 *
 * hover capability、touch並び替えmode、block選択解除時のresetを所有し、解決済みTable contextと
 * rowspan制約からSortableJS controllerを生成・破棄する。DOM装飾やdrag sessionの命令的処理は
 * 下位モジュールへ委譲し、WordPress notice APIとsetAttributesは狭いcallbackへ変換してcontrollerへ渡す。
 */

import { useDispatch } from '@wordpress/data';
import { useEffect, useRef, useState, type RefObject } from '@wordpress/element';
import { store as noticesStore } from '@wordpress/notices';

import {
	createSortableController,
	type ReorderInteractionMode,
	type SortableController,
} from './controller/sortable-controller';
import { getNoMovableRowsMessage, getRowspanErrorMessage } from './messages';
import { getForbiddenInsertionIndices, getNonMovableRowIndices, getRowspanRanges } from './rowspan';
import { resolveTableContext } from './table-context';

/** hover操作を利用できる端末を判定するmedia query。 */
const HOVER_REORDER_MEDIA_QUERY = '(hover: hover) and (pointer: fine)';

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
	isHoverCapable: boolean;
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
	const createNoticeRef = useRef( createNotice );
	const setAttributesRef = useRef( setAttributes );
	const [ isHoverCapable, setIsHoverCapable ] = useState(
		() => window.matchMedia( HOVER_REORDER_MEDIA_QUERY ).matches
	);
	const [ isTouchReorderMode, setIsTouchReorderMode ] = useState( false );
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
		}
	}, [ isSelected ] );

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

	return {
		anchorRef,
		isHoverCapable,
		isTouchReorderMode,
		requestRowControlFocus: () => {
			const result = controllerRef.current?.focusRowControl();
			if ( result === 'current-row-not-movable' ) {
				void createNoticeRef.current( 'warning', getRowspanErrorMessage(), {
					type: 'snackbar',
				} );
			} else if ( result === 'no-movable-rows' ) {
				void createNoticeRef.current( 'warning', getNoMovableRowsMessage(), {
					type: 'snackbar',
				} );
			}
		},
		toggleTouchReorderMode: () => {
			setIsTouchReorderMode( ( isActive ) => ! isActive );
		},
	};
};
