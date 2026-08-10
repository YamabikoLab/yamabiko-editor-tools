import {
	ensureSortableRuntime,
	SORTABLE_SCRIPT_ID,
	type SortableRuntime,
} from './sortable-runtime';

type TestSortableWindow = Window & {
	Sortable?: SortableRuntime;
};

const getSortableWindow = (): TestSortableWindow => window as TestSortableWindow;

const createRuntime = (): SortableRuntime => ( {
	create: jest.fn( () => ( { destroy: jest.fn() } ) ),
} );

describe( 'ensureSortableRuntime', () => {
	beforeEach( () => {
		delete getSortableWindow().Sortable;
		document.getElementById( SORTABLE_SCRIPT_ID )?.remove();
	} );

	it( 'reuses an existing runtime without inserting a script', async () => {
		const runtime = createRuntime();
		getSortableWindow().Sortable = runtime;

		await expect( ensureSortableRuntime( document, window, '/sortable.js' ) ).resolves.toBe(
			runtime
		);
		expect( document.getElementById( SORTABLE_SCRIPT_ID ) ).toBeNull();
	} );

	it( 'reuses the same loading state while the runtime script is loading', async () => {
		const first = ensureSortableRuntime( document, window, '/sortable.js' );
		const second = ensureSortableRuntime( document, window, '/sortable.js' );
		const script = document.getElementById( SORTABLE_SCRIPT_ID );
		const runtime = createRuntime();

		expect( second ).toBe( first );
		expect( document.querySelectorAll( `#${ SORTABLE_SCRIPT_ID }` ) ).toHaveLength( 1 );
		expect( script ).toBeInstanceOf( HTMLScriptElement );

		getSortableWindow().Sortable = runtime;
		script?.dispatchEvent( new Event( 'load' ) );

		await expect( first ).resolves.toBe( runtime );
		await expect( second ).resolves.toBe( runtime );
	} );

	it( 'returns null and removes the script when loading fails', async () => {
		const loading = ensureSortableRuntime( document, window, '/sortable.js' );
		const script = document.getElementById( SORTABLE_SCRIPT_ID );

		expect( script ).toBeInstanceOf( HTMLScriptElement );
		script?.dispatchEvent( new Event( 'error' ) );

		await expect( loading ).resolves.toBeNull();
		expect( document.getElementById( SORTABLE_SCRIPT_ID ) ).toBeNull();
	} );
} );
