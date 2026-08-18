import { useDispatch } from '@wordpress/data';
import { createElement, createRoot } from '@wordpress/element';

import { announceLiveStatus } from './controller/reorder-ui';
import {
	getNoMovableRowsAnnouncement,
	getNoMovableRowsMessage,
	getRowspanErrorMessage,
} from './messages';
import { resolveTableContext, type TableContext } from './table-context';
import { useTableReorder } from './use-table-reorder';
import { useTableReorderController } from './use-table-reorder-controller';
import { useTableReorderInteraction } from './use-table-reorder-interaction';

const { act } = jest.requireActual< { act: ( callback: () => void ) => void } >( 'react' );

type UseTableReorderOptions = Parameters< typeof useTableReorder >[ 0 ];
type TableReorderHookResult = ReturnType< typeof useTableReorder >;
type InteractionResult = ReturnType< typeof useTableReorderInteraction >;

jest.mock( '@wordpress/data', () => ( {
	useDispatch: jest.fn(),
} ) );

jest.mock( '@wordpress/notices', () => ( {
	store: 'notices-store',
} ) );

jest.mock( './controller/reorder-ui', () => ( {
	announceLiveStatus: jest.fn(),
} ) );

jest.mock( './table-context', () => ( {
	resolveTableContext: jest.fn(),
} ) );

jest.mock( './use-table-reorder-controller', () => ( {
	useTableReorderController: jest.fn(),
} ) );

jest.mock( './use-table-reorder-interaction', () => ( {
	useTableReorderInteraction: jest.fn(),
} ) );

const useDispatchMock = useDispatch as unknown as jest.Mock;
const announceLiveStatusMock = announceLiveStatus as jest.MockedFunction<
	typeof announceLiveStatus
>;
const resolveTableContextMock = resolveTableContext as jest.MockedFunction<
	typeof resolveTableContext
>;
const useTableReorderControllerMock = useTableReorderController as jest.MockedFunction<
	typeof useTableReorderController
>;
const useTableReorderInteractionMock = useTableReorderInteraction as jest.MockedFunction<
	typeof useTableReorderInteraction
>;

const createNoticeMock = jest.fn();
const dismissKeyboardCoachmarkMock = jest.fn();
const dismissTouchCoachmarkMock = jest.fn();
const focusRowControlMock = jest.fn();
const toggleTouchReorderModeMock = jest.fn();
let latestResult: TableReorderHookResult | null = null;
let activeRoot: ReturnType< typeof createRoot > | null = null;

const createContext = (): TableContext => {
	const blockElement = document.createElement( 'div' );
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	table.append( tbody );
	blockElement.append( table );

	return {
		blockElement,
		document,
		tbody,
		window,
	};
};

const createBody = ( ...labels: string[] ): unknown[] =>
	labels.map( ( content ) => ( {
		cells: [ { content } ],
	} ) );

const createInteractionResult = (
	overrides: Partial< InteractionResult > = {}
): InteractionResult => ( {
	dismissKeyboardCoachmark: dismissKeyboardCoachmarkMock,
	dismissTouchCoachmark: dismissTouchCoachmarkMock,
	interactionMode: 'hover',
	isHoverCapable: true,
	isKeyboardCoachmarkVisible: false,
	isTouchCoachmarkVisible: false,
	isTouchReorderMode: false,
	toggleTouchReorderMode: toggleTouchReorderModeMock,
	...overrides,
} );

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

	act( () => {
		root.render( createElement( HookHarness, props ) );
	} );

	return props;
};

beforeAll( () => {
	Object.assign( globalThis, { IS_REACT_ACT_ENVIRONMENT: true } );
} );

beforeEach( () => {
	document.body.replaceChildren();
	latestResult = null;
	activeRoot = null;
	createNoticeMock.mockReset();
	dismissKeyboardCoachmarkMock.mockReset();
	dismissTouchCoachmarkMock.mockReset();
	focusRowControlMock.mockReset();
	toggleTouchReorderModeMock.mockReset();
	useDispatchMock.mockReset();
	announceLiveStatusMock.mockReset();
	resolveTableContextMock.mockReset();
	useTableReorderControllerMock.mockReset();
	useTableReorderInteractionMock.mockReset();

	useDispatchMock.mockReturnValue( { createNotice: createNoticeMock } );
	useTableReorderInteractionMock.mockReturnValue( createInteractionResult() );
	focusRowControlMock.mockReturnValue( 'focused' );
	useTableReorderControllerMock.mockReturnValue( {
		focusRowControl: focusRowControlMock,
	} );
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

describe( 'useTableReorder local contract', () => {
	it( 'commits reordered body through setAttributes', () => {
		const setAttributes = jest.fn();
		const reorderedBody = createBody( 'b', 'a', 'c' );
		mountHook( { setAttributes } );
		const controllerOptions = useTableReorderControllerMock.mock.calls[ 0 ]?.[ 0 ];
		if ( ! controllerOptions ) {
			throw new Error( 'Expected controller hook options' );
		}

		controllerOptions.onBodyCommit( reorderedBody );

		expect( setAttributes ).toHaveBeenCalledWith( { body: reorderedBody } );
	} );

	it.each( [
		[ 'current-row-not-movable', 'error', getRowspanErrorMessage() ],
		[ 'no-movable-rows', 'warning', getNoMovableRowsMessage() ],
	] as const )( 'maps %s focus result to a %s notice', ( result, status, message ) => {
		focusRowControlMock.mockReturnValue( result );
		mountHook();

		getResult().requestRowControlFocus();

		expect( dismissKeyboardCoachmarkMock ).toHaveBeenCalledTimes( 1 );
		expect( createNoticeMock ).toHaveBeenCalledWith( status, message, {
			type: 'snackbar',
		} );
	} );

	it( 'does not create a focus notice after a successful focus request', () => {
		mountHook();

		getResult().requestRowControlFocus();

		expect( dismissKeyboardCoachmarkMock ).toHaveBeenCalledTimes( 1 );
		expect( createNoticeMock ).not.toHaveBeenCalled();
	} );

	it( 'blocks touch reorder for a non-array body and announces the local failure', () => {
		const context = createContext();
		resolveTableContextMock.mockReturnValue( context );
		mountHook( { body: null } );

		getResult().toggleTouchReorderMode();

		expect( dismissTouchCoachmarkMock ).toHaveBeenCalledTimes( 1 );
		expect( toggleTouchReorderModeMock ).not.toHaveBeenCalled();
		expect( createNoticeMock ).toHaveBeenCalledWith( 'warning', getNoMovableRowsMessage(), {
			type: 'snackbar',
		} );
		expect( resolveTableContextMock ).toHaveBeenCalledWith(
			expect.any( HTMLSpanElement ),
			'table-client-id'
		);
		expect( announceLiveStatusMock ).toHaveBeenCalledWith(
			context.document,
			getNoMovableRowsAnnouncement()
		);
	} );

	it( 'blocks touch reorder when rowspan makes every row non-movable', () => {
		const body = [ { cells: [ { content: 'a', rowspan: 2 } ] }, { cells: [ { content: 'b' } ] } ];
		resolveTableContextMock.mockReturnValue( null );
		mountHook( { body, rowspanProperty: 'rowspan' } );

		getResult().toggleTouchReorderMode();

		expect( useTableReorderControllerMock ).toHaveBeenCalledWith(
			expect.objectContaining( {
				forbiddenInsertionIndices: [ 1 ],
				nonMovableRowIndices: [ 0, 1 ],
			} )
		);
		expect( createNoticeMock ).toHaveBeenCalledWith( 'warning', getNoMovableRowsMessage(), {
			type: 'snackbar',
		} );
		expect( toggleTouchReorderModeMock ).not.toHaveBeenCalled();
		expect( announceLiveStatusMock ).not.toHaveBeenCalled();
	} );

	it( 'enters touch reorder when at least one row remains movable', () => {
		const body = [
			{ cells: [ { content: 'a', rowspan: 2 } ] },
			{ cells: [ { content: 'b' } ] },
			{ cells: [ { content: 'c' } ] },
		];
		mountHook( { body, rowspanProperty: 'rowspan' } );

		getResult().toggleTouchReorderMode();

		expect( dismissTouchCoachmarkMock ).toHaveBeenCalledTimes( 1 );
		expect( createNoticeMock ).not.toHaveBeenCalled();
		expect( toggleTouchReorderModeMock ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'leaves active touch reorder without rechecking row availability', () => {
		useTableReorderInteractionMock.mockReturnValue(
			createInteractionResult( {
				interactionMode: 'touch',
				isHoverCapable: false,
				isTouchReorderMode: true,
			} )
		);
		mountHook( { body: null } );

		getResult().toggleTouchReorderMode();

		expect( dismissTouchCoachmarkMock ).not.toHaveBeenCalled();
		expect( createNoticeMock ).not.toHaveBeenCalled();
		expect( resolveTableContextMock ).not.toHaveBeenCalled();
		expect( toggleTouchReorderModeMock ).toHaveBeenCalledTimes( 1 );
	} );
} );
