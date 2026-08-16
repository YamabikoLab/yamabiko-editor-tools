import { useDispatch, useSelect } from '@wordpress/data';
import { createElement, createRoot } from '@wordpress/element';

import { HANDLE_ZONE_CLASS } from './controller/reorder-ui';
import { resolveTableContext, type TableContext } from './table-context';
import { useTableReorderInteraction } from './use-table-reorder-interaction';

const { act } = jest.requireActual< { act: ( callback: () => void ) => void } >( 'react' );

jest.mock( '@wordpress/data', () => ( {
	useDispatch: jest.fn(),
	useSelect: jest.fn(),
} ) );

jest.mock( './controller/reorder-ui', () => ( {
	HANDLE_ZONE_CLASS: 'yamabiko-table-reorder-handle-zone',
} ) );

jest.mock( './table-context', () => ( {
	resolveTableContext: jest.fn(),
} ) );

const HOVER_REORDER_MEDIA_QUERY = '(hover: hover) and (pointer: fine)';
const PREFERENCES_SCOPE = 'yamabiko-editor-tools';
const KEYBOARD_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderKeyboardCoachmarkDismissed';
const TOUCH_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderTouchCoachmarkDismissed';

const useDispatchMock = useDispatch as unknown as jest.Mock;
const useSelectMock = useSelect as unknown as jest.Mock;
const resolveTableContextMock = resolveTableContext as jest.MockedFunction<
	typeof resolveTableContext
>;

const preferencesSetMock = jest.fn();
const preferencesActions = { set: preferencesSetMock };
const preferenceValues = new Map< string, unknown >();
let latestResult: ReturnType< typeof useTableReorderInteraction > | null = null;
let activeRoot: ReturnType< typeof createRoot > | null = null;

type MatchMediaHarness = {
	setMatches: ( matches: boolean ) => void;
};

const createContext = (): TableContext => {
	const blockElement = document.createElement( 'div' );
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	table.append( tbody );
	blockElement.append( table );

	return {
		blockElement,
		document,
		table,
		tbody,
		window,
	};
};

const installMatchMedia = ( initialMatches: boolean ): MatchMediaHarness => {
	let matches = initialMatches;
	const listeners = new Set< ( event: MediaQueryListEvent ) => void >();
	const mediaQueryList = {
		get matches() {
			return matches;
		},
		media: HOVER_REORDER_MEDIA_QUERY,
		onchange: null,
		addEventListener: jest.fn(
			( _type: string, listener: ( event: MediaQueryListEvent ) => void ) => {
				listeners.add( listener );
			}
		),
		removeEventListener: jest.fn(
			( _type: string, listener: ( event: MediaQueryListEvent ) => void ) => {
				listeners.delete( listener );
			}
		),
		addListener: jest.fn(),
		removeListener: jest.fn(),
		dispatchEvent: jest.fn(),
	} as unknown as MediaQueryList;

	Object.defineProperty( window, 'matchMedia', {
		configurable: true,
		value: jest.fn( () => mediaQueryList ),
		writable: true,
	} );

	return {
		setMatches: ( nextMatches: boolean ) => {
			matches = nextMatches;
			const event = new Event( 'change' ) as unknown as MediaQueryListEvent;
			act( () => {
				for ( const listener of listeners ) {
					listener.call( mediaQueryList, event );
				}
			} );
		},
	};
};

const HookHarness = ( props: { enabled: boolean; isSelected: boolean } ) => {
	const anchorRef = { current: document.createElement( 'span' ) };
	latestResult = useTableReorderInteraction( {
		anchorRef,
		clientId: 'table-client-id',
		enabled: props.enabled,
		isSelected: props.isSelected,
	} );
	return createElement( 'span' );
};

const getResult = () => {
	if ( ! latestResult ) {
		throw new Error( 'Expected interaction result' );
	}
	return latestResult;
};

const mountHook = ( props: { enabled?: boolean; isSelected?: boolean } = {} ) => {
	const container = document.createElement( 'div' );
	document.body.append( container );
	const root = createRoot( container );
	let currentProps = {
		enabled: true,
		isSelected: true,
		...props,
	};
	activeRoot = root;

	act( () => {
		root.render( createElement( HookHarness, currentProps ) );
	} );

	return {
		rerender: ( nextProps: Partial< typeof currentProps > ) => {
			currentProps = { ...currentProps, ...nextProps };
			act( () => {
				root.render( createElement( HookHarness, currentProps ) );
			} );
		},
	};
};

beforeAll( () => {
	Object.assign( globalThis, { IS_REACT_ACT_ENVIRONMENT: true } );
} );

beforeEach( () => {
	document.body.replaceChildren();
	latestResult = null;
	activeRoot = null;
	preferenceValues.clear();
	preferencesSetMock.mockReset();
	useDispatchMock.mockReset();
	useSelectMock.mockReset();
	resolveTableContextMock.mockReset();

	preferencesSetMock.mockImplementation( ( scope: string, name: string, value: unknown ) => {
		preferenceValues.set( `${ scope }:${ name }`, value );
	} );
	useDispatchMock.mockReturnValue( preferencesActions );
	useSelectMock.mockImplementation(
		( selector: ( registrySelect: ( storeName: string ) => unknown ) => unknown ) =>
			selector( () => ( {
				get: ( scope: string, name: string ) => preferenceValues.get( `${ scope }:${ name }` ),
			} ) )
	);
	resolveTableContextMock.mockReturnValue( createContext() );
} );

afterEach( () => {
	if ( activeRoot ) {
		act( () => {
			activeRoot?.unmount();
		} );
	}
	document.body.replaceChildren();
} );

describe( 'useTableReorderInteraction', () => {
	it( 'keeps keyboard coachmark visible after pointer input until dismissed', () => {
		installMatchMedia( true );
		mountHook();

		act( () => {
			document.dispatchEvent( new KeyboardEvent( 'keydown', { bubbles: true, key: 'ArrowDown' } ) );
		} );
		expect( getResult().isKeyboardCoachmarkVisible ).toBe( true );

		act( () => {
			document.dispatchEvent( new Event( 'pointerdown', { bubbles: true } ) );
		} );
		expect( getResult().isKeyboardCoachmarkVisible ).toBe( true );

		act( () => {
			getResult().dismissKeyboardCoachmark();
		} );
		expect( getResult().isKeyboardCoachmarkVisible ).toBe( false );
		expect( preferencesSetMock ).toHaveBeenCalledWith(
			PREFERENCES_SCOPE,
			KEYBOARD_COACHMARK_DISMISSED_PREFERENCE,
			true
		);
	} );

	it( 'dismisses keyboard coachmark when focus enters a row handle', () => {
		installMatchMedia( true );
		mountHook();
		act( () => {
			document.dispatchEvent( new KeyboardEvent( 'keydown', { bubbles: true, key: 'Enter' } ) );
		} );
		expect( getResult().isKeyboardCoachmarkVisible ).toBe( true );

		const handle = document.createElement( 'button' );
		handle.classList.add( HANDLE_ZONE_CLASS );
		document.body.append( handle );
		act( () => {
			handle.dispatchEvent( new FocusEvent( 'focusin', { bubbles: true } ) );
		} );

		expect( getResult().isKeyboardCoachmarkVisible ).toBe( false );
		expect( preferencesSetMock ).toHaveBeenCalledWith(
			PREFERENCES_SCOPE,
			KEYBOARD_COACHMARK_DISMISSED_PREFERENCE,
			true
		);
	} );

	it( 'derives touch coachmark visibility from selection, hover, mode, and preference', () => {
		installMatchMedia( false );
		const harness = mountHook();
		expect( getResult().isTouchCoachmarkVisible ).toBe( true );

		act( () => {
			getResult().toggleTouchReorderMode();
		} );
		expect( getResult().isTouchReorderMode ).toBe( true );
		expect( getResult().isTouchCoachmarkVisible ).toBe( false );

		act( () => {
			getResult().toggleTouchReorderMode();
		} );
		expect( getResult().isTouchCoachmarkVisible ).toBe( true );

		harness.rerender( { isSelected: false } );
		expect( getResult().isTouchReorderMode ).toBe( false );
		expect( getResult().isTouchCoachmarkVisible ).toBe( false );
	} );

	it( 'switches touch mode off when hover capability appears', () => {
		const media = installMatchMedia( false );
		mountHook();
		act( () => {
			getResult().toggleTouchReorderMode();
		} );
		expect( getResult().interactionMode ).toBe( 'touch' );

		media.setMatches( true );

		expect( getResult().isHoverCapable ).toBe( true );
		expect( getResult().isTouchReorderMode ).toBe( false );
		expect( getResult().interactionMode ).toBe( 'hover' );
	} );

	it( 'respects persisted touch coachmark dismissal', () => {
		preferenceValues.set(
			`${ PREFERENCES_SCOPE }:${ TOUCH_COACHMARK_DISMISSED_PREFERENCE }`,
			true
		);
		installMatchMedia( false );
		mountHook();

		expect( getResult().isTouchCoachmarkVisible ).toBe( false );
	} );
} );
