import { store as blockEditorStore } from '@wordpress/block-editor';
import { Button } from '@wordpress/components';
import { useDispatch } from '@wordpress/data';
import { PluginSidebar } from '@wordpress/editor';
import { __, sprintf } from '@wordpress/i18n';
import { listView } from '@wordpress/icons';

import { selectOutlineNode } from './block-navigator';
import type { OutlineNode } from './outline-node';
import { useOutlineNodes } from './use-outline-nodes';

function OutlineItem( {
	node,
	onSelect,
}: {
	node: OutlineNode;
	onSelect: ( node: OutlineNode ) => void;
} ) {
	const text = node.text || __( '（空の見出し）', 'yamabiko-editor-tools' );

	return (
		<li
			className={ `yamabiko-editor-tools-outline__item yamabiko-editor-tools-outline__item--level-${ node.level }` }
		>
			<Button className="yamabiko-editor-tools-outline__button" onClick={ () => onSelect( node ) }>
				<span className="yamabiko-editor-tools-outline__level">H{ node.level }</span>
				<span className="yamabiko-editor-tools-outline__text">{ text }</span>
			</Button>
		</li>
	);
}

export function OutlineSidebar() {
	const nodes = useOutlineNodes();
	const { selectBlock } = useDispatch( blockEditorStore );
	const selectNode = ( node: OutlineNode ) => selectOutlineNode( node, selectBlock );

	return (
		<PluginSidebar
			className="yamabiko-editor-tools-outline-sidebar"
			icon={ listView }
			name="document-outline"
			title={ __( '文書構造', 'yamabiko-editor-tools' ) }
		>
			<div className="yamabiko-editor-tools-outline">
				{ nodes.length === 0 ? (
					<p className="yamabiko-editor-tools-outline__empty">
						{ __( '見出しがありません。', 'yamabiko-editor-tools' ) }
					</p>
				) : (
					<ol
						aria-label={ sprintf(
							/* translators: %d: Number of headings. */
							__( '文書内の見出し（%d件）', 'yamabiko-editor-tools' ),
							nodes.length
						) }
						className="yamabiko-editor-tools-outline__list"
					>
						{ nodes.map( ( node ) => (
							<OutlineItem key={ node.id } node={ node } onSelect={ selectNode } />
						) ) }
					</ol>
				) }
			</div>
		</PluginSidebar>
	);
}
