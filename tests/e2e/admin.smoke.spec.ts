import { expect, test } from '@wordpress/e2e-test-utils-playwright';

test( 'Yamabiko Editor Tools is active in WordPress administration', async ( { admin, page } ) => {
	await admin.visitAdminPage( 'plugins.php', 'plugin_status=active' );

	await expect( page.getByText( 'Yamabiko Editor Tools', { exact: true } ) ).toBeVisible();
} );
