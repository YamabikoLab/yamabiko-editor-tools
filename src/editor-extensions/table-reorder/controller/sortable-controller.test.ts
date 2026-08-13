import { createSortableController } from './sortable-controller';
import {
	ensureSortableRuntime,
	type SortableInstance,
	type SortableRuntime,
} from './sortable-runtime';
import type { TableContext } from '../table-context';

jest.mock( '@wordpress/components', () => ( {
	Tooltip: ( { children }: { children: unknown } ) => children,
} ) );

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
		const cell = document.createElement( 'td' );
		cell.textContent = `row-${ index }`;
		row.append( cell );
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

const dispatchKey = ( target: Element, key: string, repeat = false ) => {
	const event = new KeyboardEvent( 'keydown', {
		bubbles: true,
		cancelable: true,
		key,
		repeat,
	} );
	target.dispatchEvent( event );
	return event;
};

const flushPromises = async () => {
	await Promise.resolve();
	await Promise.resolve();
};

describe( 'createSortableController', () => {
	beforeEach( () => {
		document.body.replaceChildren();
		document.head.querySelectorAll( 'style' ).forEach( ( style ) => style.remove() );
		Object.defineProperty( window, 'scrollBy', {
			configurable: true,
			value: jest.fn(),
		} );
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
			rows: [ 'a', 'b', 'c' ],
			runtimeUrl: '/sortable.js',
		} );

		controller.destroy();
		resolveRuntime( runtime );
		await flushPromises();

		expect( runtime.create ).not.toHaveBeenCalled();
	} );

	it( 'shows the shared row control on hover while keeping drag start on the control', async () => {
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
			rows: [ 'a', 'b', 'c' ],
			runtimeUrl: '/sortable.js',
		} );
		await flushPromises();

		const firstRow = tbody.rows.item( 0 );
		const firstControl = firstRow?.querySelector< HTMLButtonElement >(
			'.yamabiko-table-reorder-handle-zone'
		);
		expect( firstControl?.dataset.visible ).toBe( 'false' );

		dispatchMousePointerEvent( firstRow!, 'pointerenter' );
		expect( firstControl?.dataset.visible ).toBe( 'true' );
		expect( context.blockElement.getAttribute( 'draggable' ) ).toBe( 'false' );
		dispatchMousePointerEvent( firstRow!, 'pointerleave' );
		expect( firstControl?.dataset.visible ).toBe( 'false' );
		expect( context.blockElement.getAttribute( 'draggable' ) ).toBe( 'true' );

		expect( getCreatedOptions( runtime ).handle ).toBe( '.yamabiko-table-reorder-handle-zone' );

		dispatchMousePointerEvent( firstRow!, 'pointerenter' );
		expect( context.blockElement.getAttribute( 'draggable' ) ).toBe( 'false' );
		controller.destroy();
		expect( context.blockElement.getAttribute( 'draggable' ) ).toBe( 'true' );
	} );

	it( 'keeps focus unchanged when a mouse drag starts from the hover row control', async () => {
		const runtime = createRuntime();
		ensureSortableRuntimeMock.mockResolvedValue( runtime );
		const { context, tbody } = createContext();
		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: [],
			interactionMode: 'hover',
			nonMovableRowIndices: [],
			onCommit: jest.fn(),
			rows: [ 'a', 'b', 'c' ],
			runtimeUrl: '/sortable.js',
		} );
		await flushPromises();

		const toolbarButton = document.createElement( 'button' );
		document.body.prepend( toolbarButton );
		toolbarButton.focus();
		const firstControl = tbody.rows
			.item( 0 )
			?.querySelector< HTMLButtonElement >( '.yamabiko-table-reorder-handle-zone' );
		if ( ! firstControl ) {
			throw new Error( 'Expected first row control' );
		}

		dispatchMousePointerEvent( firstControl, 'pointerdown' );
		const mouseDownEvent = new MouseEvent( 'mousedown', {
			bubbles: true,
			button: 0,
			cancelable: true,
		} );
		firstControl.dispatchEvent( mouseDownEvent );
		if ( ! mouseDownEvent.defaultPrevented ) {
			firstControl.focus();
		}

		expect( mouseDownEvent.defaultPrevented ).toBe( true );
		expect( toolbarButton.ownerDocument.activeElement ).toBe( toolbarButton );
		expect( firstControl.hasAttribute( 'title' ) ).toBe( false );
		controller.destroy();
	} );

	it( 'focuses the last active movable row without starting a reorder session', async () => {
		const runtime = createRuntime();
		ensureSortableRuntimeMock.mockResolvedValue( runtime );
		const { context, tbody } = createContext();
		const onCommit = jest.fn();
		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: [],
			interactionMode: 'hover',
			nonMovableRowIndices: [],
			onCommit,
			rows: [ 'a', 'b', 'c' ],
			runtimeUrl: '/sortable.js',
		} );
		await flushPromises();

		const secondCell = tbody.rows.item( 1 )?.cells.item( 0 );
		secondCell?.dispatchEvent( new FocusEvent( 'focusin', { bubbles: true } ) );

		expect( controller.focusRowControl() ).toBe( 'focused' );
		expect( tbody.ownerDocument.activeElement ).toBe(
			tbody.rows.item( 1 )?.querySelector( '.yamabiko-table-reorder-handle-zone' )
		);
		expect( onCommit ).not.toHaveBeenCalled();
		controller.destroy();
	} );

	it( 'releases block drag suppression when a keyboard session ends without a move', async () => {
		const runtime = createRuntime();
		ensureSortableRuntimeMock.mockResolvedValue( runtime );
		const { context, tbody } = createContext();
		context.blockElement.setAttribute( 'draggable', 'true' );
		const onCommit = jest.fn();
		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: [],
			interactionMode: 'hover',
			nonMovableRowIndices: [],
			onCommit,
			rows: [ 'a', 'b', 'c' ],
			runtimeUrl: '/sortable.js',
		} );
		await flushPromises();

		const firstControl = tbody.rows
			.item( 0 )
			?.querySelector< HTMLButtonElement >( '.yamabiko-table-reorder-handle-zone' );
		if ( ! firstControl ) {
			throw new Error( 'Expected first row control' );
		}
		firstControl.focus();

		dispatchKey( firstControl, 'Enter' );
		expect( context.blockElement.getAttribute( 'draggable' ) ).toBe( 'false' );
		expect( firstControl.getAttribute( 'aria-pressed' ) ).toBe( 'true' );
		dispatchKey( firstControl, 'Escape' );
		expect( context.blockElement.getAttribute( 'draggable' ) ).toBe( 'true' );
		expect( firstControl.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
		expect( tbody.ownerDocument.activeElement ).toBe( firstControl );

		dispatchKey( firstControl, 'Enter' );
		dispatchKey( firstControl, 'Enter' );
		expect( context.blockElement.getAttribute( 'draggable' ) ).toBe( 'true' );
		expect( firstControl.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
		expect( onCommit ).not.toHaveBeenCalled();
		controller.destroy();
	} );

	it( 'ignores repeated activation keys while keeping arrow key repeat available', async () => {
		const runtime = createRuntime();
		ensureSortableRuntimeMock.mockResolvedValue( runtime );
		const { context, tbody } = createContext();
		context.blockElement.setAttribute( 'draggable', 'true' );
		const onCommit = jest.fn();
		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: [],
			interactionMode: 'hover',
			nonMovableRowIndices: [],
			onCommit,
			rows: [ 'a', 'b', 'c' ],
			runtimeUrl: '/sortable.js',
		} );
		await flushPromises();

		const firstControl = tbody.rows
			.item( 0 )
			?.querySelector< HTMLButtonElement >( '.yamabiko-table-reorder-handle-zone' );
		if ( ! firstControl ) {
			throw new Error( 'Expected first row control' );
		}
		firstControl.focus();

		dispatchKey( firstControl, 'Enter' );
		dispatchKey( firstControl, 'Enter', true );
		expect( firstControl.getAttribute( 'aria-pressed' ) ).toBe( 'true' );
		expect( context.blockElement.getAttribute( 'draggable' ) ).toBe( 'false' );
		expect( onCommit ).not.toHaveBeenCalled();

		dispatchKey( firstControl, 'ArrowDown', true );
		dispatchKey( firstControl, 'Enter', true );
		expect( firstControl.getAttribute( 'aria-pressed' ) ).toBe( 'true' );
		expect( onCommit ).not.toHaveBeenCalled();

		dispatchKey( firstControl, 'Enter' );
		expect( firstControl.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
		expect( context.blockElement.getAttribute( 'draggable' ) ).toBe( 'true' );
		expect( onCommit ).toHaveBeenCalledWith( [ 'b', 'a', 'c' ], 1 );
		controller.destroy();
	} );

	it( 'focuses an already-focused cell row when the controller is created', async () => {
		const runtime = createRuntime();
		ensureSortableRuntimeMock.mockResolvedValue( runtime );
		const { context, tbody } = createContext();
		const secondCell = tbody.rows.item( 1 )?.cells.item( 0 );
		if ( ! secondCell ) {
			throw new Error( 'Expected second row cell' );
		}
		secondCell.tabIndex = -1;
		secondCell.focus();

		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: [],
			interactionMode: 'hover',
			nonMovableRowIndices: [],
			onCommit: jest.fn(),
			rows: [ 'a', 'b', 'c' ],
			runtimeUrl: '/sortable.js',
		} );
		await flushPromises();

		expect( controller.focusRowControl() ).toBe( 'focused' );
		expect( tbody.ownerDocument.activeElement ).toBe(
			tbody.rows.item( 1 )?.querySelector( '.yamabiko-table-reorder-handle-zone' )
		);
		controller.destroy();
	} );

	it( 'does not fall back to another row when the current row is non-movable', async () => {
		const runtime = createRuntime();
		ensureSortableRuntimeMock.mockResolvedValue( runtime );
		const { context, tbody } = createContext();
		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: [],
			interactionMode: 'hover',
			nonMovableRowIndices: [ 1 ],
			onCommit: jest.fn(),
			rows: [ 'a', 'b', 'c' ],
			runtimeUrl: '/sortable.js',
		} );
		await flushPromises();

		const secondCell = tbody.rows.item( 1 )?.cells.item( 0 );
		secondCell?.dispatchEvent( new FocusEvent( 'focusin', { bubbles: true } ) );

		expect( controller.focusRowControl() ).toBe( 'current-row-not-movable' );
		expect(
			tbody.ownerDocument.activeElement?.classList.contains( 'yamabiko-table-reorder-handle-zone' )
		).toBe( false );
		controller.destroy();
	} );

	it( 'reports when no movable row controls exist', async () => {
		const runtime = createRuntime();
		ensureSortableRuntimeMock.mockResolvedValue( runtime );
		const { context } = createContext();
		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: [],
			interactionMode: 'hover',
			nonMovableRowIndices: [ 0, 1, 2 ],
			onCommit: jest.fn(),
			rows: [ 'a', 'b', 'c' ],
			runtimeUrl: '/sortable.js',
		} );
		await flushPromises();

		expect( controller.focusRowControl() ).toBe( 'no-movable-rows' );
		controller.destroy();
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
