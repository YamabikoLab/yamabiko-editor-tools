import type { FrameLocator, Page } from '@playwright/test';
import type { RequestUtils } from '@wordpress/e2e-test-utils-playwright';
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

const BASIC_TABLE_CONTENT = `<!-- wp:table -->
<figure class="wp-block-table"><table class="has-fixed-layout"><tbody><tr><td>Alpha</td></tr><tr><td>Bravo</td></tr><tr><td>Charlie</td></tr></tbody></table></figure>
<!-- /wp:table -->

<!-- wp:paragraph -->
<p>Outside table</p>
<!-- /wp:paragraph -->`;

const PREFERENCES_SCOPE = 'yamabiko-editor-tools';
const KEYBOARD_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderKeyboardCoachmarkDismissed';
const TOUCH_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderTouchCoachmarkDismissed';

async function setTableReorderCoachmarkDismissal(
	requestUtils: RequestUtils,
	dismissed: boolean
): Promise< void > {
	await requestUtils.setPreferences( PREFERENCES_SCOPE, {
		[ KEYBOARD_COACHMARK_DISMISSED_PREFERENCE ]: dismissed,
		[ TOUCH_COACHMARK_DISMISSED_PREFERENCE ]: dismissed,
	} );
}

async function getEditorContext(
	page: Page,
	editorCanvas: FrameLocator
): Promise< Page | FrameLocator > {
	if ( ( await page.locator( 'iframe[name="editor-canvas"]' ).count() ) > 0 ) {
		return editorCanvas;
	}

	return page;
}

test.describe( 'Table Reorder UI', () => {
	test.use( {
		hasTouch: false,
		isMobile: false,
	} );

	test.beforeEach( async ( { admin, editor, requestUtils } ) => {
		await setTableReorderCoachmarkDismissal( requestUtils, false );
		await admin.createNewPost();
		await editor.setContent( BASIC_TABLE_CONTENT );
	} );

	test( 'starts from the minimal table content', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );

		await expect( editorContext.getByText( 'Alpha', { exact: true } ) ).toBeVisible();
		await expect( editorContext.getByText( 'Bravo', { exact: true } ) ).toBeVisible();
		await expect( editorContext.getByText( 'Charlie', { exact: true } ) ).toBeVisible();
		await expect( editorContext.getByText( 'Outside table', { exact: true } ) ).toBeVisible();
	} );

	test( 'shows the toolbar entry only for a supported Table block', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableBlock = editorContext.locator( '[data-type="core/table"][data-block]' );
		const paragraphBlock = editorContext.locator( '[data-type="core/paragraph"][data-block]' );
		const reorderRowsButton = page.getByRole( 'button', {
			name: /^(Reorder rows|行を並べ替え)$/,
		} );

		await editor.selectBlocks( tableBlock );
		await expect( reorderRowsButton ).toBeVisible();

		await editor.selectBlocks( paragraphBlock );
		await expect( reorderRowsButton ).toHaveCount( 0 );
	} );

	test( 'shows a row control while its row is hovered on desktop', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableBlock = editorContext.locator( '[data-type="core/table"][data-block]' );
		const firstRow = editorContext.locator( 'tbody tr' ).filter( { hasText: 'Alpha' } );
		const firstRowControl = editorContext.getByRole( 'button', {
			name: /^(Reorder row 1: Alpha|1行目「Alpha」を並べ替え)$/,
		} );
		const reorderRowsButton = page.getByRole( 'button', {
			name: /^(Reorder rows|行を並べ替え)$/,
		} );

		await editor.selectBlocks( tableBlock );
		await expect( firstRowControl ).toBeAttached();

		// hover 以外の表示理由を取り除く
		await reorderRowsButton.focus();

		await editorContext.getByText( 'Outside table', { exact: true } ).hover();
		await expect( firstRowControl ).toHaveAttribute( 'data-visible', 'false' );

		await firstRow.hover();
		await expect( firstRowControl ).toHaveAttribute( 'data-visible', 'true' );

		await editorContext.getByText( 'Outside table', { exact: true } ).hover();
		await expect( firstRowControl ).toHaveAttribute( 'data-visible', 'false' );
	} );

	test( 'shows the keyboard coachmark and focuses the current row control', async ( {
		editor,
		page,
	} ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableListViewItem = page.getByRole( 'link', {
			name: /^(Table|テーブル)$/,
		} );
		const reorderRowsButton = page.getByRole( 'button', {
			name: /^(Reorder rows|行を並べ替え)$/,
		} );
		const keyboardCoachmark = page.getByText(
			/^(Reorder rows with the keyboard\. Select “Reorder rows” in the toolbar\.|キーボードで行を並べ替えられます。ツールバーの「行を並べ替え」を選択)$/
		);
		const secondRowCell = editorContext.getByText( 'Bravo', { exact: true } );
		const secondRowControl = editorContext.getByRole( 'button', {
			name: /^(Reorder row 2: Bravo|2行目「Bravo」を並べ替え)$/,
		} );

		await page.keyboard.press( 'Shift+Alt+KeyO' );
		await tableListViewItem.focus();
		await page.keyboard.press( 'Enter' );
		await expect( keyboardCoachmark ).toBeVisible();
		await expect( secondRowControl ).toBeAttached();

		await secondRowCell.focus();
		await reorderRowsButton.focus();
		await page.keyboard.press( 'Enter' );
		await expect( keyboardCoachmark ).toHaveCount( 0 );
		await expect( secondRowControl ).toBeFocused();
	} );
} );

test.describe( 'Table Reorder touch UI', () => {
	test.use( {
		hasTouch: true,
		isMobile: true,
		viewport: { height: 844, width: 390 },
	} );

	test.beforeEach( async ( { admin, editor, requestUtils } ) => {
		await setTableReorderCoachmarkDismissal( requestUtils, false );
		await admin.createNewPost();
		await editor.setContent( BASIC_TABLE_CONTENT );
	} );

	test( 'shows the touch coachmark and toggles reorder mode', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const reorderRowsButton = page.getByRole( 'button', {
			name: /^(Reorder rows|行を並べ替え)$/,
		} );
		const touchCoachmark = page.getByText(
			/^(Tap “Reorder rows” in the toolbar to begin\.|ツールバーの「行を並べ替え」をタップして開始)$/
		);
		const touchGuidance = editorContext.getByText(
			/^(Handle: drag to move \/ tap to choose destination\sCell: tap to edit|ハンドル: ドラッグで移動 \/ タップで移動先選択\sセル: タップで編集)$/
		);
		const firstRowControl = editorContext.getByRole( 'button', {
			name: /^(Reorder row 1: Alpha|1行目「Alpha」を並べ替え)$/,
		} );

		await editorContext.getByText( 'Alpha', { exact: true } ).tap();
		await expect( touchCoachmark ).toBeVisible();
		await expect( reorderRowsButton ).toHaveAttribute( 'aria-pressed', 'false' );

		await reorderRowsButton.tap();
		await expect( reorderRowsButton ).toHaveAttribute( 'aria-pressed', 'true' );
		await expect( touchGuidance ).toBeVisible();
		await expect( firstRowControl ).toBeVisible();

		await reorderRowsButton.tap();
		await expect( reorderRowsButton ).toHaveAttribute( 'aria-pressed', 'false' );
		await expect( touchGuidance ).toHaveCount( 0 );
		await expect( firstRowControl ).toHaveCount( 0 );
	} );
} );
