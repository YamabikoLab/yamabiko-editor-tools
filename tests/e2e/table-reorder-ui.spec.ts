import type { Page } from '@playwright/test';
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

const TABLE_CONTENT = `<!-- wp:table -->
<figure class="wp-block-table"><table class="has-fixed-layout"><tbody><tr><td>Alpha</td><td>A</td></tr><tr><td>Bravo</td><td>B</td></tr></tbody></table></figure>
<!-- /wp:table -->

<!-- wp:paragraph -->
<p>Outside table</p>
<!-- /wp:paragraph -->`;

const TOOLBAR_NAME = /^(Reorder rows|行を並べ替え)$/;
const KEYBOARD_COACHMARK =
	/You can reorder the rows in this table with the keyboard|キーボードで表の行を並べ替えられます/;
const TOUCH_COACHMARK = /You can reorder the rows in this table\. Tap|この表は行を並べ替えられます/;
const TOUCH_GUIDANCE = /Drag a row handle to move the row|行ハンドルをドラッグして行を移動する/;

const setPluginPreference = async ( page: Page, name: string, value: boolean ) => {
	await page.waitForFunction( () => Boolean( ( window as Window & { wp?: unknown } ).wp ) );
	await page.evaluate(
		async ( preference ) => {
			type PreferencesActions = {
				set: ( scope: string, key: string, nextValue: boolean ) => Promise< unknown > | unknown;
			};
			type WordPressWindow = Window & {
				wp: {
					data: {
						dispatch: ( storeName: string ) => PreferencesActions;
					};
				};
			};
			const wpWindow = window as WordPressWindow;
			await wpWindow.wp.data
				.dispatch( 'core/preferences' )
				.set( 'yamabiko-editor-tools', preference.name, preference.value );
		},
		{ name, value }
	);
};

test.describe( 'Table Reorder UI', () => {
	test.beforeEach( async ( { admin, editor } ) => {
		await admin.createNewPost();
		await editor.setContent( TABLE_CONTENT );
	} );

	test( 'shows the toolbar entry only while a supported table is selected', async ( {
		editor,
		page,
	} ) => {
		const tableBlock = editor.canvas.locator( '[data-type="core/table"]' );
		const paragraphBlock = editor.canvas.locator( '[data-type="core/paragraph"]' );
		const toolbarButton = page.getByRole( 'button', { name: TOOLBAR_NAME } );

		await tableBlock.click();
		await expect( toolbarButton ).toBeVisible();

		await paragraphBlock.click();
		await expect( toolbarButton ).toHaveCount( 0 );
	} );

	test( 'reveals a row handle on mouse hover and hides it after leaving the row', async ( {
		editor,
	} ) => {
		const tableBlock = editor.canvas.locator( '[data-type="core/table"]' );
		const firstRow = tableBlock.locator( 'tbody tr' ).first();
		const firstHandle = firstRow.locator( '.yamabiko-table-reorder-handle-zone' );

		await tableBlock.click();
		await expect( firstHandle ).toBeAttached();
		await expect( firstHandle ).toHaveCSS( 'opacity', '0' );

		await firstRow.hover();
		await expect( firstHandle ).toHaveCSS( 'opacity', '1' );

		await tableBlock.locator( 'table' ).hover( { position: { x: 1, y: 1 } } );
		await expect( firstHandle ).toHaveCSS( 'opacity', '0' );
	} );

	test( 'shows the first keyboard guidance and moves focus from the toolbar to a row handle', async ( {
		editor,
		page,
	} ) => {
		await setPluginPreference( page, 'tableReorderKeyboardCoachmarkDismissed', false );

		const tableBlock = editor.canvas.locator( '[data-type="core/table"]' );
		const firstHandle = tableBlock
			.locator( 'tbody tr' )
			.first()
			.locator( '.yamabiko-table-reorder-handle-zone' );
		const toolbarButton = page.getByRole( 'button', { name: TOOLBAR_NAME } );

		await tableBlock.click();
		await page.keyboard.press( 'Tab' );
		await expect( page.getByText( KEYBOARD_COACHMARK ) ).toBeVisible();

		await toolbarButton.focus();
		await page.keyboard.press( 'Enter' );

		await expect( page.getByText( KEYBOARD_COACHMARK ) ).toHaveCount( 0 );
		await expect( firstHandle ).toBeFocused();
	} );
} );

test.describe( 'Table Reorder touch UI', () => {
	test.use( {
		hasTouch: true,
		isMobile: true,
		viewport: { height: 844, width: 390 },
	} );

	test( 'shows first-use guidance and toggles touch reorder mode', async ( {
		admin,
		editor,
		page,
	} ) => {
		await admin.createNewPost();
		await editor.setContent( TABLE_CONTENT );
		await setPluginPreference( page, 'tableReorderTouchCoachmarkDismissed', false );

		const tableBlock = editor.canvas.locator( '[data-type="core/table"]' );
		const firstHandle = tableBlock
			.locator( 'tbody tr' )
			.first()
			.locator( '.yamabiko-table-reorder-handle-zone' );
		const toolbarButton = page.getByRole( 'button', { name: TOOLBAR_NAME } );

		await tableBlock.click();
		await expect( page.getByText( TOUCH_COACHMARK ) ).toBeVisible();
		await expect( toolbarButton ).toHaveAttribute( 'aria-pressed', 'false' );

		await toolbarButton.click();
		await expect( toolbarButton ).toHaveAttribute( 'aria-pressed', 'true' );
		await expect( editor.canvas.getByText( TOUCH_GUIDANCE ) ).toBeVisible();
		await expect( firstHandle ).toHaveCSS( 'opacity', '1' );

		await toolbarButton.click();
		await expect( toolbarButton ).toHaveAttribute( 'aria-pressed', 'false' );
		await expect( editor.canvas.getByText( TOUCH_GUIDANCE ) ).toHaveCount( 0 );
	} );
} );
