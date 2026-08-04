import { BlockControls } from '@wordpress/block-editor';
import type { BlockEditProps } from '@wordpress/blocks';
import { ToolbarButton } from '@wordpress/components';
import { useEffect, useState, type ComponentType } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { dragHandle } from '@wordpress/icons';

import { TableReorderController } from './table-reorder-controller';

type TableAttributes = Record< string, unknown > & {
	body?: unknown[];
};

type TableBlockEditProps = BlockEditProps< TableAttributes > & {
	name: string;
};

export const withTableReorder = ( BlockEdit: ComponentType< TableBlockEditProps > ) =>
	function WithTableReorder( props: TableBlockEditProps ) {
		const [ isReorderMode, setIsReorderMode ] = useState( false );
		const isTableBlock = props.name === 'core/table';

		useEffect( () => {
			if ( ! props.isSelected ) {
				setIsReorderMode( false );
			}
		}, [ props.isSelected ] );

		if ( ! isTableBlock ) {
			return <BlockEdit { ...props } />;
		}

		const label = isReorderMode
			? __( '並べ替えを終了', 'yamabiko-editor-tools' )
			: __( '行を並べ替え', 'yamabiko-editor-tools' );

		return (
			<>
				<BlockEdit { ...props } />
				{ props.isSelected && (
					<BlockControls>
						<ToolbarButton
							icon={ dragHandle }
							isPressed={ isReorderMode }
							label={ label }
							onClick={ () => setIsReorderMode( ( mode ) => ! mode ) }
						/>
					</BlockControls>
				) }
				{ isReorderMode && props.isSelected && (
					<TableReorderController body={ props.attributes.body } clientId={ props.clientId } />
				) }
			</>
		);
	};
