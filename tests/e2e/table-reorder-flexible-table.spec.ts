import type { Locator, Page } from '@playwright/test';
import type { RequestUtils } from '@wordpress/e2e-test-utils-playwright';
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import { getEditorContext, type EditorContext } from './editor-context';
import {
	dragWithMouse,
	getRowControl,
	getRowHandle,
	getTableRow,
	getTableRowOrder,
	getTableRows,
} from './table-reorder';
import {
	dismissTouchCoachmark,
	dispatchTouchGesture,
	enterTouchReorderMode,
	interpolateTouchPoints,
} from './table-reorder-touch';

const flexibleTableContent = `<!-- wp:flexible-table-block/table -->
<figure class="wp-block-flexible-table-block-table"><table><tbody><tr><td>Alpha</td></tr><tr><td>Bravo</td></tr><tr><td>Charlie</td></tr><tr><td>Delta</td></tr></tbody></table></figure>
<!-- /wp:flexible-table-block/table -->`;
const expectedRowOrder = [ 'Alpha', 'Charlie', 'Delta', 'Bravo' ];
const flexibleTableBlockSelector = '[data-type="flexible-table-block/table"][data-block]';
const reorderRowsButtonName = /^(Reorder rows|行を並べ替え)$/;
const destinationName =
	/^(Move before row \d+: .+|Move to the end of the table\.|\d+行目「.+」の前へ移動|表の末尾へ移動)$/;
const PREFERENCES_SCOPE = 'yamabiko-editor-tools';
const KEYBOARD_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderKeyboardCoachmarkDismissed';

function getDestinations( editorContext: EditorContext ): Locator {
	return editorContext.getByRole( 'button', { name: destinationName } );
}

async function dismissKeyboardCoachmark( requestUtils: RequestUtils ): Promise< void > {
	await requestUtils.setPreferences( PREFERENCES_SCOPE, {
		[ KEYBOARD_COACHMARK_DISMISSED_PREFERENCE ]: true,
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

async function dragWithTouch(
	page: Page,
	source: Locator,
	target: Locator,
	duringDrag?: () => Promise< void >
): Promise< void > {
	await source.scrollIntoViewIfNeeded();
	await target.scrollIntoViewIfNeeded();

	const sourceBox = await source.boundingBox();
	const targetBox = await target.boundingBox();
	if ( ! sourceBox || ! targetBox ) {
		throw new Error( 'Could not determine touch drag coordinates.' );
	}

	const start = {
		x: sourceBox.x + sourceBox.width / 2,
		y: sourceBox.y + sourceBox.height / 2,
	};
	const activationPoint = {
		x: start.x,
		y: start.y + Math.min( 12, sourceBox.height / 4 ),
	};
	const end = {
		x: targetBox.x + targetBox.width / 2,
		y: targetBox.y + targetBox.height - 2,
	};
	const points = [
		...interpolateTouchPoints( start, activationPoint, 2 ),
		...interpolateTouchPoints( activationPoint, end, 10 ),
	];

	await dispatchTouchGesture( page, start, points, duringDrag );
}

test.describe( 'Table Reorder Flexible Table Block representative desktop operations', () => {
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

	test( 'moves a row with pointer drag and drop', async ( { page, editor } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const bravoHandle = await getRowHandle( editorContext, tableRows, 2, 'Bravo' );
		const deltaRow = getTableRow( tableRows, 'Delta' );

		await dragWithMouse( page, bravoHandle, deltaRow, 'after' );

		await expect.poll( () => getTableRowOrder( tableRows ) ).toEqual( expectedRowOrder );
	} );

	test( 'moves a row with the single-pointer destination flow', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const destinations = getDestinations( editorContext );
		const bravoHandle = await getRowHandle( editorContext, tableRows, 2, 'Bravo' );
		const endDestination = editorContext.getByRole( 'button', {
			name: /^(Move to the end of the table\.|表の末尾へ移動)$/,
		} );

		await bravoHandle.click();
		await expect( endDestination ).toBeVisible();
		expect( await destinations.count() ).toBeGreaterThan( 0 );
		await endDestination.click();

		await expect.poll( () => getTableRowOrder( tableRows ) ).toEqual( expectedRowOrder );
	} );

	test( 'moves a row with the keyboard flow', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const bravoControl = await focusRowControlFromToolbar(
			page,
			editorContext,
			tableRows,
			2,
			'Bravo'
		);

		await page.keyboard.press( 'Enter' );
		await expect( bravoControl ).toBeFocused();
		await page.keyboard.press( 'ArrowDown' );
		await page.keyboard.press( 'ArrowDown' );
		await page.keyboard.press( 'Space' );

		await expect.poll( () => getTableRowOrder( tableRows ) ).toEqual( expectedRowOrder );
	} );
} );

test.describe( 'Table Reorder Flexible Table Block representative touch operations', () => {
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

	test( 'moves a row with touch drag and drop', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const firstRowControl = getRowControl( editorContext, 1, 'Alpha' );
		const bravoControl = getRowControl( editorContext, 2, 'Bravo' );
		const deltaRow = getTableRow( tableRows, 'Delta' );

		await enterTouchReorderMode( page, editorContext, firstRowControl );
		await expect( bravoControl ).toBeVisible();
		await dragWithTouch( page, bravoControl, deltaRow );

		await expect.poll( () => getTableRowOrder( tableRows ) ).toEqual( expectedRowOrder );
	} );

	test( 'moves a row with the touch destination flow', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const firstRowControl = getRowControl( editorContext, 1, 'Alpha' );
		const bravoControl = getRowControl( editorContext, 2, 'Bravo' );
		const endDestination = editorContext.getByRole( 'button', {
			name: /^(Move to the end of the table\.|表の末尾へ移動)$/,
		} );

		await enterTouchReorderMode( page, editorContext, firstRowControl );
		await bravoControl.tap();
		await expect( endDestination ).toBeVisible();
		await endDestination.tap();

		await expect.poll( () => getTableRowOrder( tableRows ) ).toEqual( expectedRowOrder );
	} );
} );
