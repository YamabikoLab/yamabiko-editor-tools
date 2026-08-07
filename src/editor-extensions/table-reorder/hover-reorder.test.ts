import { enableTableHoverReorder } from './hover-reorder';

type MediaQueryListener = ( event: MediaQueryListEvent ) => void;

const createMatchMedia = ( matches: boolean ) => {
	const mediaQueryList = {
		matches,
		media: '(hover: hover) and (pointer: fine)',
		onchange: null,
		addEventListener: jest.fn(),
		removeEventListener: jest.fn(),
		addListener: jest.fn(),
		removeListener: jest.fn(),
		dispatchEvent: jest.fn( () => true ),
	} as unknown as MediaQueryList;

	return mediaQueryList;
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
		document.body.innerHTML = [
			'<div data-block="table-1"><table><tbody><tr><td>Cell</td></tr></tbody></table></div>',
			'<button class="yamabiko-editor-tools-table-reorder-content__handle"',
			' aria-describedby="yamabiko-editor-tools-table-reorder-table-1-instructions"></button>',
			'<div id="outside"></div>',
		].join( '' );
	} );

	const setup = ( matches = true ) => {
		const mediaQueryList = createMatchMedia( matches );
		Object.defineProperty( window, 'matchMedia', {
			configurable: true,
			value: () => mediaQueryList,
		} );
		const blockElement = document.querySelector< HTMLElement >( '[data-block="table-1"]' )!;
		const table = blockElement.querySelector< HTMLTableElement >( 'table' )!;
		const handle = document.querySelector< HTMLButtonElement >(
			'.yamabiko-editor-tools-table-reorder-content__handle'
		)!;
		const outside = document.querySelector< HTMLElement >( '#outside' )!;
		const onActiveChange = jest.fn();
		const disable = enableTableHoverReorder( blockElement, table, onActiveChange );

		return { disable, handle, onActiveChange, outside, table };
	};

	it( 'activates for mouse hover on a hover-capable device', () => {
		const { disable, onActiveChange, table } = setup();

		dispatchPointerEvent( table, 'pointerenter' );

		expect( onActiveChange ).toHaveBeenCalledWith( true );
		disable();
	} );

	it( 'does not activate for touch pointers', () => {
		const { disable, onActiveChange, table } = setup();

		dispatchPointerEvent( table, 'pointerenter', { pointerType: 'touch' } );

		expect( onActiveChange ).not.toHaveBeenCalled();
		disable();
	} );

	it( 'stays active while the pointer moves from the table to its handle', () => {
		const { disable, handle, onActiveChange, table } = setup();
		dispatchPointerEvent( table, 'pointerenter' );

		dispatchPointerEvent( handle, 'pointermove' );

		expect( onActiveChange ).toHaveBeenCalledTimes( 1 );
		disable();
	} );

	it( 'deactivates after moving outside the table and its handles', () => {
		const { disable, onActiveChange, outside, table } = setup();
		dispatchPointerEvent( table, 'pointerenter' );

		dispatchPointerEvent( outside, 'pointermove' );

		expect( onActiveChange ).toHaveBeenLastCalledWith( false );
		disable();
	} );

	it( 'keeps hover reorder active while a mouse button is held', () => {
		const { disable, onActiveChange, outside, table } = setup();
		dispatchPointerEvent( table, 'pointerenter' );

		dispatchPointerEvent( outside, 'pointermove', { buttons: 1 } );

		expect( onActiveChange ).toHaveBeenCalledTimes( 1 );
		disable();
	} );

	it( 'does not activate when hover is unavailable', () => {
		const { disable, onActiveChange, table } = setup( false );

		dispatchPointerEvent( table, 'pointerenter' );

		expect( onActiveChange ).not.toHaveBeenCalled();
		disable();
	} );
} );
