import { ensureSortableRuntime } from './sortable-runtime-loader';

type SortableRuntime = NonNullable< Awaited< ReturnType< typeof ensureSortableRuntime > > >;
type TestSortableWindow = Window & {
	Sortable?: SortableRuntime;
};

const RUNTIME_SCRIPT_ID = 'yamabiko-table-reorder-sortable-runtime';
const RUNTIME_SCRIPT_STATE_ATTRIBUTE = 'data-yamabiko-table-reorder-runtime-state';
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
		expect( script?.getAttribute( RUNTIME_SCRIPT_STATE_ATTRIBUTE ) ).toBe( 'loading' );

		getSortableWindow().Sortable = runtime;
		script?.dispatchEvent( new Event( 'load' ) );

		await expect( first ).resolves.toBe( runtime );
		await expect( second ).resolves.toBe( runtime );
		expect( script?.hasAttribute( RUNTIME_SCRIPT_STATE_ATTRIBUTE ) ).toBe( false );
	} );

	it( 'returns null and removes the script when loading fails', async () => {
		const loading = ensureSortableRuntime( document, window, '/sortable.js' );
		const script = getRuntimeScripts()[ 0 ];

		expect( script ).toBeInstanceOf( HTMLScriptElement );
		script?.dispatchEvent( new Event( 'error' ) );

		await expect( loading ).resolves.toBeNull();
		expect( getRuntimeScripts() ).toHaveLength( 0 );
	} );

	it( 'returns null and removes the script when load completes without publishing the runtime', async () => {
		const loading = ensureSortableRuntime( document, window, '/sortable.js' );
		const script = getRuntimeScripts()[ 0 ];

		expect( script ).toBeInstanceOf( HTMLScriptElement );
		script?.dispatchEvent( new Event( 'load' ) );

		await expect( loading ).resolves.toBeNull();
		expect( getRuntimeScripts() ).toHaveLength( 0 );
	} );

	it( 'waits for an existing script that is still loading', async () => {
		const script = document.createElement( 'script' );
		script.id = RUNTIME_SCRIPT_ID;
		script.src = '/sortable.js';
		script.setAttribute( RUNTIME_SCRIPT_STATE_ATTRIBUTE, 'loading' );
		document.head.append( script );

		const loading = ensureSortableRuntime( document, window, '/sortable.js' );
		const runtime = createRuntime();

		getSortableWindow().Sortable = runtime;
		script.dispatchEvent( new Event( 'load' ) );

		await expect( loading ).resolves.toBe( runtime );
		expect( script.hasAttribute( RUNTIME_SCRIPT_STATE_ATTRIBUTE ) ).toBe( false );
	} );

	it( 'recovers when an existing loading script has already published the runtime', async () => {
		const script = document.createElement( 'script' );
		script.id = RUNTIME_SCRIPT_ID;
		script.src = '/sortable.js';
		script.setAttribute( RUNTIME_SCRIPT_STATE_ATTRIBUTE, 'loading' );
		document.head.append( script );
		const runtime = createRuntime();

		const loading = ensureSortableRuntime( document, window, '/sortable.js' );
		getSortableWindow().Sortable = runtime;

		await expect( loading ).resolves.toBe( runtime );
		expect( script.hasAttribute( RUNTIME_SCRIPT_STATE_ATTRIBUTE ) ).toBe( false );
	} );

	it( 'resolves null for a stale script and allows retrying the runtime load', async () => {
		const staleScript = document.createElement( 'script' );
		staleScript.id = RUNTIME_SCRIPT_ID;
		staleScript.src = '/sortable.js';
		document.head.append( staleScript );

		// ensureSortableRuntime() がlistenerを登録する前に、
		// 既存scriptのloadが完了していた状態を再現する。
		staleScript.dispatchEvent( new Event( 'load' ) );

		const result = await Promise.race( [
			ensureSortableRuntime( document, window, '/sortable.js' ),
			new Promise< 'pending' >( ( resolve ) => {
				window.setTimeout( () => resolve( 'pending' ), 50 );
			} ),
		] );

		expect( result ).toBeNull();
		expect( staleScript.isConnected ).toBe( false );

		const retry = ensureSortableRuntime( document, window, '/sortable.js' );
		const retryScript = getRuntimeScripts()[ 0 ];
		const runtime = createRuntime();

		expect( retryScript ).toBeInstanceOf( HTMLScriptElement );
		expect( retryScript ).not.toBe( staleScript );
		expect( retryScript?.getAttribute( RUNTIME_SCRIPT_STATE_ATTRIBUTE ) ).toBe( 'loading' );

		getSortableWindow().Sortable = runtime;
		retryScript?.dispatchEvent( new Event( 'load' ) );

		await expect( retry ).resolves.toBe( runtime );
	} );
} );
