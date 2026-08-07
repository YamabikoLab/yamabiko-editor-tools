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
	onFocusedRowIndexChange: ( index: number | null ) => void;
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
				onFocusedRowIndexChange( null );
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
		const modeActivationKeyRef = useRef< string | null >( null );
		const modeToggleRef = useRef< HTMLButtonElement >( null );
		const isTableBlock = props.name === 'core/table';
		const instructionsId = `yamabiko-editor-tools-table-reorder-${ props.clientId }-instructions`;
		const exitReorderMode = useCallback( ( restoreFocus = false ) => {
			modeActivationKeyRef.current = null;
			setIsReorderMode( false );
			if ( restoreFocus ) {
				modeToggleRef.current?.ownerDocument.defaultView?.requestAnimationFrame(
					() => modeToggleRef.current?.focus()
				);
			}
		}, [] );
		const rememberFocusedRow = useCallback( ( index: number | null ) => {
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

			let observer: MutationObserver | null = null;
			let disposed = false;
			const getHandles = () =>
				Array.from(
					document.querySelectorAll< HTMLButtonElement >(
						`.yamabiko-editor-tools-table-reorder-content__handle[aria-describedby="${ instructionsId }"]`
					)
				);
			const focusInitialHandle = () => {
				const handles = getHandles();
				if ( handles.length === 0 ) {
					return false;
				}

				const rememberedIndex = lastFocusedRowIndex.current;
				const rememberedHandle = rememberedIndex !== null ? handles[ rememberedIndex ] : undefined;
				const fallbackHandle = handles.find( ( handle ) => ! handle.disabled );
				const targetHandle =
					rememberedHandle && ! rememberedHandle.disabled ? rememberedHandle : fallbackHandle;
				if ( ! targetHandle ) {
					return false;
				}
				const targetIndex = handles.indexOf( targetHandle );
				view.requestAnimationFrame( () => {
					view.requestAnimationFrame( () => {
						if ( disposed ) {
							return;
						}

						const currentHandles = getHandles();
						const handle = currentHandles[ targetIndex ];
						if ( handle && ! handle.disabled ) {
							handle.focus( { preventScroll: true } );
						}
					} );
				} );
				return true;
			};
			const focusWhenReady = () => {
				if ( disposed || focusInitialHandle() ) {
					return;
				}

				observer ??= new view.MutationObserver( () => {
					if ( focusInitialHandle() ) {
						observer?.disconnect();
						observer = null;
					}
				} );
				observer.observe( document.body, { childList: true, subtree: true } );
			};

			const activationKey = modeActivationKeyRef.current;
			const activationDocument = modeToggleRef.current?.ownerDocument;
			if ( activationKey && activationDocument ) {
				const onActivationKeyUp = ( event: globalThis.KeyboardEvent ) => {
					if ( event.key !== activationKey ) {
						return;
					}

					modeActivationKeyRef.current = null;
					activationDocument.removeEventListener( 'keyup', onActivationKeyUp, true );
					focusWhenReady();
				};
				activationDocument.addEventListener( 'keyup', onActivationKeyUp, true );

				return () => {
					disposed = true;
					observer?.disconnect();
					activationDocument.removeEventListener( 'keyup', onActivationKeyUp, true );
				};
			}

			focusWhenReady();
			return () => {
				disposed = true;
				observer?.disconnect();
			};
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
							onKeyDown={ ( event ) => {
								if (
									! isReorderMode &&
									( event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar' )
								) {
									modeActivationKeyRef.current = event.key;
								}
							} }
							onKeyUp={ ( event ) => {
								if ( modeActivationKeyRef.current === event.key ) {
									modeActivationKeyRef.current = null;
								}
							} }
							onPointerDown={ () => {
								modeActivationKeyRef.current = null;
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
