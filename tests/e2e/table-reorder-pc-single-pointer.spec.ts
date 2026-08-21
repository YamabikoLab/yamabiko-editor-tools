import type { Locator } from '@playwright/test';
import type { RequestUtils } from '@wordpress/e2e-test-utils-playwright';
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import { getEditorContext, type EditorContext } from './editor-context';
import {
	basicRowLabels,
	basicTableContent,
	getRowHandle,
	getRowControl,
	getTableRowOrder,
	getTableRows,
} from './table-reorder';

const pcPointerGuidance =
	/^(Click destination\u3000Esc Cancel|移動先をクリック\u3000Esc キャンセル)$/;
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

test.describe( 'Table Reorder PC single-pointer operation', () => {
	test.use( {
		hasTouch: false,
		isMobile: false,
	} );

	test.beforeEach( async ( { admin, editor, page, requestUtils } ) => {
		await dismissKeyboardCoachmark( requestUtils );
		await admin.createNewPost();
		await editor.setContent( basicTableContent );

		const editorContext = await getEditorContext( page, editor.canvas );
		await editor.selectBlocks( editorContext.locator( '[data-type="core/table"][data-block]' ) );
	} );

	test( 'selects a destination with clicks and moves the row', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const guidance = editorContext.getByText( pcPointerGuidance );
		const destinations = getDestinations( editorContext );
		const bravoHandle = await getRowHandle( editorContext, tableRows, 2, 'Bravo' );
		const originalPosition = editorContext.getByRole( 'button', {
			name: /^(Move before row 2: Bravo|2行目「Bravo」の前へ移動)$/,
		} );
		const endDestination = editorContext.getByRole( 'button', {
			name: /^(Move to the end of the table\.|表の末尾へ移動)$/,
		} );

		await bravoHandle.click();

		await expect( guidance ).toBeVisible();
		await expect( endDestination ).toBeVisible();
		await expect( bravoHandle ).toBeFocused();
		await expect( endDestination ).not.toBeFocused();
		expect( await destinations.count() ).toBeGreaterThan( 0 );
		await expect( originalPosition ).toHaveCount( 0 );

		await endDestination.click();

		await expect( guidance ).toHaveCount( 0 );
		await expect( destinations ).toHaveCount( 0 );
		await expect
			.poll( () => getTableRowOrder( tableRows ) )
			.toEqual( [ 'Alpha', 'Charlie', 'Delta', 'Bravo' ] );
		await expect( getRowControl( editorContext, 4, 'Bravo' ) ).toBeFocused();
		await expect
			.poll( () => editor.getEditedPostContent() )
			.toContain(
				'<tbody><tr><td>Alpha</td></tr><tr><td>Charlie</td></tr><tr><td>Delta</td></tr><tr><td>Bravo</td></tr></tbody>'
			);
	} );

	test( 'cancels destination selection with Escape without moving the row', async ( {
		editor,
		page,
	} ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const guidance = editorContext.getByText( pcPointerGuidance );
		const destinations = getDestinations( editorContext );
		const originalContent = await editor.getEditedPostContent();
		const bravoHandle = await getRowHandle( editorContext, tableRows, 2, 'Bravo' );

		await bravoHandle.click();
		await expect( guidance ).toBeVisible();
		expect( await destinations.count() ).toBeGreaterThan( 0 );
		await expect( bravoHandle ).toBeFocused();

		await bravoHandle.press( 'Escape' );

		await expect( guidance ).toHaveCount( 0 );
		await expect( destinations ).toHaveCount( 0 );
		await expect( getRowControl( editorContext, 2, 'Bravo' ) ).toBeFocused();
		expect( await getTableRowOrder( tableRows ) ).toEqual( basicRowLabels );
		expect( await editor.getEditedPostContent() ).toBe( originalContent );
	} );
} );
