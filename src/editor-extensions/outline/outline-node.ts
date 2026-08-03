import type { Block } from '@wordpress/blocks';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type OutlineNodeSource = 'core-heading' | 'inner-block' | 'adapter' | 'html';

export type OutlineNode = {
	id: string;
	blockClientId: string;
	blockName: string;
	level: HeadingLevel;
	text: string;
	source: OutlineNodeSource;
	navigable: boolean;
};

export type AdapterOutlineNode = {
	level: HeadingLevel;
	text: string;
	navigable?: boolean;
};

export type OutlineAdapter = {
	blockName: string;
	getOutlineNodes: ( block: Block ) => readonly AdapterOutlineNode[];
};

export function isHeadingLevel( value: unknown ): value is HeadingLevel {
	return Number.isInteger( value ) && Number( value ) >= 1 && Number( value ) <= 6;
}

export function createOutlineNodeId( blockClientId: string, headingIndex: number ): string {
	return `${ blockClientId }:${ headingIndex }`;
}
