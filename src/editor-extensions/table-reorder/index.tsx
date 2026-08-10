import { addFilter } from '@wordpress/hooks';

import './editor.scss';
import { withTableReorder } from './with-table-reorder';

addFilter( 'editor.BlockEdit', 'yamabiko-editor-tools/table-reorder', withTableReorder );
