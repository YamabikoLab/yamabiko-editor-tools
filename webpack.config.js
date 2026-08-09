const fs = require( 'node:fs' );

const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const { getWebpackEntryPoints } = require( '@wordpress/scripts/utils/config' );

const SORTABLEJS_POC_ASSET = 'editor-extensions/sortablejs-table-reorder-poc/sortable.min.js';

class EmitSortableJsPocRuntimePlugin {
	apply( compiler ) {
		compiler.hooks.thisCompilation.tap( 'EmitSortableJsPocRuntimePlugin', ( compilation ) => {
			compilation.hooks.processAssets.tap(
				{
					name: 'EmitSortableJsPocRuntimePlugin',
					stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
				},
				() => {
					const sourcePath = require.resolve( 'sortablejs/Sortable.min.js' );
					const source = fs.readFileSync( sourcePath );

					compilation.emitAsset(
						SORTABLEJS_POC_ASSET,
						new compiler.webpack.sources.RawSource( source )
					);
				}
			);
		} );
	}
}

module.exports = {
	...defaultConfig,
	entry: () => ( {
		...getWebpackEntryPoints( 'script' )(),
		'editor-extensions/sortablejs-table-reorder-poc/index':
			'./src/editor-extensions/sortablejs-table-reorder-poc/index.tsx',
	} ),
	plugins: [ ...( defaultConfig.plugins ?? [] ), new EmitSortableJsPocRuntimePlugin() ],
};
