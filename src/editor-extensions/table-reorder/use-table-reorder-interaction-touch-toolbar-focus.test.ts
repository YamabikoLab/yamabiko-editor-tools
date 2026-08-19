import { useDispatch, useSelect } from '@wordpress/data';
import { createElement, createRoot } from '@wordpress/element';

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

const PREFERENCES_SCOPE = 'yamabiko-editor-tools';
const TOUCH_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderTouchCoachmarkDismissed';
const useDispatchMock = useDispatch as unknown as jest.Mock;
const useSelectMock = useSelect as unknown as jest.Mock;
const resolveTableContextMock = resolveTableContext as jest.MockedFunction<
	typeof resolveTableContext
>;
const preferencesSetMock = jest.fn();
const selectBlockMock = jest.fn();
const preferenceValues = new Map< string, unknown >();
let latestResult: ReturnType< typeof useTableReorderInteraction > | null = null;
let activeRoot: ReturnType< typeof createRoot > | null = null;

const installMatchMedia = ( matches: boolean ) => {
	Object.defineProperty( window, 'matchMedia', {
		configurable: true,
		value: jest.fn( () => ( {
			matches,
			media: '(hover: hover) and (pointer: fine)',
			onchange: null,
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
			addListener: jest.fn(),
			removeListener: jest.fn(),
			dispatchEvent: jest.fn(),
		} ) ),
		writable: true,
	} );
};

const createContext = (): TableContext => {
	const blockElement = document.createElement( 'div' );
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	const row = document.createElement( 'tr' );
	const cell = document.createElement( 'td' );
	row.append( cell );
	tbody.append( row );
	table.append( tbody );
	blockElement.append( table );
	document.body.append( blockElement );

	return { blockElement, document, tbody, window };
};

const HookHarness = ( props: { isSelected: boolean } ) => {
	latestResult = useTableReorderInteraction( {
		anchorRef: { current: document.createElement( 'span' ) },
		clientId: 'table-client-id',
		enabled: true,
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

const mountHook = ( isSelected: boolean ) => {
	const container = document.createElement( 'div' );
	document.body.append( container );
	activeRoot = createRoot( container );
	act( () => {
		activeRoot?.render( createElement( HookHarness, { isSelected } ) );
	} );
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
	selectBlockMock.mockReset();
	useDispatchMock.mockReset();
	useSelectMock.mockReset();
	resolveTableContextMock.mockReset();
	installMatchMedia( false );

	useDispatchMock.mockImplementation( ( storeName: string ) =>
		storeName === 'core/block-editor'
			? { selectBlock: selectBlockMock }
			: { set: preferencesSetMock }
	);
	useSelectMock.mockImplementation(
		( selector: ( registrySelect: ( storeName: string ) => unknown ) => unknown ) =>
			selector( () => ( {
				get: ( scope: string, name: string ) => preferenceValues.get( `${ scope }:${ name }` ),
			} ) )
	);
} );

afterEach( () => {
	if ( activeRoot ) {
		act( () => {
			activeRoot?.unmount();
		} );
	}
	document.body.replaceChildren();
} );

describe( 'touch coachmark toolbar focus request', () => {
	it( 'suppresses the initial table gesture, selects the block, and requests toolbar focus', () => {
		const context = createContext();
		resolveTableContextMock.mockReturnValue( context );
		mountHook( false );
		const cell = context.tbody.querySelector( 'td' );
		const pointerDown = new Event( 'pointerdown', { bubbles: true, cancelable: true } );
		const click = new MouseEvent( 'click', { bubbles: true, cancelable: true } );

		act( () => {
			cell?.dispatchEvent( pointerDown );
			cell?.dispatchEvent( click );
		} );

		expect( pointerDown.defaultPrevented ).toBe( true );
		expect( click.defaultPrevented ).toBe( true );
		expect( selectBlockMock ).toHaveBeenCalledWith( 'table-client-id' );
		expect( getResult().isTouchToolbarFocusRequested ).toBe( true );

		act( () => {
			getResult().consumeTouchToolbarFocusRequest();
		} );
		expect( getResult().isTouchToolbarFocusRequested ).toBe( false );
	} );

	it( 'does not guard the table after the touch coachmark is dismissed', () => {
		preferenceValues.set(
			`${ PREFERENCES_SCOPE }:${ TOUCH_COACHMARK_DISMISSED_PREFERENCE }`,
			true
		);
		const context = createContext();
		resolveTableContextMock.mockReturnValue( context );
		mountHook( false );
		const cell = context.tbody.querySelector( 'td' );
		const pointerDown = new Event( 'pointerdown', { bubbles: true, cancelable: true } );

		act( () => {
			cell?.dispatchEvent( pointerDown );
		} );

		expect( pointerDown.defaultPrevented ).toBe( false );
		expect( selectBlockMock ).not.toHaveBeenCalled();
		expect( getResult().isTouchToolbarFocusRequested ).toBe( false );
	} );

	it( 'does not guard pointer input on hover-capable devices', () => {
		installMatchMedia( true );
		const context = createContext();
		resolveTableContextMock.mockReturnValue( context );
		mountHook( false );
		const cell = context.tbody.querySelector( 'td' );
		const pointerDown = new Event( 'pointerdown', { bubbles: true, cancelable: true } );

		act( () => {
			cell?.dispatchEvent( pointerDown );
		} );

		expect( pointerDown.defaultPrevented ).toBe( false );
		expect( selectBlockMock ).not.toHaveBeenCalled();
		expect( getResult().isTouchToolbarFocusRequested ).toBe( false );
	} );
} );
