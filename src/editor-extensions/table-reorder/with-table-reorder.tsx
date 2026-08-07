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

function TableCellPaddingClickController( {
	clientId,
	onFocusedRowIndexChange,
}: {
	clientId: string;
	onFocusedRowIndexChange: ( index: number ) => void;
} ) {
	const anchorRef = useRef< HTMLSpanElement >( null );

	useEffect( () => {
		const anchor = anchorRef.current;
		if ( ! anchor ) {
			return;
		}

		const document = anchor.ownerDocument;
		const view = document.defaultView;
		const blockElement = document.querySelector< HTMLElement >( `[data-block="${ clientId }"]` );
		if ( ! view || ! blockElement ) {
			return;
		}

		const onPointerDown = ( event: PointerEvent ) => {
			focusTableCellFromPaddingClick( event, blockElement );
		};
		const onFocusIn = ( event: FocusEvent ) => {
			if ( ! ( event.target instanceof view.Element ) ) {
				return;
			}

			const cell = event.target.closest( 'td, th' );
			if ( ! cell || ! blockElement.contains( cell ) ) {
				return;
			}

			const row = cell.closest( 'tr' );
			const tbody = row?.parentElement;
			if ( ! row || tbody?.tagName !== 'TBODY' ) {
				return;
			}

			const index = Array.from( tbody.children ).indexOf( row );
			if ( index >= 0 ) {
				onFocusedRowIndexChange( index );
			}
		};

		document.addEventListener( 'focusin', onFocusIn, true );
		document.addEventListener( 'pointerdown', onPointerDown, true );
		return () => {
			document.removeEventListener( 'focusin', onFocusIn, true );
			document.removeEventListener( 'pointerdown', onPointerDown, true );
		};
	}, [ clientId, onFocusedRowIndexChange ] );

	return <span aria-hidden="true" hidden ref={ anchorRef } />;
}

export const withTableReorder = ( BlockEdit: ComponentType< TableBlockEditProps > ) =>
	function WithTableReorder( props: TableBlockEditProps ) {
		const [ isReorderMode, setIsReorderMode ] = useState( false );
		const instructionsRef = useRef< HTMLDivElement >( null );
		const lastFocusedRowIndex = useRef< number | null >( null );
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
		const rememberFocusedRow = useCallback( ( index: number ) => {
			lastFocusedRowIndex.current = index;
		}, [] );

		useEffect( () => {
			if ( ! props.isSelected ) {
				exitReorderMode();
			}
		}, [ exitReorderMode, props.isSelected ] );

		useEffect( () => {
			if ( ! isReorderMode || ! props.isSelected ) {
				return;
			}

			const document = instructionsRef.current?.ownerDocument;
			const view = document?.defaultView;
			if ( ! document || ! view ) {
				return;
			}

			const focusInitialHandle = () => {
				const handles = Array.from(
					document.querySelectorAll< HTMLButtonElement >(
						`.yamabiko-editor-tools-table-reorder-content__handle[aria-describedby="${ instructionsId }"]`
					)
				);
				if ( handles.length === 0 ) {
					return false;
				}

				const rememberedIndex = lastFocusedRowIndex.current;
				const rememberedHandle = rememberedIndex !== null ? handles[ rememberedIndex ] : undefined;
				const handle =
					rememberedHandle ?? handles.find( ( candidate ) => candidate.ariaDisabled !== 'true' );
				if ( ! handle ) {
					return false;
				}

				handle.focus( { preventScroll: true } );
				return true;
			};

			if ( focusInitialHandle() ) {
				return;
			}

			const observer = new view.MutationObserver( () => {
				if ( focusInitialHandle() ) {
					observer.disconnect();
				}
			} );
			observer.observe( document.body, { childList: true, subtree: true } );

			return () => observer.disconnect();
		}, [ instructionsId, isReorderMode, props.isSelected ] );

		if ( ! isTableBlock ) {
			return <BlockEdit { ...props } />;
		}

		const label = isReorderMode
			? __( '並べ替えを終了', 'yamabiko-editor-tools' )
			: __( '行を並べ替え', 'yamabiko-editor-tools' );

		return (
			<>
				{ isReorderMode && props.isSelected && (
					<div
						className="yamabiko-editor-tools-table-reorder__instructions"
						id={ instructionsId }
						ref={ instructionsRef }
					>
						{ __(
							'行の並べ替え：ドラッグで移動　Enter / Space: 開始・確定　↑↓: 移動　Esc: キャンセル',
							'yamabiko-editor-tools'
						) }
					</div>
				) }
				<BlockEdit { ...props } />
				{ props.isSelected && ! isReorderMode && (
					<TableCellPaddingClickController
						clientId={ props.clientId }
						onFocusedRowIndexChange={ rememberFocusedRow }
					/>
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
