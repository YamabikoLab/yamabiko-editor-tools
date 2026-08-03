const path = require( 'path' );

const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

module.exports = {
	...defaultConfig,
	entry: async () => ( {
		...( await defaultConfig.entry() ),
		'editor-extensions/outline/index': path.resolve(
			process.cwd(),
			'src/editor-extensions/outline/index.tsx'
		),
	} ),
};
