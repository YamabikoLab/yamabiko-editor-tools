import { enableFullWidthTableReorder, fullWidthReorderClass } from './full-width';

describe( 'enableFullWidthTableReorder', () => {
	it.each( [
		[ 'the block wrapper', '<div class="alignfull"><figure><table></table></figure></div>' ],
		[ 'the table block', '<div><figure class="alignfull"><table></table></figure></div>' ],
	] )( 'adds the temporary class when align: full is on %s', ( _location, markup ) => {
		document.body.innerHTML = markup;
		const blockElement = document.body.firstElementChild as HTMLElement;
		const table = blockElement.querySelector< HTMLTableElement >( 'table' );

		const disable = enableFullWidthTableReorder( blockElement, table );

		expect( blockElement.classList.contains( fullWidthReorderClass ) ).toBe( true );
		disable();
		expect( blockElement.classList.contains( fullWidthReorderClass ) ).toBe( false );
	} );

	it( 'does not change a non-full-width table', () => {
		document.body.innerHTML = '<div><figure><table></table></figure></div>';
		const blockElement = document.body.firstElementChild as HTMLElement;
		const table = blockElement.querySelector< HTMLTableElement >( 'table' );

		enableFullWidthTableReorder( blockElement, table );

		expect( blockElement.classList.contains( fullWidthReorderClass ) ).toBe( false );
	} );
} );
