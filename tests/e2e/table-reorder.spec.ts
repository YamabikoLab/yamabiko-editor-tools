import { expect, test } from '@wordpress/e2e-test-utils-playwright';
import type { Locator, Page } from '@playwright/test';

const username = process.env.WP_USERNAME ?? 'admin';
const password = process.env.WP_PASSWORD ?? 'admin';

const regularTable = ( rows: string[] ) =>
	`<!-- wp:table {"body":[${ rows
		.map( ( content ) => `{"cells":[{"content":"${ content }","tag":"td"}]}` )
		.join( ',' ) }]} -->
<figure class="wp-block-table"><table><tbody>${ rows
		.map( ( content ) => `<tr><td>${ content }</td></tr>` )
		.join( '' ) }</tbody></table></figure>
<!-- /wp:table -->`;

const rowspanTable = `<!-- wp:table {"body":[{"cells":[{"content":"outside","tag":"td"}]},{"cells":[{"content":"merged","rowspan":2,"tag":"td"}]},{"cells":[{"content":"continuation","tag":"td"}]},{"cells":[{"content":"last","tag":"td"}]}]} -->
<figure class="wp-block-table"><table><tbody><tr><td>outside</td></tr><tr><td rowspan="2">merged</td></tr><tr><td>continuation</td></tr><tr><td>last</td></tr></tbody></table></figure>
<!-- /wp:table -->`;

const login = async ( page: Page ) => {
	await page.goto( '/wp-login.php' );
	await page.getByLabel( 'Username or Email Address' ).fill( username );
	await page.getByLabel( 'Password' ).fill( password );
	await page.getByRole( 'button', { name: 'Log In' } ).click();
};

const getTableRows = async ( table: Locator ) =>
	table
		.locator( 'tbody > tr' )
		.evaluateAll( ( rows ) => rows.map( ( row ) => row.textContent?.trim() ) );

const beginReorder = async ( page: Page, table: Locator ) => {
	await table.locator( 'td, th' ).first().click();
	await page.getByRole( 'button', { name: '行を並べ替え' } ).click();
};

const drag = async ( page: Page, source: Locator, target: Locator, targetOffsetY: number ) => {
	const sourceBox = await source.boundingBox();
	const targetBox = await target.boundingBox();

	if ( ! sourceBox || ! targetBox ) {
		throw new Error( 'Table reorder handle is not visible.' );
	}

	await page.mouse.move( sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2 );
	await page.mouse.down();
	await page.mouse.move( targetBox.x + targetBox.width / 2, targetBox.y + targetOffsetY, {
		steps: 12,
	} );
	await page.mouse.up();
};

test.beforeEach( async ( { admin, page } ) => {
	await login( page );
	await admin.createNewPost();
} );

test( 'starts and exits reorder mode without enabling keyboard drag', async ( {
	editor,
	page,
} ) => {
	await editor.setContent( regularTable( [ 'one', 'two', 'three' ] ) );
	const table = editor.canvas.locator( '[data-type="core/table"]' ).first();

	await beginReorder( page, table );
	const handle = editor.canvas.getByRole( 'button', { name: '2 行目を並べ替える' } );
	await expect( handle ).toBeVisible();
	await handle.focus();
	await handle.press( 'Space' );
	await handle.press( 'Enter' );
	await handle.press( 'ArrowDown' );

	await expect( handle ).not.toHaveClass( /is-dragging/ );
	await expect.poll( () => getTableRows( table ) ).toEqual( [ 'one', 'two', 'three' ] );
	await page.getByRole( 'button', { name: '並べ替えを終了' } ).click();
	await expect( handle ).toHaveCount( 0 );
} );

test( 'reorders only the selected table with pointer handles and persists it after reload', async ( {
	editor,
	page,
} ) => {
	await editor.setContent(
		[
			regularTable( [ 'one', 'two', 'three' ] ),
			'<!-- wp:paragraph -->\n<p>unrelated</p>\n<!-- /wp:paragraph -->',
			regularTable( [ 'alpha', 'beta' ] ),
		].join( '\n' )
	);
	const tables = editor.canvas.locator( '[data-type="core/table"]' );
	const firstTable = tables.first();
	const secondTable = tables.nth( 1 );

	await beginReorder( page, firstTable );
	await drag(
		page,
		editor.canvas.getByRole( 'button', { name: '3 行目を並べ替える' } ),
		editor.canvas.getByRole( 'button', { name: '1 行目を並べ替える' } ),
		4
	);

	await expect.poll( () => getTableRows( firstTable ) ).toEqual( [ 'three', 'one', 'two' ] );
	await expect.poll( () => getTableRows( secondTable ) ).toEqual( [ 'alpha', 'beta' ] );
	await expect( editor.canvas.getByText( 'unrelated', { exact: true } ) ).toBeVisible();
	await page.keyboard.press( 'Control+z' );
	await expect.poll( () => getTableRows( firstTable ) ).toEqual( [ 'one', 'two', 'three' ] );
	await page.keyboard.press( 'Control+Shift+z' );
	await expect.poll( () => getTableRows( firstTable ) ).toEqual( [ 'three', 'one', 'two' ] );
	await editor.saveDraft();
	await page.reload();
	await expect.poll( () => getTableRows( tables.first() ) ).toEqual( [ 'three', 'one', 'two' ] );
	await expect.poll( () => getTableRows( tables.nth( 1 ) ) ).toEqual( [ 'alpha', 'beta' ] );
	await expect( editor.canvas.getByText( 'unrelated', { exact: true } ) ).toBeVisible();
} );

test( 'rejects a pointer move across a rowspan range once without changing the table', async ( {
	editor,
	page,
} ) => {
	await editor.setContent( rowspanTable );
	const table = editor.canvas.locator( '[data-type="core/table"]' ).first();

	await beginReorder( page, table );
	await drag(
		page,
		editor.canvas.getByRole( 'button', { name: '4 行目を並べ替える' } ),
		editor.canvas.getByRole( 'button', { name: '2 行目を並べ替える' } ),
		4
	);

	await expect( page.getByText( /結合セルを分断する位置には行を移動できません/ ) ).toHaveCount( 1 );
	await expect
		.poll( () => getTableRows( table ) )
		.toEqual( [ 'outside', 'merged', 'continuation', 'last' ] );
} );
