import { expect, test } from '@wordpress/e2e-test-utils-playwright';

test.describe( 'PC pointer DnD', () => {
	test.beforeEach( async ( { admin, editor } ) => {
		await admin.createNewPost();

		await editor.setContent( `
<!-- wp:table -->
<figure class="wp-block-table"><table class="has-fixed-layout"><tbody><tr><td>富士山</td></tr><tr><td>高尾山</td></tr><tr><td>筑波山</td></tr></tbody></table></figure>
<!-- /wp:table -->
` );
	} );

	test( 'moves a row downward', async ( { editor } ) => {
		const rows = editor.canvas.locator( 'table tbody tr' );

		await expect( rows ).toHaveCount( 3 );

		const takaoRow = rows.filter( { hasText: '高尾山' } );

		await expect( takaoRow ).toHaveCount( 1 );

		await takaoRow.hover();

		const takaoHandle = takaoRow.getByRole( 'button', {
			name: /高尾山/,
		} );

		await expect( takaoHandle ).toBeVisible();

		const tsukubaRow = rows.filter( { hasText: '筑波山' } );

		await expect( tsukubaRow ).toHaveCount( 1 );

		await takaoHandle.dragTo( tsukubaRow, {
			steps: 10,
		} );

		const cells = editor.canvas.getByRole( 'textbox', {
			name: /body cell text|本文セルのテキスト/i,
		} );

		await expect( cells ).toHaveText( [ '富士山', '筑波山', '高尾山' ] );

		await expect
			.poll( () => editor.getEditedPostContent() )
			.toMatch( /富士山[\s\S]*筑波山[\s\S]*高尾山/ );
	} );

	test( 'moves a row upward', async ( { editor } ) => {
		const rows = editor.canvas.locator( 'table tbody tr' );

		await expect( rows ).toHaveCount( 3 );

		const tsukubaRow = rows.filter( { hasText: '筑波山' } );

		await expect( tsukubaRow ).toHaveCount( 1 );

		await tsukubaRow.hover();

		const tsukubaHandle = tsukubaRow.getByRole( 'button', {
			name: /筑波山/,
		} );

		await expect( tsukubaHandle ).toBeVisible();

		const fujiRow = rows.filter( { hasText: '富士山' } );

		await expect( fujiRow ).toHaveCount( 1 );

		await tsukubaHandle.dragTo( fujiRow, {
			steps: 10,
		} );

		const cells = editor.canvas.getByRole( 'textbox', {
			name: /body cell text|本文セルのテキスト/i,
		} );

		await expect( cells ).toHaveText( [ '筑波山', '富士山', '高尾山' ] );

		await expect
			.poll( () => editor.getEditedPostContent() )
			.toMatch( /筑波山[\s\S]*富士山[\s\S]*高尾山/ );
	} );

	test( 'does not reorder when dragging from a table cell', async ( { editor } ) => {
		const rows = editor.canvas.locator( 'table tbody tr' );

		await expect( rows ).toHaveCount( 3 );

		const takaoRow = rows.filter( { hasText: '高尾山' } );
		const tsukubaRow = rows.filter( { hasText: '筑波山' } );

		const takaoCell = takaoRow.getByRole( 'textbox', {
			name: /body cell text|本文セルのテキスト/i,
		} );

		await expect( takaoCell ).toBeVisible();

		await takaoCell.dragTo( tsukubaRow, {
			steps: 10,
		} );

		const cells = editor.canvas.getByRole( 'textbox', {
			name: /body cell text|本文セルのテキスト/i,
		} );

		await expect( cells ).toHaveText( [ '富士山', '高尾山', '筑波山' ] );

		await expect
			.poll( () => editor.getEditedPostContent() )
			.toMatch( /富士山[\s\S]*高尾山[\s\S]*筑波山/ );
	} );
} );
