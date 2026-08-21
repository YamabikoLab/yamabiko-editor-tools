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
	getVerticalScrollPosition,
	longRowLabels,
	longTableContent,
} from './table-reorder';
import {
	dismissTouchCoachmark,
	dispatchTouchGesture,
	enterTouchReorderMode,
	interpolateTouchPoints,
} from './table-reorder-touch';

const reorderRowsButtonName = /^(Reorder rows|行を並べ替え)$/;
const touchModeGuidance =
	/^(Handle: drag to move \/ tap to choose destination\sCell: tap to edit|ハンドル: ドラッグで移動 \/ タップで移動先選択\sセル: タップで編集)$/;
const touchPointerGuidance = /^(Tap destination|移動先をタップ)$/;
const destinationName =
	/^(Move before row \d+: .+|Move to the end of the table\.|\d+行目「.+」の前へ移動|表の末尾へ移動)$/;

function getDestinations( editorContext: EditorContext ): Locator {
	return editorContext.getByRole( 'button', { name: destinationName } );
}

async function swipeVerticallyFromDestination(
	page: Page,
	destination: Locator,
	direction: 'down' | 'up'
): Promise< void > {
	await destination.scrollIntoViewIfNeeded();

	const destinationBox = await destination.boundingBox();
	const viewport = page.viewportSize();
	if ( ! destinationBox || ! viewport ) {
		throw new Error( 'Could not determine touch swipe coordinates.' );
	}

	const start = {
		x: destinationBox.x + destinationBox.width / 2,
		y: destinationBox.y + destinationBox.height / 2,
	};
	const viewportMargin = 20;
	const requestedDistance = Math.min( 240, viewport.height / 3 );
	const availableDistance =
		direction === 'up' ? start.y - viewportMargin : viewport.height - viewportMargin - start.y;
	const distance = Math.min( requestedDistance, availableDistance );
	if ( distance <= 0 ) {
		throw new Error( 'The destination does not have room for a vertical touch swipe.' );
	}

	const end = {
		x: start.x,
		y: start.y + ( direction === 'up' ? -distance : distance ),
	};

	await dispatchTouchGesture( page, start, interpolateTouchPoints( start, end, 12 ) );
}

async function getGuidanceViewportSide(
	page: Page,
	guidance: Locator
): Promise< 'bottom' | 'top' > {
	const guidanceBox = await guidance.boundingBox();
	const viewport = page.viewportSize();
	if ( ! guidanceBox || ! viewport ) {
		throw new Error( 'Could not determine touch guidance position.' );
	}

	return guidanceBox.y + guidanceBox.height / 2 < viewport.height / 2 ? 'top' : 'bottom';
}

test.describe( 'Table Reorder touch single-pointer operation', () => {
	test.use( {
		hasTouch: true,
		isMobile: true,
		viewport: { height: 844, width: 390 },
	} );

	test.beforeEach( async ( { admin, requestUtils } ) => {
		await dismissTouchCoachmark( requestUtils );
		await admin.createNewPost();
	} );

	test( 'enters reorder mode without selecting a row', async ( { editor, page } ) => {
		await editor.setContent( basicTableContent );
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const destinations = getDestinations( editorContext );
		const modeGuidance = editorContext.getByText( touchModeGuidance );
		const pointerGuidance = editorContext.getByText( touchPointerGuidance );
		const firstRowControl = getRowControl( editorContext, 1, 'Alpha' );
		const originalContent = await editor.getEditedPostContent();

		await editor.selectBlocks( editorContext.locator( '[data-type="core/table"][data-block]' ) );
		await enterTouchReorderMode( page, editorContext, firstRowControl );

		await expect( modeGuidance ).toBeVisible();
		await expect( pointerGuidance ).toHaveCount( 0 );
		await expect( destinations ).toHaveCount( 0 );
		expect( await getTableRowOrder( tableRows ) ).toEqual( basicRowLabels );
		expect( await editor.getEditedPostContent() ).toBe( originalContent );
	} );

	test( 'keeps a cell tap as normal table editing in reorder mode', async ( { editor, page } ) => {
		await editor.setContent( basicTableContent );
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const destinations = getDestinations( editorContext );
		const modeGuidance = editorContext.getByText( touchModeGuidance );
		const pointerGuidance = editorContext.getByText( touchPointerGuidance );
		const firstRowControl = getRowControl( editorContext, 1, 'Alpha' );
		const bravoCell = getTableRow( tableRows, 'Bravo' ).getByText( 'Bravo', { exact: true } );
		const originalContent = await editor.getEditedPostContent();

		await editor.selectBlocks( editorContext.locator( '[data-type="core/table"][data-block]' ) );
		await enterTouchReorderMode( page, editorContext, firstRowControl );
		await bravoCell.tap();

		await expect( bravoCell ).toHaveAttribute( 'contenteditable', 'true' );
		await expect( bravoCell ).toBeFocused();
		await expect( modeGuidance ).toBeVisible();
		await expect( pointerGuidance ).toHaveCount( 0 );
		await expect( destinations ).toHaveCount( 0 );
		expect( await getTableRowOrder( tableRows ) ).toEqual( basicRowLabels );
		expect( await editor.getEditedPostContent() ).toBe( originalContent );
	} );

	test( 'taps a row handle and destination to move the row', async ( { editor, page } ) => {
		await editor.setContent( basicTableContent );
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const destinations = getDestinations( editorContext );
		const modeGuidance = editorContext.getByText( touchModeGuidance );
		const pointerGuidance = editorContext.getByText( touchPointerGuidance );
		const firstRowControl = getRowControl( editorContext, 1, 'Alpha' );
		const bravoControl = getRowControl( editorContext, 2, 'Bravo' );
		const originalPosition = editorContext.getByRole( 'button', {
			name: /^(Move before row 2: Bravo|2行目「Bravo」の前へ移動)$/,
		} );
		const endDestination = editorContext.getByRole( 'button', {
			name: /^(Move to the end of the table\.|表の末尾へ移動)$/,
		} );

		await editor.selectBlocks( editorContext.locator( '[data-type="core/table"][data-block]' ) );
		await enterTouchReorderMode( page, editorContext, firstRowControl );
		await bravoControl.tap();

		await expect( pointerGuidance ).toBeVisible();
		await expect( modeGuidance ).toBeHidden();
		await expect( endDestination ).toBeVisible();
		expect( await destinations.count() ).toBeGreaterThan( 0 );
		await expect( originalPosition ).toHaveCount( 0 );

		await endDestination.tap();

		await expect( pointerGuidance ).toHaveCount( 0 );
		await expect( destinations ).toHaveCount( 0 );
		await expect( modeGuidance ).toBeVisible();
		await expect.poll( () => getTableRowOrder( tableRows ) ).toEqual( [ 'Alpha', 'Charlie', 'Delta', 'Bravo' ] );
		await expect
			.poll( () => editor.getEditedPostContent() )
			.toContain( '<tbody><tr><td>Alpha</td></tr><tr><td>Charlie</td></tr><tr><td>Delta</td></tr><tr><td>Bravo</td></tr></tbody>' );
	} );

	test( 'cancels destination selection with the touch Cancel button', async ( { editor, page } ) => {
		await editor.setContent( basicTableContent );
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const destinations = getDestinations( editorContext );
		const modeGuidance = editorContext.getByText( touchModeGuidance );
		const pointerGuidance = editorContext.getByText( touchPointerGuidance );
		const firstRowControl = getRowControl( editorContext, 1, 'Alpha' );
		const bravoControl = getRowControl( editorContext, 2, 'Bravo' );
		const cancelButton = editorContext.getByRole( 'button', { name: /^(Cancel|キャンセル)$/ } );
		const originalContent = await editor.getEditedPostContent();

		await editor.selectBlocks( editorContext.locator( '[data-type="core/table"][data-block]' ) );
		await enterTouchReorderMode( page, editorContext, firstRowControl );
		await bravoControl.tap();
		await expect( pointerGuidance ).toBeVisible();
		await expect( cancelButton ).toBeVisible();

		await cancelButton.tap();

		await expect( pointerGuidance ).toHaveCount( 0 );
		await expect( destinations ).toHaveCount( 0 );
		await expect( modeGuidance ).toBeVisible();
		expect( await getTableRowOrder( tableRows ) ).toEqual( basicRowLabels );
		expect( await editor.getEditedPostContent() ).toBe( originalContent );

		await firstRowControl.tap();
		await expect( pointerGuidance ).toBeVisible();
		expect( await editor.getEditedPostContent() ).toBe( originalContent );
	} );

	test( 'discards destination selection when reorder mode is turned off', async ( { editor, page } ) => {
		await editor.setContent( basicTableContent );
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const destinations = getDestinations( editorContext );
		const pointerGuidance = editorContext.getByText( touchPointerGuidance );
		const firstRowControl = getRowControl( editorContext, 1, 'Alpha' );
		const bravoControl = getRowControl( editorContext, 2, 'Bravo' );
		const reorderRowsButton = page.getByRole( 'button', { name: reorderRowsButtonName } );
		const originalContent = await editor.getEditedPostContent();

		await editor.selectBlocks( editorContext.locator( '[data-type="core/table"][data-block]' ) );
		await enterTouchReorderMode( page, editorContext, firstRowControl );
		await bravoControl.tap();
		await expect( pointerGuidance ).toBeVisible();

		await reorderRowsButton.tap();

		await expect( reorderRowsButton ).toHaveAttribute( 'aria-pressed', 'false' );
		await expect( pointerGuidance ).toHaveCount( 0 );
		await expect( destinations ).toHaveCount( 0 );
		await expect( firstRowControl ).toHaveCount( 0 );
		expect( await getTableRowOrder( tableRows ) ).toEqual( basicRowLabels );
		expect( await editor.getEditedPostContent() ).toBe( originalContent );
	} );

	test( 'keeps destination selection while touch swipes scroll and move guidance', async ( { editor, page } ) => {
		await editor.setContent( longTableContent );
		const editorContext = await getEditorContext( page, editor.canvas );
		const table = editorContext.getByRole( 'table' );
		const destinations = getDestinations( editorContext );
		const pointerGuidance = editorContext.getByText( touchPointerGuidance );
		const firstRowControl = getRowControl( editorContext, 1, longRowLabels[ 0 ] );
		const secondRowControl = getRowControl( editorContext, 2, longRowLabels[ 1 ] );
		const scrollDestination = editorContext.getByRole( 'button', {
			name: /^(Move before row 10: Row 10|10行目「Row 10」の前へ移動)$/,
		} );

		await editor.selectBlocks( editorContext.locator( '[data-type="core/table"][data-block]' ) );
		await enterTouchReorderMode( page, editorContext, firstRowControl );
		await secondRowControl.tap();
		await expect( pointerGuidance ).toBeVisible();
		await expect( scrollDestination ).toBeVisible();
		const originalContent = await editor.getEditedPostContent();
		const initialScrollPosition = await getVerticalScrollPosition( table );

		await swipeVerticallyFromDestination( page, scrollDestination, 'up' );

		await expect.poll( () => getVerticalScrollPosition( table ) ).toBeGreaterThan( initialScrollPosition );
		await expect.poll( () => getGuidanceViewportSide( page, pointerGuidance ) ).toBe( 'top' );
		await expect.poll( () => editor.getEditedPostContent() ).toBe( originalContent );
		await expect( pointerGuidance ).toBeVisible();
		expect( await destinations.count() ).toBeGreaterThan( 0 );
		expect( await getGuidanceViewportSide( page, pointerGuidance ) ).toBe( 'top' );
		const scrollPositionAfterUpSwipe = await getVerticalScrollPosition( table );

		await swipeVerticallyFromDestination( page, scrollDestination, 'down' );

		await expect.poll( () => getVerticalScrollPosition( table ) ).toBeLessThan( scrollPositionAfterUpSwipe );
		await expect.poll( () => getGuidanceViewportSide( page, pointerGuidance ) ).toBe( 'bottom' );
		await expect.poll( () => editor.getEditedPostContent() ).toBe( originalContent );
		await expect( pointerGuidance ).toBeVisible();
		expect( await destinations.count() ).toBeGreaterThan( 0 );

		await expect( scrollDestination ).toBeVisible();
		await scrollDestination.tap();

		await expect.poll( () => editor.getEditedPostContent() ).not.toBe( originalContent );
		await expect( pointerGuidance ).toHaveCount( 0 );
		await expect( destinations ).toHaveCount( 0 );
	} );
} );
