import { getKeyboardActiveMessage } from '../../messages';
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
} );
