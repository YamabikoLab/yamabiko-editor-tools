const defaultConfig = require( '@wordpress/scripts/config/jest-unit.config' );

module.exports = {
	...defaultConfig,
	collectCoverageFrom: [
		'src/**/*.{ts,tsx}',
		'!src/**/*.test.{ts,tsx}',
		'!src/**/*.test-utils.ts',
		'!src/types/**',
		'!src/editor-extensions/table-reorder/index.tsx',
	],
};
