import { listView } from '@wordpress/icons';
import { registerPlugin } from '@wordpress/plugins';

import { OutlineSidebar } from './sidebar';
import './editor.scss';

registerPlugin( 'yamabiko-editor-tools-outline', {
	icon: listView,
	render: OutlineSidebar,
} );
