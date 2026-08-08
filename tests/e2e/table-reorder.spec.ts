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
