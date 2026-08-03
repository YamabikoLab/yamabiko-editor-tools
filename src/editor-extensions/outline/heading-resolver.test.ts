import type { Block } from '@wordpress/blocks';

import { resolveHeadingBlocks } from './heading-resolver';
import { createOutlineNodeId } from './outline-node';

function createTestBlock(
	name: string,
	clientId: string,
	attributes: Record< string, unknown > = {},
	innerBlocks: Block[] = []
): Block {
	return {
		name,
		clientId,
		attributes,
		innerBlocks,
		isValid: true,
	};
}

describe( 'resolveHeadingBlocks', () => {
	it( 'returns top-level and nested headings in document order', () => {
		const blocks = [
			createTestBlock( 'core/heading', 'heading-1', {
				content: 'Title',
				level: 1,
			} ),
			createTestBlock( 'core/group', 'group-1', {}, [
				createTestBlock( 'core/paragraph', 'paragraph-1' ),
				createTestBlock( 'core/heading', 'heading-2', {
					content: '<strong>Nested</strong> heading',
					level: 3,
				} ),
				createTestBlock( 'core/group', 'group-2', {}, [
					createTestBlock( 'core/heading', 'heading-3', {
						content: 'Deep heading',
						level: 4,
					} ),
				] ),
			] ),
			createTestBlock( 'core/heading', 'heading-4', {
				content: 'Last heading',
				level: 2,
			} ),
		];

		expect( resolveHeadingBlocks( blocks ) ).toEqual( [
			{
				id: 'heading-1:0',
				blockClientId: 'heading-1',
				blockName: 'core/heading',
				level: 1,
				text: 'Title',
				source: 'core-heading',
				navigable: true,
			},
			{
				id: 'heading-2:0',
				blockClientId: 'heading-2',
				blockName: 'core/heading',
				level: 3,
				text: 'Nested heading',
				source: 'inner-block',
				navigable: true,
			},
			{
				id: 'heading-3:0',
				blockClientId: 'heading-3',
				blockName: 'core/heading',
				level: 4,
				text: 'Deep heading',
				source: 'inner-block',
				navigable: true,
			},
			{
				id: 'heading-4:0',
				blockClientId: 'heading-4',
				blockName: 'core/heading',
				level: 2,
				text: 'Last heading',
				source: 'core-heading',
				navigable: true,
			},
		] );
	} );

	it( 'uses the core heading default level and keeps empty headings', () => {
		const blocks = [ createTestBlock( 'core/heading', 'heading-1', { content: '' } ) ];

		expect( resolveHeadingBlocks( blocks )[ 0 ] ).toMatchObject( {
			level: 2,
			text: '',
		} );
	} );

	it( 'returns an empty outline when there are no headings', () => {
		const blocks = [ createTestBlock( 'core/paragraph', 'paragraph-1' ) ];

		expect( resolveHeadingBlocks( blocks ) ).toEqual( [] );
	} );
} );

describe( 'createOutlineNodeId', () => {
	it( 'combines the block client ID and zero-based heading index', () => {
		expect( createOutlineNodeId( 'block-client-id', 0 ) ).toBe( 'block-client-id:0' );
		expect( createOutlineNodeId( 'block-client-id', 2 ) ).toBe( 'block-client-id:2' );
	} );
} );
