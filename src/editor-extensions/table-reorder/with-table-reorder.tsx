/**
 * Table ReorderをGutenbergのBlockEditへ接続するcomposition / rendering adapter。
 *
 * HOCは対応block判定だけを担当し、Table Reorder固有のhook / UI描画は専用componentへ委譲する。
 */

import { BlockControls } from '@wordpress/block-editor';
import type { BlockEditProps } from '@wordpress/blocks';
import { Button, Popover, ToolbarButton } from '@wordpress/components';
import { useState, type ComponentType } from '@wordpress/element';

import {
	getCloseGuidanceName,
	getKeyboardCoachmarkMessage,
	getToolbarReorderDescription,
	getToolbarReorderName,
	getTouchCoachmarkMessage,
} from './messages';
import { getTableReorderBlockSupport, type TableReorderBlockSupport } from './block-support';
import { useTableReorder } from './use-table-reorder';

/** Table Reorder対応blockのbodyを含むattribute形。 */
type TableAttributes = Record< string, unknown > & {
	body?: unknown[];
};

/** HOCが利用するTable Reorder対応block向けBlockEdit props。 */
type TableBlockEditProps = BlockEditProps< TableAttributes > & {
	name: string;
};

/** 対応block専用componentへ渡すprops。 */
type TableReorderEditProps = {
	BlockEdit: ComponentType< TableBlockEditProps >;
	props: TableBlockEditProps;
	support: TableReorderBlockSupport;
};

/**
 * 対応block専用のTable Reorder描画component。
 *
 * @param componentProps Gutenbergから渡されるBlockEdit props、元のBlockEdit component、block support。
 */
const TableReorderEdit = ( componentProps: TableReorderEditProps ) => {
	const { BlockEdit, props, support } = componentProps;
	const {
		attributes: { body },
		clientId,
		isSelected,
		setAttributes,
	} = props;
	const [ toolbarButton, setToolbarButton ] = useState< HTMLButtonElement | null >( null );
	const {
		anchorRef,
		dismissKeyboardCoachmark,
		dismissTouchCoachmark,
		isHoverCapable,
		isKeyboardCoachmarkVisible,
		isTouchCoachmarkVisible,
		isTouchReorderMode,
		requestRowControlFocus,
		toggleTouchReorderMode,
	} = useTableReorder( {
		body,
		clientId,
		enabled: true,
		isSelected,
		rowspanProperty: support.rowspanProperty,
		setAttributes,
	} );

	const toolbarLabel = getToolbarReorderName();
	const toolbarDescription = getToolbarReorderDescription();
	const toolbarDescriptionId = `yamabiko-table-reorder-toolbar-description-${ clientId }`;
	const isCoachmarkVisible = isKeyboardCoachmarkVisible || isTouchCoachmarkVisible;
	const coachmarkMessage = isKeyboardCoachmarkVisible
		? getKeyboardCoachmarkMessage()
		: getTouchCoachmarkMessage();
	const dismissCoachmark = isKeyboardCoachmarkVisible
		? dismissKeyboardCoachmark
		: dismissTouchCoachmark;

	return (
		<>
			<BlockEdit { ...props } />
			{ isSelected && (
				<BlockControls>
					<ToolbarButton
						aria-describedby={ toolbarDescriptionId }
						className={ isCoachmarkVisible ? 'yamabiko-table-reorder-coachmark-target' : undefined }
						icon="sort"
						isPressed={ isHoverCapable ? undefined : isTouchReorderMode }
						label={ toolbarLabel }
						onClick={ isHoverCapable ? requestRowControlFocus : toggleTouchReorderMode }
						ref={ setToolbarButton }
						showTooltip
					/>
					<span className="yamabiko-table-reorder-description" id={ toolbarDescriptionId }>
						{ toolbarDescription }
					</span>
					{ isCoachmarkVisible && toolbarButton && (
						<Popover anchor={ toolbarButton } focusOnMount={ false } onClose={ dismissCoachmark }>
							<div className="yamabiko-table-reorder-coachmark">
								<p>{ coachmarkMessage }</p>
								<Button
									aria-label={ getCloseGuidanceName() }
									className="yamabiko-table-reorder-coachmark-close"
									onClick={ dismissCoachmark }
									size="small"
								>
									<span aria-hidden="true">×</span>
								</Button>
							</div>
						</Popover>
					) }
				</BlockControls>
			) }
			<span aria-hidden="true" hidden ref={ anchorRef } />
		</>
	);
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
		const support = getTableReorderBlockSupport( props.name );
		if ( ! support ) {
			return <BlockEdit { ...props } />;
		}

		return <TableReorderEdit BlockEdit={ BlockEdit } props={ props } support={ support } />;
	};
