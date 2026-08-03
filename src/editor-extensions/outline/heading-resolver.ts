import type { Block } from '@wordpress/blocks';
import { RichTextData } from '@wordpress/rich-text';

import {
	createOutlineNodeId,
	isHeadingLevel,
	type HeadingLevel,
	type OutlineNode,
} from './outline-node';

function getHeadingLevel( value: unknown ): HeadingLevel {
	return isHeadingLevel( value ) ? value : 2;
}

function getHeadingText( value: unknown ): string {
	if ( typeof value === 'string' ) {
		return RichTextData.fromHTMLString( value ).toPlainText();
	}

	if ( value instanceof RichTextData ) {
		return value.toPlainText();
	}

	if ( typeof value === 'object' && value !== null && 'text' in value ) {
		const text = ( value as { text?: unknown } ).text;

		return typeof text === 'string' ? text.replaceAll( '\ufffc', '' ) : '';
	}

	return '';
}

function resolveBlocks( blocks: readonly Block[], isNested: boolean ): OutlineNode[] {
	const nodes: OutlineNode[] = [];

	for ( const block of blocks ) {
		if ( block.name === 'core/heading' ) {
			nodes.push( {
				id: createOutlineNodeId( block.clientId, 0 ),
				blockClientId: block.clientId,
				blockName: block.name,
				level: getHeadingLevel( block.attributes.level ),
				text: getHeadingText( block.attributes.content ),
				source: isNested ? 'inner-block' : 'core-heading',
				navigable: true,
			} );
		}

		if ( block.innerBlocks.length > 0 ) {
			nodes.push( ...resolveBlocks( block.innerBlocks, true ) );
		}
	}

	return nodes;
}

export function resolveHeadingBlocks( blocks: readonly Block[] ): OutlineNode[] {
	return resolveBlocks( blocks, false );
}
