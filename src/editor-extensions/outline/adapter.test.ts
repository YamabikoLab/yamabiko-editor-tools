import { isAdapterOutlineNode, isAdapterOutlineNodeList, isOutlineAdapter } from './adapter';

describe( 'isOutlineAdapter', () => {
	it( 'accepts the minimal internal adapter shape', () => {
		expect(
			isOutlineAdapter( {
				blockName: 'example/faq',
				getOutlineNodes: () => [],
			} )
		).toBe( true );
	} );

	it.each( [
		null,
		{ blockName: '', getOutlineNodes: () => [] },
		{ blockName: 'faq', getOutlineNodes: () => [] },
		{ blockName: 'Example/faq', getOutlineNodes: () => [] },
		{ blockName: 'example/faq' },
	] )( 'rejects an invalid adapter shape', ( adapter ) => {
		expect( isOutlineAdapter( adapter ) ).toBe( false );
	} );
} );

describe( 'isAdapterOutlineNode', () => {
	it.each( [
		{ level: 1, text: '' },
		{ level: 6, text: 'Heading', navigable: false },
	] )( 'accepts a valid adapter node', ( node ) => {
		expect( isAdapterOutlineNode( node ) ).toBe( true );
	} );

	it.each( [
		null,
		[],
		{ level: 0, text: 'Heading' },
		{ level: 7, text: 'Heading' },
		{ level: 2.5, text: 'Heading' },
		{ level: 2, text: 10 },
		{ level: 2, text: 'Heading', navigable: 'yes' },
	] )( 'rejects an invalid adapter node', ( node ) => {
		expect( isAdapterOutlineNode( node ) ).toBe( false );
	} );
} );

describe( 'isAdapterOutlineNodeList', () => {
	it( 'accepts an array of valid nodes', () => {
		expect( isAdapterOutlineNodeList( [ { level: 2, text: 'Heading' } ] ) ).toBe( true );
	} );

	it( 'rejects a non-array or an array containing an invalid node', () => {
		expect( isAdapterOutlineNodeList( null ) ).toBe( false );
		expect( isAdapterOutlineNodeList( [ { level: 7, text: 'Heading' } ] ) ).toBe( false );
	} );
} );
