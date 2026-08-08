import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import {
	basicRows,
	basicTable,
	enableReorderMode,
	expectRows,
	longTable,
	mergedCellsTable,
	mergedRows,
	moveRowWithKeyboard,
	prepareTable,
	redo,
	rowHandle,
	tableRows,
	type TestFixtures,
	undo,
} from './support';

for ( const canvasMode of [ 'iframe', 'non-iframe' ] as const ) {
	const canvasName = canvasMode;

	test( `reorders a row with the keyboard and preserves focus in the ${ canvasName } editor`, async ( {
		admin,
		editor,
		page,
		pageUtils,
	} ) => {
		const fixtures: TestFixtures = { admin, editor, page, pageUtils };
		const { canvas, table } = await prepareTable( fixtures, basicTable(), canvasMode );
		const handle = await enableReorderMode( {
			canvas,
			editor: fixtures.editor,
			page: fixtures.page,
			table,
			row: 2,
		} );

		await handle.press( 'Enter' );
		await handle.press( 'ArrowDown' );
		await rowHandle( canvas, 2 ).press( 'Escape' );
		await expectRows( table, basicRows );
		await expect( rowHandle( canvas, 2 ) ).toBeFocused();

		await handle.press( ' ' );
		await rowHandle( canvas, 2 ).press( 'ArrowDown' );
		await rowHandle( canvas, 2 ).press( 'Enter' );
		await expectRows( table, [ 'Row 1', 'Row 3', 'Row 2', 'Row 4' ] );
		await expect( rowHandle( canvas, 3 ) ).toBeFocused();
	} );

	test( `moves Tab focus between row handles in the ${ canvasName } editor`, async ( {
		admin,
		editor,
		page,
		pageUtils,
	} ) => {
		const fixtures: TestFixtures = { admin, editor, page, pageUtils };
		const { canvas, table } = await prepareTable( fixtures, basicTable(), canvasMode );
		const handle = await enableReorderMode( {
			canvas,
			editor: fixtures.editor,
			page: fixtures.page,
			table,
			row: 2,
		} );

		await handle.press( 'Tab' );
		await expect( rowHandle( canvas, 3 ) ).toBeFocused();
		await rowHandle( canvas, 3 ).press( 'Shift+Tab' );
		await expect( rowHandle( canvas, 2 ) ).toBeFocused();
	} );
}

test( 'keeps a keyboard reorder focused while scrolling a long table in the iframe editor', async ( {
	admin,
	editor,
	page,
	pageUtils,
} ) => {
	const fixtures: TestFixtures = { admin, editor, page, pageUtils };
	const { canvas, table } = await prepareTable( fixtures, longTable() );
	const handle = await enableReorderMode( {
		canvas,
		editor: fixtures.editor,
		page: fixtures.page,
		table,
		row: 1,
		cellText: 'Row 01',
	} );

	await handle.press( 'Enter' );
	for ( let count = 0; count < 20; count += 1 ) {
		await rowHandle( canvas, 1 ).press( 'ArrowDown' );
	}

	await expect( table.getByText( 'Row 21', { exact: true } ) ).toBeInViewport();
	await expect( rowHandle( canvas, 1 ) ).toBeFocused();
} );

test( 'undoes and redoes a keyboard reorder in the iframe editor', async ( {
	admin,
	editor,
	page,
	pageUtils,
} ) => {
	const fixtures: TestFixtures = { admin, editor, page, pageUtils };
	const { canvas, table } = await prepareTable( fixtures, basicTable() );
	const handle = await enableReorderMode( {
		canvas,
		editor: fixtures.editor,
		page: fixtures.page,
		table,
		row: 2,
	} );

	await expect( table ).toBeVisible();
	await moveRowWithKeyboard( handle, 'ArrowDown' );
	const movedRows = [ 'Row 1', 'Row 3', 'Row 2', 'Row 4' ];
	await expectRows( table, movedRows );
	await undo( fixtures.pageUtils );
	await expectRows( table, basicRows );
	await redo( fixtures.pageUtils );
	await expectRows( table, movedRows );
} );

test( 'allows a safe keyboard reorder across a colspan row in the iframe editor', async ( {
	admin,
	editor,
	page,
	pageUtils,
} ) => {
	const fixtures: TestFixtures = { admin, editor, page, pageUtils };
	const { canvas, table } = await prepareTable( fixtures, mergedCellsTable() );
	const handle = await enableReorderMode( {
		canvas,
		cellText: 'Normal C',
		editor: fixtures.editor,
		page: fixtures.page,
		table,
		row: 4,
	} );

	await moveRowWithKeyboard( handle, 'ArrowUp' );
	await expect( tableRows( table ) ).toHaveText( [
		'Normal A',
		'Normal B',
		'Normal C',
		'Colspan',
		'Rowspan start',
		'Rowspan continuation',
		'Normal D',
		'Normal E',
	] );
} );

test( 'rejects a keyboard reorder that would split a rowspan in the iframe editor', async ( {
	admin,
	editor,
	page,
	pageUtils,
} ) => {
	const fixtures: TestFixtures = { admin, editor, page, pageUtils };
	const { canvas, table } = await prepareTable( fixtures, mergedCellsTable() );
	const handle = await enableReorderMode( {
		canvas,
		cellText: 'Normal D',
		editor: fixtures.editor,
		page: fixtures.page,
		table,
		row: 7,
	} );

	await handle.press( 'Enter' );
	await handle.press( 'ArrowUp' );
	await handle.press( 'Enter' );
	await expect( tableRows( table ) ).toHaveText( mergedRows );
} );

test( 'records consecutive keyboard reorders as separate undo steps in the iframe editor', async ( {
	admin,
	editor,
	page,
	pageUtils,
} ) => {
	const fixtures: TestFixtures = { admin, editor, page, pageUtils };
	const { canvas, table } = await prepareTable( fixtures, basicTable() );
	const firstHandle = await enableReorderMode( {
		canvas,
		editor: fixtures.editor,
		page: fixtures.page,
		table,
		row: 2,
	} );

	await expect( table ).toBeVisible();
	await moveRowWithKeyboard( firstHandle, 'ArrowDown' );
	const firstMoveRows = [ 'Row 1', 'Row 3', 'Row 2', 'Row 4' ];
	await expectRows( table, firstMoveRows );
	await moveRowWithKeyboard( rowHandle( canvas, 3 ), 'ArrowDown' );
	const secondMoveRows = [ 'Row 1', 'Row 3', 'Row 4', 'Row 2' ];
	await expectRows( table, secondMoveRows );

	await undo( fixtures.pageUtils );
	await expectRows( table, firstMoveRows );
	await undo( fixtures.pageUtils );
	await expectRows( table, basicRows );
	await redo( fixtures.pageUtils );
	await expectRows( table, firstMoveRows );
	await redo( fixtures.pageUtils );
	await expectRows( table, secondMoveRows );
} );
