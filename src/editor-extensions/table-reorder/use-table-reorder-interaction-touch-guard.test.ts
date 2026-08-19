import { useDispatch, useSelect } from '@wordpress/data';
import { createElement, createRoot } from '@wordpress/element';

import { resolveTableContext, type TableContext } from './table-context';
import { useTableReorderInteraction } from './use-table-reorder-interaction';

const { act } = jest.requireActual< { act: ( callback: () => void ) => void } >( 'react' );

jest.mock( '@wordpress/data', () => ( {
	useDispatch: jest.fn(),
	useSelect: jest.fn(),
} ) );

jest.mock( './table-context', () => ( {
	resolveTableContext: jest.fn(),
} ) );

const useDispatchMock = useDispatch as unknown as jest.Mock;
const useSelectMock = useSelect as unknown as jest.Mock;
const resolveTableContextMock = resolveTableContext as jest.MockedFunction<
	typeof resolveTableContext
>;
const preferencesSetMock = jest.fn();
const selectBlockMock = jest.fn();
let activeRoot: ReturnType< typeof createRoot > | null = null;

const installTouchMatchMedia = () => {
	Object.defineProperty( window, 'matchMedia', {
		configurable: true,
		value: jest.fn( () => ( {
			matches: false,
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
	useTableReorderInteraction( {
		anchorRef: { current: document.createElement( 'span' ) },
		clientId: 'table-client-id',
		enabled: true,
		isSelected: props.isSelected,
	} );
	return createElement( 'span' );
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
	activeRoot = null;
	preferencesSetMock.mockReset();
	selectBlockMock.mockReset();
	useDispatchMock.mockReset();
	useSelectMock.mockReset();
	resolveTableContextMock.mockReset();
	installTouchMatchMedia();

	useDispatchMock.mockImplementation( ( storeName: string ) =>
		storeName === 'core/block-editor'
			? { selectBlock: selectBlockMock }
			: { set: preferencesSetMock }
	);
	useSelectMock.mockImplementation(
		( selector: ( registrySelect: ( storeName: string ) => unknown ) => unknown ) =>
			selector( () => ( { get: jest.fn( () => false ) } ) )
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

describe( 'touch coachmark cell edit guard', () => {
	it( 'prevents the first table pointerdown and selects the block while touch coachmark is not dismissed', () => {
		const context = createContext();
		resolveTableContextMock.mockReturnValue( context );
		mountHook( false );
		const cell = context.tbody.querySelector( 'td' );
		const event = new Event( 'pointerdown', { bubbles: true, cancelable: true } );

		act( () => {
			cell?.dispatchEvent( event );
		} );

		expect( event.defaultPrevented ).toBe( true );
		expect( selectBlockMock ).toHaveBeenCalledWith( 'table-client-id' );
	} );

	it( 'does not prevent table pointerdown after the touch coachmark preference is dismissed', () => {
		useSelectMock.mockImplementation(
			( selector: ( registrySelect: ( storeName: string ) => unknown ) => unknown ) =>
				selector( () => ( {
					get: ( _scope: string, name: string ) =>
						name === 'tableReorderTouchCoachmarkDismissed',
				} ) )
		);
		const context = createContext();
		resolveTableContextMock.mockReturnValue( context );
		mountHook( false );
		const cell = context.tbody.querySelector( 'td' );
		const event = new Event( 'pointerdown', { bubbles: true, cancelable: true } );

		act( () => {
			cell?.dispatchEvent( event );
		} );

		expect( event.defaultPrevented ).toBe( false );
		expect( selectBlockMock ).not.toHaveBeenCalled();
	} );
} );
