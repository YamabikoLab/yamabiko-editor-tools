import type { Locator, Page } from '@playwright/test';
import type { RequestUtils } from '@wordpress/e2e-test-utils-playwright';
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import { getEditorContext, type EditorContext } from './editor-context';
import {
	basicRowLabels,
	basicTableContent,
	getRowControl,
	getRowHandle,
	getTableRow,
	getTableRowOrder,
	getTableRows,
} from './table-reorder';

const reorderRowsButtonName = /^(Reorder rows|行を並べ替え)$/;
const keyboardIdleGuidanceText =
	/^(Enter \/ Space: start moving|Enter \/ Space: 移動開始)$/;
const keyboardGuidanceText =
	/^(↑↓ Move\u3000Enter \/ Space Confirm\u3000Esc Cancel|↑↓ 移動\u3000Enter \/ Space 決定\u3000Esc キャンセル)$/;
const pcPointerGuidanceText =
	/^(Click destination\u3000Esc Cancel|移動先をクリック\u3000Esc キャンセル)$/;
const PREFERENCES_SCOPE = 'yamabiko-editor-tools';
const KEYBOARD_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderKeyboardCoachmarkDismissed';
const TOUCH_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderTouchCoachmarkDismissed';
const partiallyRowspannedTableContent = `<!-- wp:table -->
<figure class="wp-block-table"><table class="has-fixed-layout"><tbody><tr><td rowspan="2">Alpha</td><td>One</td></tr><tr><td>Bravo</td></tr><tr><td>Charlie</td><td>Three</td></tr></tbody></table></figure>
<!-- /wp:table -->`;
const fullyRowspannedTableContent = `<!-- wp:table -->
<figure class="wp-block-table"><table class="has-fixed-layout"><tbody><tr><td rowspan="2">Alpha</td><td>One</td></tr><tr><td>Bravo</td></tr></tbody></table></figure>
<!-- /wp:table -->`;

async function dismissCoachmarks( requestUtils: RequestUtils ): Promise< void > {
	await requestUtils.setPreferences( PREFERENCES_SCOPE, {
		[ KEYBOARD_COACHMARK_DISMISSED_PREFERENCE ]: true,
		[ TOUCH_COACHMARK_DISMISSED_PREFERENCE ]: true,
	} );
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

async function expectMinimumPointerTargetSize( locator: Locator ): Promise< void > {
	const box = await locator.boundingBox();
	if ( ! box ) {
		throw new Error( 'Pointer target did not have a visible bounding box.' );
	}

	expect( box.width ).toBeGreaterThanOrEqual( 24 );
	expect( box.height ).toBeGreaterThanOrEqual( 24 );
}

async function expectNotFullyCovered( target: Locator, overlay: Locator ): Promise< void > {
	const [ targetBox, overlayBox ] = await Promise.all( [ target.boundingBox(), overlay.boundingBox() ] );
	if ( ! targetBox || ! overlayBox ) {
		throw new Error( 'Expected visible geometry for the focused target and guidance.' );
	}

	const isFullyCovered =
		overlayBox.x <= targetBox.x &&
		overlayBox.y <= targetBox.y &&
		overlayBox.x + overlayBox.width >= targetBox.x + targetBox.width &&
		overlayBox.y + overlayBox.height >= targetBox.y + targetBox.height;

	expect( isFullyCovered ).toBe( false );
}

test.describe( 'Table Reorder accessibility integration', () => {
	test.use( {
		hasTouch: false,
		isMobile: false,
	} );

	test.beforeEach( async ( { admin, editor, page, requestUtils } ) => {
		await dismissCoachmarks( requestUtils );
		await admin.createNewPost();
		await editor.setContent( basicTableContent );

		const editorContext = await getEditorContext( page, editor.canvas );
		await editor.selectBlocks( editorContext.locator( '[data-type="core/table"][data-block]' ) );
	} );

	test( 'exposes row controls and switches keyboard guidance while announcing movement', async ( {
		editor,
		page,
	} ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const bravoControl = await focusRowControlFromToolbar(
			page,
			editorContext,
			tableRows,
			2,
			'Bravo'
		);
		const liveStatus = editorContext.getByRole( 'status' );
		const idleGuidance = editorContext.getByText( keyboardIdleGuidanceText );
		const guidance = editorContext.getByText( keyboardGuidanceText );

		await expect( bravoControl ).toBeVisible();
		await expectMinimumPointerTargetSize( bravoControl );
		await expect( idleGuidance ).toBeVisible();

		await page.keyboard.press( 'Enter' );

		await expect( bravoControl ).toBeFocused();
		await expect( idleGuidance ).toHaveCount( 0 );
		await expect( guidance ).toBeVisible();
		await expectNotFullyCovered( bravoControl, guidance );
		await expect( liveStatus ).toHaveText(
			/^(Moving Bravo, row 2 of 4\.|Bravo、全4行中2行目の移動を開始しました。)$/
		);

		await page.keyboard.press( 'ArrowDown' );

		await expect( bravoControl ).toBeFocused();
		await expect( liveStatus ).toHaveText(
			/^(Move Bravo to position 3 of 4\.|Bravoを全4行中3行目へ移動します。)$/
		);

		await page.keyboard.press( 'Space' );

		await expect
			.poll( () => getTableRowOrder( tableRows ) )
			.toEqual( [ 'Alpha', 'Charlie', 'Bravo', 'Delta' ] );
		await expect( liveStatus ).toHaveText(
			/^(Moved Bravo from position 2 to 3\.|Bravoを2行目から3行目へ移動しました。)$/
		);
		await expect( guidance ).toHaveCount( 0 );
		await expect( getRowControl( editorContext, 3, 'Bravo' ) ).toBeFocused();
	} );

	test( 'announces keyboard cancellation and restores the row focus', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const originalContent = await editor.getEditedPostContent();
		const bravoControl = await focusRowControlFromToolbar(
			page,
			editorContext,
			tableRows,
			2,
			'Bravo'
		);
		const liveStatus = editorContext.getByRole( 'status' );

		await page.keyboard.press( 'Enter' );
		await page.keyboard.press( 'ArrowDown' );
		await page.keyboard.press( 'Escape' );

		await expect( liveStatus ).toHaveText(
			/^(Canceled moving Bravo\. It remains at position 2\.|Bravoの移動をキャンセルしました。位置は2行目のままです。)$/
		);
		await expect( bravoControl ).toBeFocused();
		expect( await getTableRowOrder( tableRows ) ).toEqual( basicRowLabels );
		expect( await editor.getEditedPostContent() ).toBe( originalContent );
	} );

	test( 'announces a keyboard boundary without losing focus', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const alphaControl = await focusRowControlFromToolbar(
			page,
			editorContext,
			tableRows,
			1,
			'Alpha'
		);
		const liveStatus = editorContext.getByRole( 'status' );

		await page.keyboard.press( 'Enter' );
		await page.keyboard.press( 'ArrowUp' );

		await expect( alphaControl ).toBeFocused();
		await expect( liveStatus ).toHaveText(
			/^(Alpha cannot move any farther up\.|Alphaは、これ以上上へ移動できません。)$/
		);
	} );

	test( 'announces PC destination selection and preserves focus after confirmation', async ( {
		editor,
		page,
	} ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const guidance = editorContext.getByText( pcPointerGuidanceText );
		const liveStatus = editorContext.getByRole( 'status' );
		const bravoHandle = await getRowHandle( editorContext, tableRows, 2, 'Bravo' );
		const endDestination = editorContext.getByRole( 'button', {
			name: /^(Move to the end of the table\.|表の末尾へ移動)$/,
		} );

		await expectMinimumPointerTargetSize( bravoHandle );
		await bravoHandle.click();

		await expect( bravoHandle ).toBeFocused();
		await expect( guidance ).toBeVisible();
		await expect( endDestination ).toBeVisible();
		await expectMinimumPointerTargetSize( endDestination );
		await expectNotFullyCovered( bravoHandle, guidance );
		await expect( liveStatus ).toHaveText(
			/^(Bravo selected\. Choose a destination\.|Bravoを選択しました。移動先を選んでください。)$/
		);

		await endDestination.click();

		await expect
			.poll( () => getTableRowOrder( tableRows ) )
			.toEqual( [ 'Alpha', 'Charlie', 'Delta', 'Bravo' ] );
		await expect( liveStatus ).toHaveText(
			/^(Moved Bravo from position 2 to 4\.|Bravoを2行目から4行目へ移動しました。)$/
		);
		await expect( guidance ).toHaveCount( 0 );
		await expect( getRowControl( editorContext, 4, 'Bravo' ) ).toBeFocused();
	} );

	test( 'restores PC single-pointer focus after cancellation', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const originalContent = await editor.getEditedPostContent();
		const guidance = editorContext.getByText( pcPointerGuidanceText );
		const liveStatus = editorContext.getByRole( 'status' );
		const bravoHandle = await getRowHandle( editorContext, tableRows, 2, 'Bravo' );

		await bravoHandle.click();
		await expect( guidance ).toBeVisible();

		await page.keyboard.press( 'Escape' );

		await expect( guidance ).toHaveCount( 0 );
		await expect( liveStatus ).toHaveText(
			/^(Canceled moving Bravo\. It remains at position 2\.|Bravoの移動をキャンセルしました。位置は2行目のままです。)$/
		);
		await expect( bravoHandle ).toBeFocused();
		expect( await getTableRowOrder( tableRows ) ).toEqual( basicRowLabels );
		expect( await editor.getEditedPostContent() ).toBe( originalContent );
	} );

	test( 'announces why a row inside a rowspan range cannot be moved', async ( { editor, page } ) => {
		await editor.setContent( partiallyRowspannedTableContent );
		const editorContext = await getEditorContext( page, editor.canvas );
		await editor.selectBlocks( editorContext.locator( '[data-type="core/table"][data-block]' ) );
		const tableRows = getTableRows( editorContext );
		const liveStatus = editorContext.getByRole( 'status' );

		await getTableRow( tableRows, 'Alpha' ).getByText( 'Alpha', { exact: true } ).focus();
		await page.getByRole( 'button', { name: reorderRowsButtonName } ).focus();
		await page.keyboard.press( 'Enter' );

		await expect( liveStatus ).toHaveText(
			/^(Alpha cannot be moved because it is within a cell that spans multiple rows\.|Alphaは、複数行にまたがる結合セルの範囲内にあるため移動できません。)$/
		);
		await expect( getRowControl( editorContext, 3, 'Charlie' ) ).not.toBeFocused();
	} );

	test( 'announces when a table has no movable body rows', async ( { editor, page } ) => {
		await editor.setContent( fullyRowspannedTableContent );
		const editorContext = await getEditorContext( page, editor.canvas );
		await editor.selectBlocks( editorContext.locator( '[data-type="core/table"][data-block]' ) );
		const tableRows = getTableRows( editorContext );
		const liveStatus = editorContext.getByRole( 'status' );

		await getTableRow( tableRows, 'Alpha' ).getByText( 'Alpha', { exact: true } ).focus();
		await page.getByRole( 'button', { name: reorderRowsButtonName } ).focus();
		await page.keyboard.press( 'Enter' );

		await expect( liveStatus ).toHaveText(
			/^(There are no rows that can be reordered in this table\.|この表には並べ替えできる行がありません。)$/
		);
		await expect( editorContext.getByRole( 'button', { name: /^(Reorder row|\d+行目「)/ } ) ).toHaveCount( 0 );
	} );
} );
