import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import { getEditorContext, type EditorContext } from './editor-context';
import {
	basicRowLabels,
	basicTableContent,
	expectNotFullyCovered,
	getRowControl,
	getTableRow,
	getTableRowOrder,
	getTableRows,
	getVerticalScrollPosition,
	getVerticalScrollState,
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
	viewportBottom: number;
	viewportTop: number;
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
			viewportBottom: viewportHeight,
			viewportTop: 0,
		};
	} );
}

async function getScrollableViewportGeometry(
	locator: Locator,
	scrollSource: Locator
): Promise< ViewportGeometry > {
	const [ geometry, scrollState ] = await Promise.all( [
		getViewportGeometry( locator ),
		getVerticalScrollState( scrollSource ),
	] );

	return {
		...geometry,
		viewportBottom: scrollState.bottom,
		viewportTop: scrollState.top,
	};
}

async function pressUntilEditorScrolls(
	page: Page,
	scrollSource: Locator,
	key: 'ArrowDown' | 'ArrowUp',
	maximumMoves: number,
	didScroll: ( currentScrollY: number, initialScrollY: number ) => boolean
): Promise< { moves: number; scrollY: number } > {
	const initialScrollY = await getVerticalScrollPosition( scrollSource );

	for ( let moves = 1; moves <= maximumMoves; moves += 1 ) {
		await page.keyboard.press( key );
		const scrollY = await getVerticalScrollPosition( scrollSource );
		if ( didScroll( scrollY, initialScrollY ) ) {
			return { moves, scrollY };
		}
	}

	throw new Error( `Editor did not scroll after ${ key } keyboard movement.` );
}

async function pressDownUntilRowLeavesViewport(
	page: Page,
	row: Locator,
	scrollSource: Locator,
	maximumMoves: number
): Promise< number > {
	for ( let moves = 1; moves <= maximumMoves; moves += 1 ) {
		await page.keyboard.press( 'ArrowDown' );
		const geometry = await getScrollableViewportGeometry( row, scrollSource );
		if ( geometry.bottom < geometry.viewportTop - ( geometry.bottom - geometry.top ) ) {
			return moves;
		}
	}

	throw new Error( 'The starting row remained visible during downward keyboard movement.' );
}

async function expectToBeInsideScrollableViewport(
	locator: Locator,
	scrollSource: Locator
): Promise< void > {
	await expect
		.poll( async () => {
			const geometry = await getScrollableViewportGeometry( locator, scrollSource );
			return Math.min(
				geometry.top - geometry.viewportTop,
				geometry.viewportBottom - geometry.bottom
			);
		} )
		.toBeGreaterThanOrEqual( 0 );
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

	test( 'keeps idle Arrow focus and tabs row controls in logical order', async ( {
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

		await page.keyboard.press( 'ArrowDown' );
		await expect( bravoControl ).toBeFocused();
		await page.keyboard.press( 'ArrowUp' );
		await expect( bravoControl ).toBeFocused();

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
		const tableBody = editorContext.getByRole( 'table' ).locator( 'tbody' );
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
			tableBody,
			'ArrowDown',
			longRowLabels.length - 2,
			( current, initial ) => current > initial + 1
		);

		await expect( insertionLine ).toBeVisible();
		await expectToBeInsideScrollableViewport( insertionLine, tableBody );
		await expect( guidance ).toBeVisible();
		await expectNotFullyCovered( insertionLine, guidance );
		const downGuidanceGeometry = await getViewportGeometry( guidance );
		expect( downGuidanceGeometry.centerY ).toBeLessThan(
			( downGuidanceGeometry.viewportTop + downGuidanceGeometry.viewportBottom ) / 2
		);

		const additionalDownMoves = await pressDownUntilRowLeavesViewport(
			page,
			startingRow,
			tableBody,
			longRowLabels.length - downMovement.moves - 2
		);
		await expectToBeInsideScrollableViewport( insertionLine, tableBody );
		const scrollBeforeMovingUp = await getVerticalScrollPosition( tableBody );
		const upMovement = await pressUntilEditorScrolls(
			page,
			tableBody,
			'ArrowUp',
			downMovement.moves + additionalDownMoves + 1,
			( current, initial ) => current < initial - 1
		);

		expect( upMovement.scrollY ).toBeLessThan( scrollBeforeMovingUp );
		await expectToBeInsideScrollableViewport( insertionLine, tableBody );
		const upGuidanceGeometry = await getViewportGeometry( guidance );
		expect( upGuidanceGeometry.centerY ).toBeGreaterThan(
			( upGuidanceGeometry.viewportTop + upGuidanceGeometry.viewportBottom ) / 2
		);

		await page.keyboard.press( 'Escape' );

		expect( await editor.getEditedPostContent() ).toBe( originalContent );
		await expect( rowControl ).toBeFocused();
	} );
} );
