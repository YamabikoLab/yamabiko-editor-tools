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
	onMove: (
		event: { related: HTMLElement; willInsertAfter: boolean },
		originalEvent: Event
	) => boolean | void;
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

const pressKey = ( control: HTMLButtonElement, key: string, shiftKey = false ) => {
	const event = new KeyboardEvent( 'keydown', {
		bubbles: true,
		cancelable: true,
		key,
		shiftKey,
	} );
	control.dispatchEvent( event );
	return event;
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

const pointerDownPointerControl = ( control: HTMLButtonElement ) => {
	const event = new Event( 'pointerdown', { bubbles: true, cancelable: true } );
	Object.defineProperties( event, {
		button: { value: 0 },
		pointerId: { value: 1 },
		pointerType: { value: 'mouse' },
	} );
	control.dispatchEvent( event );
};

describe( 'createSortableController keyboard reorder', () => {
	beforeEach( () => {
		document.body.replaceChildren();
		document.head.querySelectorAll( 'style' ).forEach( ( style ) => style.remove() );
		Object.defineProperty( window, 'scrollBy', {
			configurable: true,
			value: jest.fn(),
		} );
		ensureSortableRuntimeMock.mockReset();
		ensureSortableRuntimeMock.mockResolvedValue( createRuntime() );
	} );

	it( 'starts, moves, and commits from the focused row control', () => {
		const { context, tbody } = createContext();
		const onCommit = jest.fn();
		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: [],
			interactionMode: 'hover',
			nonMovableRowIndices: [],
			onCommit,
			rows: [ 'a', 'b', 'c', 'd' ],
			runtimeUrl: '/sortable.js',
		} );
		const control = getControl( tbody, 1 );
		control.focus();

		expect( pressKey( control, 'Enter' ).defaultPrevented ).toBe( true );
		expect( pressKey( control, 'ArrowDown' ).defaultPrevented ).toBe( true );
		expect( pressKey( control, ' ' ).defaultPrevented ).toBe( true );

		expect( onCommit ).toHaveBeenCalledTimes( 1 );
		expect( onCommit ).toHaveBeenCalledWith( [ 'a', 'c', 'b', 'd' ], 2 );
		controller.destroy();
	} );

	it( 'skips forbidden rowspan insertion positions', () => {
		const { context, tbody } = createContext();
		const onCommit = jest.fn();
		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: [ 2 ],
			interactionMode: 'hover',
			nonMovableRowIndices: [ 1 ],
			onCommit,
			rows: [ 'a', 'b', 'c', 'd' ],
			runtimeUrl: '/sortable.js',
		} );
		const control = getControl( tbody, 0 );
		control.focus();

		pressKey( control, 'Enter' );
		pressKey( control, 'ArrowDown' );
		pressKey( control, 'Enter' );

		expect( onCommit ).toHaveBeenCalledWith( [ 'b', 'c', 'a', 'd' ], 2 );
		controller.destroy();
	} );

	it( 'does not commit when confirmed at the original position', () => {
		const { context, tbody } = createContext();
		const onCommit = jest.fn();
		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: [],
			interactionMode: 'hover',
			nonMovableRowIndices: [],
			onCommit,
			rows: [ 'a', 'b', 'c', 'd' ],
			runtimeUrl: '/sortable.js',
		} );
		const control = getControl( tbody, 2 );
		control.focus();

		pressKey( control, 'Enter' );
		pressKey( control, 'Enter' );

		expect( onCommit ).not.toHaveBeenCalled();
		expect( tbody.ownerDocument.activeElement ).toBe( control );
		controller.destroy();
	} );

	it( 'cancels without commit and keeps focus on the starting control', () => {
		const { context, tbody } = createContext();
		const onCommit = jest.fn();
		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: [],
			interactionMode: 'hover',
			nonMovableRowIndices: [],
			onCommit,
			rows: [ 'a', 'b', 'c', 'd' ],
			runtimeUrl: '/sortable.js',
		} );
		const control = getControl( tbody, 1 );
		control.focus();

		pressKey( control, ' ' );
		pressKey( control, 'ArrowDown' );
		pressKey( control, 'Escape' );

		expect( onCommit ).not.toHaveBeenCalled();
		expect( tbody.ownerDocument.activeElement ).toBe( control );
		controller.destroy();
	} );

	it( 'keeps Tab and Shift+Tab on the active control until the session ends', () => {
		const { context, tbody } = createContext();
		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: [],
			interactionMode: 'hover',
			nonMovableRowIndices: [],
			onCommit: jest.fn(),
			rows: [ 'a', 'b', 'c', 'd' ],
			runtimeUrl: '/sortable.js',
		} );
		const control = getControl( tbody, 1 );
		control.focus();
		pressKey( control, 'Enter' );

		expect( pressKey( control, 'Tab' ).defaultPrevented ).toBe( true );
		expect( pressKey( control, 'Tab', true ).defaultPrevented ).toBe( true );
		expect( tbody.ownerDocument.activeElement ).toBe( control );
		controller.destroy();
	} );

	it( 'ignores pointer start while a keyboard session is active', () => {
		const { context, tbody } = createContext();
		const onCommit = jest.fn();
		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: [],
			interactionMode: 'hover',
			nonMovableRowIndices: [],
			onCommit,
			rows: [ 'a', 'b', 'c', 'd' ],
			runtimeUrl: '/sortable.js',
		} );
		const control = getControl( tbody, 1 );
		control.focus();
		pressKey( control, 'Enter' );
		const guidance = document.querySelector( '.yamabiko-table-reorder-pointer-guidance' );
		const pointerControl = getControl( tbody, 2 );
		expect( guidance ).not.toBeNull();

		pointerDownPointerControl( pointerControl );
		clickPointerControl( pointerControl );

		expect( control.getAttribute( 'aria-pressed' ) ).toBe( 'true' );
		expect( document.querySelector( '.yamabiko-table-reorder-pointer-guidance' ) ).toBe( guidance );
		expect( document.querySelector( '.yamabiko-table-reorder-destination' ) ).toBeNull();
		expect( tbody.ownerDocument.activeElement ).toBe( control );
		pressKey( control, 'ArrowDown' );
		pressKey( control, 'Enter' );
		expect( onCommit ).toHaveBeenCalledWith( [ 'a', 'c', 'b', 'd' ], 2 );
		controller.destroy();
	} );

	it( 'ignores keyboard start while a drag is active', async () => {
		const runtimeOptionsRef: { current: RuntimeOptions | null } = { current: null };
		ensureSortableRuntimeMock.mockResolvedValue(
			createRuntime( ( options ) => {
				runtimeOptionsRef.current = options;
			} )
		);
		const { context, tbody } = createContext();
		const onCommit = jest.fn();
		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: [],
			interactionMode: 'hover',
			nonMovableRowIndices: [],
			onCommit,
			rows: [ 'a', 'b', 'c', 'd' ],
			runtimeUrl: '/sortable.js',
		} );
		await Promise.resolve();
		const runtimeOptions = runtimeOptionsRef.current;
		const control = getControl( tbody, 1 );
		if ( ! runtimeOptions ) {
			throw new Error( 'Expected Sortable runtime options' );
		}

		runtimeOptions.onStart();
		control.focus();
		pressKey( control, 'Enter' );

		expect( control.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
		expect( document.querySelector( '.yamabiko-table-reorder-pointer-guidance' ) ).toBeNull();
		expect( onCommit ).not.toHaveBeenCalled();
		runtimeOptions.onEnd( { oldIndex: 1, newIndex: 1 } );
		controller.destroy();
	} );

	it( 'keeps the keyboard session through a rejected Sortable lifecycle', async () => {
		const runtimeOptionsRef: { current: RuntimeOptions | null } = { current: null };
		ensureSortableRuntimeMock.mockResolvedValue(
			createRuntime( ( options ) => {
				runtimeOptionsRef.current = options;
			} )
		);
		const { context, tbody } = createContext();
		const onCommit = jest.fn();
		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: [],
			interactionMode: 'hover',
			nonMovableRowIndices: [],
			onCommit,
			rows: [ 'a', 'b', 'c', 'd' ],
			runtimeUrl: '/sortable.js',
		} );
		await Promise.resolve();
		const runtimeOptions = runtimeOptionsRef.current;
		const control = getControl( tbody, 1 );
		const row = tbody.rows.item( 1 );
		const related = tbody.rows.item( 2 );
		if ( ! runtimeOptions || ! row || ! related ) {
			throw new Error( 'Expected Sortable runtime options and rows' );
		}
		control.focus();
		pressKey( control, 'Enter' );
		pressKey( control, 'ArrowDown' );
		const guidance = document.querySelector( '.yamabiko-table-reorder-pointer-guidance' );
		const insertionLine = document.querySelector< HTMLDivElement >(
			'.yamabiko-table-reorder-insertion-line'
		);
		expect( guidance ).not.toBeNull();
		expect( insertionLine?.style.display ).toBe( 'block' );

		runtimeOptions.onChoose( { item: row } );
		runtimeOptions.onStart();
		expect(
			runtimeOptions.onMove( { related, willInsertAfter: true }, new Event( 'pointermove' ) )
		).toBe( false );
		runtimeOptions.onUnchoose();
		runtimeOptions.onEnd( { oldIndex: 1, newIndex: 2 } );

		expect( onCommit ).not.toHaveBeenCalled();
		expect( control.getAttribute( 'aria-pressed' ) ).toBe( 'true' );
		expect( document.querySelector( '.yamabiko-table-reorder-pointer-guidance' ) ).toBe( guidance );
		expect( tbody.ownerDocument.activeElement ).toBe( control );
		expect( insertionLine?.style.display ).toBe( 'block' );

		expect( pressKey( control, 'ArrowDown' ).defaultPrevented ).toBe( true );
		expect( insertionLine?.style.display ).toBe( 'block' );
		expect( pressKey( control, 'Escape' ).defaultPrevented ).toBe( true );
		expect( control.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
		expect( document.querySelector( '.yamabiko-table-reorder-pointer-guidance' ) ).toBeNull();
		expect( onCommit ).not.toHaveBeenCalled();
		controller.destroy();
	} );
} );
