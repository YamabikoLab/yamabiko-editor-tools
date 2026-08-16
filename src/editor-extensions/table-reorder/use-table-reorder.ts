/**
 * Table ReorderのReact state / effect lifecycleとcontroller接続を管理する。
 *
 * hover capability、入力方式、touch並び替えmode、block選択解除時のreset、初回coachmarkの永続化を所有し、
 * controller lifecycleは専用hookへ委譲する。WordPress notice APIとsetAttributesは狭いcallbackへ変換する。
 */

import { useDispatch, useSelect } from '@wordpress/data';
import { useEffect, useRef, useState, type RefObject } from '@wordpress/element';
import { store as noticesStore } from '@wordpress/notices';

import { announceLiveStatus, HANDLE_ZONE_CLASS } from './controller/reorder-ui';
import type { ReorderInteractionMode } from './controller/sortable-controller';
import {
	getNoMovableRowsAnnouncement,
	getNoMovableRowsMessage,
	getRowspanErrorMessage,
} from './messages';
import { getNonMovableRowIndices, getRowspanRanges } from './rowspan';
import { resolveTableContext } from './table-context';
import { useTableReorderController } from './use-table-reorder-controller';

/** hover操作を利用できる端末を判定するmedia query。 */
const HOVER_REORDER_MEDIA_QUERY = '(hover: hover) and (pointer: fine)';

/** WordPress preferences storeへ保存するscope。 */
const PREFERENCES_SCOPE = 'yamabiko-editor-tools';

/** PC keyboard初回coachmarkのdismiss状態を保存するpreference名。 */
const KEYBOARD_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderKeyboardCoachmarkDismissed';

/** touch初回coachmarkのdismiss状態を保存するpreference名。 */
const TOUCH_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderTouchCoachmarkDismissed';

/** 入力方式の判定に使わない修飾キー。 */
const MODIFIER_KEYS = new Set( [ 'Alt', 'Control', 'Meta', 'Shift' ] );

/** WordPress preferences selectorの利用部分。 */
type PreferencesSelector = {
	get: ( scope: string, name: string ) => unknown;
};

/** WordPress preferences actionsの利用部分。 */
type PreferencesActions = {
	set: ( scope: string, name: string, value: unknown ) => Promise< unknown > | unknown;
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
	const preferencesActions = useDispatch( 'core/preferences' ) as unknown as PreferencesActions;
	const isKeyboardCoachmarkDismissed = useSelect( ( registrySelect ) => {
		const preferences = registrySelect( 'core/preferences' ) as unknown as PreferencesSelector;
		return preferences.get( PREFERENCES_SCOPE, KEYBOARD_COACHMARK_DISMISSED_PREFERENCE ) === true;
	}, [] );
	const isTouchCoachmarkDismissed = useSelect( ( registrySelect ) => {
		const preferences = registrySelect( 'core/preferences' ) as unknown as PreferencesSelector;
		return preferences.get( PREFERENCES_SCOPE, TOUCH_COACHMARK_DISMISSED_PREFERENCE ) === true;
	}, [] );
	const createNoticeRef = useRef( createNotice );
	const setAttributesRef = useRef( setAttributes );
	const [ isHoverCapable, setIsHoverCapable ] = useState(
		() => window.matchMedia( HOVER_REORDER_MEDIA_QUERY ).matches
	);
	const [ isKeyboardInput, setIsKeyboardInput ] = useState( false );
	const [ isKeyboardCoachmarkVisible, setIsKeyboardCoachmarkVisible ] = useState( false );
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
			} else {
				setIsKeyboardCoachmarkVisible( false );
			}
		};

		syncHoverCapability();
		hoverMedia.addEventListener( 'change', syncHoverCapability );
		return () => {
			hoverMedia.removeEventListener( 'change', syncHoverCapability );
		};
	}, [ enabled ] );

	useEffect( () => {
		if ( ! enabled ) {
			return;
		}

		const documents = new Set< Document >( [ window.document ] );
		const anchor = anchorRef.current;
		const context = anchor ? resolveTableContext( anchor, clientId ) : null;
		if ( context ) {
			documents.add( context.document );
		}

		const onKeyDown = ( event: KeyboardEvent ) => {
			if ( ! MODIFIER_KEYS.has( event.key ) ) {
				setIsKeyboardInput( true );
			}
		};
		const onPointerDown = () => {
			setIsKeyboardInput( false );
		};
		const onFocusIn = ( event: FocusEvent ) => {
			const target = event.target as Element | null;
			if ( ! target?.classList.contains( HANDLE_ZONE_CLASS ) ) {
				return;
			}

			setIsKeyboardCoachmarkVisible( false );
			void preferencesActions.set(
				PREFERENCES_SCOPE,
				KEYBOARD_COACHMARK_DISMISSED_PREFERENCE,
				true
			);
		};

		for ( const document of documents ) {
			document.addEventListener( 'keydown', onKeyDown, true );
			document.addEventListener( 'pointerdown', onPointerDown, true );
			document.addEventListener( 'focusin', onFocusIn, true );
		}
		return () => {
			for ( const document of documents ) {
				document.removeEventListener( 'keydown', onKeyDown, true );
				document.removeEventListener( 'pointerdown', onPointerDown, true );
				document.removeEventListener( 'focusin', onFocusIn, true );
			}
		};
	}, [ clientId, enabled, preferencesActions ] );

	useEffect( () => {
		if ( ! isSelected ) {
			setIsKeyboardCoachmarkVisible( false );
			setIsTouchReorderMode( false );
			setIsTouchCoachmarkVisible( false );
		}
	}, [ isSelected ] );

	useEffect( () => {
		if ( ! enabled || ! isSelected || ! isHoverCapable || isKeyboardCoachmarkDismissed ) {
			setIsKeyboardCoachmarkVisible( false );
			return;
		}

		if ( isKeyboardInput ) {
			setIsKeyboardCoachmarkVisible( true );
		}
	}, [ enabled, isHoverCapable, isKeyboardCoachmarkDismissed, isKeyboardInput, isSelected ] );

	useEffect( () => {
		if ( ! enabled || ! isSelected || isHoverCapable || isTouchReorderMode ) {
			setIsTouchCoachmarkVisible( false );
			return;
		}

		setIsTouchCoachmarkVisible( ! isTouchCoachmarkDismissed );
	}, [ enabled, isHoverCapable, isSelected, isTouchCoachmarkDismissed, isTouchReorderMode ] );

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

	const dismissKeyboardCoachmark = () => {
		setIsKeyboardCoachmarkVisible( false );
		void preferencesActions.set( PREFERENCES_SCOPE, KEYBOARD_COACHMARK_DISMISSED_PREFERENCE, true );
	};

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
