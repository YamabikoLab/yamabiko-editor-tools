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

type TouchSortableOptions = {
	delay?: number;
	draggable: string;
	handle?: string;
	touchStartThreshold?: number;
};

const createContext = () => {
	const blockElement = document.createElement( 'div' );
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	table.append( tbody );
	blockElement.append( table );
	document.body.append( blockElement );

	for ( let index = 0; index < 2; index++ ) {
		const row = document.createElement( 'tr' );
		const cell = document.createElement( 'td' );
		cell.contentEditable = 'true';
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

describe( 'createSortableController touch handle DnD', () => {
	beforeEach( () => {
		document.body.replaceChildren();
		ensureSortableRuntimeMock.mockReset();
	} );

	it( 'uses the shared row control as the touch drag handle without long-press settings', async () => {
		let capturedOptions: TouchSortableOptions | null = null;
		const runtime: SortableRuntime = {
			create: jest.fn( ( _element: HTMLElement, options: unknown ): SortableInstance => {
				capturedOptions = options as TouchSortableOptions;
				return { destroy: jest.fn() };
			} ),
		};
		ensureSortableRuntimeMock.mockResolvedValue( runtime );
		const { context, tbody } = createContext();
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
			onNonMovableRowLongPress: jest.fn(),
			onRequestTouchModeExit: jest.fn(),
			rows: [ 'a', 'b' ],
			runtimeUrl: '/sortable.js',
		} );
		await Promise.resolve();

		expect( capturedOptions ).toMatchObject( {
			draggable: 'tr',
			handle: '.yamabiko-table-reorder-handle-zone',
		} );
		expect( capturedOptions?.delay ).toBeUndefined();
		expect( capturedOptions?.touchStartThreshold ).toBeUndefined();
		expect( firstCell.style.pointerEvents ).toBe( '' );
		expect( tbody.style.userSelect ).toBe( '' );

		controller.destroy();
	} );
} );
