import { createSortableController } from './sortable-controller';
import {
	ensureSortableRuntime,
	type SortableInstance,
	type SortableRuntime,
} from './sortable-runtime';
import type { TableContext } from '../table-context';

jest.mock( './sortable-runtime', () => ( {
	ensureSortableRuntime: jest.fn(),
} ) );

const ensureSortableRuntimeMock = ensureSortableRuntime as jest.MockedFunction<
	typeof ensureSortableRuntime
>;

type TestSortableOptions = {
	handle?: string;
	onChoose: ( event: { item: HTMLElement } ) => void;
	onEnd: ( event: { oldIndex?: number; newIndex?: number } ) => void;
};

const createContext = () => {
	const blockElement = document.createElement( 'div' );
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	table.append( tbody );
	blockElement.append( table );
	document.body.append( blockElement );

	for ( let index = 0; index < 3; index++ ) {
		const row = document.createElement( 'tr' );
		row.dataset.index = String( index );
		row.append( document.createElement( 'td' ) );
		tbody.append( row );
	}

	const context: TableContext = {
		blockElement,
		document,
		table,
		tbody,
		window,
	};
	return { context, tbody };
};

const createRuntime = (): SortableRuntime => ( {
	create: jest.fn(
		(): SortableInstance => ( {
			destroy: jest.fn(),
		} )
	),
} );

const getCreatedOptions = ( runtime: SortableRuntime ): TestSortableOptions => {
	const createMock = runtime.create as jest.MockedFunction< SortableRuntime[ 'create' ] >;
	const options = createMock.mock.calls[ 0 ]?.[ 1 ];
	if ( ! options ) {
		throw new Error( 'Expected SortableJS options to be created' );
	}

	return options as TestSortableOptions;
};

const dispatchMousePointerEvent = ( target: Element, type: string ) => {
	const event = new Event( type );
	Object.defineProperty( event, 'pointerType', { value: 'mouse' } );
	target.dispatchEvent( event );
};

const flushPromises = async () => {
	await Promise.resolve();
	await Promise.resolve();
};

describe( 'createSortableController', () => {
	beforeEach( () => {
		document.body.replaceChildren();
		document.head.querySelectorAll( 'style' ).forEach( ( style ) => style.remove() );
		ensureSortableRuntimeMock.mockReset();
	} );

	it( 'does not create a stale SortableJS instance after destroy during runtime loading', async () => {
		let resolveRuntime: ( runtime: SortableRuntime | null ) => void = () => undefined;
		const loading = new Promise< SortableRuntime | null >( ( resolve ) => {
			resolveRuntime = resolve;
		} );
		const runtime = createRuntime();
		ensureSortableRuntimeMock.mockReturnValue( loading );
		const { context } = createContext();

		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: [],
			interactionMode: 'touch',
			nonMovableRowIndices: [],
			onCommit: jest.fn(),
			onNonMovableRowLongPress: jest.fn(),
			onRequestTouchModeExit: jest.fn(),
			rows: [ 'a', 'b', 'c' ],
			runtimeUrl: '/sortable.js',
		} );

		controller.destroy();
		resolveRuntime( runtime );
		await flushPromises();

		expect( runtime.create ).not.toHaveBeenCalled();
	} );

	it( 'shows the handle when the row is hovered while keeping drag start on the handle zone', async () => {
		const runtime = createRuntime();
		ensureSortableRuntimeMock.mockResolvedValue( runtime );
		const { context, tbody } = createContext();
		context.blockElement.setAttribute( 'draggable', 'true' );
		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: [],
			interactionMode: 'hover',
			nonMovableRowIndices: [],
			onCommit: jest.fn(),
			onNonMovableRowLongPress: jest.fn(),
			onRequestTouchModeExit: jest.fn(),
			rows: [ 'a', 'b', 'c' ],
			runtimeUrl: '/sortable.js',
		} );
		await flushPromises();

		const firstRow = tbody.rows.item( 0 );
		const firstHandle = firstRow?.querySelector< HTMLElement >( '.yamabiko-table-reorder-handle' );
		expect( firstHandle?.style.opacity ).toBe( '0' );

		dispatchMousePointerEvent( firstRow!, 'pointerenter' );
		expect( firstHandle?.style.opacity ).toBe( '1' );
		expect( context.blockElement.getAttribute( 'draggable' ) ).toBe( 'false' );
		dispatchMousePointerEvent( firstRow!, 'pointerleave' );
		expect( firstHandle?.style.opacity ).toBe( '0' );
		expect( context.blockElement.getAttribute( 'draggable' ) ).toBe( 'true' );

		expect( getCreatedOptions( runtime ).handle ).toBe( '.yamabiko-table-reorder-handle-zone' );

		dispatchMousePointerEvent( firstRow!, 'pointerenter' );
		expect( context.blockElement.getAttribute( 'draggable' ) ).toBe( 'false' );
		controller.destroy();
		expect( context.blockElement.getAttribute( 'draggable' ) ).toBe( 'true' );
	} );

	it( 'restores the original DOM order before committing reordered rows', async () => {
		const runtime = createRuntime();
		ensureSortableRuntimeMock.mockResolvedValue( runtime );
		const { context, tbody } = createContext();
		const commitOrders: string[][] = [];
		const onCommit = jest.fn( () => {
			commitOrders.push( Array.from( tbody.rows ).map( ( row ) => row.dataset.index ?? '' ) );
		} );
		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: [],
			interactionMode: 'touch',
			nonMovableRowIndices: [],
			onCommit,
			onNonMovableRowLongPress: jest.fn(),
			onRequestTouchModeExit: jest.fn(),
			rows: [ 'a', 'b', 'c' ],
			runtimeUrl: '/sortable.js',
		} );
		await flushPromises();

		const sortableOptions = getCreatedOptions( runtime );
		const originalRows = Array.from( tbody.rows );
		sortableOptions.onChoose( { item: originalRows[ 0 ] } );
		tbody.append( originalRows[ 0 ] );
		expect( Array.from( tbody.rows ).map( ( row ) => row.dataset.index ) ).toEqual( [
			'1',
			'2',
			'0',
		] );

		sortableOptions.onEnd( { oldIndex: 0, newIndex: 2 } );

		expect( commitOrders ).toEqual( [ [ '0', '1', '2' ] ] );
		expect( onCommit ).toHaveBeenCalledWith( [ 'b', 'c', 'a' ] );
		controller.destroy();
	} );
} );
