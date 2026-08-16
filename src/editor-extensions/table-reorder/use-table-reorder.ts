/**
 * Table ReorderのReact state / effect lifecycleとcontroller接続を管理する。
 *
 * interaction / UI stateとcontroller lifecycleは専用hookへ委譲し、
 * WordPress notice APIとsetAttributesをHOC向けstate / commandへ接続する。
 */

import { useDispatch } from '@wordpress/data';
import { useEffect, useRef, type RefObject } from '@wordpress/element';
import { store as noticesStore } from '@wordpress/notices';

import { announceLiveStatus } from './controller/reorder-ui';
import {
	getNoMovableRowsAnnouncement,
	getNoMovableRowsMessage,
	getRowspanErrorMessage,
} from './messages';
import { getNonMovableRowIndices, getRowspanRanges } from './rowspan';
import { resolveTableContext } from './table-context';
import { useTableReorderController } from './use-table-reorder-controller';
import { useTableReorderInteraction } from './use-table-reorder-interaction';

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
	dismissKeyboardCoachmark: () => void;
	dismissTouchCoachmark: () => void;
	isHoverCapable: boolean;
	isKeyboardCoachmarkVisible: boolean;
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
	const { createNotice } = useDispatch( noticesStore );
	const createNoticeRef = useRef( createNotice );
	const setAttributesRef = useRef( setAttributes );
	const {
		dismissKeyboardCoachmark,
		dismissTouchCoachmark,
		interactionMode,
		isHoverCapable,
		isKeyboardCoachmarkVisible,
		isTouchCoachmarkVisible,
		isTouchReorderMode,
		toggleTouchReorderMode,
	} = useTableReorderInteraction( {
		anchorRef,
		clientId,
		enabled,
		isSelected,
	} );

	useEffect( () => {
		createNoticeRef.current = createNotice;
	}, [ createNotice ] );

	useEffect( () => {
		setAttributesRef.current = setAttributes;
	}, [ setAttributes ] );

	const { focusRowControl } = useTableReorderController( {
		anchorRef,
		body,
		clientId,
		enabled,
		interactionMode,
		onBodyCommit: ( reorderedBody ) => {
			setAttributesRef.current( { body: reorderedBody } );
		},
	} );

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
		dismissKeyboardCoachmark,
		dismissTouchCoachmark,
		isHoverCapable,
		isKeyboardCoachmarkVisible,
		isTouchCoachmarkVisible,
		isTouchReorderMode,
		requestRowControlFocus: () => {
			dismissKeyboardCoachmark();
			const result = focusRowControl();
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
			if ( ! isTouchReorderMode ) {
				dismissTouchCoachmark();
				const rowCount = Array.isArray( body ) ? body.length : 0;
				const nonMovableRowCount = getNonMovableRowIndices( getRowspanRanges( body ) ).length;
				if ( rowCount === 0 || nonMovableRowCount >= rowCount ) {
					notifyTouchNoMovableRows();
					return;
				}
			}
			toggleTouchReorderMode();
		},
	};
};
