import type { CDPSession, Locator, Page } from '@playwright/test';
import type { RequestUtils } from '@wordpress/e2e-test-utils-playwright';
import { expect } from '@wordpress/e2e-test-utils-playwright';

import type { EditorContext } from './editor-context';

const PREFERENCES_SCOPE = 'yamabiko-editor-tools';
const TOUCH_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderTouchCoachmarkDismissed';
const reorderRowsButtonName = /^(Reorder rows|行を並べ替え)$/;

export type TouchPoint = {
	x: number;
	y: number;
};

type SortableWindow = Window & {
	Sortable?: {
		get?: ( element: Element ) => unknown;
	};
};

export async function dismissTouchCoachmark( requestUtils: RequestUtils ): Promise< void > {
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

export async function enterTouchReorderMode(
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

export async function dispatchTouchGesture(
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

export function interpolateTouchPoints(
	start: TouchPoint,
	end: TouchPoint,
	steps: number
): TouchPoint[] {
	return Array.from( { length: steps }, ( _, index ) => {
		const progress = ( index + 1 ) / steps;

		return {
			x: start.x + ( end.x - start.x ) * progress,
			y: start.y + ( end.y - start.y ) * progress,
		};
	} );
}
