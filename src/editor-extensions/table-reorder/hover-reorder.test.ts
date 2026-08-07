import { enableTableHoverReorder } from './hover-reorder';

type MediaQueryListener = ( event: MediaQueryListEvent ) => void;

const createMatchMedia = ( matches: boolean ) => {
	const listeners = new Set< MediaQueryListener >();
	const mediaQueryList = {
		matches,
		media: '(hover: hover) and (pointer: fine)',
		onchange: null,
		addEventListener: ( _type: string, listener: MediaQueryListener ) => listeners.add( listener ),
		removeEventListener: ( _type: string, listener: MediaQueryListener ) => listeners.delete( listener ),
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => true,
	} as unknown as MediaQueryList;

	return { mediaQueryList, listeners };
};

const dispatchPointerEvent = (
	target: EventTarget,
	type: string,
	{ buttons = 0, pointerType = 'mouse' }: { buttons?: number; pointerType?: string } = {}
) => {
	const event = new Event( type, { bubbles: true } ) as PointerEvent;
	Object.defineProperties( event, {
		buttons: { value: buttons },
		pointerType: { value: pointerType },
	} );
	target.dispatchEvent( event );
};

describe( 'enableTableHoverReorder', () => {
	beforeEach( () => {
		document.body.innerHTML = '<div><table><tbody><tr><td>Cell</td></tr></tbody></table></div>';
	} );

	it( 'activates for mouse hover on a hover-capable device', () => {
		const { mediaQueryList } = createMatchMedia( true );
		Object.defineProperty( window, 'matchMedia', {
			configurable: true,
			value: () => mediaQueryList,
		} );
		const blockElement = document.body.firstElementChild as HTMLElement;
		const table = blockElement.querySelector( 'table' )!;
		const onActiveChange = jest.fn();
		const disable = enableTableHoverReorder( blockElement, table, onActiveChange );

		dispatchPointerEvent( table, 'pointerenter' );

		expect( onActiveChange ).toHaveBeenCalledWith( true );
		disable();
	} );

	it( 'does not activate for touch pointers', () => {
		const { mediaQueryList } = createMatchMedia( true );
		Object.defineProperty( window, 'matchMedia', {
			configurable: true,
			value: () => mediaQueryList,
		} );
		const blockElement = document.body.firstElementChild as HTMLElement;
		const table = blockElement.querySelector( 'table' )!;
		const onActiveChange = jest.fn();

		enableTableHoverReorder( blockElement, table, onActiveChange );
		dispatchPointerEvent( table, 'pointerenter', { pointerType: 'touch' } );

		expect( onActiveChange ).not.toHaveBeenCalledWith( true );
	} );

	it( 'deactivates when the mouse leaves without dragging', () => {
		const { mediaQueryList } = createMatchMedia( true );
		Object.defineProperty( window, 'matchMedia', {
			configurable: true,
			value: () => mediaQueryList,
		} );
		const blockElement = document.body.firstElementChild as HTMLElement;
		const table = blockElement.querySelector( 'table' )!;
		const onActiveChange = jest.fn();

		enableTableHoverReorder( blockElement, table, onActiveChange );
		dispatchPointerEvent( table, 'pointerenter' );
		dispatchPointerEvent( blockElement, 'pointerleave' );

		expect( onActiveChange ).toHaveBeenLastCalledWith( false );
	} );

	it( 'keeps hover reorder active while a mouse button is held', () => {
		const { mediaQueryList } = createMatchMedia( true );
		Object.defineProperty( window, 'matchMedia', {
			configurable: true,
			value: () => mediaQueryList,
		} );
		const blockElement = document.body.firstElementChild as HTMLElement;
		const table = blockElement.querySelector( 'table' )!;
		const onActiveChange = jest.fn();

		enableTableHoverReorder( blockElement, table, onActiveChange );
		dispatchPointerEvent( table, 'pointerenter' );
		dispatchPointerEvent( blockElement, 'pointerleave', { buttons: 1 } );

		expect( onActiveChange ).not.toHaveBeenLastCalledWith( false );
	} );

	it( 'does not activate when hover is unavailable', () => {
		const { mediaQueryList } = createMatchMedia( false );
		Object.defineProperty( window, 'matchMedia', {
			configurable: true,
			value: () => mediaQueryList,
		} );
		const blockElement = document.body.firstElementChild as HTMLElement;
		const table = blockElement.querySelector( 'table' )!;
		const onActiveChange = jest.fn();

		enableTableHoverReorder( blockElement, table, onActiveChange );
		dispatchPointerEvent( table, 'pointerenter' );

		expect( onActiveChange ).not.toHaveBeenCalled();
	} );
} );
