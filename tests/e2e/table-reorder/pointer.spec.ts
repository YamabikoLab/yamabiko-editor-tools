import { test } from '@wordpress/e2e-test-utils-playwright';

import {
	basicRows,
	basicTable,
	enableReorderMode,
	expectRows,
	moveRowWithPointer,
	prepareTable,
	redo,
	tableRows,
	type TestFixtures,
	undo,
} from './support';

test( 'reorders a row with the pointer in the non-iframe editor', async ( {
	admin,
	editor,
	page,
	pageUtils,
} ) => {
	const fixtures: TestFixtures = { admin, editor, page, pageUtils };
	const { canvas, table } = await prepareTable( fixtures, basicTable(), 'non-iframe' );
	await enableReorderMode( {
		canvas,
		editor: fixtures.editor,
		page: fixtures.page,
		table,
		row: 3,
	} );

	await moveRowWithPointer( {
		canvas,
		from: 2,
		page,
		table,
		to: 0,
	} );
	await expectRows( table, [ 'Row 3', 'Row 1', 'Row 2', 'Row 4' ] );
} );

test( 'reorders a row with the pointer and supports undo and redo in the iframe editor', async ( {
	admin,
	editor,
	page,
	pageUtils,
} ) => {
	const fixtures: TestFixtures = { admin, editor, page, pageUtils };
	const { canvas, table } = await prepareTable( fixtures, basicTable() );
	await enableReorderMode( {
		canvas,
		editor: fixtures.editor,
		page: fixtures.page,
		table,
		row: 4,
	} );

	await moveRowWithPointer( { canvas, from: 3, page, table, to: 1 } );
	const movedRows = [ 'Row 1', 'Row 2', 'Row 4', 'Row 3' ];
	await expectRows( table, movedRows );
	await undo( fixtures.pageUtils );
	await expectRows( table, basicRows );
	await redo( fixtures.pageUtils );
	await expectRows( table, movedRows );
} );
