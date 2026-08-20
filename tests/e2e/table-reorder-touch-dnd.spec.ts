import type { CDPSession, Locator, Page } from '@playwright/test';
import type { RequestUtils } from '@wordpress/e2e-test-utils-playwright';
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import { getEditorContext, type EditorContext } from './editor-context';
import {
	basicRowLabels,
	basicTableContent,
	getRowControl,
	getTableRow,
	getTableRowOrder,
	getTableRows,
	longRowLabels,
	longTableContent,
} from './table-reorder';

const PREFERENCES_SCOPE = 'yamabiko-editor-tools';
const TOUCH_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderTouchCoachmarkDismissed';
const reorderRowsButtonName = /^(Reorder rows|行を並べ替え)$/;

type TouchPoint = {
	x: number;
	y: number;
};

type VerticalTarget = 'after' | 'center';

type SortableWindow = Window & {
	Sortable?: {
		get?: ( element: Element ) => unknown;
	};
};

async function dismissTouchCoachmark( requestUtils: RequestUtils ): Promise< void > {
	await requestUtils.setPreferences( PREFERENCES_SCOPE, {
		[ TOUCH_COACHMARK_DISMISSED_PREFERENCE ]: true,
	} );
}

async function waitForSortableInstance( tableBody: Locator ): Promise< void > {
	await expect
		.poll( () =>
			tableBody.evaluate( ( body ) => {
				const view = body.ownerDocument.defaultView as SortableWindow | null;

				return Boolean( view?.Sortable?.get?.( body ) );
			} )
		)
		.toBe( true );
}

async function enterTouchReorderMode(
	page: Page,
	editorContext: EditorContext,
	firstRowControl: Locator
): Promise< void > {
	const reorderRowsButton = page.getByRole( 'button', {
		name: reorderRowsButtonName,
	} );
	const tableBody = editorContext.getByRole( 'table' ).locator( 'tbody' );

	await expect( reorderRowsButton ).toBeVisible();
	await reorderRowsButton.tap();
	await expect( reorderRowsButton ).toHaveAttribute( 'aria-pressed', 'true' );
	await expect( firstRowControl ).toBeVisible();
	await waitForSortableInstance( tableBody );
}

async function dispatchTouchPoint(
	client: CDPSession,
	type: 'touchMove' | 'touchStart',
	point: TouchPoint
): Promise< void > {
	await client.send( 'Input.dispatchTouchEvent', {
		touchPoints: [
			{
				force: 1,
				id: 1,
				radiusX: 1,
				radiusY: 1,
				x: point.x,
				y: point.y,
			},
		],
		type,
	} );
}

async function dispatchTouchGesture(
	page: Page,
	start: TouchPoint,
	points: TouchPoint[],
	duringGesture?: () => Promise< void >
): Promise< void > {
	const client = await page.context().newCDPSession( page );

	await dispatchTouchPoint( client, 'touchStart', start );
	try {
		for ( const point of points ) {
			await dispatchTouchPoint( client, 'touchMove', point );
		}
		await duringGesture?.();
	} finally {
		await client.send( 'Input.dispatchTouchEvent', {
			touchPoints: [],
			type: 'touchEnd',
		} );
		await client.detach();
	}
}

function interpolateTouchPoints( start: TouchPoint, end: TouchPoint, steps: number ): TouchPoint[] {
	return Array.from( { length: steps }, ( _, index ) => {
		const progress = ( index + 1 ) / steps;

		return {
			x: start.x + ( end.x - start.x ) * progress,
			y: start.y + ( end.y - start.y ) * progress,
		};
	} );
}

async function dragWithTouch(
	page: Page,
	source: Locator,
	target: Locator,
	verticalTarget: VerticalTarget,
	duringDrag?: () => Promise< void >
): Promise< void > {
	await source.scrollIntoViewIfNeeded();
	await target.scrollIntoViewIfNeeded();

	const sourceBox = await source.boundingBox();
	const targetBox = await target.boundingBox();
	if ( ! sourceBox || ! targetBox ) {
		throw new Error( 'Could not determine touch drag coordinates.' );
	}

	const start = {
		x: sourceBox.x + sourceBox.width / 2,
		y: sourceBox.y + sourceBox.height / 2,
	};
	const activationPoint = {
		x: start.x,
		y: start.y + Math.min( 12, sourceBox.height / 4 ),
	};
	const end = {
		x: targetBox.x + targetBox.width / 2,
		y:
			verticalTarget === 'after'
				? targetBox.y + targetBox.height - 2
				: targetBox.y + targetBox.height / 2,
	};
	const points = [
		...interpolateTouchPoints( start, activationPoint, 2 ),
		...interpolateTouchPoints( activationPoint, end, 10 ),
	];

	await dispatchTouchGesture( page, start, points, duringDrag );
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

async function scrollFromCellWithTouch( page: Page, source: Locator ): Promise< void > {
	await source.scrollIntoViewIfNeeded();

	const sourceBox = await source.boundingBox();
	if ( ! sourceBox ) {
		throw new Error( 'Could not determine touch scroll coordinates.' );
	}

	const start = {
		x: sourceBox.x + sourceBox.width / 2,
		y: sourceBox.y + sourceBox.height / 2,
	};
	const end = {
		x: start.x,
		y: Math.max( 20, start.y - 240 ),
	};

	await dispatchTouchGesture( page, start, interpolateTouchPoints( start, end, 12 ) );
}

test.describe( 'Table Reorder touch drag and drop', () => {
	test.use( {
		hasTouch: true,
		isMobile: true,
		viewport: { height: 844, width: 390 },
	} );

	test.beforeEach( async ( { admin, requestUtils } ) => {
		await dismissTouchCoachmark( requestUtils );
		await admin.createNewPost();
	} );

	test( 'moves a row to another valid position with a touch drag from the row handle', async ( {
		editor,
		page,
	} ) => {
		await editor.setContent( basicTableContent );
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const firstRowControl = getRowControl( editorContext, 1, 'Alpha' );
		const bravoControl = getRowControl( editorContext, 2, 'Bravo' );
		const deltaRow = getTableRow( tableRows, 'Delta' );
		const insertionIndicator = editorContext.locator( '.yamabiko-table-reorder-insertion-line' );

		await editor.selectBlocks( editorContext.locator( '[data-type="core/table"][data-block]' ) );
		await enterTouchReorderMode( page, editorContext, firstRowControl );
		await expect( bravoControl ).toBeVisible();

		await dragWithTouch( page, bravoControl, deltaRow, 'after', async () => {
			await expect( insertionIndicator ).toBeVisible();
		} );

		await expect
			.poll( () => getTableRowOrder( tableRows ) )
			.toEqual( [ 'Alpha', 'Charlie', 'Delta', 'Bravo' ] );
		await expect
			.poll( () => editor.getEditedPostContent() )
			.toContain(
				'<tbody><tr><td>Alpha</td></tr><tr><td>Charlie</td></tr><tr><td>Delta</td></tr><tr><td>Bravo</td></tr></tbody>'
			);
	} );

	test( 'keeps the row order when a touch drag returns to its original position', async ( {
		editor,
		page,
	} ) => {
		await editor.setContent( basicTableContent );
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const originalContent = await editor.getEditedPostContent();
		const firstRowControl = getRowControl( editorContext, 1, 'Alpha' );
		const bravoControl = getRowControl( editorContext, 2, 'Bravo' );
		const bravoRow = getTableRow( tableRows, 'Bravo' );

		await editor.selectBlocks( editorContext.locator( '[data-type="core/table"][data-block]' ) );
		await enterTouchReorderMode( page, editorContext, firstRowControl );
		await dragWithTouch( page, bravoControl, bravoRow, 'center' );

		expect( await getTableRowOrder( tableRows ) ).toEqual( basicRowLabels );
		await expect.poll( () => editor.getEditedPostContent() ).toBe( originalContent );
	} );

	test( 'scrolls from table cell content without changing the row order', async ( {
		editor,
		page,
	} ) => {
		await editor.setContent( longTableContent );
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableRows = getTableRows( editorContext );
		const originalContent = await editor.getEditedPostContent();
		const firstRowControl = getRowControl( editorContext, 1, longRowLabels[ 0 ] );
		const scrollSource = getTableRow( tableRows, longRowLabels[ 7 ] ).getByText(
			longRowLabels[ 7 ],
			{ exact: true }
		);

		await editor.selectBlocks( editorContext.locator( '[data-type="core/table"][data-block]' ) );
		await enterTouchReorderMode( page, editorContext, firstRowControl );
		await scrollSource.scrollIntoViewIfNeeded();
		const initialScrollPosition = await getVerticalScrollPosition( scrollSource );

		await scrollFromCellWithTouch( page, scrollSource );

		await expect
			.poll( () => getVerticalScrollPosition( scrollSource ) )
			.toBeGreaterThan( initialScrollPosition );
		await expect.poll( () => editor.getEditedPostContent() ).toBe( originalContent );
	} );
} );
