import type { Locator } from '@playwright/test';
import { expect } from '@wordpress/e2e-test-utils-playwright';

import type { EditorContext } from './editor-context';

export const basicTableContent = `<!-- wp:table -->
<figure class="wp-block-table"><table class="has-fixed-layout"><tbody><tr><td>Alpha</td></tr><tr><td>Bravo</td></tr><tr><td>Charlie</td></tr><tr><td>Delta</td></tr></tbody></table></figure>
<!-- /wp:table -->`;

export const basicRowLabels = [ 'Alpha', 'Bravo', 'Charlie', 'Delta' ] as const;

export const longRowLabels = Array.from(
	{ length: 24 },
	( _, index ) => `Row ${ String( index + 1 ).padStart( 2, '0' ) }`
);

export const longTableContent = `<!-- wp:table -->
<figure class="wp-block-table"><table class="has-fixed-layout"><tbody>${ longRowLabels
	.map( ( label ) => `<tr><td>${ label }</td></tr>` )
	.join( '' ) }</tbody></table></figure>
<!-- /wp:table -->`;

export function getTableRows( editorContext: EditorContext ): Locator {
	return editorContext.getByRole( 'table' ).getByRole( 'row' );
}

export function getTableRow( tableRows: Locator, rowLabel: string ): Locator {
	return tableRows.filter( { hasText: rowLabel } );
}

export function getRowControl(
	editorContext: EditorContext,
	rowNumber: number,
	rowLabel: string
): Locator {
	const escapedRowLabel = rowLabel.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );

	return editorContext.getByRole( 'button', {
		name: new RegExp(
			`^(Reorder row ${ rowNumber }: ${ escapedRowLabel }|${ rowNumber }行目「${ escapedRowLabel }」を並べ替え)$`
		),
	} );
}

export async function getTableRowOrder(
	tableRows: Locator,
	rowLabels: readonly string[] = basicRowLabels
): Promise< string[] > {
	const rows = await tableRows.all();

	return Promise.all(
		rows.map( async ( row ) => {
			for ( const label of rowLabels ) {
				if ( ( await row.getByText( label, { exact: true } ).count() ) > 0 ) {
					return label;
				}
			}

			throw new Error( 'Could not identify a table row from its visible text.' );
		} )
	);
}

export async function expectNotFullyCovered(
	target: Locator,
	overlay: Locator
): Promise< void > {
	const [ targetBox, overlayBox ] = await Promise.all( [
		target.boundingBox(),
		overlay.boundingBox(),
	] );
	if ( ! targetBox || ! overlayBox ) {
		throw new Error( 'Expected visible geometry for the focused target and guidance.' );
	}

	const isFullyCovered =
		overlayBox.x <= targetBox.x &&
		overlayBox.y <= targetBox.y &&
		overlayBox.x + overlayBox.width >= targetBox.x + targetBox.width &&
		overlayBox.y + overlayBox.height >= targetBox.y + targetBox.height;

	expect( isFullyCovered ).toBe( false );
}

export async function getRowHandle(
	editorContext: EditorContext,
	tableRows: Locator,
	rowNumber: number,
	rowLabel: string
): Promise< Locator > {
	const row = getTableRow( tableRows, rowLabel );
	const handle = getRowControl( editorContext, rowNumber, rowLabel );

	await row.hover();
	await expect( handle ).toBeVisible();

	return handle;
}
