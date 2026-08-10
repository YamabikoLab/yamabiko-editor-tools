import type { FrameLocator, Locator, Page } from '@playwright/test';
import {
	expect,
	type Admin,
	type Editor,
	type PageUtils,
} from '@wordpress/e2e-test-utils-playwright';

export type Canvas = FrameLocator | Page;

export type CanvasMode = 'iframe' | 'non-iframe';

export type TestFixtures = {
	admin: Admin;
	editor: Editor;
	page: Page;
	pageUtils: PageUtils;
};

type TableOptions = {
	align?: 'full';
};

export const basicRows = [ 'Row 1', 'Row 2', 'Row 3', 'Row 4' ];
export const mergedRows = [
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

export const basicTable = ( options?: TableOptions ) => tableBlock( basicRows, options );

export const longTable = () => tableBlock( longRows );

export const mergedCellsTable = () => `<!-- wp:table -->
<figure class="wp-block-table"><table class="has-fixed-layout"><tbody><tr><td>Normal A</td><td>Normal A value</td></tr><tr><td>Normal B</td><td>Normal B value</td></tr><tr><td colspan="2">Colspan</td></tr><tr><td>Normal C</td><td>Normal C value</td></tr><tr><td rowspan="2">Rowspan start</td><td>Rowspan start value</td></tr><tr><td>Rowspan continuation</td></tr><tr><td>Normal D</td><td>Normal D value</td></tr><tr><td>Normal E</td><td>Normal E value</td></tr></tbody></table></figure>
<!-- /wp:table -->`;

const legacyCanvasBlock = `<!-- wp:test/legacy-canvas -->
<p>Legacy canvas test block</p>
<!-- /wp:test/legacy-canvas -->`;

export function rowHandle( canvas: Canvas, row: number ): Locator {
	return canvas.getByRole( 'button', {
		name: new RegExp( `(?:row\\s+${ row }(?!\\d)|(?<!\\d)${ row }\\s*行目)`, 'i' ),
	} );
}

export function tableRows( table: Locator ): Locator {
	return table.locator( 'tbody > tr > td:first-child' );
}

export async function expectRows( table: Locator, rows: readonly string[] ) {
	await expect( tableRows( table ) ).toHaveText( rows );
}

export async function prepareTable(
	{ admin, editor, page }: TestFixtures,
	content: string,
	canvasMode: CanvasMode = 'iframe'
) {
	await admin.createNewPost( { fullscreenMode: false, showWelcomeGuide: false } );

	if ( canvasMode === 'non-iframe' ) {
		await page.waitForFunction( () => window?.wp?.blocks && window?.wp?.element );
		await page.evaluate( () => {
			const { createElement } = window.wp.element;

			window.wp.blocks.registerBlockType( 'test/legacy-canvas', {
				apiVersion: 2,
				category: 'text',
				title: 'Legacy canvas test block',
				edit: () => createElement( 'p', {}, 'Legacy canvas test block' ),
				save: () => createElement( 'p', {}, 'Legacy canvas test block' ),
			} );
		} );
	}

	await editor.setContent(
		canvasMode === 'non-iframe' ? `${ content }\n${ legacyCanvasBlock }` : content
	);

	if ( canvasMode === 'non-iframe' ) {
		await expect( page.locator( '[name="editor-canvas"]' ) ).toHaveCount( 0 );
	}

	const canvas: Canvas = canvasMode === 'iframe' ? editor.canvas : page;
	const table = canvas.locator( 'table' );
	await expect( table ).toBeVisible();

	return { canvas, table };
}

export async function enableReorderMode( {
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

export async function moveRowWithKeyboard( handle: Locator, direction: 'ArrowDown' | 'ArrowUp' ) {
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

export async function moveRowWithPointer( {
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

export async function undo( pageUtils: { pressKeys: ( key: string ) => Promise< void > } ) {
	await pageUtils.pressKeys( 'primary+z' );
}

export async function redo( pageUtils: { pressKeys: ( key: string ) => Promise< void > } ) {
	await pageUtils.pressKeys( 'primary+shift+z' );
}
