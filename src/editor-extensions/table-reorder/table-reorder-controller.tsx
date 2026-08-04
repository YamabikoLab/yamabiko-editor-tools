import { createPortal, useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { dragHandle } from '@wordpress/icons';

type TableReorderControllerProps = {
	body: unknown;
	clientId: string;
};

type TableRow = {
	height: number;
	id: string;
	index: number;
	left: number;
	top: number;
};

const getBodyRows = ( body: unknown ): unknown[] => ( Array.isArray( body ) ? body : [] );

export function TableReorderController( { body, clientId }: TableReorderControllerProps ) {
	const anchorRef = useRef< HTMLSpanElement >( null );
	const [ container, setContainer ] = useState< HTMLDivElement | null >( null );
	const [ rows, setRows ] = useState< TableRow[] >( [] );
	const rowIds = useRef( new WeakMap< object, string >() );
	const nextRowId = useRef( 0 );

	useEffect( () => {
		const anchor = anchorRef.current;
		if ( ! anchor ) {
			return;
		}

		const anchorDocument = anchor.ownerDocument;
		const blockElement = anchorDocument.querySelector< HTMLElement >(
			`[data-block="${ clientId }"]`
		);

		if ( ! blockElement ) {
			return;
		}

		const document = blockElement.ownerDocument;
		const view = document.defaultView;
		if ( ! view ) {
			return;
		}

		const handleContainer = document.createElement( 'div' );
		handleContainer.className = 'yamabiko-editor-tools-table-reorder-content';
		document.body.append( handleContainer );
		setContainer( handleContainer );

		let animationFrame = 0;
		let resizeObserver: ResizeObserver | undefined;

		const getRowId = ( row: unknown, index: number ) => {
			if ( row === null || typeof row !== 'object' ) {
				return `row-${ index }`;
			}

			const existingId = rowIds.current.get( row );
			if ( existingId ) {
				return existingId;
			}

			const id = `row-${ nextRowId.current }`;
			nextRowId.current += 1;
			rowIds.current.set( row, id );
			return id;
		};

		const updateRows = () => {
			const table = blockElement.querySelector( 'table' );
			const tbody = table?.tBodies.item( 0 );
			const tableRows = tbody ? Array.from( tbody.rows ) : [];
			const bodyRows = getBodyRows( body );

			if ( tableRows.length !== bodyRows.length ) {
				setRows( [] );
				return;
			}

			setRows(
				tableRows.map( ( row, index ) => {
					const rect = row.getBoundingClientRect();

					return {
						height: rect.height,
						id: getRowId( bodyRows[ index ], index ),
						index,
						left: rect.left,
						top: rect.top,
					};
				} )
			);
		};

		const scheduleUpdate = () => {
			if ( animationFrame ) {
				view.cancelAnimationFrame( animationFrame );
			}

			animationFrame = view.requestAnimationFrame( updateRows );
		};

		const mutationObserver = new view.MutationObserver( scheduleUpdate );
		mutationObserver.observe( blockElement, { childList: true, subtree: true } );

		if ( view.ResizeObserver ) {
			resizeObserver = new view.ResizeObserver( scheduleUpdate );
			resizeObserver.observe( blockElement );
		}

		document.addEventListener( 'scroll', scheduleUpdate, true );
		view.addEventListener( 'resize', scheduleUpdate );
		updateRows();

		return () => {
			if ( animationFrame ) {
				view.cancelAnimationFrame( animationFrame );
			}
			mutationObserver.disconnect();
			resizeObserver?.disconnect();
			document.removeEventListener( 'scroll', scheduleUpdate, true );
			view.removeEventListener( 'resize', scheduleUpdate );
			handleContainer.remove();
			setContainer( null );
		};
	}, [ body, clientId ] );

	return (
		<>
			<span aria-hidden="true" hidden ref={ anchorRef } />
			{ container &&
				createPortal(
					rows.map( ( row ) => (
						<button
							aria-label={ sprintf(
								/* translators: %d: table body row number. */
								__( '%d 行目を並べ替える', 'yamabiko-editor-tools' ),
								row.index + 1
							) }
							className="yamabiko-editor-tools-table-reorder-content__handle"
							data-table-reorder-row-id={ row.id }
							key={ row.id }
							style={ {
								height: `${ row.height }px`,
								left: `${ row.left }px`,
								top: `${ row.top }px`,
							} }
							type="button"
						>
							{ dragHandle }
						</button>
					) ),
					container
				) }
		</>
	);
}
