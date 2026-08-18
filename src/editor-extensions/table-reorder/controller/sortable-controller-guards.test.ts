import { createSortableController } from './sortable-controller';
import {
	createSortableRuntime as createRuntime,
	createTableContext as createContext,
	getRowControl as getControl,
} from './sortable-controller.test-utils';
import { ensureSortableRuntime } from './sortable-runtime-loader';

jest.mock( '@wordpress/components', () => ( {
	Tooltip: ( { children }: { children: unknown } ) => children,
} ) );

jest.mock( './sortable-runtime-loader', () => ( {
	ensureSortableRuntime: jest.fn(),
} ) );

const ensureSortableRuntimeMock = ensureSortableRuntime as jest.MockedFunction<
	typeof ensureSortableRuntime
>;

type RuntimeOptions = {
	onChoose: ( event: { item: HTMLElement } ) => void;
	onEnd: ( event: { oldIndex?: number; newIndex?: number } ) => void;
	onMove: ( event: { related: HTMLElement; willInsertAfter: boolean } ) => boolean | void;
	onStart: () => void;
};

const getRuntimeOptions = async () => {
	const runtimeOptionsRef: { current: RuntimeOptions | null } = { current: null };
	ensureSortableRuntimeMock.mockResolvedValue(
		createRuntime< RuntimeOptions >( ( options ) => {
			runtimeOptionsRef.current = options;
		} )
	);
	const { context, tbody } = createContext();
	const onCommit = jest.fn();
	const controller = createSortableController( {
		context,
		forbiddenInsertionIndices: [ 2 ],
		interactionMode: 'hover',
		nonMovableRowIndices: [],
		onCommit,
		rows: [ 'a', 'b', 'c', 'd' ],
		runtimeUrl: '/sortable.js',
	} );
	await Promise.resolve();
	if ( ! runtimeOptionsRef.current ) {
		throw new Error( 'Expected Sortable runtime options' );
	}
	return { controller, onCommit, runtimeOptions: runtimeOptionsRef.current, tbody };
};

describe( 'createSortableController guard branches', () => {
	beforeEach( () => {
		document.body.replaceChildren();
		document.head.querySelectorAll( 'style' ).forEach( ( style ) => style.remove() );
		Object.defineProperty( window, 'scrollBy', {
			configurable: true,
			value: jest.fn(),
		} );
		ensureSortableRuntimeMock.mockReset();
	} );

	it( 'does not create SortableJS when the runtime is unavailable', async () => {
		ensureSortableRuntimeMock.mockResolvedValue( null );
		const { context } = createContext();
		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: [],
			interactionMode: 'hover',
			nonMovableRowIndices: [],
			onCommit: jest.fn(),
			rows: [ 'a', 'b', 'c', 'd' ],
			runtimeUrl: '/sortable.js',
		} );

		await Promise.resolve();

		expect( ensureSortableRuntimeMock ).toHaveBeenCalledTimes( 1 );
		controller.destroy();
	} );

	it( 'rejects drag movement before a drag session starts', async () => {
		const { controller, runtimeOptions, tbody } = await getRuntimeOptions();
		const related = tbody.rows.item( 1 );
		if ( ! related ) {
			throw new Error( 'Expected related row' );
		}

		expect( runtimeOptions.onMove( { related, willInsertAfter: false } ) ).toBe( false );
		expect(
			document.querySelector< HTMLDivElement >( '.yamabiko-table-reorder-insertion-line' )?.style
				.display
		).toBe( 'none' );
		controller.destroy();
	} );

	it( 'rejects forbidden and unrelated drag destinations without committing', async () => {
		const { controller, onCommit, runtimeOptions, tbody } = await getRuntimeOptions();
		const draggedRow = tbody.rows.item( 0 );
		const forbiddenRelatedRow = tbody.rows.item( 1 );
		if ( ! draggedRow || ! forbiddenRelatedRow ) {
			throw new Error( 'Expected table rows' );
		}
		runtimeOptions.onChoose( { item: draggedRow } );
		runtimeOptions.onStart();

		expect(
			runtimeOptions.onMove( { related: forbiddenRelatedRow, willInsertAfter: true } )
		).toBe( false );

		const unrelated = document.createElement( 'div' );
		document.body.append( unrelated );
		expect( runtimeOptions.onMove( { related: unrelated, willInsertAfter: false } ) ).toBeUndefined();

		runtimeOptions.onEnd( { oldIndex: 0, newIndex: 0 } );
		expect( onCommit ).not.toHaveBeenCalled();
		controller.destroy();
	} );

	it( 'does not commit when drag completion lacks an index or snapshot', async () => {
		const { controller, onCommit, runtimeOptions, tbody } = await getRuntimeOptions();
		const row = tbody.rows.item( 0 );
		if ( ! row ) {
			throw new Error( 'Expected row' );
		}

		runtimeOptions.onStart();
		runtimeOptions.onEnd( { oldIndex: 0, newIndex: 1 } );
		expect( onCommit ).not.toHaveBeenCalled();

		runtimeOptions.onChoose( { item: row } );
		runtimeOptions.onStart();
		runtimeOptions.onEnd( { oldIndex: 0 } );
		expect( onCommit ).not.toHaveBeenCalled();
		controller.destroy();
	} );

	it( 'returns false for an invalid focus row and tolerates repeated destroy', async () => {
		ensureSortableRuntimeMock.mockResolvedValue( createRuntime() );
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
		await Promise.resolve();

		expect( controller.focusRowControlAt( -1 ) ).toBe( false );
		expect( controller.focusRowControlAt( 99 ) ).toBe( false );
		expect( controller.focusRowControlAt( 1 ) ).toBe( true );
		expect( tbody.ownerDocument.activeElement ).toBe( getControl( tbody, 1 ) );

		controller.destroy();
		expect( () => controller.destroy() ).not.toThrow();
	} );
} );
