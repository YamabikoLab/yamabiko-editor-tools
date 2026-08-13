/**
 * Table ReorderをGutenbergのBlockEditへ接続するcomposition / rendering adapter。
 *
 * core/table判定、元のBlockEdit、Table Reorder toolbar、touch初回coachmark、Table探索用hidden anchorの
 * 描画だけを担当する。React state / effectとcontroller lifecycleは`use-table-reorder.ts`へ委譲する。
 */

import { BlockControls } from '@wordpress/block-editor';
import type { BlockEditProps } from '@wordpress/blocks';
import { Popover, ToolbarButton } from '@wordpress/components';
import { useRef, type ComponentType } from '@wordpress/element';

import {
	getToolbarReorderDescription,
	getToolbarReorderName,
	getTouchCoachmarkMessage,
} from './messages';
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
		const toolbarButtonRef = useRef< HTMLButtonElement >( null );
		const isTableBlock = props.name === 'core/table';
		const {
			anchorRef,
			dismissTouchCoachmark,
			isHoverCapable,
			isTouchCoachmarkVisible,
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
		const toolbarDescription = getToolbarReorderDescription();
		const toolbarDescriptionId = `yamabiko-table-reorder-toolbar-description-${ clientId }`;

		return (
			<>
				<BlockEdit { ...props } />
				{ isSelected && (
					<BlockControls>
						<ToolbarButton
							aria-describedby={ toolbarDescriptionId }
							icon="sort"
							isPressed={ isHoverCapable ? undefined : isTouchReorderMode }
							label={ toolbarLabel }
							onClick={ isHoverCapable ? requestRowControlFocus : toggleTouchReorderMode }
							ref={ toolbarButtonRef }
							showTooltip
						/>
						<span
							className="yamabiko-table-reorder-description"
							id={ toolbarDescriptionId }
						>
							{ toolbarDescription }
						</span>
						{ isTouchCoachmarkVisible && toolbarButtonRef.current && (
							<Popover
								anchor={ toolbarButtonRef.current }
								onClose={ dismissTouchCoachmark }
							>
								<p className="yamabiko-table-reorder-coachmark">
									{ getTouchCoachmarkMessage() }
								</p>
							</Popover>
						) }
					</BlockControls>
				) }
				<span aria-hidden="true" hidden ref={ anchorRef } />
			</>
		);
	};
