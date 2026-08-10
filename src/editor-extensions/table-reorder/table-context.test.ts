import { resolveTableContext } from './table-context';

const appendTableBlock = ( targetDocument: Document, clientId: string ) => {
	const block = targetDocument.createElement( 'div' );
	block.dataset.block = clientId;
	const table = targetDocument.createElement( 'table' );
	const tbody = targetDocument.createElement( 'tbody' );
	table.append( tbody );
	block.append( table );
	targetDocument.body.append( block );
	return { block, table, tbody };
};

describe( 'resolveTableContext', () => {
	beforeEach( () => {
		document.body.replaceChildren();
	} );

	it( 'resolves a direct document Table context', () => {
		const anchor = document.createElement( 'span' );
		document.body.append( anchor );
		const { block, table, tbody } = appendTableBlock( document, 'root-block' );

		expect( resolveTableContext( anchor, 'root-block' ) ).toEqual( {
			blockElement: block,
			document,
			window,
			table,
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
		const { block, table, tbody } = appendTableBlock( iframe.contentDocument, 'iframe-block' );

		expect( resolveTableContext( anchor, 'iframe-block' ) ).toEqual( {
			blockElement: block,
			document: iframe.contentDocument,
			window: iframe.contentWindow,
			table,
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
