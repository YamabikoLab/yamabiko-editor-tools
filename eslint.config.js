/**
 * WordPress dependencies
 */
const wordpress = require( '@wordpress/eslint-plugin' );

module.exports = [
	{
		ignores: [
			'build/**',
			'vendor/**',
			'.playwright/**',
			'playwright-report/**',
			'test-results/**',
		],
	},
	...wordpress.configs.recommended,
	{
		files: [ 'scripts/version.mjs' ],
		rules: {
			'no-console': 'off',
		},
	},
];
