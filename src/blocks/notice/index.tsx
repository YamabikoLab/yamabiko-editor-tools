import { registerBlockType } from '@wordpress/blocks';

import metadata from './block.json';
import { Edit } from './edit';
import './editor.scss';
import './style.scss';

registerBlockType( metadata, {
	edit: Edit,
	save: () => null,
} );
