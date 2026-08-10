/**
 * Table ReorderをGutenbergのBlockEditへ接続するcomposition / rendering adapter。
 *
 * core/table判定、元のBlockEdit、touch並び替えtoolbar、Table探索用hidden anchorの描画だけを担当する。
 * React state / effectとcontroller lifecycleは`use-table-reorder.ts`へ委譲し、drag処理やDOM操作は
 * さらに下位のTable Reorderモジュールが所有する。
 */

import { BlockControls } from '@wordpress/block-editor';
import type { BlockEditProps } from '@wordpress/blocks';
import { ToolbarButton } from '@wordpress/components';
import type { ComponentType } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

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
 * Table以外のblockは元のBlockEditだけを描画する。Tableではcustom hookが返すstate / callbackを使い、
 * touch端末向けtoolbarとTable DOM解決の起点となるhidden anchorを追加する。
 *
 * @param BlockEdit Gutenbergが提供する元のBlockEdit component。
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
		const { anchorRef, isHoverCapable, isTouchReorderMode, toggleTouchReorderMode } =
			useTableReorder( {
				body,
				clientId,
				enabled: isTableBlock,
				isSelected,
				setAttributes,
			} );

		if ( ! isTableBlock ) {
			return <BlockEdit { ...props } />;
		}

		return (
			<>
				<BlockEdit { ...props } />
				{ ! isHoverCapable && isSelected && (
					<BlockControls>
						<ToolbarButton
							icon="sort"
							isPressed={ isTouchReorderMode }
							label={ __( '行を並び替え', 'yamabiko-editor-tools' ) }
							onClick={ toggleTouchReorderMode }
							showTooltip
						/>
					</BlockControls>
				) }
				<span aria-hidden="true" hidden ref={ anchorRef } />
			</>
		);
	};
