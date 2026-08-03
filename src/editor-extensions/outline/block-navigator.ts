import type { OutlineNode } from './outline-node';

type SelectBlock = ( clientId: string ) => void;

export function selectOutlineNode( node: OutlineNode, selectBlock: SelectBlock ): boolean {
	if ( ! node.navigable ) {
		return false;
	}

	selectBlock( node.blockClientId );

	return true;
}
