import { resolveTableContext } from './table-context';

const appendTableBlock = ( targetDocument: Document, clientId: string ) => {
	const block = targetDocument.createElement( 'div' );
	block.dataset.block = clientId;
	const table = targetDocument.createElement( 'table' );
	const tbody = targetDocument.createElement( 'tbody' );
	table.append( tbody );
	block.append( table );
	targetDocument.body.append( block );
	return { block, tbody };
};

describe( 'resolveTableContext', () => {
	beforeEach( () => {
		document.body.replaceChildren();
	} );

	it( 'prefers the root document when the same block exists in the iframe', () => {
		const anchor = document.createElement( 'span' );
		document.body.append( anchor );
		const root = appendTableBlock( document, 'shared-block' );

		const iframe = document.createElement( 'iframe' );
		iframe.name = 'editor-canvas';
		document.body.append( iframe );
		if ( ! iframe.contentDocument ) {
			throw new Error( 'Expected iframe contentDocument in jsdom' );
		}
		appendTableBlock( iframe.contentDocument, 'shared-block' );

		const context = resolveTableContext( anchor, 'shared-block' );
		expect( context?.blockElement ).toBe( root.block );
		expect( context?.document ).toBe( document );
		expect( context?.window ).toBe( window );
		expect( context?.tbody ).toBe( root.tbody );
		expect( context?.isIframeEditor() ).toBe( false );
	} );

	it( 'resolves a direct document Table context', () => {
		const anchor = document.createElement( 'span' );
		document.body.append( anchor );
		const { block, tbody } = appendTableBlock( document, 'root-block' );

		const context = resolveTableContext( anchor, 'root-block' );
		expect( context?.blockElement ).toBe( block );
		expect( context?.document ).toBe( document );
		expect( context?.window ).toBe( window );
		expect( context?.tbody ).toBe( tbody );
		expect( context?.isIframeEditor() ).toBe( false );
	} );

	it( 'falls back to the editor canvas iframe when the root has no block', () => {
		const anchor = document.createElement( 'span' );
		document.body.append( anchor );
		const iframe = document.createElement( 'iframe' );
		iframe.name = 'editor-canvas';
		document.body.append( iframe );
		if ( ! iframe.contentDocument || ! iframe.contentWindow ) {
			throw new Error( 'Expected iframe document and window in jsdom' );
		}
		const { block, tbody } = appendTableBlock( iframe.contentDocument, 'iframe-block' );

		const context = resolveTableContext( anchor, 'iframe-block' );
		expect( context?.blockElement ).toBe( block );
		expect( context?.document ).toBe( iframe.contentDocument );
		expect( context?.window ).toBe( iframe.contentWindow );
		expect( context?.tbody ).toBe( tbody );
		expect( context?.isIframeEditor() ).toBe( true );
	} );

	it( 'derives iframe state from the current context window', () => {
		const anchor = document.createElement( 'span' );
		document.body.append( anchor );
		appendTableBlock( document, 'root-block' );
		const context = resolveTableContext( anchor, 'root-block' );
		if ( ! context ) {
			throw new Error( 'Expected Table context' );
		}

		Object.defineProperty( context.window, 'frameElement', {
			configurable: true,
			value: document.createElement( 'iframe' ),
		} );
		expect( context.isIframeEditor() ).toBe( true );
	} );

	it( 'returns null when a complete Table context cannot be resolved', () => {
		const anchor = document.createElement( 'span' );
		document.body.append( anchor );
		const block = document.createElement( 'div' );
		block.dataset.block = 'incomplete-block';
		document.body.append( block );

		expect( resolveTableContext( anchor, 'missing-block' ) ).toBeNull();
		expect( resolveTableContext( anchor, 'incomplete-block' ) ).toBeNull();
	} );
} );
