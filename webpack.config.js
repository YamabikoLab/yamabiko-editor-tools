const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const { getWebpackEntryPoints } = require( '@wordpress/scripts/utils/config' );

module.exports = {
	...defaultConfig,
	entry: () => ( {
		...getWebpackEntryPoints( 'script' )(),
		'editor-extensions/table-reorder/index': './src/editor-extensions/table-reorder/index.tsx',
		'editor-extensions/table-reorder/content': './src/editor-extensions/table-reorder/content.scss',
	} ),
};
