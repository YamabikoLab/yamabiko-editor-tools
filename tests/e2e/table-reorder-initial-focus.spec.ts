import { expect, test } from '@wordpress/e2e-test-utils-playwright';

for ( const editorMode of [ 'iframe', 'non-iframe' ] as const ) {
	test( `focuses the current body row handle when reorder mode starts in the ${ editorMode } editor`, async ( {
		admin,
		editor,
		page,
	} ) => {
		await admin.createNewPost();
		if ( editorMode === 'non-iframe' ) {
			await editor.switchToLegacyCanvas();
		}

		await editor.setContent( `
			<!-- wp:table -->
			<figure class="wp-block-table"><table><tbody>
				<tr><td>Row 1</td></tr>
				<tr><td>Row 2</td></tr>
				<tr><td>Row 3</td></tr>
			</tbody></table></figure>
			<!-- /wp:table -->
			${ editorMode === 'non-iframe' ? '<!-- wp:test/v2 /-->' : '' }
		` );

		const canvas = editorMode === 'non-iframe' ? page : editor.canvas;
		const tableBlock = canvas.locator( '[data-type="core/table"]' );
		await editor.selectBlocks( tableBlock );
		await tableBlock.locator( 'tbody tr' ).nth( 1 ).locator( 'td' ).focus();
		await editor.showBlockToolbar();
		await page.getByRole( 'button', { name: '行を並べ替え' } ).click();

		const handles = canvas.locator( '.yamabiko-editor-tools-table-reorder-content__handle' );
		await expect( handles ).toHaveCount( 3 );
		await expect( handles.nth( 1 ) ).toBeFocused();
	} );

	test( `remembers the first cell selection after reload in the ${ editorMode } editor`, async ( {
		admin,
		editor,
		page,
	} ) => {
		await admin.createNewPost();
		if ( editorMode === 'non-iframe' ) {
			await editor.switchToLegacyCanvas();
		}

		await editor.setContent( `
			<!-- wp:table -->
			<figure class="wp-block-table"><table><tbody>
				<tr><td>Row 1</td></tr>
				<tr><td>Row 2</td></tr>
				<tr><td>Row 3</td></tr>
			</tbody></table></figure>
			<!-- /wp:table -->
			${ editorMode === 'non-iframe' ? '<!-- wp:test/v2 /-->' : '' }
		` );
		await editor.saveDraft();
		await page.reload();

		const canvas = editorMode === 'non-iframe' ? page : editor.canvas;
		const tableBlock = canvas.locator( '[data-type="core/table"]' );
		const secondRowCell = tableBlock.locator( 'tbody tr' ).nth( 1 ).locator( 'td' );
		await secondRowCell.click();
		await editor.showBlockToolbar();
		await page.getByRole( 'button', { name: '行を並べ替え' } ).click();

		const handles = canvas.locator( '.yamabiko-editor-tools-table-reorder-content__handle' );
		await expect( handles ).toHaveCount( 3 );
		await expect( handles.nth( 1 ) ).toBeFocused();
	} );

	test( `focuses the first body row handle when reorder mode starts from a header in the ${ editorMode } editor`, async ( {
		admin,
		editor,
		page,
	} ) => {
		await admin.createNewPost();
		if ( editorMode === 'non-iframe' ) {
			await editor.switchToLegacyCanvas();
		}

		await editor.setContent( `
			<!-- wp:table -->
			<figure class="wp-block-table"><table><thead><tr><th>Heading</th></tr></thead><tbody>
				<tr><td>Row 1</td></tr>
				<tr><td>Row 2</td></tr>
			</tbody></table></figure>
			<!-- /wp:table -->
			${ editorMode === 'non-iframe' ? '<!-- wp:test/v2 /-->' : '' }
		` );

		const canvas = editorMode === 'non-iframe' ? page : editor.canvas;
		const tableBlock = canvas.locator( '[data-type="core/table"]' );
		await editor.selectBlocks( tableBlock );
		await tableBlock.locator( 'thead th' ).focus();
		await editor.showBlockToolbar();
		await page.getByRole( 'button', { name: '行を並べ替え' } ).click();

		const handles = canvas.locator( '.yamabiko-editor-tools-table-reorder-content__handle' );
		await expect( handles ).toHaveCount( 2 );
		await expect( handles.first() ).toBeFocused();
	} );
}
