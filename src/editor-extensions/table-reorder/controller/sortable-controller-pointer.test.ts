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

type RuntimeOptions = {
	onChoose: ( event: { item: HTMLElement } ) => void;
	onEnd: ( event: { oldIndex?: number; newIndex?: number } ) => void;
	onStart: () => void;
	onUnchoose: () => void;
};

const createRuntime = ( capture?: ( options: RuntimeOptions ) => void ): SortableRuntime => ( {
	create: jest.fn( ( _element: HTMLElement, options: unknown ): SortableInstance => {
		capture?.( options as RuntimeOptions );
		return { destroy: jest.fn() };
	} ),
} );

const createContext = ( rowCount = 4 ) => {
	const blockElement = document.createElement( 'div' );
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	table.append( tbody );
	blockElement.append( table );
	document.body.append( blockElement );

	for ( let index = 0; index < rowCount; index++ ) {
		const row = document.createElement( 'tr' );
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

const getControl = ( tbody: HTMLTableSectionElement, rowIndex: number ): HTMLButtonElement => {
	const control = tbody.rows
		.item( rowIndex )
		?.querySelector< HTMLButtonElement >( '.yamabiko-table-reorder-handle-zone' );
	if ( ! control ) {
		throw new Error( `Expected row control for row ${ rowIndex }` );
	}
	return control;
};

const clickPointerControl = ( control: HTMLButtonElement ) => {
	control.dispatchEvent(
		new MouseEvent( 'click', {
			bubbles: true,
			cancelable: true,
			detail: 1,
		} )
	);
};

const pressKey = ( control: HTMLButtonElement, key: string ) => {
	const event = new KeyboardEvent( 'keydown', {
		bubbles: true,
		cancelable: true,
		key,
	} );
	control.dispatchEvent( event );
	return event;
};

const dispatchTouchPointer = (
	target: Element,
	type: string,
	{ x, y }: { x: number; y: number }
) => {
	const event = new Event( type, { bubbles: true, cancelable: true } );
	Object.defineProperties( event, {
		clientX: { value: x },
		clientY: { value: y },
		pointerId: { value: 1 },
		pointerType: { value: 'touch' },
	} );
	target.dispatchEvent( event );
};

const createController = (
	interactionMode: 'hover' | 'touch',
	options: {
		forbiddenInsertionIndices?: number[];
		nonMovableRowIndices?: number[];
		onCommit?: jest.Mock;
	} = {}
) => {
	const { context, tbody } = createContext();
	const onCommit = options.onCommit ?? jest.fn();
	const controller = createSortableController( {
		context,
		forbiddenInsertionIndices: options.forbiddenInsertionIndices ?? [],
		interactionMode,
		nonMovableRowIndices: options.nonMovableRowIndices ?? [],
		onCommit,
		rows: [ 'a', 'b', 'c', 'd' ],
		runtimeUrl: '/sortable.js',
	} );
	return { controller, onCommit, tbody };
};

describe( 'createSortableController single-pointer reorder', () => {
	beforeEach( () => {
		document.body.replaceChildren();
		ensureSortableRuntimeMock.mockReset();
		ensureSortableRuntimeMock.mockResolvedValue( createRuntime() );
	} );

	it( 'moves a row by clicking the existing PC control and a destination', () => {
		const { controller, onCommit, tbody } = createController( 'hover' );
		const control = getControl( tbody, 1 );

		clickPointerControl( control );

		expect( control.getAttribute( 'aria-pressed' ) ).toBe( 'true' );
		const destination = document.querySelector< HTMLButtonElement >(
			'.yamabiko-table-reorder-destination[data-new-index="2"]'
		);
		expect( destination ).not.toBeNull();
		destination?.click();

		expect( onCommit ).toHaveBeenCalledWith( [ 'a', 'c', 'b', 'd' ], 2 );
		expect( document.querySelector( '.yamabiko-table-reorder-destination' ) ).toBeNull();
		controller.destroy();
	} );

	it( 'cancels PC destination selection with Escape without changing data', () => {
		const { controller, onCommit, tbody } = createController( 'hover' );
		const control = getControl( tbody, 1 );

		clickPointerControl( control );
		document.dispatchEvent(
			new KeyboardEvent( 'keydown', { bubbles: true, cancelable: true, key: 'Escape' } )
		);

		expect( onCommit ).not.toHaveBeenCalled();
		expect( document.querySelector( '.yamabiko-table-reorder-destination' ) ).toBeNull();
		expect( tbody.ownerDocument.activeElement ).toBe( control );
		controller.destroy();
	} );

	it( 'provides a touch cancel action and keeps touch reorder mode active', () => {
		const { controller, onCommit, tbody } = createController( 'touch' );
		const control = getControl( tbody, 1 );

		clickPointerControl( control );
		const cancel = document.querySelector< HTMLButtonElement >(
			'.yamabiko-table-reorder-pointer-cancel'
		);
		expect( cancel?.textContent ).toBe( 'Cancel' );
		cancel?.click();

		expect( onCommit ).not.toHaveBeenCalled();
		expect( document.querySelector( '.yamabiko-table-reorder-destination' ) ).toBeNull();
		expect( getControl( tbody, 0 ) ).not.toBeNull();
		controller.destroy();
	} );

	it( 'does not commit when a touch destination is swiped for scrolling', () => {
		const { controller, onCommit, tbody } = createController( 'touch' );
		clickPointerControl( getControl( tbody, 1 ) );
		const destination = document.querySelector< HTMLButtonElement >(
			'.yamabiko-table-reorder-destination[data-new-index="2"]'
		);
		if ( ! destination ) {
			throw new Error( 'Expected destination button' );
		}

		dispatchTouchPointer( destination, 'pointerdown', { x: 10, y: 10 } );
		dispatchTouchPointer( destination, 'pointermove', { x: 10, y: 30 } );
		dispatchTouchPointer( destination, 'pointerup', { x: 10, y: 30 } );
		destination.click();

		expect( onCommit ).not.toHaveBeenCalled();
		expect( document.querySelector( '.yamabiko-table-reorder-destination' ) ).not.toBeNull();
		controller.destroy();
	} );

	it( 'cancels an active touch session when reorder mode is torn down', () => {
		const { controller, onCommit, tbody } = createController( 'touch' );
		clickPointerControl( getControl( tbody, 1 ) );

		controller.destroy();

		expect( onCommit ).not.toHaveBeenCalled();
		expect( document.querySelector( '.yamabiko-table-reorder-destination' ) ).toBeNull();
		expect( document.querySelector( '.yamabiko-table-reorder-pointer-guidance' ) ).toBeNull();
	} );

	it( 'renders only destinations allowed by rowspan constraints', () => {
		const { controller, tbody } = createController( 'hover', {
			forbiddenInsertionIndices: [ 2 ],
			nonMovableRowIndices: [ 1 ],
		} );
		const control = getControl( tbody, 0 );

		clickPointerControl( control );
		const newIndices = Array.from(
			document.querySelectorAll< HTMLButtonElement >( '.yamabiko-table-reorder-destination' )
		).map( ( target ) => target.dataset.newIndex );

		expect( newIndices ).toEqual( [ '2', '3' ] );
		controller.destroy();
	} );

	it( 'does not suppress a PC click when Sortable unchooses without starting a drag', async () => {
		const runtimeOptionsRef: { current: RuntimeOptions | null } = { current: null };
		ensureSortableRuntimeMock.mockResolvedValue(
			createRuntime( ( options ) => {
				runtimeOptionsRef.current = options;
			} )
		);
		const { controller, tbody } = createController( 'hover' );
		await Promise.resolve();
		const control = getControl( tbody, 1 );
		const row = tbody.rows.item( 1 );
		const runtimeOptions = runtimeOptionsRef.current;
		if ( ! runtimeOptions || ! row ) {
			throw new Error( 'Expected Sortable runtime options and row' );
		}

		runtimeOptions.onChoose( { item: row } );
		runtimeOptions.onUnchoose();
		clickPointerControl( control );

		expect( document.querySelector( '.yamabiko-table-reorder-destination' ) ).not.toBeNull();
		controller.destroy();
	} );

	it( 'suppresses the click emitted immediately after a PC drag', async () => {
		const runtimeOptionsRef: { current: RuntimeOptions | null } = { current: null };
		ensureSortableRuntimeMock.mockResolvedValue(
			createRuntime( ( options ) => {
				runtimeOptionsRef.current = options;
			} )
		);
		const { controller, tbody } = createController( 'hover' );
		await Promise.resolve();
		const control = getControl( tbody, 1 );
		const runtimeOptions = runtimeOptionsRef.current;
		if ( ! runtimeOptions ) {
			throw new Error( 'Expected Sortable runtime options' );
		}

		runtimeOptions.onStart();
		runtimeOptions.onEnd( { oldIndex: 1, newIndex: 1 } );
		clickPointerControl( control );

		expect( document.querySelector( '.yamabiko-table-reorder-destination' ) ).toBeNull();
		controller.destroy();
	} );

	it( 'ignores keyboard start while a pointer session is active', () => {
		const { controller, onCommit, tbody } = createController( 'hover' );
		const pointerControl = getControl( tbody, 1 );
		const otherControl = getControl( tbody, 2 );
		clickPointerControl( pointerControl );
		const destination = document.querySelector( '.yamabiko-table-reorder-destination' );

		otherControl.focus();
		pressKey( otherControl, 'Enter' );

		expect( pointerControl.getAttribute( 'aria-pressed' ) ).toBe( 'true' );
		expect( document.querySelector( '.yamabiko-table-reorder-destination' ) ).toBe( destination );
		expect( otherControl.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
		expect( onCommit ).not.toHaveBeenCalled();
		controller.destroy();
	} );

	it( 'ignores pointer start while a drag is active', async () => {
		const runtimeOptionsRef: { current: RuntimeOptions | null } = { current: null };
		ensureSortableRuntimeMock.mockResolvedValue(
			createRuntime( ( options ) => {
				runtimeOptionsRef.current = options;
			} )
		);
		const { controller, tbody } = createController( 'hover' );
		await Promise.resolve();
		const runtimeOptions = runtimeOptionsRef.current;
		if ( ! runtimeOptions ) {
			throw new Error( 'Expected Sortable runtime options' );
		}

		runtimeOptions.onStart();
		clickPointerControl( getControl( tbody, 1 ) );

		expect( document.querySelector( '.yamabiko-table-reorder-destination' ) ).toBeNull();
		expect( getControl( tbody, 1 ).getAttribute( 'aria-pressed' ) ).toBe( 'false' );
		runtimeOptions.onEnd( { oldIndex: 1, newIndex: 1 } );
		controller.destroy();
	} );

	it( 'cleans up pointer UI when a drag starts from a pointer session', async () => {
		const runtimeOptionsRef: { current: RuntimeOptions | null } = { current: null };
		ensureSortableRuntimeMock.mockResolvedValue(
			createRuntime( ( options ) => {
				runtimeOptionsRef.current = options;
			} )
		);
		const { controller, onCommit, tbody } = createController( 'hover' );
		await Promise.resolve();
		const runtimeOptions = runtimeOptionsRef.current;
		const control = getControl( tbody, 1 );
		if ( ! runtimeOptions ) {
			throw new Error( 'Expected Sortable runtime options' );
		}
		clickPointerControl( control );
		expect( document.querySelector( '.yamabiko-table-reorder-destination' ) ).not.toBeNull();

		runtimeOptions.onStart();

		expect( control.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
		expect( document.querySelector( '.yamabiko-table-reorder-destination' ) ).toBeNull();
		expect( onCommit ).not.toHaveBeenCalled();
		runtimeOptions.onEnd( { oldIndex: 1, newIndex: 1 } );
		controller.destroy();
	} );

	it( 'allows keyboard and pointer sessions to restart after a drag ends', async () => {
		const runtimeOptionsRef: { current: RuntimeOptions | null } = { current: null };
		ensureSortableRuntimeMock.mockResolvedValue(
			createRuntime( ( options ) => {
				runtimeOptionsRef.current = options;
			} )
		);
		const { controller, tbody } = createController( 'hover' );
		await Promise.resolve();
		const runtimeOptions = runtimeOptionsRef.current;
		const control = getControl( tbody, 1 );
		if ( ! runtimeOptions ) {
			throw new Error( 'Expected Sortable runtime options' );
		}

		runtimeOptions.onStart();
		runtimeOptions.onEnd( { oldIndex: 1, newIndex: 1 } );
		control.focus();
		pressKey( control, 'Enter' );
		expect( control.getAttribute( 'aria-pressed' ) ).toBe( 'true' );
		pressKey( control, 'Escape' );
		expect( control.getAttribute( 'aria-pressed' ) ).toBe( 'false' );

		clickPointerControl( control );
		expect( control.getAttribute( 'aria-pressed' ) ).toBe( 'true' );
		expect( document.querySelector( '.yamabiko-table-reorder-destination' ) ).not.toBeNull();
		controller.destroy();
	} );

	it( 'cleans up drag snapshot state when destroyed after onChoose', async () => {
		const runtimeOptionsRef: { current: RuntimeOptions | null } = { current: null };
		ensureSortableRuntimeMock.mockResolvedValue(
			createRuntime( ( options ) => {
				runtimeOptionsRef.current = options;
			} )
		);
		const { controller, tbody } = createController( 'hover' );
		await Promise.resolve();
		const runtimeOptions = runtimeOptionsRef.current;
		const row = tbody.rows.item( 1 );
		const cell = row?.cells.item( 0 );
		if ( ! runtimeOptions || ! row || ! cell ) {
			throw new Error( 'Expected Sortable runtime options, row, and cell' );
		}
		Object.defineProperty( cell, 'getBoundingClientRect', {
			configurable: true,
			value: () => ( { width: 120 } ),
		} );

		runtimeOptions.onChoose( { item: row } );
		tbody.append( row );
		expect(
			Array.from( tbody.rows ).map( ( current ) => current.cells.item( 0 )?.textContent )
		).toEqual( [ 'row-0', 'row-2', 'row-3', 'row-1' ] );
		expect( cell.style.width ).toBe( '120px' );

		controller.destroy();

		expect(
			Array.from( tbody.rows ).map( ( current ) => current.cells.item( 0 )?.textContent )
		).toEqual( [ 'row-0', 'row-1', 'row-2', 'row-3' ] );
		expect( cell.style.width ).toBe( '' );
		expect( document.querySelector( '.yamabiko-table-reorder-insertion-line' ) ).toBeNull();
	} );
} );
