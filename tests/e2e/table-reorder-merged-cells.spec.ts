import type { Locator, Page } from '@playwright/test';
import type { RequestUtils } from '@wordpress/e2e-test-utils-playwright';
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import { getEditorContext, type EditorContext } from './editor-context';
import {
	getRowControl,
	getRowHandle,
	getTableRow,
	getTableRowOrder,
	getTableRows,
	mergedCellsRowLabels,
	mergedCellsTableContent,
} from './table-reorder';
import { enterTouchReorderMode } from './table-reorder-touch';

const reorderRowsButtonName = /^(Reorder rows|行を並べ替え)$/;
const PREFERENCES_SCOPE = 'yamabiko-editor-tools';
const KEYBOARD_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderKeyboardCoachmarkDismissed';
const TOUCH_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderTouchCoachmarkDismissed';

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

test.describe( 'Table Reorder merged-cell constraints', () => {
	test.use( {
		hasTouch: false,
		isMobile: false,
	} );

	test.beforeEach( async ( { admin, editor, page, requestUtils } ) => {
		await dismissCoachmarks( requestUtils );
		await admin.createNewPost();
		await editor.setContent( mergedCellsTableContent );

		const editorContext = await getEditorContext( page, editor.canvas );
		await editor.selectBlocks( editorContext.locator( '[data-type="core/table"][data-block]' ) );
	} );

	test( 'does not expose row controls inside a rowspan range', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const originalContent = await editor.getEditedPostContent();

		await getTableRow( tableRows, 'Alpha' ).hover();
		await expect( getRowControl( editorContext, 1, 'Alpha' ) ).toBeVisible();

		await getTableRow( tableRows, 'Rowspan start' ).hover();
		await expect( getRowControl( editorContext, 5, 'Rowspan start' ) ).toHaveCount( 0 );

		await getTableRow( tableRows, 'Rowspan covered' ).hover();
		await expect( getRowControl( editorContext, 6, 'Rowspan covered' ) ).toHaveCount( 0 );

		expect( await getTableRowOrder( tableRows, mergedCellsRowLabels ) ).toEqual(
			mergedCellsRowLabels
		);
		expect( await editor.getEditedPostContent() ).toBe( originalContent );
	} );

	test( 'omits a destination inside the rowspan range and moves across the whole range', async ( {
		editor,
		page,
	} ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const charlieHandle = await getRowHandle( editorContext, tableRows, 4, 'Charlie' );
		const forbiddenDestination = editorContext.getByRole( 'button', {
			name: /^(Move before row 6: Rowspan covered|6行目「Rowspan covered」の前へ移動)$/,
		} );
		const afterRowspanDestination = editorContext.getByRole( 'button', {
			name: /^(Move before row 7: Delta|7行目「Delta」の前へ移動)$/,
		} );

		await charlieHandle.click();

		await expect( forbiddenDestination ).toHaveCount( 0 );
		await expect( afterRowspanDestination ).toBeVisible();

		await afterRowspanDestination.click();

		await expect
			.poll( () => getTableRowOrder( tableRows, mergedCellsRowLabels ) )
			.toEqual( [
				'Alpha',
				'Bravo',
				'Colspan',
				'Rowspan start',
				'Rowspan covered',
				'Charlie',
				'Delta',
				'Echo',
			] );
	} );

	test( 'skips the destination inside the rowspan range with the keyboard', async ( {
		editor,
		page,
	} ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const charlieControl = await focusRowControlFromToolbar(
			page,
			editorContext,
			tableRows,
			4,
			'Charlie'
		);

		await page.keyboard.press( 'Enter' );
		await page.keyboard.press( 'ArrowDown' );

		await expect( charlieControl ).toBeFocused();
		expect( await getTableRowOrder( tableRows, mergedCellsRowLabels ) ).toEqual(
			mergedCellsRowLabels
		);

		await page.keyboard.press( 'Space' );

		await expect
			.poll( () => getTableRowOrder( tableRows, mergedCellsRowLabels ) )
			.toEqual( [
				'Alpha',
				'Bravo',
				'Colspan',
				'Rowspan start',
				'Rowspan covered',
				'Charlie',
				'Delta',
				'Echo',
			] );
	} );

	test( 'moves a colspan-only row to a valid destination', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const colspanHandle = await getRowHandle( editorContext, tableRows, 3, 'Colspan' );
		const topDestination = editorContext.getByRole( 'button', {
			name: /^(Move before row 1: Alpha|1行目「Alpha」の前へ移動)$/,
		} );

		await colspanHandle.click();
		await expect( topDestination ).toBeVisible();

		await topDestination.click();

		await expect
			.poll( () => getTableRowOrder( tableRows, mergedCellsRowLabels ) )
			.toEqual( [
				'Colspan',
				'Alpha',
				'Bravo',
				'Charlie',
				'Rowspan start',
				'Rowspan covered',
				'Delta',
				'Echo',
			] );
	} );
} );

test.describe( 'Table Reorder merged-cell constraints on touch', () => {
	test.use( {
		hasTouch: true,
		isMobile: true,
		viewport: { height: 844, width: 390 },
	} );

	test.beforeEach( async ( { admin, editor, page, requestUtils } ) => {
		await dismissCoachmarks( requestUtils );
		await admin.createNewPost();
		await editor.setContent( mergedCellsTableContent );

		const editorContext = await getEditorContext( page, editor.canvas );
		await editor.selectBlocks( editorContext.locator( '[data-type="core/table"][data-block]' ) );
	} );

	test( 'does not expose rowspan row controls in touch reorder mode', async ( {
		editor,
		page,
	} ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const alphaControl = getRowControl( editorContext, 1, 'Alpha' );
		const originalContent = await editor.getEditedPostContent();

		await enterTouchReorderMode( page, editorContext, alphaControl );

		await expect( alphaControl ).toBeVisible();
		await expect( getRowControl( editorContext, 5, 'Rowspan start' ) ).toHaveCount( 0 );
		await expect( getRowControl( editorContext, 6, 'Rowspan covered' ) ).toHaveCount( 0 );
		expect( await getTableRowOrder( tableRows, mergedCellsRowLabels ) ).toEqual(
			mergedCellsRowLabels
		);
		expect( await editor.getEditedPostContent() ).toBe( originalContent );
	} );
} );
