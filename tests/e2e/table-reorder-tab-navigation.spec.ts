import { expect, test } from '@wordpress/e2e-test-utils-playwright';

const tableRows = Array.from(
	{ length: 30 },
	( _, index ) => `<tr><td>Row ${ index + 1 }</td><td>Content</td></tr>`
).join( '' );

for ( const editorMode of [ 'iframe', 'non-iframe' ] as const ) {
	test( `moves focus through every row handle with Tab in the ${ editorMode } editor`, async ( {
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
			<figure class="wp-block-table"><table><tbody>${ tableRows }</tbody></table></figure>
			<!-- /wp:table -->
			${ editorMode === 'non-iframe' ? '<!-- wp:test/v2 /-->' : '' }
		` );

		const canvas = editorMode === 'non-iframe' ? page : editor.canvas;
		const tableBlock = canvas.locator( '[data-type="core/table"]' );
		await editor.selectBlocks( tableBlock );
		await editor.showBlockToolbar();
		await page.getByRole( 'button', { name: '行を並べ替え' } ).click();

		const handles = canvas.locator( '.yamabiko-editor-tools-table-reorder-content__handle' );
		await expect( handles ).toHaveCount( 30 );
		await expect( handles.first() ).toBeFocused();

		for ( let index = 1; index < 30; index += 1 ) {
			await handles.nth( index - 1 ).press( 'Tab' );
			await expect( handles.nth( index ) ).toBeFocused();
		}

		for ( let index = 28; index >= 0; index -= 1 ) {
			await handles.nth( index + 1 ).press( 'Shift+Tab' );
			await expect( handles.nth( index ) ).toBeFocused();
		}

		const firstBoundaryAllowed = await handles.first().evaluate( ( handle ) =>
			handle.dispatchEvent(
				new KeyboardEvent( 'keydown', {
					bubbles: true,
					cancelable: true,
					key: 'Tab',
					shiftKey: true,
				} )
			)
		);
		expect( firstBoundaryAllowed ).toBe( true );

		const lastBoundaryAllowed = await handles.last().evaluate( ( handle ) =>
			handle.dispatchEvent(
				new KeyboardEvent( 'keydown', {
					bubbles: true,
					cancelable: true,
					key: 'Tab',
				} )
			)
		);
		expect( lastBoundaryAllowed ).toBe( true );
	} );

	test( `keeps keyboard mode activation separate from row reorder in the ${ editorMode } editor`, async ( {
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
			<figure class="wp-block-table"><table><tbody>${ tableRows }</tbody></table></figure>
			<!-- /wp:table -->
			${ editorMode === 'non-iframe' ? '<!-- wp:test/v2 /-->' : '' }
		` );

		const canvas = editorMode === 'non-iframe' ? page : editor.canvas;
		const tableBlock = canvas.locator( '[data-type="core/table"]' );
		await editor.selectBlocks( tableBlock );
		await editor.showBlockToolbar();

		const modeToggle = page.getByRole( 'button', { name: '行を並べ替え' } );
		await modeToggle.focus();
		await modeToggle.press( 'Enter' );

		const handles = canvas.locator( '.yamabiko-editor-tools-table-reorder-content__handle' );
		await expect( handles ).toHaveCount( 30 );
		await expect( handles.first() ).toBeFocused();
		await expect( handles.first() ).toHaveAccessibleName( '1 行目を並べ替える' );
		await expect( handles.first() ).not.toHaveClass( /is-keyboard-reordering/ );

		await handles.first().press( 'Tab' );
		await expect( handles.nth( 1 ) ).toBeFocused();
	} );
}

test( 'keeps Tab focus on the source handle while keyboard reordering', async ( {
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

	const handles = editor.canvas.locator( '.yamabiko-editor-tools-table-reorder-content__handle' );
	const source = handles.nth( 4 );
	await source.focus();
	await source.press( 'Enter' );
	await expect( source ).toHaveAccessibleName( '5 行目を並べ替え中' );

	await source.press( 'Tab' );
	await expect( source ).toBeFocused();
	await source.press( 'Shift+Tab' );
	await expect( source ).toBeFocused();

	await source.press( 'Escape' );
	await source.press( 'Tab' );
	await expect( handles.nth( 5 ) ).toBeFocused();
} );

test( 'keeps rowspan rows focusable in the Tab sequence', async ( { admin, editor, page } ) => {
	await admin.createNewPost();
	await editor.setContent( `
		<!-- wp:table -->
		<figure class="wp-block-table"><table><tbody>
			<tr><td>Row 1</td><td>Content</td></tr>
			<tr><td rowspan="2">Merged</td><td>Row 2</td></tr>
			<tr><td>Row 3</td></tr>
			<tr><td>Row 4</td><td>Content</td></tr>
		</tbody></table></figure>
		<!-- /wp:table -->
	` );

	const tableBlock = editor.canvas.locator( '[data-type="core/table"]' );
	await editor.selectBlocks( tableBlock );
	await editor.showBlockToolbar();
	await page.getByRole( 'button', { name: '行を並べ替え' } ).click();

	const handles = editor.canvas.locator( '.yamabiko-editor-tools-table-reorder-content__handle' );
	await expect( handles ).toHaveCount( 4 );
	await handles.first().press( 'Tab' );
	await expect( handles.nth( 1 ) ).toBeFocused();
	await expect( handles.nth( 1 ) ).toHaveAttribute( 'aria-disabled', 'true' );
	await handles.nth( 1 ).press( 'Tab' );
	await expect( handles.nth( 2 ) ).toBeFocused();
	await expect( handles.nth( 2 ) ).toHaveAttribute( 'aria-disabled', 'true' );
} );
