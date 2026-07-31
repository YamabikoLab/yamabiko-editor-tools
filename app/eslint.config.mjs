import wordpress from '@wordpress/eslint-plugin';

export default [
	{
		ignores: [ 'build/**' ],
	},
	...wordpress.configs.recommended,
];
