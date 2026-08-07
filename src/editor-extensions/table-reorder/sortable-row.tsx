import { directionBiased } from '@dnd-kit/collision';
import { useSortable } from '@dnd-kit/react/sortable';
import type { KeyboardEvent } from 'react';
import { useCallback } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { dragHandle } from '@wordpress/icons';

import { getKeyboardTabDestinationIndex } from './keyboard-reorder';

type SortableRowProps = {
	element: HTMLTableRowElement;
	height: number;
	id: string;
	index: number;
	instructionsId: string;
	isKeyboardReorderSource: boolean;
	isPointerDragDisabled: boolean;
	isNonMovable: boolean;
	left: number;
	onHandleChange: ( id: string, element: HTMLButtonElement | null ) => void;
	onKeyDown: ( event: KeyboardEvent< HTMLButtonElement >, id: string ) => void;
	top: number;
};

const HANDLE_SELECTOR = '.yamabiko-editor-tools-table-reorder-content__handle';

export function SortableRow( {
	element,
	height,
	id,
	index,
	instructionsId,
	isKeyboardReorderSource,
	isPointerDragDisabled,
	isNonMovable,
	left,
	onHandleChange,
	onKeyDown,
	top,
}: SortableRowProps ) {
	const { handleRef, isDragSource } = useSortable( {
		collisionDetector: directionBiased,
		element,
		id,
		index,
		// Gutenberg owns the Table DOM. The controller derives a pending move
		// from its drag-start snapshot instead of allowing optimistic DOM sorting.
		plugins: [],
	} );

	const setHandle = useCallback(
		( handle: HTMLButtonElement | null ) => {
			handleRef( handle );
			onHandleChange( id, handle );
		},
		[ handleRef, id, onHandleChange ]
	);

	return (
		<button
			aria-describedby={ instructionsId }
			aria-disabled={ isNonMovable || undefined }
			aria-label={
				isKeyboardReorderSource
					? sprintf(
							/* translators: %d: table body row number. */
							__( '%d 行目を並べ替え中', 'yamabiko-editor-tools' ),
							index + 1
					  )
					: sprintf(
							/* translators: %d: table body row number. */
							__( '%d 行目を並べ替える', 'yamabiko-editor-tools' ),
							index + 1
					  )
			}
			className={ [
				'yamabiko-editor-tools-table-reorder-content__handle',
				isDragSource ? 'is-dragging' : '',
				isKeyboardReorderSource ? 'is-keyboard-reordering' : '',
			]
				.filter( Boolean )
				.join( ' ' ) }
			data-table-reorder-row-id={ id }
			data-table-reorder-row-index={ index }
			onPointerDownCapture={ ( event ) => {
				if ( isNonMovable || isPointerDragDisabled ) {
					event.preventDefault();
					event.stopPropagation();
				}
			} }
			onKeyDown={ ( event ) => {
				if ( event.key === 'Tab' ) {
					if ( isPointerDragDisabled ) {
						event.preventDefault();
						return;
					}

					const handleContainer = event.currentTarget.parentElement;
					const handles = handleContainer
						? Array.from(
								handleContainer.querySelectorAll< HTMLButtonElement >( HANDLE_SELECTOR )
						  ).filter( ( handle ) => handle.isConnected )
						: [];
					const rowCount = element.parentElement?.children.length ?? 0;
					if ( handles.length !== rowCount ) {
						event.preventDefault();
						return;
					}

					const currentHandleIndex = handles.findIndex(
						( handle ) => Number( handle.dataset.tableReorderRowIndex ) === index
					);
					const destinationHandleIndex = getKeyboardTabDestinationIndex(
						currentHandleIndex,
						handles.length,
						event.shiftKey
					);
					if ( destinationHandleIndex !== null ) {
						const destinationHandle = handles[ destinationHandleIndex ];
						const destinationIndex = Number( destinationHandle.dataset.tableReorderRowIndex );
						if ( Number.isInteger( destinationIndex ) ) {
							event.preventDefault();
							destinationHandle.focus( { preventScroll: true } );
							const destinationRow = element.parentElement?.children.item( destinationIndex );
							if ( destinationRow?.tagName === 'TR' ) {
								( destinationRow as HTMLTableRowElement ).scrollIntoView( {
									behavior: 'auto',
									block: 'nearest',
									inline: 'nearest',
								} );
							}
							return;
						}
					}
				}

				if (
					! isKeyboardReorderSource &&
					( event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar' )
				) {
					element.ownerDocument.defaultView?.requestAnimationFrame( () => {
						element.scrollIntoView( {
							behavior: 'auto',
							block: 'nearest',
							inline: 'nearest',
						} );
					} );
				}

				onKeyDown( event, id );
			} }
			ref={ setHandle }
			style={ {
				height: `${ height }px`,
				left: `${ left }px`,
				top: `${ top }px`,
			} }
			type="button"
		>
			{ dragHandle }
		</button>
	);
}
