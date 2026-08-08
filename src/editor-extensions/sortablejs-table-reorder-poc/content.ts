import Sortable from 'sortablejs';

type SortableWindow = Window & {
	Sortable?: typeof Sortable;
};

( window as SortableWindow ).Sortable = Sortable;

console.info( '[Yamabiko SortableJS PoC] Sortable runtime ready', {
	inIframe: window !== window.parent,
} );
