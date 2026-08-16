import { useDispatch, useSelect } from '@wordpress/data';
import { createElement, createRoot } from '@wordpress/element';

import {
	createSortableController,
	type SortableController,
	type SortableControllerOptions,
} from './controller/sortable-controller';
import { resolveTableContext, type TableContext } from './table-context';
import {
	useTableReorder,
	type TableReorderHookResult,
	type UseTableReorderOptions,
} from './use-table-reorder';

const { act } = jest.requireActual< { act: ( callback: () => void ) => void } >( 'react' );

jest.mock( '@wordpress/data', () => ( {
	useDispatch: jest.fn(),
	useSelect: jest.fn(),
} ) );

jest.mock( '@wordpress/notices', () => ( {
	store: 'notices-store',
} ) );

jest.mock( './controller/reorder-ui', () => ( {
	announceLiveStatus: jest.fn(),
	HANDLE_ZONE_CLASS: 'yamabiko-table-reorder-handle-zone',
} ) );

jest.mock( './controller/sortable-controller', () => ( {
	createSortableController: jest.fn(),
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
const createSortableControllerMock = createSortableController as jest.MockedFunction<
	typeof createSortableController
>;
const resolveTableContextMock = resolveTableContext as jest.MockedFunction<
	typeof resolveTableContext
>;

const createNoticeMock = jest.fn();
const preferencesSetMock = jest.fn();
const noticesActions = { createNotice: createNoticeMock };
const preferencesActions = { set: preferencesSetMock };
const preferenceValues = new Map< string, unknown >();

type MockController = {
	destroy: jest.MockedFunction< SortableController[ 'destroy' ] >;
	focusRowControl: jest.MockedFunction< SortableController[ 'focusRowControl' ] >;
	focusRowControlAt: jest.MockedFunction< SortableController[ 'focusRowControlAt' ] >;
};

const mockControllers: MockController[] = [];
let latestResult: TableReorderHookResult | null = null;
let activeRoot: ReturnType< typeof createRoot > | null = null;
let activeProps: UseTableReorderOptions | null = null;

const createMockController = (): MockController => ( {
	destroy: jest.fn(),
	focusRowControl: jest.fn( () => 'focused' ),
	focusRowControlAt: jest.fn( ( _rowIndex: number ) => true ),
} );

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

const createBody = ( ...labels: string[] ): unknown[] =>
	labels.map( ( content ) => ( {
		cells: [ { content } ],
	} ) );

type MatchMediaHarness = {
	setMatches: ( matches: boolean ) => void;
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

const HookHarness = ( options: UseTableReorderOptions ) => {
	const result = useTableReorder( options );
	latestResult = result;
	return createElement( 'span', { ref: result.anchorRef } );
};

const getResult = (): TableReorderHookResult => {
	if ( ! latestResult ) {
		throw new Error( 'Expected useTableReorder result' );
	}
	return latestResult;
};

const mountHook = ( overrides: Partial< UseTableReorderOptions > = {} ) => {
	const container = document.createElement( 'div' );
	document.body.append( container );
	const root = createRoot( container );
	const props: UseTableReorderOptions = {
		body: createBody( 'a', 'b', 'c' ),
		clientId: 'table-client-id',
		enabled: true,
		isSelected: true,
		setAttributes: jest.fn(),
		...overrides,
	};
	activeRoot = root;
	activeProps = props;

	act( () => {
		root.render( createElement( HookHarness, props ) );
	} );

	return {
		rerender: ( nextProps: Partial< UseTableReorderOptions > ) => {
			if ( ! activeProps ) {
				throw new Error( 'Expected mounted hook props' );
			}
			activeProps = { ...activeProps, ...nextProps };
			act( () => {
				root.render( createElement( HookHarness, activeProps as UseTableReorderOptions ) );
			} );
		},
		unmount: () => {
			act( () => {
				root.unmount();
			} );
			activeRoot = null;
			activeProps = null;
		},
	};
};

const flushLifecycleMicrotasks = () => {
	act( () => {
		jest.runAllTimers();
	} );
};

const getControllerOptions = ( callIndex: number ): SortableControllerOptions => {
	const call = createSortableControllerMock.mock.calls[ callIndex ];
	if ( ! call ) {
		throw new Error( `Expected controller creation call ${ callIndex }` );
	}
	return call[ 0 ];
};

beforeAll( () => {
	Object.assign( globalThis, { IS_REACT_ACT_ENVIRONMENT: true } );
} );

beforeEach( () => {
	jest.useFakeTimers();
	document.body.replaceChildren();
	latestResult = null;
	activeRoot = null;
	activeProps = null;
	mockControllers.length = 0;
	preferenceValues.clear();
	createNoticeMock.mockReset();
	preferencesSetMock.mockReset();
	useDispatchMock.mockReset();
	useSelectMock.mockReset();
	createSortableControllerMock.mockReset();
	resolveTableContextMock.mockReset();

	preferencesSetMock.mockImplementation( ( scope: string, name: string, value: unknown ) => {
		preferenceValues.set( `${ scope }:${ name }`, value );
	} );
	useDispatchMock.mockImplementation( ( store: unknown ) =>
		store === 'core/preferences' ? preferencesActions : noticesActions
	);
	useSelectMock.mockImplementation(
		( selector: ( registrySelect: ( storeName: string ) => unknown ) => unknown ) =>
			selector( ( storeName: string ) => {
				if ( storeName !== 'core/preferences' ) {
					return {};
				}
				return {
					get: ( scope: string, name: string ) => preferenceValues.get( `${ scope }:${ name }` ),
				};
			} )
	);
	resolveTableContextMock.mockReturnValue( createContext() );
	createSortableControllerMock.mockImplementation( () => {
		const controller = createMockController();
		mockControllers.push( controller );
		return controller;
	} );
	Object.assign( window, {
		yamabikoEditorToolsTableReorder: { runtimeUrl: '/sortable.js' },
	} );
} );

afterEach( () => {
	if ( activeRoot ) {
		act( () => {
			activeRoot?.unmount();
		} );
	}
	flushLifecycleMicrotasks();
	jest.useRealTimers();
	Reflect.deleteProperty( window, 'yamabikoEditorToolsTableReorder' );
	document.body.replaceChildren();
} );

describe( 'useTableReorder lifecycle', () => {
	it( 'creates a hover controller while enabled without requiring block selection', () => {
		installMatchMedia( true );
		const body = createBody( 'a', 'b', 'c' );
		mountHook( { body, isSelected: false } );

		flushLifecycleMicrotasks();

		expect( createSortableControllerMock ).toHaveBeenCalledTimes( 1 );
		expect( getControllerOptions( 0 ) ).toEqual(
			expect.objectContaining( {
				interactionMode: 'hover',
				rows: body,
				runtimeUrl: '/sortable.js',
			} )
		);
	} );

	it( 'does not create a controller while disabled', () => {
		installMatchMedia( true );
		mountHook( { enabled: false } );

		flushLifecycleMicrotasks();

		expect( createSortableControllerMock ).not.toHaveBeenCalled();
	} );

	it( 'creates and destroys a touch controller as touch reorder mode starts and ends', () => {
		installMatchMedia( false );
		mountHook();
		flushLifecycleMicrotasks();
		expect( createSortableControllerMock ).not.toHaveBeenCalled();

		act( () => {
			getResult().toggleTouchReorderMode();
		} );
		flushLifecycleMicrotasks();

		expect( getResult().isTouchReorderMode ).toBe( true );
		expect( createSortableControllerMock ).toHaveBeenCalledTimes( 1 );
		expect( getControllerOptions( 0 ).interactionMode ).toBe( 'touch' );
		const touchController = mockControllers[ 0 ];

		act( () => {
			getResult().toggleTouchReorderMode();
		} );
		flushLifecycleMicrotasks();

		expect( getResult().isTouchReorderMode ).toBe( false );
		expect( createSortableControllerMock ).toHaveBeenCalledTimes( 1 );
		expect( touchController?.destroy ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'ends touch controller lifecycle when block selection is lost', () => {
		installMatchMedia( false );
		const harness = mountHook();
		act( () => {
			getResult().toggleTouchReorderMode();
		} );
		flushLifecycleMicrotasks();
		const touchController = mockControllers[ 0 ];

		harness.rerender( { isSelected: false } );
		flushLifecycleMicrotasks();

		expect( touchController?.destroy ).toHaveBeenCalledTimes( 1 );
		expect( getResult().isTouchReorderMode ).toBe( false );
		harness.rerender( { isSelected: true } );
		flushLifecycleMicrotasks();
		expect( createSortableControllerMock ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'replaces a touch controller with a hover controller when hover capability appears', () => {
		const media = installMatchMedia( false );
		mountHook();
		act( () => {
			getResult().toggleTouchReorderMode();
		} );
		flushLifecycleMicrotasks();
		const touchController = mockControllers[ 0 ];

		media.setMatches( true );
		flushLifecycleMicrotasks();

		expect( touchController?.destroy ).toHaveBeenCalledTimes( 1 );
		expect( createSortableControllerMock ).toHaveBeenCalledTimes( 2 );
		expect( getControllerOptions( 1 ).interactionMode ).toBe( 'hover' );
	} );

	it( 'cleans up the old controller on body change without losing the new controller command target', () => {
		installMatchMedia( true );
		const firstBody = createBody( 'a', 'b', 'c' );
		const secondBody = createBody( 'b', 'a', 'c' );
		const harness = mountHook( { body: firstBody } );
		flushLifecycleMicrotasks();
		const firstController = mockControllers[ 0 ];

		harness.rerender( { body: secondBody } );
		flushLifecycleMicrotasks();
		const secondController = mockControllers[ 1 ];

		expect( firstController?.destroy ).toHaveBeenCalledTimes( 1 );
		expect( createSortableControllerMock ).toHaveBeenCalledTimes( 2 );
		expect( getControllerOptions( 1 ).rows ).toBe( secondBody );
		act( () => {
			getResult().requestRowControlFocus();
		} );
		expect( secondController?.focusRowControl ).toHaveBeenCalledTimes( 1 );
		expect( firstController?.focusRowControl ).not.toHaveBeenCalled();
	} );

	it( 'restores committed focus after body rerender and consumes the pending focus once', () => {
		installMatchMedia( true );
		const setAttributes = jest.fn();
		const firstBody = createBody( 'a', 'b', 'c' );
		const reorderedBody = createBody( 'b', 'a', 'c' );
		const laterBody = createBody( 'b', 'c', 'a' );
		const harness = mountHook( { body: firstBody, setAttributes } );
		flushLifecycleMicrotasks();

		act( () => {
			getControllerOptions( 0 ).onCommit( reorderedBody, 1 );
		} );
		expect( setAttributes ).toHaveBeenCalledWith( { body: reorderedBody } );

		harness.rerender( { body: reorderedBody } );
		flushLifecycleMicrotasks();
		const recreatedController = mockControllers[ 1 ];
		expect( recreatedController?.focusRowControlAt ).toHaveBeenCalledWith( 1 );

		harness.rerender( { body: laterBody } );
		flushLifecycleMicrotasks();
		const laterController = mockControllers[ 2 ];
		expect( laterController?.focusRowControlAt ).not.toHaveBeenCalled();
	} );

	it( 'does not request focus restoration when commit has no focus row index', () => {
		installMatchMedia( true );
		const firstBody = createBody( 'a', 'b', 'c' );
		const reorderedBody = createBody( 'b', 'a', 'c' );
		const harness = mountHook( { body: firstBody } );
		flushLifecycleMicrotasks();

		act( () => {
			getControllerOptions( 0 ).onCommit( reorderedBody );
		} );
		harness.rerender( { body: reorderedBody } );
		flushLifecycleMicrotasks();

		expect( mockControllers[ 1 ]?.focusRowControlAt ).not.toHaveBeenCalled();
	} );

	it( 'keeps the keyboard coachmark visible when pointer input follows keyboard input', () => {
		installMatchMedia( true );
		mountHook();

		expect( getResult().isKeyboardCoachmarkVisible ).toBe( false );
		act( () => {
			document.dispatchEvent( new KeyboardEvent( 'keydown', { bubbles: true, key: 'ArrowDown' } ) );
		} );
		expect( getResult().isKeyboardCoachmarkVisible ).toBe( true );

		act( () => {
			document.dispatchEvent( new Event( 'pointerdown', { bubbles: true } ) );
		} );
		expect( getResult().isKeyboardCoachmarkVisible ).toBe( true );
	} );

	it( 'does not leave a controller from an effect cleaned up before its creation microtask', () => {
		installMatchMedia( true );
		const harness = mountHook();
		expect( createSortableControllerMock ).not.toHaveBeenCalled();

		harness.rerender( { enabled: false } );
		flushLifecycleMicrotasks();

		expect( createSortableControllerMock ).not.toHaveBeenCalled();
	} );

	it( 'destroys the generated controller after unmount', () => {
		installMatchMedia( true );
		const harness = mountHook();
		flushLifecycleMicrotasks();
		const controller = mockControllers[ 0 ];

		harness.unmount();
		flushLifecycleMicrotasks();

		expect( controller?.destroy ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'keeps preference mocks aligned with the production preference keys', () => {
		preferenceValues.set(
			`${ PREFERENCES_SCOPE }:${ KEYBOARD_COACHMARK_DISMISSED_PREFERENCE }`,
			true
		);
		preferenceValues.set(
			`${ PREFERENCES_SCOPE }:${ TOUCH_COACHMARK_DISMISSED_PREFERENCE }`,
			true
		);
		installMatchMedia( true );
		mountHook();

		act( () => {
			document.dispatchEvent( new KeyboardEvent( 'keydown', { bubbles: true, key: 'Enter' } ) );
		} );

		expect( getResult().isKeyboardCoachmarkVisible ).toBe( false );
	} );
} );