import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import {
	basicTable,
	prepareTable,
	rowHandle,
	type TestFixtures,
} from './support';

for ( const canvasMode of [ 'iframe', 'non-iframe' ] as const ) {
	const canvasName = canvasMode;

	for ( const align of [ undefined, 'full' ] as const ) {
		const widthName = align === 'full' ? 'full-width' : 'normal-width';

		test( `shows hover handles and returns to cell editing on a ${ widthName } table in the ${ canvasName } editor`, async ( {
			admin,
			editor,
			page,
			pageUtils,
		} ) => {
			const fixtures: TestFixtures = { admin, editor, page, pageUtils };
			const { canvas, table } = await prepareTable(
				fixtures,
				basicTable( { align } ),
				canvasMode
			);
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
