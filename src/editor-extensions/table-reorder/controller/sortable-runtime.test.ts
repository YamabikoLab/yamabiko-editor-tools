import { ensureSortableRuntime } from './sortable-runtime';

type SortableRuntime = NonNullable< Awaited< ReturnType< typeof ensureSortableRuntime > > >;
type TestSortableWindow = Window & {
	Sortable?: SortableRuntime;
};

const getSortableWindow = (): TestSortableWindow => window as TestSortableWindow;
const getRuntimeScripts = () =>
	Array.from( document.querySelectorAll< HTMLScriptElement >( 'script' ) ).filter(
		( script ) => script.getAttribute( 'src' ) === '/sortable.js'
	);

const createRuntime = (): SortableRuntime => ( {
	create: jest.fn( () => ( { destroy: jest.fn() } ) ),
} );

describe( 'ensureSortableRuntime', () => {
	beforeEach( () => {
		delete getSortableWindow().Sortable;
		for ( const script of getRuntimeScripts() ) {
			script.remove();
		}
	} );

	it( 'reuses an existing runtime without inserting a script', async () => {
		const runtime = createRuntime();
		getSortableWindow().Sortable = runtime;

		await expect( ensureSortableRuntime( document, window, '/sortable.js' ) ).resolves.toBe(
			runtime
		);
		expect( getRuntimeScripts() ).toHaveLength( 0 );
	} );

	it( 'reuses the same loading state while the runtime script is loading', async () => {
		const first = ensureSortableRuntime( document, window, '/sortable.js' );
		const second = ensureSortableRuntime( document, window, '/sortable.js' );
		const script = getRuntimeScripts()[ 0 ];
		const runtime = createRuntime();

		expect( second ).toBe( first );
		expect( getRuntimeScripts() ).toHaveLength( 1 );
		expect( script ).toBeInstanceOf( HTMLScriptElement );

		getSortableWindow().Sortable = runtime;
		script?.dispatchEvent( new Event( 'load' ) );

		await expect( first ).resolves.toBe( runtime );
		await expect( second ).resolves.toBe( runtime );
	} );

	it( 'returns null and removes the script when loading fails', async () => {
		const loading = ensureSortableRuntime( document, window, '/sortable.js' );
		const script = getRuntimeScripts()[ 0 ];

		expect( script ).toBeInstanceOf( HTMLScriptElement );
		script?.dispatchEvent( new Event( 'error' ) );

		await expect( loading ).resolves.toBeNull();
		expect( getRuntimeScripts() ).toHaveLength( 0 );
	} );
} );
