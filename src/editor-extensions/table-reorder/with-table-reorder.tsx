import { BlockControls } from '@wordpress/block-editor';
import type { BlockEditProps } from '@wordpress/blocks';
import { ToolbarButton } from '@wordpress/components';
import { useDispatch } from '@wordpress/data';
import { useEffect, useRef, useState, type ComponentType } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';

import { getForbiddenInsertionIndices, getNonMovableRowIndices, getRowspanRanges } from './rowspan';
import { createSortableController } from './sortable-controller';
import { findBlockElement, resolveTableContext } from './table-context';

const HOVER_REORDER_MEDIA_QUERY = '(hover: hover) and (pointer: fine)';

type TableAttributes = Record< string, unknown > & {
	body?: unknown[];
};

type TableBlockEditProps = BlockEditProps< TableAttributes > & {
	name: string;
};

type TableReorderConfigWindow = Window & {
	yamabikoEditorToolsTableReorder?: {
		runtimeUrl?: string;
	};
};

export const withTableReorder = ( BlockEdit: ComponentType< TableBlockEditProps > ) =>
	function WithTableReorder( props: TableBlockEditProps ) {
		const anchorRef = useRef< HTMLSpanElement >( null );
		const {
			attributes: { body },
			clientId,
			isSelected,
			setAttributes,
		} = props;
		const isTableBlock = props.name === 'core/table';
		const { createNotice } = useDispatch( noticesStore );
		const [ isHoverCapable, setIsHoverCapable ] = useState(
			() => window.matchMedia( HOVER_REORDER_MEDIA_QUERY ).matches
		);
		const [ isTouchReorderMode, setIsTouchReorderMode ] = useState( false );

		useEffect( () => {
			if ( ! isTableBlock ) {
				return;
			}

			const hoverMedia = window.matchMedia( HOVER_REORDER_MEDIA_QUERY );
			const syncHoverCapability = () => {
				setIsHoverCapable( hoverMedia.matches );
				if ( hoverMedia.matches ) {
					setIsTouchReorderMode( false );
				}
			};

			syncHoverCapability();
			hoverMedia.addEventListener( 'change', syncHoverCapability );
			return () => {
				hoverMedia.removeEventListener( 'change', syncHoverCapability );
			};
		}, [ isTableBlock ] );

		useEffect( () => {
			if ( ! isSelected ) {
				setIsTouchReorderMode( false );
			}
		}, [ isSelected ] );

		useEffect( () => {
			if ( ! isTableBlock ) {
				return;
			}

			const anchor = anchorRef.current;
			if ( ! anchor ) {
				return;
			}

			const runtimeUrl = ( window as TableReorderConfigWindow ).yamabikoEditorToolsTableReorder
				?.runtimeUrl;
			if ( ! runtimeUrl ) {
				return;
			}

			const context = resolveTableContext( anchor, clientId );
			if ( ! context ) {
				return;
			}

			const rowspanRanges = getRowspanRanges( body );
			const nonMovableRowIndices = getNonMovableRowIndices( rowspanRanges );
			const forbiddenInsertionIndices = getForbiddenInsertionIndices( rowspanRanges );
			const hoverMedia = context.window.matchMedia( HOVER_REORDER_MEDIA_QUERY );
			const useHoverMode = isHoverCapable && hoverMedia.matches;
			const useTouchMode = ! useHoverMode && isSelected && isTouchReorderMode;
			if ( ! useHoverMode && ! useTouchMode ) {
				return;
			}

			const controller = createSortableController( {
				context,
				forbiddenInsertionIndices,
				mode: useHoverMode ? 'hover' : 'touch',
				nonMovableRowIndices,
				onCommit: ( reorderedBody ) => {
					setAttributes( { body: reorderedBody } );
				},
				onNonMovableRowLongPress: () => {
					void createNotice(
						'warning',
						__( '縦結合を含む行は並び替えできません。', 'yamabiko-editor-tools' ),
						{ type: 'snackbar' }
					);
				},
				onRequestTouchModeExit: () => {
					setIsTouchReorderMode( false );
				},
				rows: Array.isArray( body ) ? body : null,
				runtimeUrl,
			} );

			return () => {
				controller.destroy();
			};
		}, [
			body,
			clientId,
			createNotice,
			isHoverCapable,
			isSelected,
			isTableBlock,
			isTouchReorderMode,
			setAttributes,
		] );

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
							onClick={ () => setIsTouchReorderMode( ( isActive ) => ! isActive ) }
							showTooltip
						/>
					</BlockControls>
				) }
				<span aria-hidden="true" hidden ref={ anchorRef } />
			</>
		);
	};

export { findBlockElement };
