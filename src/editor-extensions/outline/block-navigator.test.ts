import { selectOutlineNode } from './block-navigator';
import type { OutlineNode } from './outline-node';

function createNode( navigable: boolean ): OutlineNode {
	return {
		id: 'heading-1:0',
		blockClientId: 'heading-1',
		blockName: 'core/heading',
		level: 2,
		text: 'Heading',
		source: 'core-heading',
		navigable,
	};
}

describe( 'selectOutlineNode', () => {
	it( 'selects the source block for a navigable node', () => {
		const selectBlock = jest.fn();

		expect( selectOutlineNode( createNode( true ), selectBlock ) ).toBe( true );
		expect( selectBlock ).toHaveBeenCalledWith( 'heading-1' );
	} );

	it( 'does not select a source block for a non-navigable node', () => {
		const selectBlock = jest.fn();

		expect( selectOutlineNode( createNode( false ), selectBlock ) ).toBe( false );
		expect( selectBlock ).not.toHaveBeenCalled();
	} );
} );
