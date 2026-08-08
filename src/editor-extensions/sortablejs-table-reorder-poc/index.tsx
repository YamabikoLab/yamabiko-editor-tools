import { addFilter } from '@wordpress/hooks';

import { withSortableJsTableReorderPoc } from './with-sortablejs-table-reorder-poc';

addFilter(
	'editor.BlockEdit',
	'yamabiko-editor-tools/sortablejs-table-reorder-poc',
	withSortableJsTableReorderPoc,
	20
);
