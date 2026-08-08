import type { FrameLocator, Locator, Page } from '@playwright/test';
import {
	expect,
	test,
	type Admin,
	type Editor,
	type PageUtils,
} from '@wordpress/e2e-test-utils-playwright';

type Canvas = FrameLocator;

type TestFixtures = {
	admin: Admin;
	editor: Editor;
	page: Page;
	pageUtils: PageUtils;
};

type TableOptions = {
	align?: 'full';
};

const basicRows = [ 'Row 1', 'Row 2', 'Row 3', 'Row 4' ];
const mergedRows = [
	'Normal A',
	'Normal B',
	'Colspan',
	'Normal C',
	'Rowspan start',
	'Rowspan continuation',
	'Normal D',
	'Normal E',
];
const longRows = Array.from(
	{ length: 30 },
	( _, index ) => `Row ${ String( index + 1 ).padStart( 2, '0' ) }`
);

function tableBlock( rows: readonly string[], { align }: TableOptions = {} ): string {
	const attributes = align ? ` ${ JSON.stringify( { align } ) }` : '';
	const figureClass = align ? 'wp-block-table alignfull' : 'wp-block-table';
	const body = rows
		.map( ( row ) => `<tr><td>${ row }</td><td>${ row } value</td></tr>` )
		.join( '' );

	return `<!-- wp:table${ attributes } -->\n<figure class="${ figureClass }"><table class="has-fixed-layout"><tbody>${ body }</tbody></table></figure>\n<!-- /wp:table -->`;
}

const basicTable = ( options?: TableOptions ) => tableBlock( basicRows, options );

const longTable = () => tableBlock( longRows );

const mergedCellsTable = () => `<!-- wp:table -->
<figure class="wp-block-table"><table class="has-fixed-layout"><tbody><tr><td>Normal A</td><td>Normal A value</td></tr><tr><td>Normal B</td><td>Normal B value</td></tr><tr><td colspan="2">Colspan</td></tr><tr><td>Normal C</td><td>Normal C value</td></tr><tr><td rowspan="2">Rowspan start</td><td>Rowspan start value</td></tr><tr><td>Rowspan continuation</td></tr><tr><td>Normal D</td><td>Normal D value</td></tr><tr><td>Normal E</td><td>Normal E value</td></tr></tbody></table></figure>
<!-- /wp:table -->`;

function rowHandle( canvas: Canvas, row: number ): Locator {
	return canvas.getByRole( 'button', {
		name: new RegExp( `(?:row\\s+${ row }(?!\\d)|(?<!\\d)${ row }\\s*行目)`, 'i' ),
	} );
}

function tableRows( table: Locator ): Locator {
	return table.locator( 'tbody > tr > td:first-child' );
}

async function expectRows( table: Locator, rows: readonly string[] ) {
	await expect( tableRows( table ) ).toHaveText( rows );
}

async function prepareTable( { admin, editor }: TestFixtures, content: string ) {
	await admin.createNewPost( { fullscreenMode: false, showWelcomeGuide: false } );
	await editor.setContent( content );

	const canvas = editor.canvas;
	const table = canvas.locator( 'table' );
	await expect( table ).toBeVisible();

	return { canvas, table };
}

async function enableReorderMode( {
	canvas,
	editor,
	page,
	table,
	row,
	cellText = `Row ${ row }`,
}: {
	canvas: Canvas;
	cellText?: string;
	editor: { showBlockToolbar: () => Promise< void > };
	page: Page;
	table: Locator;
	row: number;
} ) {
	await table.getByText( cellText, { exact: true } ).click();
	await editor.showBlockToolbar();
	await page.getByRole( 'button', { name: /^(Reorder rows|行を並べ替え)$/ } ).click();
	const handle = rowHandle( canvas, row );
	await expect( handle ).toBeFocused();
	return handle;
}

async function moveRowWithKeyboard( handle: Locator, direction: 'ArrowDown' | 'ArrowUp' ) {
	await handle.press( 'Enter' );
	await handle.press( direction );
	await handle.press( 'Enter' );
}

async function nextAnimationFrame( locator: Locator ) {
	await locator.evaluate(
		( element ) =>
			new Promise< void >( ( resolve ) => {
				element.ownerDocument.defaultView?.requestAnimationFrame( () => resolve() );
			} )
	);
}

async function moveRowWithPointer( {
	canvas,
	page,
	table,
	from,
	to,
}: {
	canvas: Canvas;
	from: number;
	page: Page;
	table: Locator;
	to: number;
} ) {
	const handle = rowHandle( canvas, from + 1 );
	const target = table.locator( 'tbody > tr' ).nth( to );
	const sourceBox = await handle.boundingBox();
	const targetBox = await target.boundingBox();

	if ( ! sourceBox || ! targetBox ) {
		throw new Error( 'Expected the source handle and target row to have bounding boxes.' );
	}
	await page.mouse.move( sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2 );
	await page.mouse.down();
	await page.mouse.move(
		sourceBox.x + sourceBox.width / 2,
		sourceBox.y + sourceBox.height / 2 + 1
	);
	await nextAnimationFrame( handle );
	const targetY = targetBox.y + targetBox.height * ( from < to ? 0.75 : 0.25 );
	const steps = from < to ? 9 : 10;
	for ( let step = 1; step <= steps; step += 1 ) {
		await page.mouse.move(
			sourceBox.x + sourceBox.width / 2,
			sourceBox.y +
				sourceBox.height / 2 +
				( ( targetY - ( sourceBox.y + sourceBox.height / 2 ) ) * step ) / 10
		);
		await nextAnimationFrame( handle );
	}
	await page.mouse.move( sourceBox.x + sourceBox.width / 2, targetY - 1 );
	await nextAnimationFrame( handle );
	await nextAnimationFrame( handle );
	await expect(
		canvas.locator( '.yamabiko-editor-tools-table-reorder-content__insertion-indicator' )
	).toBeVisible();
	await page.mouse.up();
}

async function undo( pageUtils: { pressKeys: ( key: string ) => Promise< void > } ) {
	await pageUtils.pressKeys( 'primary+z' );
}

async function redo( pageUtils: { pressKeys: ( key: string ) => Promise< void > } ) {
	await pageUtils.pressKeys( 'primary+shift+z' );
}

for ( const canvasName of [ 'iframe' ] ) {
	test( `reorders a row with the keyboard and preserves focus in the ${ canvasName } editor`, async ( {
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
		const { canvas, table } = await prepareTable( fixtures, basicTable() );
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

	for ( const align of [ undefined, 'full' ] as const ) {
		const widthName = align === 'full' ? 'full-width' : 'normal-width';

		test( `shows hover handles and returns to cell editing on a ${ widthName } table in the ${ canvasName } editor`, async ( {
			admin,
			editor,
			page,
			pageUtils,
		} ) => {
			const fixtures: TestFixtures = { admin, editor, page, pageUtils };
			const { canvas, table } = await prepareTable( fixtures, basicTable( { align } ) );
			const handle = rowHandle( canvas, 2 );

			await table.hover();
			await expect( handle ).toBeVisible();
			await expect( handle ).toBeInViewport();
			await expect( handle ).toBeEnabled();

			await fixtures.page.mouse.move( 0, 0 );
			await expect( handle ).toHaveCount( 0 );

			await table.hover();
			await expect( handle ).toBeVisible();
			await table.getByText( 'Row 2', { exact: true } ).click();
			await expect( handle ).toHaveCount( 0 );
		} );
	}
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
	await expect( tableRows( table ) ).toHaveText( movedRows );
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
