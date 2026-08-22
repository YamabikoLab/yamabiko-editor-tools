import {
	getKeyboardActiveMessage,
	getPcPointerActiveMessage,
	getTouchModeMessage,
	getTouchPointerActiveMessage,
} from '../../messages';
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
	const tableRect = jest
		.spyOn( table, 'getBoundingClientRect' )
		.mockReturnValue( createRect( 100, 300 ) );
	return { table, tableRect, tbody };
};

const makeScrollable = ( element: HTMLElement, top = 100, bottom = 500 ) => {
	element.style.overflowY = 'auto';
	Object.defineProperty( element, 'clientHeight', {
		configurable: true,
		value: bottom - top,
	} );
	Object.defineProperty( element, 'scrollHeight', {
		configurable: true,
		value: bottom - top + 500,
	} );
	jest.spyOn( element, 'getBoundingClientRect' ).mockReturnValue( createRect( top, bottom ) );
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

describe( 'reorder-guidance', () => {
	beforeEach( () => {
		document.body.replaceChildren();
	} );

	it( 'creates and cleans up an inline operation guidance', () => {
		const { tbody } = createTable();
		const guidance = createReorderGuidance( document, tbody, 'Keyboard guidance' );

		expect( guidance.element.textContent ).toBe( 'Keyboard guidance' );
		guidance.setHidden( true );
		expect( guidance.element.classList.contains( 'is-hidden' ) ).toBe( true );
		guidance.cleanup();
		expect( guidance.element.isConnected ).toBe( false );
	} );

	it( 'adds a decorative WordPress icon for a known guidance message', () => {
		const { tbody } = createTable();
		const guidance = createReorderGuidance( document, tbody, getKeyboardActiveMessage() );
		const icon = guidance.element.querySelector( '.yamabiko-table-reorder-guidance-icon' );

		expect( icon?.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
		guidance.cleanup();
	} );

	it.each( [ getKeyboardActiveMessage(), getPcPointerActiveMessage() ] )(
		'places PC and keyboard guidance below the header on the viewport right for %s',
		( message ) => {
			const { tbody } = createTable();
			const guidance = createReorderGuidance( document, tbody, message );

			expect( guidance.element.style.left ).toBe( '' );
			expect( guidance.element.style.right ).toBe( '8px' );
			expect( guidance.element.style.top ).toBe( '64px' );
			guidance.cleanup();
		}
	);

	it.each( [ getTouchModeMessage(), getTouchPointerActiveMessage() ] )(
		'keeps touch guidance on the left for %s',
		( message ) => {
			const { tbody } = createTable();
			const guidance = createReorderGuidance( document, tbody, message );

			expect( guidance.element.style.left ).not.toBe( '' );
			expect( guidance.element.style.right ).toBe( '' );
			guidance.cleanup();
		}
	);

	it( 'hides guidance when the table leaves the viewport and shows it again when it returns', () => {
		const { tableRect, tbody } = createTable();
		const guidance = createReorderGuidance( document, tbody, getPcPointerActiveMessage() );

		expect( guidance.element.classList.contains( 'is-hidden' ) ).toBe( false );

		tableRect.mockReturnValue( createRect( window.innerHeight + 20, window.innerHeight + 220 ) );
		window.dispatchEvent( new Event( 'scroll' ) );
		expect( guidance.element.classList.contains( 'is-hidden' ) ).toBe( true );

		tableRect.mockReturnValue( createRect( 120, 320 ) );
		window.dispatchEvent( new Event( 'scroll' ) );
		expect( guidance.element.classList.contains( 'is-hidden' ) ).toBe( false );

		guidance.cleanup();
	} );

	it( 'uses the visible scroll container intersection for table visibility', () => {
		const container = document.createElement( 'div' );
		document.body.append( container );
		makeScrollable( container, 100, window.innerHeight + 7000 );
		const { table, tableRect, tbody } = createTable();
		container.append( table );
		tableRect.mockReturnValue( createRect( 150, 350 ) );
		const guidance = createReorderGuidance( document, tbody, getTouchPointerActiveMessage() );

		expect( guidance.element.style.top ).toBe( `${ window.innerHeight - 8 }px` );
		expect( guidance.element.classList.contains( 'is-hidden' ) ).toBe( false );

		tableRect.mockReturnValue( createRect( 20, 80 ) );
		window.dispatchEvent( new Event( 'scroll' ) );
		expect( guidance.element.classList.contains( 'is-hidden' ) ).toBe( true );

		guidance.cleanup();
	} );

	it( 'keeps explicitly hidden guidance hidden after the table returns to the viewport', () => {
		const { tableRect, tbody } = createTable();
		const guidance = createReorderGuidance( document, tbody, getTouchModeMessage() );

		guidance.setHidden( true );
		tableRect.mockReturnValue( createRect( window.innerHeight + 20, window.innerHeight + 220 ) );
		window.dispatchEvent( new Event( 'scroll' ) );
		tableRect.mockReturnValue( createRect( 120, 320 ) );
		window.dispatchEvent( new Event( 'scroll' ) );

		expect( guidance.element.classList.contains( 'is-hidden' ) ).toBe( true );
		guidance.cleanup();
	} );

	it.each( [ getTouchModeMessage(), getTouchPointerActiveMessage() ] )(
		'moves touch guidance near the pointer and switches sides with swipe direction for %s',
		( message ) => {
			const { tbody } = createTable();
			const guidance = createReorderGuidance( document, tbody, message );
			const bottomPosition = `${ window.innerHeight - 8 }px`;

			expect( guidance.element.style.top ).toBe( bottomPosition );

			dispatchTouchPointer( 'pointerdown', 1, 108 );
			expect( guidance.element.style.top ).toBe( '124px' );

			dispatchTouchPointer( 'pointermove', 1, 102 );
			expect( guidance.element.style.top ).toBe( '118px' );

			dispatchTouchPointer( 'pointermove', 1, 100 );
			expect( guidance.element.style.top ).toBe( '84px' );

			dispatchTouchPointer( 'pointerup', 1, 100 );
			expect( guidance.element.style.top ).toBe( '84px' );

			dispatchTouchPointer( 'pointerdown', 2, 100 );
			expect( guidance.element.style.top ).toBe( '84px' );

			dispatchTouchPointer( 'pointermove', 2, 106 );
			expect( guidance.element.style.top ).toBe( '90px' );

			dispatchTouchPointer( 'pointermove', 2, 108 );
			expect( guidance.element.style.top ).toBe( '124px' );

			guidance.cleanup();
		}
	);

	it( 'uses the focused control as the initial anchor for touch pointer guidance', () => {
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
