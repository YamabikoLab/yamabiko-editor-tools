import { expect, test } from '@wordpress/e2e-test-utils-playwright';

const tableRows = Array.from(
	{ length: 30 },
	( _, index ) => `<tr><td>Row ${ index + 1 }</td><td>Content</td></tr>`
).join( '' );

test( 'shows table reorder instructions directly before the table', async ( {
	admin,
	editor,
	page,
} ) => {
	await admin.createNewPost();
	await editor.setContent( `
		<!-- wp:table -->
		<figure class="wp-block-table"><table><tbody>${ tableRows }</tbody></table></figure>
		<!-- /wp:table -->
	` );

	const tableBlock = editor.canvas.locator( '[data-type="core/table"]' );
	await editor.selectBlocks( tableBlock );
	await editor.showBlockToolbar();
	await page.getByRole( 'button', { name: '行を並べ替え' } ).click();

	const instructions = editor.canvas.locator(
		'.yamabiko-editor-tools-table-reorder__instructions'
	);
	await expect( instructions ).toBeVisible();

	const isDirectlyBeforeTable = await instructions.evaluate( ( element ) =>
		Boolean( element.nextElementSibling?.querySelector( 'table' ) )
	);
	expect( isDirectlyBeforeTable ).toBe( true );

	const isInViewport = await instructions.evaluate( ( element ) => {
		const bounds = element.getBoundingClientRect();
		const view = element.ownerDocument.defaultView;

		return view !== null && bounds.top >= 0 && bounds.bottom <= view.innerHeight;
	} );
	expect( isInViewport ).toBe( true );

	await expect( instructions ).toHaveText(
		'ドラッグで移動　Enter / Space: 開始・確定　↑↓: 移動　Esc: キャンセル'
	);
} );
