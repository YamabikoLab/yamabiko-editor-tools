import type { Locator, Page } from '@playwright/test';
import type { Editor, RequestUtils } from '@wordpress/e2e-test-utils-playwright';
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import { getEditorContext, type EditorContext } from './editor-context';
import {
	basicRowLabels,
	basicTableContent,
	dragWithMouse,
	getRowHandle,
	getTableRow,
	getTableRowOrder,
	getTableRows,
} from './table-reorder';

const richRowLabels = [ 'Alpha', 'Rich Bravo', 'Charlie', 'Delta' ] as const;
const richTableContent = `<!-- wp:table -->
<figure class="wp-block-table"><table class="has-fixed-layout"><tbody><tr><td>Alpha</td><td>A</td></tr><tr><th scope="row"><strong><a href="https://example.com/rich-bravo">Rich Bravo</a></strong></th><td class="has-text-align-center" data-align="center">Centered detail</td></tr><tr><td>Charlie</td><td>C</td></tr><tr><td>Delta</td><td>D</td></tr></tbody></table></figure>
<!-- /wp:table -->`;
const PREFERENCES_SCOPE = 'yamabiko-editor-tools';
const KEYBOARD_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderKeyboardCoachmarkDismissed';

async function dismissKeyboardCoachmark( requestUtils: RequestUtils ): Promise< void > {
	await requestUtils.setPreferences( PREFERENCES_SCOPE, {
		[ KEYBOARD_COACHMARK_DISMISSED_PREFERENCE ]: true,
	} );
}

async function setTableContent(
	editorContext: EditorContext,
	editor: Editor,
	content: string
): Promise< void > {
	await editor.setContent( content );
	await editor.selectBlocks( editorContext.locator( '[data-type="core/table"][data-block]' ) );
}

async function expectRichBravoData( tableRows: Locator ): Promise< void > {
	const richBravoRow = getTableRow( tableRows, 'Rich Bravo' );
	const rowHeader = richBravoRow.getByRole( 'rowheader' );
	const emphasizedLink = rowHeader.locator( 'strong' ).getByRole( 'link', {
		name: 'Rich Bravo',
	} );
	const centeredCell = richBravoRow.getByRole( 'cell', { name: 'Centered detail' } );

	await expect( rowHeader ).toHaveAttribute( 'scope', 'row' );
	await expect( emphasizedLink ).toHaveAttribute( 'href', 'https://example.com/rich-bravo' );
	await expect( centeredCell ).toHaveClass( /\bhas-text-align-center\b/ );
}

async function expectOtherRowData( tableRows: Locator ): Promise< void > {
	for ( const [ rowLabel, cellContent ] of [
		[ 'Alpha', 'A' ],
		[ 'Charlie', 'C' ],
		[ 'Delta', 'D' ],
	] as const ) {
		await expect(
			getTableRow( tableRows, rowLabel ).getByRole( 'cell', {
				name: cellContent,
				exact: true,
			} )
		).toBeVisible();
	}
}

async function undoOnce( page: Page ): Promise< void > {
	await page.keyboard.press( 'Control+z' );
}

test.describe( 'Table Reorder data preservation and Undo', () => {
	test.use( {
		hasTouch: false,
		isMobile: false,
	} );

	test.beforeEach( async ( { admin, requestUtils } ) => {
		await dismissKeyboardCoachmark( requestUtils );
		await admin.createNewPost();
	} );

	test( 'preserves rich row data through a single-pointer move and one Undo', async ( {
		editor,
		page,
	} ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		await setTableContent( editorContext, editor, richTableContent );

		const tableRows = getTableRows( editorContext );
		const bravoHandle = await getRowHandle( editorContext, tableRows, 2, 'Rich Bravo' );
		const endDestination = editorContext.getByRole( 'button', {
			name: /^(Move to the end of the table\.|表の末尾へ移動)$/,
		} );

		await expectRichBravoData( tableRows );
		await bravoHandle.click();
		await endDestination.click();

		await expect
			.poll( () => getTableRowOrder( tableRows, richRowLabels ) )
			.toEqual( [ 'Alpha', 'Charlie', 'Delta', 'Rich Bravo' ] );
		await expectRichBravoData( tableRows );
		await expectOtherRowData( tableRows );
		await expect
			.poll( () => editor.getEditedPostContent() )
			.toContain(
				'<th scope="row"><strong><a href="https://example.com/rich-bravo">Rich Bravo</a></strong></th><td class="has-text-align-center" data-align="center">Centered detail</td>'
			);

		await undoOnce( page );

		await expect
			.poll( () => getTableRowOrder( tableRows, richRowLabels ) )
			.toEqual( richRowLabels );
		await expectRichBravoData( tableRows );
		await expectOtherRowData( tableRows );
	} );

	test( 'restores a pointer drag commit with one Undo', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		await setTableContent( editorContext, editor, basicTableContent );

		const tableRows = getTableRows( editorContext );
		const bravoHandle = await getRowHandle( editorContext, tableRows, 2, 'Bravo' );
		const deltaRow = getTableRow( tableRows, 'Delta' );

		await dragWithMouse( page, bravoHandle, deltaRow, 'after' );
		await expect
			.poll( () => getTableRowOrder( tableRows ) )
			.toEqual( [ 'Alpha', 'Charlie', 'Delta', 'Bravo' ] );

		await undoOnce( page );

		await expect.poll( () => getTableRowOrder( tableRows ) ).toEqual( basicRowLabels );
	} );
} );
