import { createElement, createRoot, type RefObject } from '@wordpress/element';

import {
	createSortableController,
	type SortableController,
} from './controller/sortable-controller';
import { resolveTableContext, type TableContext } from './table-context';
import { useTableReorderController } from './use-table-reorder-controller';

const { act } = jest.requireActual< { act: ( callback: () => void ) => void } >( 'react' );

type ControllerOptions = Parameters< typeof createSortableController >[ 0 ];
type HookOptions = Parameters< typeof useTableReorderController >[ 0 ];

type MockController = {
	destroy: jest.MockedFunction< SortableController[ 'destroy' ] >;
	focusRowControl: jest.MockedFunction< SortableController[ 'focusRowControl' ] >;
	focusRowControlAt: jest.MockedFunction< SortableController[ 'focusRowControlAt' ] >;
};

jest.mock( './controller/sortable-controller', () => ( {
	createSortableController: jest.fn(),
} ) );

jest.mock( './table-context', () => ( {
	resolveTableContext: jest.fn(),
} ) );

const createSortableControllerMock = createSortableController as jest.MockedFunction<
	typeof createSortableController
>;
const resolveTableContextMock = resolveTableContext as jest.MockedFunction<
	typeof resolveTableContext
>;

const createContext = ( matches = true ): TableContext => {
	const blockElement = document.createElement( 'div' );
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	table.append( tbody );
	blockElement.append( table );
	const contextWindow = Object.create( window ) as Window;
	Object.defineProperty( contextWindow, 'matchMedia', {
		configurable: true,
		value: jest.fn( () => ( { matches } ) as MediaQueryList ),
	} );

	return {
		blockElement,
		document,
		tbody,
		window: contextWindow,
	};
};

const createMockController = ( focusResult = true ): MockController => ( {
	destroy: jest.fn(),
	focusRowControl: jest.fn( () => 'focused' ),
	focusRowControlAt: jest.fn( ( _rowIndex: number ) => focusResult ),
} );

const Harness = ( options: HookOptions ) => {
	useTableReorderController( options );
	return null;
};

const createAnchorRef = ( anchor: HTMLSpanElement | null ): RefObject< HTMLSpanElement > =>
	( { current: anchor } ) as RefObject< HTMLSpanElement >;

const createOptions = ( overrides: Partial< HookOptions > = {} ): HookOptions => ( {
	anchorRef: createAnchorRef( document.createElement( 'span' ) ),
	body: [ 'a', 'b', 'c' ],
	clientId: 'table-client-id',
	enabled: true,
	forbiddenInsertionIndices: [],
	interactionMode: 'hover',
	nonMovableRowIndices: [],
	onBodyCommit: jest.fn(),
	...overrides,
} );

const mountHook = ( initialOptions: HookOptions ) => {
	const container = document.createElement( 'div' );
	document.body.append( container );
	const root = createRoot( container );
	let options = initialOptions;
	act( () => {
		root.render( createElement( Harness, options ) );
	} );

	return {
		rerender: ( overrides: Partial< HookOptions > ) => {
			options = { ...options, ...overrides };
			act( () => {
				root.render( createElement( Harness, options ) );
			} );
		},
		unmount: () => {
			act( () => {
				root.unmount();
			} );
		},
	};
};

const flushLifecycleMicrotasks = () => {
	act( () => {
		jest.runAllTimers();
	} );
};

const getControllerOptions = ( callIndex: number ): ControllerOptions => {
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
	createSortableControllerMock.mockReset();
	resolveTableContextMock.mockReset();
	resolveTableContextMock.mockReturnValue( createContext() );
	createSortableControllerMock.mockImplementation( () => createMockController() );
	Object.assign( window, {
		yamabikoEditorToolsTableReorder: { runtimeUrl: '/sortable.js' },
	} );
} );

afterEach( () => {
	jest.runOnlyPendingTimers();
	jest.useRealTimers();
	Reflect.deleteProperty( window, 'yamabikoEditorToolsTableReorder' );
	document.body.replaceChildren();
} );

describe( 'useTableReorderController', () => {
	it( 'does not resolve table context when the anchor is unavailable', () => {
		const harness = mountHook( createOptions( { anchorRef: createAnchorRef( null ) } ) );
		flushLifecycleMicrotasks();

		expect( resolveTableContextMock ).not.toHaveBeenCalled();
		expect( createSortableControllerMock ).not.toHaveBeenCalled();
		harness.unmount();
	} );

	it( 'does not create a controller when the runtime URL is unavailable', () => {
		Object.assign( window, { yamabikoEditorToolsTableReorder: {} } );
		const harness = mountHook( createOptions() );
		flushLifecycleMicrotasks();

		expect( resolveTableContextMock ).not.toHaveBeenCalled();
		expect( createSortableControllerMock ).not.toHaveBeenCalled();
		harness.unmount();
	} );

	it( 'does not create a controller when table context resolution fails', () => {
		resolveTableContextMock.mockReturnValue( null );
		const harness = mountHook( createOptions() );
		flushLifecycleMicrotasks();

		expect( resolveTableContextMock ).toHaveBeenCalledTimes( 1 );
		expect( createSortableControllerMock ).not.toHaveBeenCalled();
		harness.unmount();
	} );

	it( 'does not create a hover controller without a fine hover pointer', () => {
		resolveTableContextMock.mockReturnValue( createContext( false ) );
		const harness = mountHook( createOptions() );
		flushLifecycleMicrotasks();

		expect( createSortableControllerMock ).not.toHaveBeenCalled();
		harness.unmount();
	} );

	it( 'does not create a controller when cleanup happens before its creation microtask', () => {
		const harness = mountHook( createOptions() );
		harness.unmount();
		flushLifecycleMicrotasks();

		expect( createSortableControllerMock ).not.toHaveBeenCalled();
	} );

	it( 'keeps pending focus until a recreated controller restores it successfully', () => {
		const firstController = createMockController();
		const failedFocusController = createMockController( false );
		const restoredFocusController = createMockController( true );
		createSortableControllerMock
			.mockReturnValueOnce( firstController )
			.mockReturnValueOnce( failedFocusController )
			.mockReturnValueOnce( restoredFocusController );
		const firstBody = [ 'a', 'b', 'c' ];
		const secondBody = [ 'b', 'a', 'c' ];
		const thirdBody = [ 'b', 'c', 'a' ];
		const harness = mountHook( createOptions( { body: firstBody } ) );
		flushLifecycleMicrotasks();

		act( () => {
			getControllerOptions( 0 ).onCommit( secondBody, 1 );
		} );
		harness.rerender( { body: secondBody } );
		flushLifecycleMicrotasks();
		expect( failedFocusController.focusRowControlAt ).toHaveBeenCalledWith( 1 );

		harness.rerender( { body: thirdBody } );
		flushLifecycleMicrotasks();
		expect( restoredFocusController.focusRowControlAt ).toHaveBeenCalledWith( 1 );
		harness.unmount();
		flushLifecycleMicrotasks();
	} );
} );
