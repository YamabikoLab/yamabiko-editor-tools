const fs = require( 'node:fs' );

const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const { getWebpackEntryPoints } = require( '@wordpress/scripts/utils/config' );

const SORTABLEJS_RUNTIME_ASSET = 'editor-extensions/table-reorder/sortable.min.js';

class EmitSortableJsRuntimePlugin {
	apply( compiler ) {
		compiler.hooks.thisCompilation.tap( 'EmitSortableJsRuntimePlugin', ( compilation ) => {
			compilation.hooks.processAssets.tap(
				{
					name: 'EmitSortableJsRuntimePlugin',
					stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
				},
				() => {
					const sourcePath = require.resolve( 'sortablejs/Sortable.min.js' );
					const source = fs.readFileSync( sourcePath );

					compilation.emitAsset(
						SORTABLEJS_RUNTIME_ASSET,
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
		'editor-extensions/table-reorder/index': './src/editor-extensions/table-reorder/index.tsx',
	} ),
	plugins: [ ...( defaultConfig.plugins ?? [] ), new EmitSortableJsRuntimePlugin() ],
};
