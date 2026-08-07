import { defineConfig } from '@playwright/test';

const baseURL = process.env.WP_BASE_URL ?? process.env.WORDPRESS_URL ?? 'http://127.0.0.1:8080';

export default defineConfig( {
	testDir: './tests/e2e',
	outputDir: 'test-results',
	timeout: 30_000,
	fullyParallel: false,
	workers: 1,
	reporter: [ [ 'html', { open: 'never', outputFolder: 'playwright-report' } ], [ 'list' ] ],
	use: {
		baseURL,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
	},
	projects: [
		{
			name: 'setup',
			testMatch: '**/auth.setup.ts',
			use: {
				browserName: 'chromium',
				channel: 'chromium',
			},
		},
		{
			name: 'chromium',
			dependencies: [ 'setup' ],
			use: {
				browserName: 'chromium',
				channel: 'chromium',
				storageState: '.playwright/.auth/admin.json',
			},
		},
	],
} );
