import Sortable from 'sortablejs';

type SortableWindow = Window & {
	Sortable?: typeof Sortable;
};

type SortableImportShape = {
	create?: unknown;
	default?: typeof Sortable;
};

const sortableImport = Sortable as unknown as SortableImportShape;
const sortableRuntime =
	typeof sortableImport.create === 'function' ? Sortable : sortableImport.default;

if ( sortableRuntime && typeof sortableRuntime.create === 'function' ) {
	( window as SortableWindow ).Sortable = sortableRuntime;
} else {
	console.warn( '[Yamabiko SortableJS PoC] Sortable runtime shape is unsupported', {
		createType: typeof sortableImport.create,
		hasDefault: Boolean( sortableImport.default ),
		importType: typeof Sortable,
	} );
}

console.info( '[Yamabiko SortableJS PoC] Sortable runtime ready', {
	available: Boolean( ( window as SortableWindow ).Sortable ),
	createType: typeof ( window as SortableWindow ).Sortable?.create,
	hasDefault: Boolean( sortableImport.default ),
	importType: typeof Sortable,
	inIframe: window !== window.parent,
} );
