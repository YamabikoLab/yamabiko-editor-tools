import {
	filterAdapterOutlineNodes,
	isAdapterOutlineNode,
	isOutlineAdapter,
} from './adapter';

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

describe( 'filterAdapterOutlineNodes', () => {
	it( 'returns an empty list for a non-array value', () => {
		expect( filterAdapterOutlineNodes( null ) ).toEqual( [] );
	} );

	it( 'keeps valid nodes and their original indexes', () => {
		expect(
			filterAdapterOutlineNodes( [
				{ level: 2, text: 'First' },
				{ level: 7, text: 'Invalid' },
				{ level: 3, text: 'Third', navigable: false },
			] )
		).toEqual( [
			{
				headingIndex: 0,
				node: { level: 2, text: 'First' },
			},
			{
				headingIndex: 2,
				node: { level: 3, text: 'Third', navigable: false },
			},
		] );
	} );
} );
