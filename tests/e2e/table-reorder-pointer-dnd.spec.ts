import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import { getEditorContext } from './editor-context';
import {
	basicRowLabels,
	basicTableContent,
	getRowHandle,
	getTableRow,
	getTableRowOrder,
	getTableRows,
} from './table-reorder';

type VerticalTarget = 'before' | 'center' | 'after';

async function dragWithMouse(
	page: Page,
	source: Locator,
	target: Locator,
	verticalTarget: VerticalTarget,
	duringDrag?: () => Promise< void >
): Promise< void > {
	await source.scrollIntoViewIfNeeded();
	await target.scrollIntoViewIfNeeded();

	const sourceBox = await source.boundingBox();
	const targetBox = await target.boundingBox();
	if ( ! sourceBox || ! targetBox ) {
		throw new Error( 'Could not determine mouse drag coordinates.' );
	}

	const sourceX = sourceBox.x + sourceBox.width / 2;
	const sourceY = sourceBox.y + sourceBox.height / 2;
	const targetX = targetBox.x + targetBox.width / 2;
	let targetY = targetBox.y + targetBox.height / 2;
	if ( verticalTarget === 'before' ) {
		targetY = targetBox.y + 2;
	} else if ( verticalTarget === 'after' ) {
		targetY = targetBox.y + targetBox.height - 2;
	}

	await page.mouse.move( sourceX, sourceY );
	await page.mouse.down();
	try {
		await page.mouse.move( sourceX, sourceY + 6, { steps: 2 } );
		await page.mouse.move( targetX, targetY, { steps: 10 } );
		await duringDrag?.();
	} finally {
		await page.mouse.up();
	}
}

test.describe( 'Table Reorder pointer drag and drop', () => {
	test.use( {
		hasTouch: false,
		isMobile: false,
	} );

	test.beforeEach( async ( { admin, editor, page } ) => {
		await admin.createNewPost();
		await editor.setContent( basicTableContent );

		const editorContext = await getEditorContext( page, editor.canvas );
		await editor.selectBlocks( editorContext.locator( '[data-type="core/table"][data-block]' ) );
	} );

	test( 'moves a row to another valid position with the row handle', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const bravoHandle = await getRowHandle( editorContext, tableRows, 2, 'Bravo' );
		const deltaRow = getTableRow( tableRows, 'Delta' );
		const insertionIndicator = editorContext.locator( '.yamabiko-table-reorder-insertion-line' );

		await dragWithMouse( page, bravoHandle, deltaRow, 'after', async () => {
			await expect( insertionIndicator ).toBeVisible();
		} );

		await expect
			.poll( () => getTableRowOrder( tableRows ) )
			.toEqual( [ 'Alpha', 'Charlie', 'Delta', 'Bravo' ] );
		expect( await editor.getEditedPostContent() ).toContain(
			'<tbody><tr><td>Alpha</td></tr><tr><td>Charlie</td></tr><tr><td>Delta</td></tr><tr><td>Bravo</td></tr></tbody>'
		);
	} );

	test( 'keeps the row order when dropped back at the original position', async ( {
		editor,
		page,
	} ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const originalContent = await editor.getEditedPostContent();
		const bravoHandle = await getRowHandle( editorContext, tableRows, 2, 'Bravo' );
		const bravoRow = getTableRow( tableRows, 'Bravo' );

		await dragWithMouse( page, bravoHandle, bravoRow, 'center' );

		expect( await getTableRowOrder( tableRows ) ).toEqual( basicRowLabels );
		expect( await editor.getEditedPostContent() ).toBe( originalContent );
	} );

	test( 'keeps the row order when dragging from table cell content', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const originalContent = await editor.getEditedPostContent();
		const bravoCellContent = getTableRow( tableRows, 'Bravo' ).getByText( 'Bravo', {
			exact: true,
		} );
		const deltaCellContent = getTableRow( tableRows, 'Delta' ).getByText( 'Delta', {
			exact: true,
		} );

		await dragWithMouse( page, bravoCellContent, deltaCellContent, 'center' );

		expect( await getTableRowOrder( tableRows ) ).toEqual( basicRowLabels );
		expect( await editor.getEditedPostContent() ).toBe( originalContent );
	} );
} );
