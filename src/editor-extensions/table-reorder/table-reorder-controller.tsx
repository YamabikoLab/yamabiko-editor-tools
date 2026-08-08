import { PointerSensor } from '@dnd-kit/dom';
import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import {
	createPortal,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from '@wordpress/element';

import { TableReorderDragVisuals, type InsertionIndicator } from './drag-visuals';
import { DragRowOverlay } from './drag-row-overlay';
import { getNonMovableRowIndices, getRowspanRanges } from './rowspan';
import { SortableRow } from './sortable-row';
import { useKeyboardReorder } from './use-keyboard-reorder';
import { usePointerReorder } from './use-pointer-reorder';
import { useTableReorderDom } from './use-table-reorder-dom';

type TableReorderControllerProps = {
	align: string | undefined;
	body: unknown;
	clientId: string;
	instructionsId: string;
	onExit: () => void;
	setAttributes: ( attributes: { body: unknown[] } ) => void;
};

export function TableReorderController( {
	align,
	body,
	clientId,
	instructionsId,
	onExit,
	setAttributes,
}: TableReorderControllerProps ) {
	const {
		anchorRef,
		container,
		getRows,
		requestRowsReconciliation,
		resumeRowsReconciliation,
		rowPositions,
		rows,
		suspendRowsReconciliation,
	} = useTableReorderDom( { align, body, clientId, onExit } );
	const [ insertionIndicator, setInsertionIndicator ] = useState< InsertionIndicator | null >(
		null
	);
	const handleElements = useRef< Map< string, HTMLButtonElement > >( new Map() );
	const dragVisuals = useRef< TableReorderDragVisuals | null >( null );
	const rowspanRanges = useMemo( () => getRowspanRanges( body ), [ body ] );
	const nonMovableRows = useMemo(
		() => new Set( getNonMovableRowIndices( rowspanRanges ) ),
		[ rowspanRanges ]
	);
	const sensors = useMemo(
		() => [
			PointerSensor.configure( {
				activatorElements: ( source ) => [ handleElements.current.get( String( source.id ) ) ],
			} ),
		],
		[]
	);

	const clearCandidate = useCallback( () => {
		dragVisuals.current?.clear();
	}, [] );
	const showCandidate = useCallback(
		( ...args: Parameters< TableReorderDragVisuals[ 'showCandidate' ] > ) => {
			dragVisuals.current?.showCandidate( ...args );
		},
		[]
	);
	const focusHandle = useCallback(
		( id: string ) => {
			const view = anchorRef.current?.ownerDocument.defaultView;
			if ( ! view ) {
				return;
			}

			view.requestAnimationFrame( () => {
				view.requestAnimationFrame( () => {
					handleElements.current.get( id )?.focus( { preventScroll: true } );
				} );
			} );
		},
		[ anchorRef ]
	);

	useEffect( () => {
		const visuals = new TableReorderDragVisuals( setInsertionIndicator );
		dragVisuals.current = visuals;

		return () => {
			visuals.clear();
			if ( dragVisuals.current === visuals ) {
				dragVisuals.current = null;
			}
		};
	}, [] );

	const { keyboardReorder, liveMessage, onHandleKeyDown } = useKeyboardReorder( {
		body,
		clearCandidate,
		focusHandle,
		getRows,
		nonMovableRows,
		rows,
		setAttributes,
		showCandidate,
	} );
	const { activeRow, onDragEnd, onDragStart, onOverlayElementChange, updateDragTarget } =
		usePointerReorder( {
			body,
			clearCandidate,
			isKeyboardReordering: Boolean( keyboardReorder ),
			requestRowsReconciliation,
			resumeRowsReconciliation,
			rows,
			setAttributes,
			showCandidate,
			suspendRowsReconciliation,
		} );

	const onHandleChange = useCallback( ( id: string, element: HTMLButtonElement | null ) => {
		if ( element ) {
			handleElements.current.set( id, element );
			return;
		}

		handleElements.current.delete( id );
	}, [] );

	const indicatorPosition = insertionIndicator
		? rowPositions.get( insertionIndicator.rowId )
		: undefined;
	const activeRowPosition = activeRow ? rowPositions.get( activeRow.id ) : undefined;

	return (
		<>
			<span aria-hidden="true" hidden ref={ anchorRef } />
			<span
				aria-atomic="true"
				aria-live="polite"
				className="yamabiko-editor-tools-table-reorder-content__live-region"
				role="status"
			>
				{ liveMessage }
			</span>
			<DragDropProvider
				onDragEnd={ onDragEnd }
				onDragMove={ updateDragTarget }
				onDragOver={ updateDragTarget }
				onDragStart={ onDragStart }
				sensors={ sensors }
			>
				{ container &&
					createPortal(
						<>
							{ rows.map( ( row ) => (
								<SortableRow
									element={ row.element }
									height={ rowPositions.get( row.id )?.height ?? 0 }
									id={ row.id }
									index={ row.index }
									instructionsId={ instructionsId }
									isKeyboardReorderSource={ keyboardReorder?.sourceId === row.id }
									isNonMovable={ nonMovableRows.has( row.index ) }
									isPointerDragDisabled={ Boolean( keyboardReorder ) }
									key={ row.id }
									left={ rowPositions.get( row.id )?.left ?? 0 }
									onHandleChange={ onHandleChange }
									onKeyDown={ onHandleKeyDown }
									top={ rowPositions.get( row.id )?.top ?? 0 }
								/>
							) ) }
							<div
								aria-hidden="true"
								className="yamabiko-editor-tools-table-reorder-content__insertion-indicator"
								hidden={ ! indicatorPosition }
								style={
									indicatorPosition
										? {
												left: `${ indicatorPosition.left }px`,
												top: `${
													insertionIndicator?.below
														? indicatorPosition.top + indicatorPosition.height
														: indicatorPosition.top
												}px`,
												width: `${ indicatorPosition.width }px`,
										  }
										: undefined
								}
							/>
						</>,
						container
					) }
				<DragOverlay>
					{ activeRow && activeRowPosition && (
						<DragRowOverlay
							element={ activeRow.element }
							height={ activeRowPosition.height }
							onElementChange={ onOverlayElementChange }
							width={ activeRowPosition.width }
						/>
					) }
				</DragOverlay>
			</DragDropProvider>
		</>
	);
}
