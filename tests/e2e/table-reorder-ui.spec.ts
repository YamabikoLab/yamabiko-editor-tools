import type { Locator, Page } from '@playwright/test';
import type { RequestUtils } from '@wordpress/e2e-test-utils-playwright';
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import { getEditorContext } from './editor-context';
import { getRowControl } from './table-reorder';

const BASIC_TABLE_CONTENT = `<!-- wp:table -->
<figure class="wp-block-table"><table class="has-fixed-layout"><tbody><tr><td>Alpha</td></tr><tr><td>Bravo</td></tr><tr><td>Charlie</td></tr></tbody></table></figure>
<!-- /wp:table -->

<!-- wp:paragraph -->
<p>Outside table</p>
<!-- /wp:paragraph -->`;

const BASIC_TABLE_ROW_LABELS = [ 'Alpha', 'Bravo', 'Charlie' ] as const;
const FOCUSED_TABLE_ROW_INDEX_ATTRIBUTE = 'data-yamabiko-e2e-focused-table-row-index';
const PREFERENCES_SCOPE = 'yamabiko-editor-tools';
const KEYBOARD_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderKeyboardCoachmarkDismissed';
const TOUCH_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderTouchCoachmarkDismissed';

async function setTableReorderCoachmarkDismissal(
	requestUtils: RequestUtils,
	{ keyboardDismissed, touchDismissed }: { keyboardDismissed: boolean; touchDismissed: boolean }
): Promise< void > {
	await requestUtils.setPreferences( PREFERENCES_SCOPE, {
		[ KEYBOARD_COACHMARK_DISMISSED_PREFERENCE ]: keyboardDismissed,
		[ TOUCH_COACHMARK_DISMISSED_PREFERENCE ]: touchDismissed,
	} );
}

async function startFocusedTableRowRecorder( tableBlock: Locator ): Promise< void > {
	await tableBlock.evaluate( ( block, attributeName ) => {
		const documentElement = block.ownerDocument.documentElement;
		documentElement.removeAttribute( attributeName );

		block.ownerDocument.addEventListener( 'focusin', ( event ) => {
			const target = event.target;
			if ( ! ( target instanceof Element ) ) {
				return;
			}

			const row = target.closest( 'tbody tr' );
			if ( ! row || ! block.contains( row ) || ! row.parentElement ) {
				return;
			}

			const rowIndex = Array.from( row.parentElement.children ).indexOf( row );
			if ( rowIndex >= 0 ) {
				documentElement.setAttribute( attributeName, String( rowIndex ) );
			}
		} );
	}, FOCUSED_TABLE_ROW_INDEX_ATTRIBUTE );
}

async function getRecordedFocusedTableRowIndex( tableBlock: Locator ): Promise< number > {
	const readRecordedRowIndex = () =>
		tableBlock.evaluate( ( block, attributeName ) => {
			return block.ownerDocument.documentElement.getAttribute( attributeName );
		}, FOCUSED_TABLE_ROW_INDEX_ATTRIBUTE );

	await expect
		.poll( readRecordedRowIndex, {
			message: 'Expected List View activation to focus a Table row.',
		} )
		.not.toBeNull();

	const recordedRowIndex = Number( await readRecordedRowIndex() );
	if ( ! Number.isInteger( recordedRowIndex ) || recordedRowIndex < 0 ) {
		throw new Error( 'Could not determine the Table row focused by Gutenberg.' );
	}

	return recordedRowIndex;
}

function getBasicTableRowLabel( rowIndex: number ): string {
	const rowLabel = BASIC_TABLE_ROW_LABELS[ rowIndex ];
	if ( ! rowLabel ) {
		throw new Error( 'Gutenberg focused a row outside the test Table.' );
	}

	return rowLabel;
}

async function focusWithArrowDown( page: Page, target: Locator ): Promise< void > {
	for ( let attempt = 0; attempt < 10; attempt++ ) {
		if ( await target.evaluate( ( element ) => element === element.ownerDocument.activeElement ) ) {
			return;
		}

		await page.keyboard.press( 'ArrowDown' );
	}

	await expect( target ).toBeFocused();
}

test.describe( 'Table Reorder UI', () => {
	test.use( {
		hasTouch: false,
		isMobile: false,
	} );

	test.beforeEach( async ( { admin, editor, requestUtils } ) => {
		await setTableReorderCoachmarkDismissal( requestUtils, {
			keyboardDismissed: false,
			touchDismissed: false,
		} );
		await admin.createNewPost();
		await editor.setContent( BASIC_TABLE_CONTENT );
	} );

	test( 'starts from the minimal table content', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );

		await expect( editorContext.getByText( 'Alpha', { exact: true } ) ).toBeVisible();
		await expect( editorContext.getByText( 'Bravo', { exact: true } ) ).toBeVisible();
		await expect( editorContext.getByText( 'Charlie', { exact: true } ) ).toBeVisible();
		await expect( editorContext.getByText( 'Outside table', { exact: true } ) ).toBeVisible();
	} );

	test( 'shows the toolbar entry only for a supported Table block', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableBlock = editorContext.locator( '[data-type="core/table"][data-block]' );
		const paragraphBlock = editorContext.locator( '[data-type="core/paragraph"][data-block]' );
		const reorderRowsButton = page.getByRole( 'button', {
			name: /^(Reorder rows|行を並べ替え)$/,
		} );

		await editor.selectBlocks( tableBlock );
		await expect( reorderRowsButton ).toBeVisible();

		await editor.selectBlocks( paragraphBlock );
		await expect( reorderRowsButton ).toHaveCount( 0 );
	} );

	test( 'does not show the keyboard coachmark for normal pointer selection', async ( {
		editor,
		page,
	} ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const reorderRowsButton = page.getByRole( 'button', {
			name: /^(Reorder rows|行を並べ替え)$/,
		} );
		const keyboardCoachmark = page.getByText(
			/^(Reorder rows with the keyboard\. Select “Reorder rows” in the toolbar, then use Tab \/ Shift\+Tab to choose a row to reorder\.|キーボードで行を並べ替えられます。ツールバーの「行を並べ替え」を選択し、Tab \/ Shift\+Tab で並べ替える行を選べます。)$/
		);

		await editorContext.getByText( 'Alpha', { exact: true } ).click();

		await expect( reorderRowsButton ).toBeVisible();
		await expect( keyboardCoachmark ).toHaveCount( 0 );
	} );

	test( 'shows a row control while its row is hovered on desktop', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableBlock = editorContext.locator( '[data-type="core/table"][data-block]' );
		const firstRow = editorContext.locator( 'tbody tr' ).filter( { hasText: 'Alpha' } );
		const firstRowControl = editorContext.getByRole( 'button', {
			name: /^(Reorder row 1: Alpha|1行目「Alpha」を並べ替え)$/,
		} );
		const reorderRowsButton = page.getByRole( 'button', {
			name: /^(Reorder rows|行を並べ替え)$/,
		} );

		await editor.selectBlocks( tableBlock );
		await expect( firstRowControl ).toBeAttached();

		// hover 以外の表示理由を取り除く
		await reorderRowsButton.focus();

		await editorContext.getByText( 'Outside table', { exact: true } ).hover();
		await expect( firstRowControl ).toHaveAttribute( 'data-visible', 'false' );

		await firstRow.hover();
		await expect( firstRowControl ).toHaveAttribute( 'data-visible', 'true' );

		await editorContext.getByText( 'Outside table', { exact: true } ).hover();
		await expect( firstRowControl ).toHaveAttribute( 'data-visible', 'false' );
	} );

	test( 'shows the keyboard coachmark and focuses the toolbar entry', async ( {
		editor,
		page,
	} ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableBlock = editorContext.locator( '[data-type="core/table"][data-block]' );
		const tableListViewItem = page.getByRole( 'link', {
			name: /^(Table|テーブル)$/,
		} );
		const reorderRowsButton = page.getByRole( 'button', {
			name: /^(Reorder rows|行を並べ替え)$/,
		} );
		const keyboardCoachmark = page.getByText(
			/^(Reorder rows with the keyboard\. Select “Reorder rows” in the toolbar, then use Tab \/ Shift\+Tab to choose a row to reorder\.|キーボードで行を並べ替えられます。ツールバーの「行を並べ替え」を選択し、Tab \/ Shift\+Tab で並べ替える行を選べます。)$/
		);
		const paragraphBlock = editorContext.locator( '[data-type="core/paragraph"][data-block]' );

		await startFocusedTableRowRecorder( tableBlock );
		await page.keyboard.press( 'Shift+Alt+KeyO' );
		await expect( tableListViewItem ).toBeVisible();
		await focusWithArrowDown( page, tableListViewItem );
		await page.keyboard.press( 'Enter' );

		const focusedRowIndex = await getRecordedFocusedTableRowIndex( tableBlock );
		const focusedRowLabel = getBasicTableRowLabel( focusedRowIndex );
		const focusedRowControl = getRowControl( editorContext, focusedRowIndex + 1, focusedRowLabel );

		await expect( keyboardCoachmark ).toBeVisible();
		await expect( reorderRowsButton ).toBeFocused();
		await expect( reorderRowsButton ).not.toHaveClass( /yamabiko-table-reorder-coachmark-target/ );

		await page.keyboard.press( 'Enter' );
		await expect( keyboardCoachmark ).toHaveCount( 0 );
		await expect( focusedRowControl ).toBeFocused();

		await editor.selectBlocks( paragraphBlock );
		await expect( reorderRowsButton ).toHaveCount( 0 );
		await tableListViewItem.focus();
		await page.keyboard.press( 'Enter' );
		await expect( reorderRowsButton ).toBeVisible();
		await expect( keyboardCoachmark ).toHaveCount( 0 );
	} );
} );

test.describe( 'Table Reorder touch UI', () => {
	test.use( {
		hasTouch: true,
		isMobile: true,
		viewport: { height: 844, width: 390 },
	} );

	test.beforeEach( async ( { admin, editor, requestUtils } ) => {
		await setTableReorderCoachmarkDismissal( requestUtils, {
			keyboardDismissed: false,
			touchDismissed: false,
		} );
		await admin.createNewPost();
		await editor.setContent( BASIC_TABLE_CONTENT );
	} );

	test( 'shows the touch coachmark and toggles reorder mode', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const reorderRowsButton = page.getByRole( 'button', {
			name: /^(Reorder rows|行を並べ替え)$/,
		} );
		const touchCoachmark = page.getByText(
			/^(Tap “Reorder rows” in the toolbar to begin\.|ツールバーの「行を並べ替え」をタップして開始)$/
		);
		const touchGuidance = editorContext.getByText(
			/^(Handle: drag to move \/ tap to choose destination\sCell: tap to edit|ハンドル: ドラッグで移動 \/ タップで移動先選択\sセル: タップで編集)$/
		);
		const firstRowControl = editorContext.getByRole( 'button', {
			name: /^(Reorder row 1: Alpha|1行目「Alpha」を並べ替え)$/,
		} );
		const alphaCell = editorContext.getByText( 'Alpha', { exact: true } );
		const reorderRowsTooltip = page.getByRole( 'tooltip' ).filter( {
			hasText: /^(Reorder rows|行を並べ替え)$/,
		} );

		await alphaCell.tap();
		await expect( reorderRowsButton ).toBeVisible();
		await expect( touchCoachmark ).toBeVisible();
		await expect( reorderRowsButton ).toBeFocused();
		await expect( alphaCell ).not.toBeFocused();
		await expect( reorderRowsButton ).toHaveAttribute( 'aria-pressed', 'false' );
		await expect( reorderRowsTooltip ).toHaveCount( 0 );

		await reorderRowsButton.tap();
		await expect( touchCoachmark ).toHaveCount( 0 );
		await expect( reorderRowsButton ).toHaveAttribute( 'aria-pressed', 'true' );
		await expect( touchGuidance ).toBeVisible();
		await expect( firstRowControl ).toBeVisible();

		await alphaCell.tap();
		await expect( alphaCell ).toHaveAttribute( 'contenteditable', 'true' );
		await expect( alphaCell ).toBeFocused();
		await expect( touchGuidance ).toBeVisible();

		await reorderRowsButton.tap();
		await expect( reorderRowsButton ).toHaveAttribute( 'aria-pressed', 'false' );
		await expect( touchGuidance ).toHaveCount( 0 );
		await expect( firstRowControl ).toHaveCount( 0 );
	} );
} );
