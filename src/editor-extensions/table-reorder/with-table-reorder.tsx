/**
 * Table ReorderをGutenbergのBlockEditへ接続するcomposition / rendering adapter。
 *
 * HOCは対応block判定だけを担当し、Table Reorder固有のhook / UI描画は専用componentへ委譲する。
 */

import { BlockControls } from '@wordpress/block-editor';
import type { BlockEditProps } from '@wordpress/blocks';
import { Button, Popover, ToolbarButton } from '@wordpress/components';
import { useEffect, useState, type ComponentType } from '@wordpress/element';
import { dragHandle, Icon, keyboard } from '@wordpress/icons';

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
 * coachmarkをviewport中央・Toolbar直下へ配置するためのvirtual anchorを生成する。
 *
 * @param toolbarButton coachmarkの基準となるToolbar button。
 * @return Popoverへ渡すvirtual anchor。
 */
const createCoachmarkAnchor = ( toolbarButton: HTMLButtonElement ) => ( {
	ownerDocument: toolbarButton.ownerDocument,
	getBoundingClientRect: (): DOMRect => {
		const buttonRect = toolbarButton.getBoundingClientRect();
		const document = toolbarButton.ownerDocument;
		const viewportWidth = document.defaultView?.innerWidth ?? document.documentElement.clientWidth;
		const centerX = viewportWidth / 2;

		return {
			bottom: buttonRect.bottom,
			height: 0,
			left: centerX,
			right: centerX,
			top: buttonRect.bottom,
			width: 0,
			x: centerX,
			y: buttonRect.bottom,
			toJSON: () => ( {} ),
		};
	},
} );

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

	useEffect( () => {
		if ( isKeyboardCoachmarkVisible && toolbarButton ) {
			toolbarButton.focus( { preventScroll: true } );
		}
	}, [ isKeyboardCoachmarkVisible, toolbarButton ] );

	const toolbarLabel = getToolbarReorderName();
	const toolbarDescription = getToolbarReorderDescription();
	const toolbarDescriptionId = `yamabiko-table-reorder-toolbar-description-${ clientId }`;
	const isCoachmarkVisible = isKeyboardCoachmarkVisible || isTouchCoachmarkVisible;
	const coachmarkMessage = isKeyboardCoachmarkVisible
		? getKeyboardCoachmarkMessage()
		: getTouchCoachmarkMessage();
	const coachmarkIcon = isKeyboardCoachmarkVisible ? keyboard : dragHandle;
	const dismissCoachmark = isKeyboardCoachmarkVisible
		? dismissKeyboardCoachmark
		: dismissTouchCoachmark;
	const coachmarkAnchor = toolbarButton ? createCoachmarkAnchor( toolbarButton ) : null;

	return (
		<>
			<BlockEdit { ...props } />
			{ isSelected && (
				<BlockControls>
					<ToolbarButton
						aria-describedby={ toolbarDescriptionId }
						className={
							isTouchCoachmarkVisible ? 'yamabiko-table-reorder-coachmark-target' : undefined
						}
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
					{ isCoachmarkVisible && coachmarkAnchor && (
						<Popover
							anchor={ coachmarkAnchor }
							className="yamabiko-table-reorder-coachmark-popover"
							flip={ false }
							focusOnMount={ false }
							offset={ 4 }
							onClose={ dismissCoachmark }
							placement="bottom"
							shift
							variant="unstyled"
						>
							<div className="yamabiko-table-reorder-coachmark">
								<span aria-hidden="true" className="yamabiko-table-reorder-guidance-icon">
									<Icon icon={ coachmarkIcon } size={ 24 } />
								</span>
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
