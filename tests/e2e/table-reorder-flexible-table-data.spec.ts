import type { Locator, Page } from '@playwright/test';
import type { RequestUtils } from '@wordpress/e2e-test-utils-playwright';
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import { getEditorContext } from './editor-context';
import {
	getRowControl,
	getRowHandle,
	getTableRow,
	getTableRowOrder,
	getTableRows,
} from './table-reorder';

const richRowLabels = [
	'Alpha',
	'Rich Bravo',
	'Charlie',
	'Rowspan start',
	'Rowspan covered',
	'Delta',
] as const;
const flexibleTableRichContent = `<!-- wp:flexible-table-block/table -->
<figure class="wp-block-flexible-table-block-table"><table class="has-fixed-layout"><tbody><tr><td>Alpha</td><td>A</td></tr><tr><th scope="row" class="rich-bravo-cell" colspan="2" style="background-color:#123456">Rich Bravo</th></tr><tr><td>Charlie</td><td>C</td></tr><tr><td rowspan="2">Rowspan start</td><td>Rowspan detail</td></tr><tr><td>Rowspan covered</td></tr><tr><td>Delta</td><td>D</td></tr></tbody></table></figure>
<!-- /wp:flexible-table-block/table -->`;
const flexibleTableBlockSelector = '[data-type="flexible-table-block/table"][data-block]';
const endDestinationName = /^(Move to the end of the table\.|表の末尾へ移動)$/;
const forbiddenDestinationName =
	/^(Move before row 5: Rowspan covered|5行目「Rowspan covered」の前へ移動)$/;
const afterRowspanDestinationName = /^(Move before row 6: Delta|6行目「Delta」の前へ移動)$/;
const PREFERENCES_SCOPE = 'yamabiko-editor-tools';
const KEYBOARD_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderKeyboardCoachmarkDismissed';

async function dismissKeyboardCoachmark( requestUtils: RequestUtils ): Promise< void > {
	await requestUtils.setPreferences( PREFERENCES_SCOPE, {
		[ KEYBOARD_COACHMARK_DISMISSED_PREFERENCE ]: true,
	} );
}

async function savePostThroughEditorStore( page: Page ): Promise< void > {
	await page.evaluate( async () => {
		const data = (
			window as unknown as {
				wp: {
					data: {
						dispatch: ( store: string ) => {
							savePost: () => Promise< void >;
						};
					};
				};
			}
		).wp.data;

		await data.dispatch( 'core/editor' ).savePost();
	} );
}

async function expectRichBravoData( tableRows: Locator ): Promise< void > {
	const richBravoRow = getTableRow( tableRows, 'Rich Bravo' );
	const richBravoCell = richBravoRow.locator( 'th' ).filter( {
		hasText: 'Rich Bravo',
	} );

	await expect( richBravoCell ).toHaveAttribute( 'scope', 'row' );
	await expect( richBravoCell ).toHaveAttribute( 'colspan', '2' );
	await expect( richBravoCell ).toHaveClass( /\brich-bravo-cell\b/ );
	await expect( richBravoCell ).toHaveCSS( 'background-color', 'rgb(18, 52, 86)' );
	await expect( richBravoCell ).toHaveText( 'Rich Bravo' );
}

async function expectRowspanData( tableRows: Locator ): Promise< void > {
	const rowspanCell = getTableRow( tableRows, 'Rowspan start' ).getByRole( 'cell', {
		name: 'Rowspan start',
		exact: true,
	} );

	await expect( rowspanCell ).toHaveAttribute( 'rowspan', '2' );
	await expect(
		getTableRow( tableRows, 'Rowspan covered' ).getByRole( 'cell', {
			name: 'Rowspan covered',
			exact: true,
		} )
	).toBeVisible();
}

test.describe( 'Table Reorder Flexible Table Block merged cells and persistence', () => {
	test.use( {
		hasTouch: false,
		isMobile: false,
	} );

	test.beforeEach( async ( { admin, editor, page, requestUtils } ) => {
		await dismissKeyboardCoachmark( requestUtils );
		await admin.createNewPost();
		await editor.setContent( flexibleTableRichContent );

		const editorContext = await getEditorContext( page, editor.canvas );
		await editor.selectBlocks( editorContext.locator( flexibleTableBlockSelector ) );
	} );

	test( 'does not split a rowspan range and moves across the whole range', async ( {
		editor,
		page,
	} ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );

		await getTableRow( tableRows, 'Rowspan start' ).hover();
		await expect( getRowControl( editorContext, 4, 'Rowspan start' ) ).toHaveCount( 0 );

		await getTableRow( tableRows, 'Rowspan covered' ).hover();
		await expect( getRowControl( editorContext, 5, 'Rowspan covered' ) ).toHaveCount( 0 );

		const charlieHandle = await getRowHandle( editorContext, tableRows, 3, 'Charlie' );
		const forbiddenDestination = editorContext.getByRole( 'button', {
			name: forbiddenDestinationName,
		} );
		const afterRowspanDestination = editorContext.getByRole( 'button', {
			name: afterRowspanDestinationName,
		} );

		await charlieHandle.click();
		await expect( forbiddenDestination ).toHaveCount( 0 );
		await expect( afterRowspanDestination ).toBeVisible();
		await afterRowspanDestination.click();

		await expect
			.poll( () => getTableRowOrder( tableRows, richRowLabels ) )
			.toEqual( [ 'Alpha', 'Rich Bravo', 'Rowspan start', 'Rowspan covered', 'Charlie', 'Delta' ] );
	} );

	test( 'moves a colspan-only rich row without losing Flexible Table cell data', async ( {
		editor,
		page,
	} ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const richBravoHandle = await getRowHandle( editorContext, tableRows, 2, 'Rich Bravo' );
		const endDestination = editorContext.getByRole( 'button', {
			name: endDestinationName,
		} );

		await richBravoHandle.click();
		await expect( endDestination ).toBeVisible();
		await endDestination.click();

		await expect
			.poll( () => getTableRowOrder( tableRows, richRowLabels ) )
			.toEqual( [ 'Alpha', 'Charlie', 'Rowspan start', 'Rowspan covered', 'Delta', 'Rich Bravo' ] );
		await expectRichBravoData( tableRows );
		await expectRowspanData( tableRows );
	} );

	test( 'preserves row order and representative cell data after save and reload', async ( {
		editor,
		page,
	} ) => {
		let editorContext = await getEditorContext( page, editor.canvas );
		let tableRows = getTableRows( editorContext );
		const richBravoHandle = await getRowHandle( editorContext, tableRows, 2, 'Rich Bravo' );
		const endDestination = editorContext.getByRole( 'button', {
			name: endDestinationName,
		} );

		await richBravoHandle.click();
		await expect( endDestination ).toBeVisible();
		await endDestination.click();
		await expect
			.poll( () => getTableRowOrder( tableRows, richRowLabels ) )
			.toEqual( [ 'Alpha', 'Charlie', 'Rowspan start', 'Rowspan covered', 'Delta', 'Rich Bravo' ] );

		await savePostThroughEditorStore( page );
		await page.reload();

		editorContext = await getEditorContext( page, editor.canvas );
		await expect( editorContext.locator( flexibleTableBlockSelector ) ).toBeVisible();
		tableRows = getTableRows( editorContext );

		await expect
			.poll( () => getTableRowOrder( tableRows, richRowLabels ) )
			.toEqual( [ 'Alpha', 'Charlie', 'Rowspan start', 'Rowspan covered', 'Delta', 'Rich Bravo' ] );
		await expectRichBravoData( tableRows );
		await expectRowspanData( tableRows );
	} );
} );
