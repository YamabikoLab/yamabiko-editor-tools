import { getTouchPointerActiveMessage } from '../../messages';
import { createReorderGuidance } from './reorder-guidance';

const createRect = ( top: number, bottom: number, left = 0, width = 400 ): DOMRect =>
	( {
		bottom,
		height: bottom - top,
		left,
		right: left + width,
		top,
		width,
		x: left,
		y: top,
		toJSON: () => ( {} ),
	} ) as DOMRect;

const createTable = () => {
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	const row = document.createElement( 'tr' );
	const cell = document.createElement( 'td' );
	cell.textContent = 'Alpha';
	row.append( cell );
	tbody.append( row );
	table.append( tbody );
	document.body.append( table );
	jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue( createRect( 100, 300 ) );
	return { table, tbody };
};

const dispatchTouchPointer = ( type: string, pointerId: number, clientY: number ) => {
	const event = new Event( type, { bubbles: true } );
	Object.defineProperties( event, {
		clientY: { value: clientY },
		pointerId: { value: pointerId },
		pointerType: { value: 'touch' },
	} );
	document.dispatchEvent( event );
};

describe( 'reorder-guidance touch pointer positioning', () => {
	beforeEach( () => {
		document.body.replaceChildren();
	} );

	it( 'keeps guidance inside the browser viewport when a scroll container extends beyond it', () => {
		const container = document.createElement( 'div' );
		container.style.overflowY = 'auto';
		Object.defineProperty( container, 'clientHeight', { configurable: true, value: 7000 } );
		Object.defineProperty( container, 'scrollHeight', { configurable: true, value: 7500 } );
		jest
			.spyOn( container, 'getBoundingClientRect' )
			.mockReturnValue( createRect( 100, window.innerHeight + 7000 ) );
		document.body.append( container );
		const { table, tbody } = createTable();
		container.append( table );

		const guidance = createReorderGuidance( document, tbody, getTouchPointerActiveMessage() );

		expect( guidance.element.style.top ).toBe( `${ window.innerHeight - 8 }px` );
		expect( guidance.element.classList.contains( 'is-hidden' ) ).toBe( false );
		guidance.cleanup();
	} );

	it( 'follows the touch pointer and switches between its lower and upper side', () => {
		const { tbody } = createTable();
		const guidance = createReorderGuidance( document, tbody, getTouchPointerActiveMessage() );

		dispatchTouchPointer( 'pointerdown', 1, 108 );
		expect( guidance.element.style.top ).toBe( '124px' );

		dispatchTouchPointer( 'pointermove', 1, 102 );
		expect( guidance.element.style.top ).toBe( '118px' );

		dispatchTouchPointer( 'pointermove', 1, 100 );
		expect( guidance.element.style.top ).toBe( '84px' );

		dispatchTouchPointer( 'pointerdown', 2, 100 );
		dispatchTouchPointer( 'pointermove', 2, 108 );
		expect( guidance.element.style.top ).toBe( '124px' );

		guidance.cleanup();
	} );

	it( 'uses the focused control as the initial touch anchor', () => {
		const { tbody } = createTable();
		const control = document.createElement( 'button' );
		document.body.append( control );
		jest.spyOn( control, 'getBoundingClientRect' ).mockReturnValue( createRect( 200, 240 ) );
		control.focus();

		const guidance = createReorderGuidance( document, tbody, getTouchPointerActiveMessage() );

		expect( guidance.element.style.top ).toBe( '236px' );
		guidance.cleanup();
	} );
} );
