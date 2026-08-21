import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import { getEditorContext } from './editor-context';
import {
	basicRowLabels,
	basicTableContent,
	dragWithMouse,
	getRowHandle,
	getTableRow,
	getTableRowOrder,
	getTableRows,
	longRowLabels,
	longTableContent,
} from './table-reorder';

type BoundingBox = { height: number; width: number; x: number; y: number };
type ViewportSize = { height: number; width: number };

async function getRequiredBoundingBox(
	locator: Locator,
	errorMessage: string
): Promise< BoundingBox > {
	const box = await locator.boundingBox();

	if ( ! box ) {
		throw new Error( errorMessage );
	}

	return box;
}

function getRequiredViewportSize( page: Page, errorMessage: string ): ViewportSize {
	const viewport = page.viewportSize();

	if ( ! viewport ) {
		throw new Error( errorMessage );
	}

	return viewport;
}

async function getVerticalScrollPosition( source: Locator ): Promise< number > {
	return source.evaluate( ( element ) => {
		const view = element.ownerDocument.defaultView;
		let ancestor = element.parentElement;

		while ( ancestor ) {
			const overflowY = view?.getComputedStyle( ancestor ).overflowY ?? '';
			if (
				/(auto|scroll)/.test( overflowY ) &&
				ancestor.scrollHeight > ancestor.clientHeight + 1
			) {
				return ancestor.scrollTop;
			}
			ancestor = ancestor.parentElement;
		}

		return element.ownerDocument.scrollingElement?.scrollTop ?? view?.scrollY ?? 0;
	} );
}

async function waitForVerticalScrollToStop(
	page: Page,
	source: Locator,
	pointerX: number,
	pointerY: number
): Promise< void > {
	let previousPosition: number | undefined;
	let sampleIndex = 0;
	let stableSamples = 0;

	await expect
		.poll(
			async () => {
				// Keep sending the user's away-from-edge pointer position while
				// SortableJS transitions out of auto-scroll.
				await page.mouse.move( pointerX + ( sampleIndex++ % 2 ), pointerY );
				const position = await getVerticalScrollPosition( source );

				stableSamples = position === previousPosition ? stableSamples + 1 : 0;
				previousPosition = position;

				return stableSamples;
			},
			{ intervals: [ 50 ] }
		)
		.toBeGreaterThanOrEqual( 2 );
}

async function moveMouseBeforeTarget(
	page: Page,
	target: Locator,
	insertionIndicator: Locator
): Promise< void > {
	await expect
		.poll(
			async () => {
				const targetBox = await target.boundingBox();
				if ( ! targetBox ) {
					return false;
				}

				await page.mouse.move( targetBox.x + targetBox.width / 2, targetBox.y + 2, { steps: 2 } );

				const [ currentTargetBox, indicatorBox ] = await Promise.all( [
					target.boundingBox(),
					insertionIndicator.boundingBox(),
				] );

				return Boolean(
					currentTargetBox && indicatorBox && Math.abs( indicatorBox.y - currentTargetBox.y ) <= 2
				);
			},
			{ intervals: [ 50 ] }
		)
		.toBe( true );
}

async function dragWithMouseAndAutoScroll(
	page: Page,
	source: Locator,
	target: Locator,
	scrollSource: Locator,
	insertionIndicator: Locator,
	duringAutoScroll: () => Promise< void >,
	duringDrop?: () => Promise< void >
): Promise< void > {
	await source.scrollIntoViewIfNeeded();

	const sourceBox = await getRequiredBoundingBox(
		source,
		'Could not determine mouse auto-scroll coordinates.'
	);
	const viewport = getRequiredViewportSize(
		page,
		'Could not determine mouse auto-scroll coordinates.'
	);

	const sourceX = sourceBox.x + sourceBox.width / 2;
	const sourceY = sourceBox.y + sourceBox.height / 2;

	await page.mouse.move( sourceX, sourceY );
	await page.mouse.down();
	try {
		await page.mouse.move( sourceX, sourceY + 6, { steps: 2 } );
		await page.mouse.move( sourceX, viewport.height - 4, { steps: 10 } );
		await duringAutoScroll();
		await page.mouse.move( sourceX, viewport.height / 2 );
		await waitForVerticalScrollToStop( page, scrollSource, sourceX, viewport.height / 2 );

		const targetBox = await target.boundingBox();
		if ( ! targetBox ) {
			throw new Error( 'Could not determine the target after mouse auto-scroll.' );
		}
		await page.mouse.move(
			targetBox.x + targetBox.width / 2,
			targetBox.y + targetBox.height * 0.25,
			{ steps: 10 }
		);
		await moveMouseBeforeTarget( page, target, insertionIndicator );
		await duringDrop?.();
	} finally {
		await page.mouse.up();
	}
}

test.describe( 'Table Reorder pointer drag and drop', () => {
	test.use( {
		hasTouch: false,
		isMobile: false,
	} );

	test.beforeEach( async ( { admin, editor, page } ) => {
		await admin.createNewPost();
		await editor.setContent( basicTableContent );

		const editorContext = await getEditorContext( page, editor.canvas );
		await editor.selectBlocks( editorContext.locator( '[data-type="core/table"][data-block]' ) );
	} );

	test( 'moves a row to another valid position with the row handle', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const bravoHandle = await getRowHandle( editorContext, tableRows, 2, 'Bravo' );
		const deltaRow = getTableRow( tableRows, 'Delta' );
		const insertionIndicator = editorContext.locator( '.yamabiko-table-reorder-insertion-line' );

		await dragWithMouse( page, bravoHandle, deltaRow, 'after', async () => {
			await expect( insertionIndicator ).toBeVisible();
		} );

		await expect
			.poll( () => getTableRowOrder( tableRows ) )
			.toEqual( [ 'Alpha', 'Charlie', 'Delta', 'Bravo' ] );
		expect( await editor.getEditedPostContent() ).toContain(
			'<tbody><tr><td>Alpha</td></tr><tr><td>Charlie</td></tr><tr><td>Delta</td></tr><tr><td>Bravo</td></tr></tbody>'
		);
	} );

	test( 'keeps the row order when dropped back at the original position', async ( {
		editor,
		page,
	} ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const originalContent = await editor.getEditedPostContent();
		const bravoHandle = await getRowHandle( editorContext, tableRows, 2, 'Bravo' );
		const bravoRow = getTableRow( tableRows, 'Bravo' );

		await dragWithMouse( page, bravoHandle, bravoRow, 'center' );

		expect( await getTableRowOrder( tableRows ) ).toEqual( basicRowLabels );
		expect( await editor.getEditedPostContent() ).toBe( originalContent );
	} );

	test( 'keeps the row order when dragging from table cell content', async ( { editor, page } ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const originalContent = await editor.getEditedPostContent();
		const bravoCellContent = getTableRow( tableRows, 'Bravo' ).getByText( 'Bravo', {
			exact: true,
		} );
		const deltaCellContent = getTableRow( tableRows, 'Delta' ).getByText( 'Delta', {
			exact: true,
		} );

		await dragWithMouse( page, bravoCellContent, deltaCellContent, 'center' );

		expect( await getTableRowOrder( tableRows ) ).toEqual( basicRowLabels );
		expect( await editor.getEditedPostContent() ).toBe( originalContent );
	} );

	test( 'auto-scrolls down while dragging to an initially offscreen destination', async ( {
		editor,
		page,
	} ) => {
		await editor.setContent( longTableContent );

		const editorContext = await getEditorContext( page, editor.canvas );
		const tableBlock = editorContext.locator( '[data-type="core/table"][data-block]' );
		const tableRows = getTableRows( editorContext );
		const sourceRow = getTableRow( tableRows, 'Row 02' );
		const targetRow = getTableRow( tableRows, 'Row 20' );
		const rowAfterTarget = getTableRow( tableRows, 'Row 21' );
		const insertionIndicator = editorContext.locator( '.yamabiko-table-reorder-insertion-line' );
		const viewport = getRequiredViewportSize(
			page,
			'Could not determine the viewport for mouse auto-scroll.'
		);

		await editor.selectBlocks( tableBlock );
		await sourceRow.scrollIntoViewIfNeeded();
		const sourceHandle = await getRowHandle( editorContext, tableRows, 2, 'Row 02' );
		const targetBoxBeforeDrag = await getRequiredBoundingBox(
			targetRow,
			'Could not determine the target before mouse auto-scroll.'
		);
		expect( targetBoxBeforeDrag.y ).toBeGreaterThanOrEqual( viewport.height );

		const initialScrollPosition = await getVerticalScrollPosition( tableBlock );

		await dragWithMouseAndAutoScroll(
			page,
			sourceHandle,
			rowAfterTarget,
			tableBlock,
			insertionIndicator,
			async () => {
				await expect
					.poll( () => getVerticalScrollPosition( tableBlock ) )
					.toBeGreaterThan( initialScrollPosition );
				await expect
					.poll(
						async () => {
							const targetBox = await targetRow.boundingBox();

							return Boolean(
								targetBox &&
									targetBox.y >= 0 &&
									targetBox.y + targetBox.height <= viewport.height - 64
							);
						},
						{ intervals: [ 50 ] }
					)
					.toBe( true );
			},
			async () => {
				await expect( insertionIndicator ).toBeVisible();
			}
		);

		const expectedOrder = [
			longRowLabels[ 0 ],
			...longRowLabels.slice( 2, 20 ),
			longRowLabels[ 1 ],
			...longRowLabels.slice( 20 ),
		];
		const expectedTableBody = `<tbody>${ expectedOrder
			.map( ( label ) => `<tr><td>${ label }</td></tr>` )
			.join( '' ) }</tbody>`;

		await expect.poll( () => editor.getEditedPostContent() ).toContain( expectedTableBody );
		expect( await getTableRowOrder( tableRows, longRowLabels ) ).toEqual( expectedOrder );
	} );
} );
