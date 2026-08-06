import { directionBiased } from '@dnd-kit/collision';
import { useSortable } from '@dnd-kit/react/sortable';
import type { KeyboardEvent } from 'react';
import { useCallback } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { dragHandle } from '@wordpress/icons';

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
		disabled: isNonMovable || isPointerDragDisabled ? { draggable: true } : false,
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
			aria-label={ sprintf(
				/* translators: %d: table body row number. */
				__( '%d 行目を並べ替える', 'yamabiko-editor-tools' ),
				index + 1
			) }
			aria-pressed={ isKeyboardReorderSource || undefined }
			className={
				isDragSource
					? 'yamabiko-editor-tools-table-reorder-content__handle is-dragging'
					: 'yamabiko-editor-tools-table-reorder-content__handle'
			}
			data-table-reorder-row-id={ id }
			onKeyDown={ ( event ) => onKeyDown( event, id ) }
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
