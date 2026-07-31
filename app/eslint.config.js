/**
 * WordPress dependencies
 */
const wordpress = require( '@wordpress/eslint-plugin' );

module.exports = [
	{
		ignores: [ 'build/**' ],
	},
	...wordpress.configs.recommended,
];
