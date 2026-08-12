/**
 * Table ReorderのReact state / effect lifecycleとcontroller接続を管理する。
 *
 * hover capability、touch並び替えmode、block選択解除時のresetを所有し、解決済みTable contextと
 * rowspan制約からSortableJS controllerを生成・破棄する。DOM装飾やdrag sessionの命令的処理は
 * 下位モジュールへ委譲し、WordPress notice APIとsetAttributesは狭いcallbackへ変換してcontrollerへ渡す。
 */

import { useDispatch } from '@wordpress/data';
import { useEffect, useRef, useState, type RefObject } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';

import { createSortableController } from './controller/sortable-controller';
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
	toggleTouchReorderMode: () => void;
};

/**
 * Table ReorderのReact lifecycleを所有し、必要な期間だけSortableJS controllerを接続する。
 *
 * `enabled`がfalseの間はcontrollerを生成しない。touch並び替えmodeはhover対応へ切り替わった時、
 * または対象blockの選択が解除された時にresetする。controllerへ渡すcommit / notice callbackは
 * ref経由で最新のWordPress APIを参照し、callback identityだけを理由としたcontroller再生成を避ける。
 *
 * @param options Table blockのbody、選択状態、clientId、attribute更新callback。
 */
export const useTableReorder = ( options: UseTableReorderOptions ): TableReorderHookResult => {
	const { body, clientId, enabled, isSelected, setAttributes } = options;
	const anchorRef = useRef< HTMLSpanElement >( null );
	const { createNotice } = useDispatch( noticesStore );
	const createNoticeRef = useRef( createNotice );
	const setAttributesRef = useRef( setAttributes );
	const [ isHoverCapable, setIsHoverCapable ] = useState(
		() => window.matchMedia( HOVER_REORDER_MEDIA_QUERY ).matches
	);
	const [ isTouchReorderMode, setIsTouchReorderMode ] = useState( false );
	const interactionMode = isHoverCapable
		? 'hover'
		: isSelected && isTouchReorderMode
			? 'touch'
			: null;

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
		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: getForbiddenInsertionIndices( rowspanRanges ),
			interactionMode,
			nonMovableRowIndices: getNonMovableRowIndices( rowspanRanges ),
			onCommit: ( reorderedBody ) => {
				setAttributesRef.current( { body: reorderedBody } );
			},
			onNonMovableRowLongPress: () => {
				void createNoticeRef.current(
					'warning',
					__( '縦結合を含む行は並び替えできません。', 'yamabiko-editor-tools' ),
					{ type: 'snackbar' }
				);
			},
			onRequestTouchModeExit: () => {
				setIsTouchReorderMode( false );
			},
			rows: Array.isArray( body ) ? body : null,
			runtimeUrl,
		} );

		return () => {
			controller.destroy();
		};
	}, [ body, clientId, enabled, interactionMode ] );

	return {
		anchorRef,
		isHoverCapable,
		isTouchReorderMode,
		toggleTouchReorderMode: () => {
			setIsTouchReorderMode( ( isActive ) => ! isActive );
		},
	};
};
