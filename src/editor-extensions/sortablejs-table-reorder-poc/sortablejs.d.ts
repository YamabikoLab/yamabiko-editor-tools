declare module 'sortablejs' {
	export type SortableEvent = {
		item: HTMLElement;
		from: HTMLElement;
		to: HTMLElement;
		oldIndex?: number;
		newIndex?: number;
		oldDraggableIndex?: number;
		newDraggableIndex?: number;
	};

	export type MoveEvent = SortableEvent & {
		dragged: HTMLElement;
		draggedRect: DOMRect;
		related: HTMLElement;
		relatedRect: DOMRect;
		willInsertAfter: boolean;
	};

	export type Options = {
		animation?: number;
		easing?: string;
		direction?: 'vertical' | 'horizontal';
		draggable?: string;
		handle?: string;
		filter?: string | ( ( event: Event, target: HTMLElement, sortable: Sortable ) => boolean );
		preventOnFilter?: boolean;
		forceFallback?: boolean;
		fallbackOnBody?: boolean;
		fallbackTolerance?: number;
		ghostClass?: string;
		chosenClass?: string;
		dragClass?: string;
		fallbackClass?: string;
		onStart?: ( event: SortableEvent ) => void;
		onMove?: ( event: MoveEvent, originalEvent: Event ) => boolean | -1 | 1 | void;
		onEnd?: ( event: SortableEvent ) => void;
	};

	export default class Sortable {
		constructor( element: HTMLElement, options?: Options );
		static create( element: HTMLElement, options?: Options ): Sortable;
		destroy(): void;
	}
}
