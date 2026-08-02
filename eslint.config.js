/**
 * WordPress dependencies
 */
const wordpress = require( '@wordpress/eslint-plugin' );

module.exports = [
	{
		ignores: [ 'build/**', 'vendor/**' ],
	},
	...wordpress.configs.recommended,
	{
		files: [ 'scripts/version.mjs' ],
		rules: {
			'no-console': 'off',
		},
	},
];
