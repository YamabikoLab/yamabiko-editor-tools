import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import { expect, test as setup, type Page } from '@playwright/test';

const authFile = '.playwright/.auth/admin.json';

function requiredEnvironment( name: string ): string {
	const value = process.env[ name ];

	if ( value === undefined || value === '' ) {
		throw new Error( `${ name } must be set before running WordPress E2E tests.` );
	}

	return value;
}

async function verifyEditorMode( page: Page ): Promise< void > {
	const expectedMode = process.env.E2E_EDITOR_MODE;

	if ( expectedMode === undefined || expectedMode === '' ) {
		return;
	}

	if ( expectedMode !== 'iframe' && expectedMode !== 'non-iframe' ) {
		throw new Error( `Unsupported E2E_EDITOR_MODE: ${ expectedMode }` );
	}

	await page.goto( '/wp-admin/post-new.php' );

	await expect
		.poll( async () => {
			if ( ( await page.locator( 'iframe[name="editor-canvas"]' ).count() ) > 0 ) {
				return 'iframe';
			}

			if ( ( await page.locator( '.is-root-container' ).count() ) > 0 ) {
				return 'non-iframe';
			}

			return 'loading';
		} )
		.toBe( expectedMode );
}

setup( 'authenticate as the WordPress administrator', async ( { page } ) => {
	const username = requiredEnvironment( 'WP_USERNAME' );
	const password = requiredEnvironment( 'WP_PASSWORD' );

	await page.goto( '/wp-login.php' );
	await page.getByLabel( /username|ユーザー名|メールアドレス/i ).fill( username );
	await page.getByRole( 'textbox', { name: /password|パスワード/i } ).fill( password );
	await page.getByRole( 'button', { name: /log in|ログイン/i } ).click();

	await expect( page ).toHaveURL( /\/wp-admin(?:\/|$|\?)/ );
	await verifyEditorMode( page );

	await mkdir( dirname( authFile ), { recursive: true } );
	await page.context().storageState( { path: authFile } );
} );
