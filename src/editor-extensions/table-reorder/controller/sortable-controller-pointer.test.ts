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
	onEnd: ( event: { oldIndex?: number; newIndex?: number } ) => void;
	onStart: () => void;
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
		onNonMovableRowLongPress: jest.fn(),
		onRequestTouchModeExit: jest.fn(),
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

	it( 'suppresses the click emitted immediately after a PC drag', async () => {
		let runtimeOptions: RuntimeOptions | null = null;
		ensureSortableRuntimeMock.mockResolvedValue(
			createRuntime( ( options ) => {
				runtimeOptions = options;
			} )
		);
		const { controller, tbody } = createController( 'hover' );
		await Promise.resolve();
		const control = getControl( tbody, 1 );

		runtimeOptions?.onStart();
		runtimeOptions?.onEnd( { oldIndex: 1, newIndex: 1 } );
		clickPointerControl( control );

		expect( document.querySelector( '.yamabiko-table-reorder-destination' ) ).toBeNull();
		controller.destroy();
	} );
} );
