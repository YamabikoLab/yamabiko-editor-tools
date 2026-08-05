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

	it( 'does not use a full-width ancestor outside the table block', () => {
		document.body.innerHTML =
			'<div class="alignfull"><div><figure><table></table></figure></div></div>';
		const blockElement = document.body.querySelector< HTMLElement >( 'div > div' )!;
		const table = blockElement.querySelector< HTMLTableElement >( 'table' );

		enableFullWidthTableReorder( blockElement, table );

		expect( blockElement.classList.contains( fullWidthReorderClass ) ).toBe( false );
	} );

	it( 'updates the temporary class when the table alignment changes', () => {
		document.body.innerHTML = '<div><figure class="alignfull"><table></table></figure></div>';
		const blockElement = document.body.firstElementChild as HTMLElement;
		const table = blockElement.querySelector< HTMLTableElement >( 'table' );
		const tableBlock = table!.parentElement!;

		let disable = enableFullWidthTableReorder( blockElement, table );
		expect( blockElement.classList.contains( fullWidthReorderClass ) ).toBe( true );

		tableBlock.className = 'alignwide';
		disable();
		disable = enableFullWidthTableReorder( blockElement, table );
		expect( blockElement.classList.contains( fullWidthReorderClass ) ).toBe( false );

		tableBlock.removeAttribute( 'class' );
		disable();
		disable = enableFullWidthTableReorder( blockElement, table );
		expect( blockElement.classList.contains( fullWidthReorderClass ) ).toBe( false );

		tableBlock.className = 'alignfull';
		disable();
		enableFullWidthTableReorder( blockElement, table );
		expect( blockElement.classList.contains( fullWidthReorderClass ) ).toBe( true );
	} );
} );
