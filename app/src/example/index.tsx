import { useBlockProps } from '@wordpress/block-editor';
import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';

import metadata from './block.json';

function Edit() {
	return (
		<p { ...useBlockProps() }>
			{ __( 'Yamabiko Editor Tools is ready.', 'yamabiko-editor-tools' ) }
		</p>
	);
}

function save() {
	return (
		<p { ...useBlockProps.save() }>
			{ __( 'Yamabiko Editor Tools is ready.', 'yamabiko-editor-tools' ) }
		</p>
	);
}

registerBlockType( metadata, {
	edit: Edit,
	save,
} );
