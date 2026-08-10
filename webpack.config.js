const fs = require( 'node:fs' );

const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const { getWebpackEntryPoints } = require( '@wordpress/scripts/utils/config' );

const SORTABLEJS_TABLE_REORDER_ASSET = 'editor-extensions/table-reorder/sortable.min.js';

class EmitSortableJsTableReorderRuntimePlugin {
	apply( compiler ) {
		compiler.hooks.thisCompilation.tap(
			'EmitSortableJsTableReorderRuntimePlugin',
			( compilation ) => {
				compilation.hooks.processAssets.tap(
					{
						name: 'EmitSortableJsTableReorderRuntimePlugin',
						stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
					},
					() => {
						const sourcePath = require.resolve( 'sortablejs/Sortable.min.js' );
						const source = fs.readFileSync( sourcePath );

						compilation.emitAsset(
							SORTABLEJS_TABLE_REORDER_ASSET,
							new compiler.webpack.sources.RawSource( source )
						);
					}
				);
			}
		);
	}
}

module.exports = {
	...defaultConfig,
	entry: () => ( {
		...getWebpackEntryPoints( 'script' )(),
		'editor-extensions/table-reorder/index': './src/editor-extensions/table-reorder/index.tsx',
	} ),
	plugins: [
		...( defaultConfig.plugins ?? [] ),
		new EmitSortableJsTableReorderRuntimePlugin(),
	],
};
