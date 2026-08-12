/**
 * Table ReorderをGutenbergのBlockEditへ接続するcomposition / rendering adapter。
 *
 * core/table判定、元のBlockEdit、Table Reorder toolbar、Table探索用hidden anchorの描画だけを担当する。
 * React state / effectとcontroller lifecycleは`use-table-reorder.ts`へ委譲する。
 */

import { BlockControls } from '@wordpress/block-editor';
import type { BlockEditProps } from '@wordpress/blocks';
import { ToolbarButton } from '@wordpress/components';
import type { ComponentType } from '@wordpress/element';

import { getToolbarReorderName } from './messages';
import { useTableReorder } from './use-table-reorder';

/** Core Table blockのbodyを含むattribute形。 */
type TableAttributes = Record< string, unknown > & {
	body?: unknown[];
};

/** HOCが利用するCore Table向けBlockEdit props。 */
type TableBlockEditProps = BlockEditProps< TableAttributes > & {
	name: string;
};

/**
 * BlockEditへTable Reorderの描画境界を追加するHOC。
 *
 * @param BlockEdit Gutenbergが提供する元のBlockEdit component。
 * @return Table Reorderを接続したBlockEdit component。
 */
export const withTableReorder = ( BlockEdit: ComponentType< TableBlockEditProps > ) =>
	/**
	 * Table Reorderを接続したBlockEdit component。
	 *
	 * @param props Gutenbergから渡されるBlockEdit props。
	 */
	function WithTableReorder( props: TableBlockEditProps ) {
		const {
			attributes: { body },
			clientId,
			isSelected,
			setAttributes,
		} = props;
		const isTableBlock = props.name === 'core/table';
		const {
			anchorRef,
			isHoverCapable,
			isTouchReorderMode,
			requestRowControlFocus,
			toggleTouchReorderMode,
		} = useTableReorder( {
			body,
			clientId,
			enabled: isTableBlock,
			isSelected,
			setAttributes,
		} );

		if ( ! isTableBlock ) {
			return <BlockEdit { ...props } />;
		}

		const toolbarLabel = getToolbarReorderName();

		return (
			<>
				<BlockEdit { ...props } />
				{ isSelected && (
					<BlockControls>
						<ToolbarButton
							icon="sort"
							isPressed={ isHoverCapable ? undefined : isTouchReorderMode }
							label={ toolbarLabel }
							onClick={
								isHoverCapable ? requestRowControlFocus : toggleTouchReorderMode
							}
							showTooltip
						/>
					</BlockControls>
				) }
				<span aria-hidden="true" hidden ref={ anchorRef } />
			</>
		);
	};
