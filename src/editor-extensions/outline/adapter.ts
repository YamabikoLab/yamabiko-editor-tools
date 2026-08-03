import { isHeadingLevel, type AdapterOutlineNode, type OutlineAdapter } from './outline-node';

const blockNamePattern = /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/;

export function isOutlineAdapter( value: unknown ): value is OutlineAdapter {
	if ( typeof value !== 'object' || value === null ) {
		return false;
	}

	const candidate = value as Record< string, unknown >;

	return (
		typeof candidate.blockName === 'string' &&
		blockNamePattern.test( candidate.blockName ) &&
		typeof candidate.getOutlineNodes === 'function'
	);
}

export function isAdapterOutlineNode( value: unknown ): value is AdapterOutlineNode {
	if ( typeof value !== 'object' || value === null ) {
		return false;
	}

	const candidate = value as Record< string, unknown >;

	return (
		isHeadingLevel( candidate.level ) &&
		typeof candidate.text === 'string' &&
		( candidate.navigable === undefined || typeof candidate.navigable === 'boolean' )
	);
}

export function isAdapterOutlineNodeList( value: unknown ): value is readonly AdapterOutlineNode[] {
	return Array.isArray( value ) && value.every( isAdapterOutlineNode );
}
