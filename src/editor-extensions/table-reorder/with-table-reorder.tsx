import { BlockControls } from '@wordpress/block-editor';
import type { BlockEditProps } from '@wordpress/blocks';
import { ToolbarButton } from '@wordpress/components';
import { useCallback, useEffect, useRef, useState, type ComponentType } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { dragHandle } from '@wordpress/icons';

import { focusTableCellFromPaddingClick } from './table-cell-padding-click';
import { TableReorderController } from './table-reorder-controller';

type TableAttributes = Record< string, unknown > & {
	align?: string;
	body?: unknown[];
};

type TableBlockEditProps = BlockEditProps< TableAttributes > & {
	name: string;
};

function TableCellPaddingClickController( { clientId }: { clientId: string } ) {
	const anchorRef = useRef< HTMLSpanElement >( null );

	useEffect( () => {
		const anchor = anchorRef.current;
		if ( ! anchor ) {
			return;
		}

		const document = anchor.ownerDocument;
		const blockElement = document.querySelector< HTMLElement >( `[data-block="${ clientId }"]` );
		if ( ! blockElement ) {
			return;
		}

		const onPointerDown = ( event: PointerEvent ) => {
			focusTableCellFromPaddingClick( event, blockElement );
		};

		document.addEventListener( 'pointerdown', onPointerDown, true );
		return () => document.removeEventListener( 'pointerdown', onPointerDown, true );
	}, [ clientId ] );

	return <span aria-hidden="true" hidden ref={ anchorRef } />;
}

export const withTableReorder = ( BlockEdit: ComponentType< TableBlockEditProps > ) =>
	function WithTableReorder( props: TableBlockEditProps ) {
		const [ isReorderMode, setIsReorderMode ] = useState( false );
		const modeToggleRef = useRef< HTMLButtonElement >( null );
		const isTableBlock = props.name === 'core/table';
		const instructionsId = `yamabiko-editor-tools-table-reorder-${ props.clientId }-instructions`;
		const exitReorderMode = useCallback( ( restoreFocus = false ) => {
			setIsReorderMode( false );
			if ( restoreFocus ) {
				modeToggleRef.current?.ownerDocument.defaultView?.requestAnimationFrame(
					() => modeToggleRef.current?.focus()
				);
			}
		}, [] );

		useEffect( () => {
			if ( ! props.isSelected ) {
				exitReorderMode();
			}
		}, [ exitReorderMode, props.isSelected ] );

		if ( ! isTableBlock ) {
			return <BlockEdit { ...props } />;
		}

		const label = isReorderMode
			? __( '並べ替えを終了', 'yamabiko-editor-tools' )
			: __( '行を並べ替え', 'yamabiko-editor-tools' );

		return (
			<>
				<BlockEdit { ...props } />
				{ props.isSelected && ! isReorderMode && (
					<TableCellPaddingClickController clientId={ props.clientId } />
				) }
				{ props.isSelected && (
					<BlockControls>
						<ToolbarButton
							icon={ dragHandle }
							isPressed={ isReorderMode }
							label={ label }
							onClick={ () => {
								if ( isReorderMode ) {
									exitReorderMode( true );
									return;
								}

								setIsReorderMode( true );
							} }
							ref={ modeToggleRef }
						/>
					</BlockControls>
				) }
				{ isReorderMode && props.isSelected && (
					<p className="yamabiko-editor-tools-table-reorder__instructions" id={ instructionsId }>
						{ __(
							'ハンドルをドラッグして移動できます。キーボードでは Enter または Space で開始し、上下矢印で移動、Enter または Space で確定、Escape でキャンセルします。',
							'yamabiko-editor-tools'
						) }
					</p>
				) }
				{ isReorderMode && props.isSelected && (
					<TableReorderController
						align={ props.attributes.align }
						body={ props.attributes.body }
						clientId={ props.clientId }
						instructionsId={ instructionsId }
						onExit={ exitReorderMode }
						setAttributes={ props.setAttributes }
					/>
				) }
			</>
		);
	};
