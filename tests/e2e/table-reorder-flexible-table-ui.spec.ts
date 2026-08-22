import type { Locator, Page } from '@playwright/test';
import type { RequestUtils } from '@wordpress/e2e-test-utils-playwright';
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import { getEditorContext, type EditorContext } from './editor-context';
import {
	getRowControl,
	getRowHandle,
	getTableRow,
	getTableRows,
} from './table-reorder';
import { dismissTouchCoachmark, enterTouchReorderMode } from './table-reorder-touch';

const flexibleTableContent = `<!-- wp:flexible-table-block/table -->
<figure class="wp-block-flexible-table-block-table"><table class="has-fixed-layout"><tbody><tr><td>Alpha</td></tr><tr><td>Bravo</td></tr><tr><td>Charlie</td></tr><tr><td>Delta</td></tr></tbody></table></figure>
<!-- /wp:flexible-table-block/table -->`;
const flexibleTableBlockSelector = '[data-type="flexible-table-block/table"][data-block]';
const reorderRowsButtonName = /^(Reorder rows|行を並べ替え)$/;
const touchModeGuidance =
	/^(Handle: drag to move \/ tap to choose destination\sCell: tap to edit|ハンドル: ドラッグで移動 \/ タップで移動先選択\sセル: タップで編集)$/;
const touchPointerGuidance = /^(Tap destination|移動先をタップ)$/;
const PREFERENCES_SCOPE = 'yamabiko-editor-tools';
const KEYBOARD_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderKeyboardCoachmarkDismissed';

async function dismissKeyboardCoachmark( requestUtils: RequestUtils ): Promise< void > {
	await requestUtils.setPreferences( PREFERENCES_SCOPE, {
		[ KEYBOARD_COACHMARK_DISMISSED_PREFERENCE ]: true,
	} );
}

async function expectNoFtbRowSelected( editorContext: EditorContext ): Promise< void > {
	await expect( editorContext.locator( '.ftb-row-remover' ) ).toHaveCount( 0 );
}

async function focusRowControlFromToolbar(
	page: Page,
	editorContext: EditorContext,
	tableRows: Locator,
	rowNumber: number,
	rowLabel: string
): Promise< Locator > {
	const rowControl = getRowControl( editorContext, rowNumber, rowLabel );

	await getTableRow( tableRows, rowLabel ).getByText( rowLabel, { exact: true } ).focus();
	await page.getByRole( 'button', { name: reorderRowsButtonName } ).focus();
	await page.keyboard.press( 'Enter' );
	await expect( rowControl ).toBeFocused();

	return rowControl;
}

async function expectInsideBrowserViewport( page: Page, target: Locator ): Promise< void > {
	await expect( target ).toBeVisible();
	await expect
		.poll( async () => {
			const box = await target.boundingBox();
			const viewport = page.viewportSize();
			if ( ! box || ! viewport ) {
				return false;
			}

			return box.y >= 0 && box.y + box.height <= viewport.height;
		} )
		.toBe( true );
}

test.describe( 'Table Reorder Flexible Table Block UI integration', () => {
	test.use( {
		hasTouch: false,
		isMobile: false,
	} );

	test.beforeEach( async ( { admin, editor, page, requestUtils } ) => {
		await dismissKeyboardCoachmark( requestUtils );
		await admin.createNewPost();
		await editor.setContent( flexibleTableContent );

		const editorContext = await getEditorContext( page, editor.canvas );
		await editor.selectBlocks( editorContext.locator( flexibleTableBlockSelector ) );
	} );

	test( 'keeps FTB controls available with the Table Reorder toolbar entry', async ( {
		editor,
		page,
	} ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const rowSelectors = editorContext.locator( '.ftb-row-selector' );
		const rowBeforeInserter = editorContext.locator( '.ftb-row-before-inserter' ).first();
		const rowAfterInserter = editorContext.locator( '.ftb-row-after-inserter' ).first();
		const sectionLabel = editorContext.locator( '.ftb-table-cell-label' ).first();
		const rowRemover = editorContext.locator( '.ftb-row-remover' );
		const reorderRowsButton = page.getByRole( 'button', { name: reorderRowsButtonName } );

		await expect( rowSelectors.first() ).toBeVisible();
		await expect( rowBeforeInserter ).toBeVisible();
		await expect( rowAfterInserter ).toBeVisible();
		await expect( sectionLabel ).toBeVisible();
		await expect( reorderRowsButton ).toBeVisible();
		await expect( rowRemover ).toHaveCount( 0 );

		await rowSelectors.first().click();

		await expect( rowRemover ).toBeVisible();
		await expect( reorderRowsButton ).toBeVisible();
	} );

	test( 'keeps FTB helper UI out of the row control accessible name', async ( {
		editor,
	} ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const alphaControl = await getRowHandle( editorContext, tableRows, 1, 'Alpha' );

		await expect( alphaControl ).toHaveAccessibleName(
			/^(Reorder row 1: Alpha|1行目「Alpha」を並べ替え)$/
		);
		await expectNoFtbRowSelected( editorContext );
	} );

	test( 'does not select an FTB row during keyboard start and cancel', async ( {
		editor,
		page,
	} ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );

		await expectNoFtbRowSelected( editorContext );
		const alphaControl = await focusRowControlFromToolbar(
			page,
			editorContext,
			tableRows,
			1,
			'Alpha'
		);
		await expectNoFtbRowSelected( editorContext );

		await page.keyboard.press( 'Enter' );
		await expect( alphaControl ).toBeFocused();
		await expectNoFtbRowSelected( editorContext );

		await page.keyboard.press( 'Escape' );

		await expect( alphaControl ).toBeFocused();
		await expectNoFtbRowSelected( editorContext );
	} );
} );

test.describe( 'Table Reorder Flexible Table Block touch UI integration', () => {
	test.use( {
		hasTouch: true,
		isMobile: true,
		viewport: { height: 844, width: 390 },
	} );

	test.beforeEach( async ( { admin, editor, page, requestUtils } ) => {
		await dismissTouchCoachmark( requestUtils );
		await admin.createNewPost();
		await editor.setContent( flexibleTableContent );

		const editorContext = await getEditorContext( page, editor.canvas );
		await editor.selectBlocks( editorContext.locator( flexibleTableBlockSelector ) );
	} );

	test( 'keeps FTB row selection idle while touch guidance stays inside the viewport', async ( {
		editor,
		page,
	} ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const firstRowControl = editorContext.locator(
			'.yamabiko-table-reorder-handle-zone[aria-label*="Alpha"]'
		);
		const bravoControl = editorContext.locator(
			'.yamabiko-table-reorder-handle-zone[aria-label*="Bravo"]'
		);
		const modeGuidance = editorContext.getByText( touchModeGuidance );
		const pointerGuidance = editorContext.getByText( touchPointerGuidance );
		const cancelButton = editorContext.getByRole( 'button', {
			name: /^(Cancel|キャンセル)$/,
		} );

		await expectNoFtbRowSelected( editorContext );
		await enterTouchReorderMode( page, editorContext, firstRowControl );

		await expectInsideBrowserViewport( page, modeGuidance );
		await expectNoFtbRowSelected( editorContext );

		await bravoControl.tap();

		await expect( modeGuidance ).toBeHidden();
		await expectInsideBrowserViewport( page, pointerGuidance );
		await expect( cancelButton ).toBeVisible();
		await expectNoFtbRowSelected( editorContext );

		await cancelButton.tap();

		await expect( pointerGuidance ).toHaveCount( 0 );
		await expectInsideBrowserViewport( page, modeGuidance );
		await expectNoFtbRowSelected( editorContext );
	} );
} );
