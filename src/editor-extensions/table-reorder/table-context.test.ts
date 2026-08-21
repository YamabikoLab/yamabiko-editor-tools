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

		expect( resolveTableContext( anchor, 'shared-block' ) ).toEqual( {
			blockElement: root.block,
			document,
			window,
			tbody: root.tbody,
		} );
	} );

	it( 'resolves a direct document Table context', () => {
		const anchor = document.createElement( 'span' );
		document.body.append( anchor );
		const { block, tbody } = appendTableBlock( document, 'root-block' );

		expect( resolveTableContext( anchor, 'root-block' ) ).toEqual( {
			blockElement: block,
			document,
			window,
			tbody,
		} );
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

		expect( resolveTableContext( anchor, 'iframe-block' ) ).toEqual( {
			blockElement: block,
			document: iframe.contentDocument,
			window: iframe.contentWindow,
			tbody,
		} );
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
