import { BlockControls } from '@wordpress/block-editor';
import type { BlockEditProps } from '@wordpress/blocks';
import { ToolbarButton } from '@wordpress/components';
import { useCallback, useEffect, useRef, useState, type ComponentType } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { dragHandle } from '@wordpress/icons';

import { enableTableHoverReorder } from './hover-reorder';
import { focusTableCellFromPaddingClick } from './table-cell-padding-click';
import { TableReorderController } from './table-reorder-controller';

type TableAttributes = Record< string, unknown > & {
	align?: string;
	body?: unknown[];
};

type TableBlockEditProps = BlockEditProps< TableAttributes > & {
	name: string;
};

type KeyboardKeyEvent = Pick< globalThis.KeyboardEvent, 'key' >;

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

		const rememberRowFromTarget = ( target: EventTarget | null ) => {
			if ( ! ( target instanceof view.Element ) ) {
				return;
			}

			const cell = target.closest( 'td, th' );
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
		const onPointerDown = ( event: PointerEvent ) => {
			focusTableCellFromPaddingClick( event, blockElement );
		};
		const onFocusIn = ( event: FocusEvent ) => {
			rememberRowFromTarget( event.target );
		};

		document.addEventListener( 'focusin', onFocusIn, true );
		document.addEventListener( 'pointerdown', onPointerDown, true );

		// On the first selection after a page reload, the cell can receive focus
		// before this controller mounts and registers its focusin listener.
		// Seed the remembered row from the focus that already exists.
		rememberRowFromTarget( anchor.ownerDocument.activeElement );

		return () => {
			document.removeEventListener( 'focusin', onFocusIn, true );
			document.removeEventListener( 'pointerdown', onPointerDown, true );
		};
	}, [ clientId, onFocusedRowIndexChange ] );

	return <span aria-hidden="true" hidden ref={ anchorRef } />;
}

function TableHoverReorderController( {
	clientId,
	onActiveChange,
}: {
	clientId: string;
	onActiveChange: ( isActive: boolean ) => void;
} ) {
	const anchorRef = useRef< HTMLSpanElement >( null );

	useEffect( () => {
		const anchor = anchorRef.current;
		if ( ! anchor ) {
			return;
		}

		const document = anchor.ownerDocument;
		const blockElement = document.querySelector< HTMLElement >( `[data-block="${ clientId }"]` );
		const table = blockElement?.querySelector< HTMLTableElement >( 'table' ) ?? null;
		if ( ! blockElement ) {
			return;
		}

		return enableTableHoverReorder( blockElement, table, onActiveChange );
	}, [ clientId, onActiveChange ] );

	return <span aria-hidden="true" hidden ref={ anchorRef } />;
}

export const withTableReorder = ( BlockEdit: ComponentType< TableBlockEditProps > ) =>
	function WithTableReorder( props: TableBlockEditProps ) {
		const [ isReorderMode, setIsReorderMode ] = useState( false );
		const [ isHoverReorderActive, setIsHoverReorderActive ] = useState( false );
		const [ isInstructionsVisible, setIsInstructionsVisible ] = useState( false );
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
		const handleHoverActiveChange = useCallback( ( isActive: boolean ) => {
			setIsHoverReorderActive( isActive );
		}, [] );
		const handleControllerExit = useCallback( () => {
			if ( isReorderMode ) {
				exitReorderMode();
			}
		}, [ exitReorderMode, isReorderMode ] );

		useEffect( () => {
			if ( ! props.isSelected ) {
				exitReorderMode();
			}
		}, [ exitReorderMode, props.isSelected ] );

		useEffect( () => {
			if ( ! isReorderMode || ! props.isSelected ) {
				setIsInstructionsVisible( false );
				return;
			}

			setIsInstructionsVisible( true );
			const view = instructionsRef.current?.ownerDocument.defaultView;
			if ( ! view ) {
				return;
			}

			const timeoutId = view.setTimeout( () => {
				setIsInstructionsVisible( false );
			}, 10000 );

			return () => view.clearTimeout( timeoutId );
		}, [ isReorderMode, props.isSelected ] );

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
			? __( 'Finish reordering', 'yamabiko-editor-tools' )
			: __( 'Reorder rows', 'yamabiko-editor-tools' );

		return (
			<>
				{ isReorderMode && props.isSelected && (
					<>
						<div
							className="yamabiko-editor-tools-table-reorder__instructions-description"
							id={ instructionsId }
							ref={ instructionsRef }
						>
							{ __(
								'Rows can be reordered by dragging or with the keyboard. For keyboard operation, use Tab or Shift+Tab to select a row, Enter or Space to start reordering, the Up and Down arrow keys to move it, and Enter or Space to confirm. Press Escape to cancel.',
								'yamabiko-editor-tools'
							) }
						</div>
						{ isInstructionsVisible && (
							<div className="yamabiko-editor-tools-table-reorder__instructions">
								<button
									aria-label={ __( 'Close instructions', 'yamabiko-editor-tools' ) }
									className="yamabiko-editor-tools-table-reorder__instructions-close"
									onClick={ () => setIsInstructionsVisible( false ) }
									type="button"
								>
									×
								</button>
								<div className="yamabiko-editor-tools-table-reorder__instructions-title">
									{ __( 'Rows can be reordered by dragging or with the keyboard', 'yamabiko-editor-tools' ) }
								</div>
								<div className="yamabiko-editor-tools-table-reorder__instructions-method">
									<strong>{ __( 'Drag:', 'yamabiko-editor-tools' ) }</strong>
									{ __( 'Drag the handle on the left to move the row', 'yamabiko-editor-tools' ) }
								</div>
								<div className="yamabiko-editor-tools-table-reorder__instructions-method">
									<strong>{ __( 'Keyboard:', 'yamabiko-editor-tools' ) }</strong>
									{ __(
										'Tab / Shift+Tab to select a row → Enter / Space to start → ↑↓ to move → Enter / Space to confirm (Esc to cancel)',
										'yamabiko-editor-tools'
									) }
								</div>
							</div>
						) }
					</>
				) }
				<BlockEdit { ...props } />
				<TableHoverReorderController
					clientId={ props.clientId }
					onActiveChange={ handleHoverActiveChange }
				/>
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
							onKeyDown={ ( event: KeyboardKeyEvent ) => {
								if (
									! isReorderMode &&
									( event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar' )
								) {
									modeActivationKeyRef.current = event.key;
								}
							} }
							onKeyUp={ ( event: KeyboardKeyEvent ) => {
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
				{ ( isReorderMode || isHoverReorderActive ) && (
					<TableReorderController
						align={ props.attributes.align }
						body={ props.attributes.body }
						clientId={ props.clientId }
						instructionsId={ instructionsId }
						onExit={ handleControllerExit }
						setAttributes={ props.setAttributes }
					/>
				) }
			</>
		);
	};
