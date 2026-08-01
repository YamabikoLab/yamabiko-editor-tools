import { useBlockProps } from '@wordpress/block-editor';
import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';

import metadata from './block.json';

function Edit() {
	return (
		<p { ...useBlockProps() }>
			{ __( 'Yamabiko Blocks is ready.', 'yamabiko-blocks' ) }
		</p>
	);
}

function save() {
	return (
		<p { ...useBlockProps.save() }>
			{ __( 'Yamabiko Blocks is ready.', 'yamabiko-blocks' ) }
		</p>
	);
}

registerBlockType( metadata, {
	edit: Edit,
	save,
} );
