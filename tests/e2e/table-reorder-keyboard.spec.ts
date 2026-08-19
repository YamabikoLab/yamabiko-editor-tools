import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import { getEditorContext, type EditorContext } from './editor-context';
import {
	basicRowLabels,
	basicTableContent,
	getRowControl,
	getTableRow,
	getTableRowOrder,
	getTableRows,
	longRowLabels,
	longTableContent,
} from './table-reorder';

const reorderRowsButtonName = /^(Reorder rows|行を並べ替え)$/;
const keyboardGuidanceText =
	/^(↑↓ Move\u3000Enter \/ Space Confirm\u3000Esc Cancel|↑↓ 移動\u3000Enter \/ Space 決定\u3000Esc キャンセル)$/;

type ViewportGeometry = {
	bottom: number;
	centerY: number;
	top: number;
	viewportHeight: number;
};

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

async function getEditorScrollY( editorContext: EditorContext ): Promise< number > {
	return editorContext.locator( 'body' ).evaluate( ( body ) => {
		return body.ownerDocument.defaultView?.scrollY ?? 0;
	} );
}

async function getViewportGeometry( locator: Locator ): Promise< ViewportGeometry > {
	return locator.evaluate( ( element ) => {
		const rect = element.getBoundingClientRect();
		const viewportHeight =
			element.ownerDocument.defaultView?.innerHeight ??
			element.ownerDocument.documentElement.clientHeight;

		return {
			bottom: rect.bottom,
			centerY: rect.top + rect.height / 2,
			top: rect.top,
			viewportHeight,
		};
	} );
}

async function pressUntilEditorScrolls(
	page: Page,
	editorContext: EditorContext,
	key: 'ArrowDown' | 'ArrowUp',
	maximumMoves: number,
	didScroll: ( currentScrollY: number, initialScrollY: number ) => boolean
): Promise< { moves: number; scrollY: number } > {
	const initialScrollY = await getEditorScrollY( editorContext );

	for ( let moves = 1; moves <= maximumMoves; moves += 1 ) {
		await page.keyboard.press( key );
		const scrollY = await getEditorScrollY( editorContext );
		if ( didScroll( scrollY, initialScrollY ) ) {
			return { moves, scrollY };
		}
	}

	throw new Error( `Editor did not scroll after ${ key } keyboard movement.` );
}

async function pressDownUntilRowLeavesViewport(
	page: Page,
	row: Locator,
	maximumMoves: number
): Promise< number > {
	for ( let moves = 1; moves <= maximumMoves; moves += 1 ) {
		await page.keyboard.press( 'ArrowDown' );
		if ( ( await getViewportGeometry( row ) ).bottom < 0 ) {
			return moves;
		}
	}

	throw new Error( 'The starting row remained visible during downward keyboard movement.' );
}

function expectToBeInsideViewport( geometry: ViewportGeometry ): void {
	expect( geometry.top ).toBeGreaterThanOrEqual( 0 );
	expect( geometry.bottom ).toBeLessThanOrEqual( geometry.viewportHeight );
}

test.describe( 'Table Reorder keyboard operation', () => {
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

	test( 'enters row controls from the toolbar and tabs in logical order', async ( {
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
		const charlieControl = getRowControl( editorContext, 3, 'Charlie' );

		await page.keyboard.press( 'Tab' );
		await expect( charlieControl ).toBeFocused();

		await page.keyboard.press( 'Shift+Tab' );
		await expect( bravoControl ).toBeFocused();
	} );

	test( 'starts with Enter, moves down, and confirms with Space', async ( { editor, page } ) => {
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
		await expect( bravoControl ).toBeFocused();
		await page.keyboard.press( 'Space' );

		await expect
			.poll( () => getTableRowOrder( tableRows ) )
			.toEqual( [ 'Alpha', 'Charlie', 'Bravo', 'Delta' ] );
		await expect
			.poll( () => editor.getEditedPostContent() )
			.toContain(
				'<tbody><tr><td>Alpha</td></tr><tr><td>Charlie</td></tr><tr><td>Bravo</td></tr><tr><td>Delta</td></tr></tbody>'
			);
		await expect( getRowControl( editorContext, 3, 'Bravo' ) ).toBeFocused();
	} );

	test( 'starts with Space, moves up, and confirms with Enter', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const charlieControl = await focusRowControlFromToolbar(
			page,
			editorContext,
			tableRows,
			3,
			'Charlie'
		);

		await page.keyboard.press( 'Space' );
		await expect( charlieControl ).toBeFocused();
		await page.keyboard.press( 'ArrowUp' );
		await page.keyboard.press( 'Enter' );

		await expect
			.poll( () => getTableRowOrder( tableRows ) )
			.toEqual( [ 'Alpha', 'Charlie', 'Bravo', 'Delta' ] );
		await expect
			.poll( () => editor.getEditedPostContent() )
			.toContain(
				'<tbody><tr><td>Alpha</td></tr><tr><td>Charlie</td></tr><tr><td>Bravo</td></tr><tr><td>Delta</td></tr></tbody>'
			);
		await expect( getRowControl( editorContext, 2, 'Charlie' ) ).toBeFocused();
	} );

	test( 'cancels with Escape without changing the row order', async ( { editor, page } ) => {
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

		await page.keyboard.press( 'Enter' );
		await page.keyboard.press( 'ArrowDown' );
		await page.keyboard.press( 'Escape' );

		expect( await getTableRowOrder( tableRows ) ).toEqual( basicRowLabels );
		expect( await editor.getEditedPostContent() ).toBe( originalContent );
		await expect( bravoControl ).toBeFocused();
	} );
} );

test.describe( 'Table Reorder keyboard operation in a long table', () => {
	test.use( {
		hasTouch: false,
		isMobile: false,
	} );

	test.beforeEach( async ( { admin, editor, page } ) => {
		await admin.createNewPost();
		await editor.setContent( longTableContent );

		const editorContext = await getEditorContext( page, editor.canvas );
		await editor.selectBlocks( editorContext.locator( '[data-type="core/table"][data-block]' ) );
	} );

	test( 'keeps the destination visible while following vertical keyboard movement', async ( {
		editor,
		page,
	} ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const originalContent = await editor.getEditedPostContent();
		const startingRow = getTableRow( tableRows, longRowLabels[ 1 ] );
		const rowControl = await focusRowControlFromToolbar(
			page,
			editorContext,
			tableRows,
			2,
			longRowLabels[ 1 ]
		);
		const insertionLine = editorContext.locator( '.yamabiko-table-reorder-insertion-line' );
		const guidance = editorContext.getByText( keyboardGuidanceText );

		await page.keyboard.press( 'Enter' );
		const downMovement = await pressUntilEditorScrolls(
			page,
			editorContext,
			'ArrowDown',
			longRowLabels.length - 2,
			( current, initial ) => current > initial + 1
		);

		await expect( insertionLine ).toBeVisible();
		expectToBeInsideViewport( await getViewportGeometry( insertionLine ) );
		await expect( guidance ).toBeVisible();
		const downGuidanceGeometry = await getViewportGeometry( guidance );
		expect( downGuidanceGeometry.centerY ).toBeLessThan( downGuidanceGeometry.viewportHeight / 2 );

		const additionalDownMoves = await pressDownUntilRowLeavesViewport(
			page,
			startingRow,
			longRowLabels.length - downMovement.moves - 2
		);
		expectToBeInsideViewport( await getViewportGeometry( insertionLine ) );
		const scrollBeforeMovingUp = await getEditorScrollY( editorContext );
		const upMovement = await pressUntilEditorScrolls(
			page,
			editorContext,
			'ArrowUp',
			downMovement.moves + additionalDownMoves + 1,
			( current, initial ) => current < initial - 1
		);

		expect( upMovement.scrollY ).toBeLessThan( scrollBeforeMovingUp );
		expectToBeInsideViewport( await getViewportGeometry( insertionLine ) );
		const upGuidanceGeometry = await getViewportGeometry( guidance );
		expect( upGuidanceGeometry.centerY ).toBeGreaterThan( upGuidanceGeometry.viewportHeight / 2 );

		await page.keyboard.press( 'Escape' );

		expect( await editor.getEditedPostContent() ).toBe( originalContent );
		await expect( rowControl ).toBeFocused();
	} );
} );
