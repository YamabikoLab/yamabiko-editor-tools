import { store as blockEditorStore } from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';
import { useMemo } from '@wordpress/element';

import { resolveHeadingBlocks } from './heading-resolver';

export function useOutlineNodes() {
	const blocks = useSelect( ( select ) => select( blockEditorStore ).getBlocks(), [] );

	return useMemo( () => resolveHeadingBlocks( blocks ), [ blocks ] );
}
