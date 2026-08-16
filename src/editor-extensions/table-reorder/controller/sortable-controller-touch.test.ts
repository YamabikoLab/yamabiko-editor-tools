import { createSortableController } from './sortable-controller';
import {
	createSortableRuntime as createRuntime,
	createTableContext as createContext,
	type SortableRuntime,
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

type TouchSortableOptions = {
	delay?: number;
	draggable: string;
	handle?: string;
	touchStartThreshold?: number;
};

describe( 'createSortableController touch handle DnD', () => {
	beforeEach( () => {
		document.body.replaceChildren();
		ensureSortableRuntimeMock.mockReset();
	} );

	it( 'uses the shared row control as the touch drag handle without long-press settings', async () => {
		const runtime = createRuntime();
		ensureSortableRuntimeMock.mockResolvedValue( runtime );
		const { context, tbody } = createContext( 2 );
		for ( const row of Array.from( tbody.rows ) ) {
			const cell = row.cells.item( 0 );
			if ( cell ) {
				cell.contentEditable = 'true';
			}
		}
		const firstCell = tbody.rows.item( 0 )?.cells.item( 0 );
		if ( ! firstCell ) {
			throw new Error( 'Expected first table cell' );
		}

		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: [],
			interactionMode: 'touch',
			nonMovableRowIndices: [],
			onCommit: jest.fn(),
			rows: [ 'a', 'b' ],
			runtimeUrl: '/sortable.js',
		} );
		await Promise.resolve();

		const createMock = runtime.create as jest.MockedFunction< SortableRuntime[ 'create' ] >;
		const capturedOptions = createMock.mock.calls[ 0 ]?.[ 1 ] as TouchSortableOptions | undefined;
		if ( ! capturedOptions ) {
			throw new Error( 'Expected SortableJS options to be created' );
		}

		expect( capturedOptions ).toMatchObject( {
			draggable: 'tr',
			handle: '.yamabiko-table-reorder-handle-zone',
		} );
		expect( capturedOptions.delay ).toBeUndefined();
		expect( capturedOptions.touchStartThreshold ).toBeUndefined();
		expect( firstCell.style.pointerEvents ).toBe( '' );
		expect( tbody.style.userSelect ).toBe( '' );

		controller.destroy();
	} );
} );
