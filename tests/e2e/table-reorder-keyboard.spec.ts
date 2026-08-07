import { expect, test } from '@wordpress/e2e-test-utils-playwright';

const tableRows = Array.from(
	{ length: 30 },
	( _, index ) => `<tr><td>Row ${ index + 1 }</td><td>Content</td></tr>`
).join( '' );

for ( const editorMode of [ 'iframe', 'non-iframe' ] as const ) {
	test( `reorders rows by keyboard and follows the destination in the ${ editorMode } editor`, async ( {
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
		const rows = tableBlock.locator( 'tbody tr' );
		await editor.selectBlocks( tableBlock );
		await rows.nth( 9 ).locator( 'td' ).first().focus();
		await editor.showBlockToolbar();
		await page.getByRole( 'button', { name: '行を並べ替え' } ).click();

		const handles = canvas.locator( '.yamabiko-editor-tools-table-reorder-content__handle' );
		const liveRegion = canvas.locator(
			'.yamabiko-editor-tools-table-reorder-content__live-region'
		);
		await expect( handles ).toHaveCount( 30 );

		const initialHandle = handles.nth( 9 );
		await expect( initialHandle ).toBeFocused();
		await initialHandle.press( 'Enter' );
		await expect( initialHandle ).toHaveAccessibleName( '10 行目を並べ替え中' );
		await expect( page.getByRole( 'button', { name: '並べ替えを終了' } ) ).toBeVisible();
		await expect
			.poll( () =>
				rows.nth( 9 ).evaluate( ( row ) => {
					const bounds = row.getBoundingClientRect();
					const view = row.ownerDocument.defaultView;

					return view !== null && bounds.top >= 0 && bounds.bottom <= view.innerHeight;
				} )
			)
			.toBe( true );
		await initialHandle.press( 'Escape' );
		await expect( initialHandle ).toBeFocused();

		const source = handles.nth( 2 );
		const sourceId = await source.getAttribute( 'data-table-reorder-row-id' );
		if ( ! sourceId ) {
			throw new Error( 'The keyboard reorder source has no row ID.' );
		}

		await source.focus();
		await source.press( 'Enter' );
		await expect( source ).toHaveAccessibleName( '3 行目を並べ替え中' );
		await expect( source ).toHaveClass( /\bis-keyboard-reordering\b/ );
		await expect( liveRegion ).toHaveText( '3 行目の並べ替えを開始しました。全30行です。' );

		await source.press( 'ArrowDown' );
		await expect( liveRegion ).toHaveText( '4 行目へ移動します。全30行です。' );
		await expect
			.poll( () => rows.nth( 2 ).evaluate( ( row ) => row.style.opacity ) )
			.not.toBe( '0' );
		await expect
			.poll( () => rows.nth( 2 ).evaluate( ( row ) => row.style.transform ) )
			.toContain( 'translateY' );
		await source.press( 'ArrowUp' );
		await expect( liveRegion ).toHaveText( '3 行目へ移動します。全30行です。' );
		await source.press( 'ArrowUp' );
		await expect( liveRegion ).toHaveText( '2 行目へ移動します。全30行です。' );
		await source.press( 'Escape' );

		await expect( source ).toBeFocused();
		await expect( source ).toHaveAccessibleName( '3 行目を並べ替える' );
		await expect( rows.nth( 2 ) ).toContainText( 'Row 3' );

		await source.press( 'Enter' );
		for ( let index = 0; index < 20; index += 1 ) {
			await source.press( 'ArrowDown' );
		}

		const destinationRow = rows.nth( 22 );
		await expect
			.poll( () =>
				destinationRow.evaluate( ( row ) => {
					const bounds = row.getBoundingClientRect();
					const view = row.ownerDocument.defaultView;

					return view !== null && bounds.top >= 0 && bounds.bottom <= view.innerHeight;
				} )
			)
			.toBe( true );
		await expect( source ).toBeFocused();
		await expect( liveRegion ).toHaveText( '23 行目へ移動します。全30行です。' );

		await source.press( 'Enter' );
		const movedSource = canvas.locator( `[data-table-reorder-row-id="${ sourceId }"]` );
		await expect( rows.nth( 2 ) ).toContainText( 'Row 4' );
		await expect( rows.nth( 22 ) ).toContainText( 'Row 3' );
		await expect( movedSource ).toHaveAccessibleName( '23 行目を並べ替える' );
		await expect( movedSource ).toBeFocused();
	} );
}

test( 'keeps pointer drag-and-drop row reordering working', async ( { admin, editor, page } ) => {
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

	const sourceHandle = editor.canvas
		.locator( '.yamabiko-editor-tools-table-reorder-content__handle' )
		.first();
	const rows = tableBlock.locator( 'tbody tr' );
	const sourceBounds = await sourceHandle.boundingBox();
	const targetBounds = await rows.nth( 2 ).boundingBox();
	if ( ! sourceBounds || ! targetBounds ) {
		throw new Error( 'The pointer reorder source or target has no bounding box.' );
	}

	await sourceHandle.hover();
	await page.mouse.down();
	await expect( sourceHandle ).toHaveClass( /\bis-dragging\b/ );
	await page.mouse.move(
		sourceBounds.x + sourceBounds.width / 2,
		targetBounds.y + targetBounds.height * 0.75,
		{ steps: 10 }
	);
	await expect(
		editor.canvas.locator( '.yamabiko-editor-tools-table-reorder-content__insertion-indicator' )
	).toBeVisible();
	await page.mouse.up();

	await expect( rows.nth( 0 ) ).toContainText( 'Row 2' );
	await expect( rows.nth( 3 ) ).toContainText( 'Row 1' );
} );
