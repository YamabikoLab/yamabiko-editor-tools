import { useSortable } from '@dnd-kit/react/sortable';
import { useCallback } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { dragHandle } from '@wordpress/icons';

type SortableRowProps = {
	disabled: boolean;
	element: HTMLTableRowElement;
	height: number;
	id: string;
	index: number;
	left: number;
	onHandleChange: ( id: string, element: HTMLButtonElement | null ) => void;
	top: number;
};

export function SortableRow( {
	disabled,
	element,
	height,
	id,
	index,
	left,
	onHandleChange,
	top,
}: SortableRowProps ) {
	const { handleRef, isDragSource } = useSortable( {
		disabled,
		element,
		id,
		index,
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
			aria-label={ sprintf(
				/* translators: %d: table body row number. */
				__( '%d 行目を並べ替える', 'yamabiko-editor-tools' ),
				index + 1
			) }
			className={
				isDragSource
					? 'yamabiko-editor-tools-table-reorder-content__handle is-dragging'
					: 'yamabiko-editor-tools-table-reorder-content__handle'
			}
			data-table-reorder-row-id={ id }
			disabled={ disabled }
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
