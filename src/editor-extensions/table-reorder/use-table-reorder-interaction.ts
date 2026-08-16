/**
 * Table Reorderのinteraction / UI stateをReact側で管理する。
 *
 * hover capability、入力方式、touch並び替えmode、coachmark preferenceを所有し、
 * controller lifecycleやGutenberg notice / setAttributesとは分離する。
 */

import { useDispatch, useSelect } from '@wordpress/data';
import { useEffect, useState, type RefObject } from '@wordpress/element';

import { HANDLE_ZONE_CLASS } from './controller/reorder-ui';
import type { ReorderInteractionMode } from './controller/sortable-controller';
import { resolveTableContext } from './table-context';

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

/** interaction hook内で扱う入力方式。 */
type InputModality = 'keyboard' | 'pointer';

/** WordPress preferences selectorの利用部分。 */
type PreferencesSelector = {
	get: ( scope: string, name: string ) => unknown;
};

/** WordPress preferences actionsの利用部分。 */
type PreferencesActions = {
	set: ( scope: string, name: string, value: unknown ) => Promise< unknown > | unknown;
};

/** interaction hookへ渡すTable block側の入力。 */
type UseTableReorderInteractionOptions = {
	anchorRef: RefObject< HTMLSpanElement >;
	clientId: string;
	enabled: boolean;
	isSelected: boolean;
};

/** interaction hookが親へ公開するstate / command。 */
type TableReorderInteraction = {
	dismissKeyboardCoachmark: () => void;
	dismissTouchCoachmark: () => void;
	interactionMode: ReorderInteractionMode | null;
	isHoverCapable: boolean;
	isKeyboardCoachmarkVisible: boolean;
	isTouchCoachmarkVisible: boolean;
	isTouchReorderMode: boolean;
	toggleTouchReorderMode: () => void;
};

/**
 * Table Reorderのhover / input / touch mode / coachmark stateを所有する。
 *
 * @param options interaction判定に必要なanchor、clientId、plugin有効状態、block選択状態。
 * @return controller modeとHOCが利用するinteraction state / command。
 */
export const useTableReorderInteraction = (
	options: UseTableReorderInteractionOptions
): TableReorderInteraction => {
	const { anchorRef, clientId, enabled, isSelected } = options;
	const preferencesActions = useDispatch( 'core/preferences' ) as unknown as PreferencesActions;
	const isKeyboardCoachmarkDismissed = useSelect( ( registrySelect ) => {
		const preferences = registrySelect( 'core/preferences' ) as unknown as PreferencesSelector;
		return preferences.get( PREFERENCES_SCOPE, KEYBOARD_COACHMARK_DISMISSED_PREFERENCE ) === true;
	}, [] );
	const isTouchCoachmarkDismissed = useSelect( ( registrySelect ) => {
		const preferences = registrySelect( 'core/preferences' ) as unknown as PreferencesSelector;
		return preferences.get( PREFERENCES_SCOPE, TOUCH_COACHMARK_DISMISSED_PREFERENCE ) === true;
	}, [] );
	const [ isHoverCapable, setIsHoverCapable ] = useState(
		() => window.matchMedia( HOVER_REORDER_MEDIA_QUERY ).matches
	);
	const [ inputModality, setInputModality ] = useState< InputModality >( 'pointer' );
	const [ isKeyboardCoachmarkTriggered, setIsKeyboardCoachmarkTriggered ] = useState( false );
	const [ isKeyboardCoachmarkDismissedLocally, setIsKeyboardCoachmarkDismissedLocally ] =
		useState( false );
	const [ isTouchCoachmarkDismissedLocally, setIsTouchCoachmarkDismissedLocally ] =
		useState( false );
	const [ isTouchReorderMode, setIsTouchReorderMode ] = useState( false );

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
				setInputModality( 'keyboard' );
			}
		};
		const onPointerDown = () => {
			setInputModality( 'pointer' );
		};
		const onFocusIn = ( event: FocusEvent ) => {
			const target = event.target as Element | null;
			if ( ! target?.classList.contains( HANDLE_ZONE_CLASS ) ) {
				return;
			}

			setIsKeyboardCoachmarkTriggered( false );
			setIsKeyboardCoachmarkDismissedLocally( true );
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
	}, [ anchorRef, clientId, enabled, preferencesActions ] );

	useEffect( () => {
		if ( ! isSelected ) {
			setIsTouchReorderMode( false );
		}
	}, [ isSelected ] );

	useEffect( () => {
		if (
			! enabled ||
			! isSelected ||
			! isHoverCapable ||
			isKeyboardCoachmarkDismissed ||
			isKeyboardCoachmarkDismissedLocally
		) {
			setIsKeyboardCoachmarkTriggered( false );
			return;
		}

		if ( inputModality === 'keyboard' ) {
			setIsKeyboardCoachmarkTriggered( true );
		}
	}, [
		enabled,
		inputModality,
		isHoverCapable,
		isKeyboardCoachmarkDismissed,
		isKeyboardCoachmarkDismissedLocally,
		isSelected,
	] );

	const dismissKeyboardCoachmark = () => {
		setIsKeyboardCoachmarkTriggered( false );
		setIsKeyboardCoachmarkDismissedLocally( true );
		void preferencesActions.set(
			PREFERENCES_SCOPE,
			KEYBOARD_COACHMARK_DISMISSED_PREFERENCE,
			true
		);
	};

	const dismissTouchCoachmark = () => {
		setIsTouchCoachmarkDismissedLocally( true );
		void preferencesActions.set(
			PREFERENCES_SCOPE,
			TOUCH_COACHMARK_DISMISSED_PREFERENCE,
			true
		);
	};

	const isKeyboardCoachmarkVisible =
		enabled &&
		isSelected &&
		isHoverCapable &&
		isKeyboardCoachmarkTriggered &&
		! isKeyboardCoachmarkDismissed &&
		! isKeyboardCoachmarkDismissedLocally;
	const isTouchCoachmarkVisible =
		enabled &&
		isSelected &&
		! isHoverCapable &&
		! isTouchReorderMode &&
		! isTouchCoachmarkDismissed &&
		! isTouchCoachmarkDismissedLocally;

	let interactionMode: ReorderInteractionMode | null = null;
	if ( isHoverCapable ) {
		interactionMode = 'hover';
	} else if ( isSelected && isTouchReorderMode ) {
		interactionMode = 'touch';
	}

	return {
		dismissKeyboardCoachmark,
		dismissTouchCoachmark,
		interactionMode,
		isHoverCapable,
		isKeyboardCoachmarkVisible,
		isTouchCoachmarkVisible,
		isTouchReorderMode,
		toggleTouchReorderMode: () => {
			setIsTouchReorderMode( ( isActive ) => ! isActive );
		},
	};
};
