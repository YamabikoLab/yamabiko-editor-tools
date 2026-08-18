import {
	getKeyboardActiveMessage,
	getPcPointerActiveMessage,
	getTouchModeMessage,
	getTouchPointerActiveMessage,
} from '../../messages';
import { createReorderGuidance } from './reorder-guidance';

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
	return { tbody };
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
		expect( guidance.element.hidden ).toBe( true );
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
		'places PC and keyboard guidance on the viewport right for %s',
		( message ) => {
			const { tbody } = createTable();
			const guidance = createReorderGuidance( document, tbody, message );

			expect( guidance.element.style.left ).toBe( '' );
			expect( guidance.element.style.right ).toBe( '8px' );
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

	it.each( [ getTouchModeMessage(), getTouchPointerActiveMessage() ] )(
		'moves touch guidance with swipe direction and keeps the last position for %s',
		( message ) => {
			const { tbody } = createTable();
			const guidance = createReorderGuidance( document, tbody, message );

			expect( guidance.element.style.top ).toBe( '8px' );

			dispatchTouchPointer( 'pointerdown', 1, 100 );
			dispatchTouchPointer( 'pointermove', 1, 106 );
			expect( guidance.element.style.top ).toBe( '8px' );

			dispatchTouchPointer( 'pointermove', 1, 108 );
			expect( guidance.element.style.top ).toBe( `${ window.innerHeight - 8 }px` );

			dispatchTouchPointer( 'pointerup', 1, 108 );
			expect( guidance.element.style.top ).toBe( `${ window.innerHeight - 8 }px` );

			dispatchTouchPointer( 'pointerdown', 2, 108 );
			dispatchTouchPointer( 'pointermove', 2, 102 );
			expect( guidance.element.style.top ).toBe( `${ window.innerHeight - 8 }px` );

			dispatchTouchPointer( 'pointermove', 2, 100 );
			expect( guidance.element.style.top ).toBe( '8px' );

			guidance.cleanup();
		}
	);
} );
