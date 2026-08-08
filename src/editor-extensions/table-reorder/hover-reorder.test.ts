import { enableTableHoverReorder } from './hover-reorder';

const createMatchMedia = ( matches: boolean ) =>
	( {
		matches,
		media: '(hover: hover) and (pointer: fine)',
		onchange: null,
		addEventListener: jest.fn(),
		removeEventListener: jest.fn(),
		addListener: jest.fn(),
		removeListener: jest.fn(),
		dispatchEvent: jest.fn( () => true ),
	} ) as unknown as MediaQueryList;

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
		jest.useFakeTimers();
		document.body.innerHTML = [
			'<div data-block="table-1"><table><tbody><tr><td>Cell</td></tr></tbody></table></div>',
			'<button class="yamabiko-editor-tools-table-reorder-content__handle"',
			' aria-describedby="yamabiko-editor-tools-table-reorder-table-1-instructions"></button>',
			'<div id="outside"></div>',
		].join( '' );
	} );

	afterEach( () => {
		jest.runOnlyPendingTimers();
		jest.useRealTimers();
	} );

	const setup = ( matches = true ) => {
		const mediaQueryList = createMatchMedia( matches );
		Object.defineProperty( window, 'matchMedia', {
			configurable: true,
			value: () => mediaQueryList,
		} );
		const blockElement = document.querySelector< HTMLElement >( '[data-block="table-1"]' )!;
		const table = blockElement.querySelector< HTMLTableElement >( 'table' )!;
		const cell = table.querySelector< HTMLTableCellElement >( 'td' )!;
		const handle = document.querySelector< HTMLButtonElement >(
			'.yamabiko-editor-tools-table-reorder-content__handle'
		)!;
		const outside = document.querySelector< HTMLElement >( '#outside' )!;
		const onActiveChange = jest.fn();
		const disable = enableTableHoverReorder( blockElement, table, onActiveChange );

		return { cell, disable, handle, onActiveChange, outside, table };
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

	it( 'keeps the hover session alive while crossing the gap to its handle', () => {
		const { disable, handle, onActiveChange, outside, table } = setup();
		dispatchPointerEvent( table, 'pointerenter' );

		dispatchPointerEvent( outside, 'pointermove' );
		jest.advanceTimersByTime( 150 );
		dispatchPointerEvent( handle, 'pointermove' );
		jest.advanceTimersByTime( 300 );

		expect( onActiveChange ).toHaveBeenCalledTimes( 1 );
		expect( onActiveChange ).toHaveBeenLastCalledWith( true );
		disable();
	} );

	it( 'deactivates after the fade interval outside the table and its handles', () => {
		const { disable, onActiveChange, outside, table } = setup();
		dispatchPointerEvent( table, 'pointerenter' );

		dispatchPointerEvent( outside, 'pointermove' );
		expect( onActiveChange ).toHaveBeenCalledTimes( 1 );
		jest.advanceTimersByTime( 299 );
		expect( onActiveChange ).toHaveBeenCalledTimes( 1 );
		jest.advanceTimersByTime( 1 );

		expect( onActiveChange ).toHaveBeenLastCalledWith( false );
		disable();
	} );

	it( 'hides handles when a table cell is clicked for editing', () => {
		const { cell, disable, handle, onActiveChange, table } = setup();
		dispatchPointerEvent( table, 'pointerenter' );
		handle.classList.add( 'is-hover-reorder-handle', 'is-hover-reorder-visible' );

		dispatchPointerEvent( cell, 'pointerdown' );

		expect( handle.classList.contains( 'is-hover-reorder-visible' ) ).toBe( false );
		jest.advanceTimersByTime( 300 );
		expect( onActiveChange ).toHaveBeenLastCalledWith( false );
		disable();
	} );

	it( 'does not reactivate while the pointer remains over the table after editing starts', () => {
		const { cell, disable, onActiveChange, table } = setup();
		dispatchPointerEvent( table, 'pointerenter' );
		dispatchPointerEvent( cell, 'pointerdown' );
		jest.advanceTimersByTime( 300 );

		dispatchPointerEvent( cell, 'pointermove' );

		expect( onActiveChange ).toHaveBeenCalledTimes( 2 );
		expect( onActiveChange ).toHaveBeenLastCalledWith( false );
		disable();
	} );

	it( 'reactivates only after leaving the table and hovering it again', () => {
		const { cell, disable, onActiveChange, outside, table } = setup();
		dispatchPointerEvent( table, 'pointerenter' );
		dispatchPointerEvent( cell, 'pointerdown' );
		jest.advanceTimersByTime( 300 );

		dispatchPointerEvent( outside, 'pointermove' );
		dispatchPointerEvent( table, 'pointerenter' );

		expect( onActiveChange ).toHaveBeenLastCalledWith( true );
		disable();
	} );

	it( 'removes the visible class while fading out', () => {
		const { disable, handle, outside, table } = setup();
		dispatchPointerEvent( table, 'pointerenter' );
		handle.classList.add( 'is-hover-reorder-visible' );

		dispatchPointerEvent( outside, 'pointermove' );

		expect( handle.classList.contains( 'is-hover-reorder-handle' ) ).toBe( true );
		expect( handle.classList.contains( 'is-hover-reorder-visible' ) ).toBe( false );
		disable();
	} );

	it( 'keeps hover reorder active while a mouse button is held', () => {
		const { disable, onActiveChange, outside, table } = setup();
		dispatchPointerEvent( table, 'pointerenter' );

		dispatchPointerEvent( outside, 'pointermove', { buttons: 1 } );
		jest.advanceTimersByTime( 300 );

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
