import type { RequestUtils } from '@wordpress/e2e-test-utils-playwright';
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

const BASIC_TABLE_CONTENT = `<!-- wp:table -->
<figure class="wp-block-table"><table class="has-fixed-layout"><tbody><tr><td>Alpha</td></tr><tr><td>Bravo</td></tr><tr><td>Charlie</td></tr></tbody></table></figure>
<!-- /wp:table -->

<!-- wp:paragraph -->
<p>Outside table</p>
<!-- /wp:paragraph -->`;

const PREFERENCES_SCOPE = 'yamabiko-editor-tools';
const KEYBOARD_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderKeyboardCoachmarkDismissed';
const TOUCH_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderTouchCoachmarkDismissed';

async function setTableReorderCoachmarkDismissal(
	requestUtils: RequestUtils,
	dismissed: boolean
): Promise< void > {
	await requestUtils.setPreferences( PREFERENCES_SCOPE, {
		[ KEYBOARD_COACHMARK_DISMISSED_PREFERENCE ]: dismissed,
		[ TOUCH_COACHMARK_DISMISSED_PREFERENCE ]: dismissed,
	} );
}

test.describe( 'Table Reorder UI', () => {
	test.beforeEach( async ( { admin, editor, requestUtils } ) => {
		await setTableReorderCoachmarkDismissal( requestUtils, false );
		await admin.createNewPost();
		await editor.setContent( BASIC_TABLE_CONTENT );
	} );

	test( 'starts from the minimal table content', async ( { editor } ) => {
		await expect( editor.canvas.getByText( 'Alpha', { exact: true } ) ).toBeVisible();
		await expect( editor.canvas.getByText( 'Bravo', { exact: true } ) ).toBeVisible();
		await expect( editor.canvas.getByText( 'Charlie', { exact: true } ) ).toBeVisible();
		await expect( editor.canvas.getByText( 'Outside table', { exact: true } ) ).toBeVisible();
	} );
} );
