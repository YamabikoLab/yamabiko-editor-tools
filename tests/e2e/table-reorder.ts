import type { Locator } from '@playwright/test';
import { expect } from '@wordpress/e2e-test-utils-playwright';

import type { EditorContext } from './editor-context';

export const basicTableContent = `<!-- wp:table -->
<figure class="wp-block-table"><table class="has-fixed-layout"><tbody><tr><td>Alpha</td></tr><tr><td>Bravo</td></tr><tr><td>Charlie</td></tr><tr><td>Delta</td></tr></tbody></table></figure>
<!-- /wp:table -->`;

export const basicRowLabels = [ 'Alpha', 'Bravo', 'Charlie', 'Delta' ] as const;

export function getTableRows( editorContext: EditorContext ): Locator {
	return editorContext.getByRole( 'table' ).getByRole( 'row' );
}

export function getTableRow( tableRows: Locator, rowLabel: string ): Locator {
	return tableRows.filter( { hasText: rowLabel } );
}

export async function getTableRowOrder( tableRows: Locator ): Promise< string[] > {
	const rows = await tableRows.all();

	return Promise.all(
		rows.map( async ( row ) => {
			for ( const label of basicRowLabels ) {
				if ( ( await row.getByText( label, { exact: true } ).count() ) > 0 ) {
					return label;
				}
			}

			throw new Error( 'Could not identify a table row from its visible text.' );
		} )
	);
}

export async function getRowHandle(
	editorContext: EditorContext,
	tableRows: Locator,
	rowNumber: number,
	rowLabel: string
): Promise< Locator > {
	const row = getTableRow( tableRows, rowLabel );
	const handle = editorContext.getByRole( 'button', {
		name: new RegExp(
			`^(Reorder row ${ rowNumber }: ${ rowLabel }|${ rowNumber }行目「${ rowLabel }」を並べ替え)$`
		),
	} );

	await row.hover();
	await expect( handle ).toBeVisible();

	return handle;
}
