/**
 * Table ReorderのSortableJS controller lifecycleをReact側で管理する。
 *
 * controllerの生成・破棄・再生成、pending focus、遅延microtaskの生存管理を所有し、
 * Gutenberg固有のsetAttributesやnotice処理とはcallback / command境界で接続する。
 */

import { useEffect, useRef, type RefObject } from '@wordpress/element';

import {
	createSortableController,
	type FocusRowControlResult,
	type ReorderInteractionMode,
	type SortableController,
} from './controller/sortable-controller';
import { getForbiddenInsertionIndices, getNonMovableRowIndices, getRowspanRanges } from './rowspan';
import { resolveTableContext } from './table-context';

/** SortableJS runtime URLを公開するeditor windowの設定。 */
type TableReorderConfigWindow = Window & {
	yamabikoEditorToolsTableReorder?: {
		runtimeUrl?: string;
	};
};

/** controller lifecycle hookへ渡すReact側の入力。 */
type UseTableReorderControllerOptions = {
	anchorRef: RefObject< HTMLSpanElement >;
	body: unknown;
	clientId: string;
	enabled: boolean;
	interactionMode: ReorderInteractionMode | null;
	onBodyCommit: ( reorderedBody: unknown[] ) => void;
};

/** controller lifecycle hookが親へ公開する最小command API。 */
type TableReorderControllerCommands = {
	focusRowControl: () => FocusRowControlResult | undefined;
};

/**
 * Table Reorderのcontroller生成・cleanupとcommit後のfocus復元を所有する。
 *
 * @param options controller生成に必要なTable情報とbody commit callback。
 * @return Toolbarから利用するcontroller command。
 */
export const useTableReorderController = (
	options: UseTableReorderControllerOptions
): TableReorderControllerCommands => {
	const { anchorRef, body, clientId, enabled, interactionMode, onBodyCommit } = options;
	const controllerRef = useRef< SortableController | null >( null );
	const pendingFocusRowIndexRef = useRef< number | null >( null );
	const onBodyCommitRef = useRef( onBodyCommit );

	useEffect( () => {
		onBodyCommitRef.current = onBodyCommit;
	}, [ onBodyCommit ] );

	useEffect( () => {
		controllerRef.current = null;
		if ( ! enabled || ! interactionMode ) {
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

		if (
			interactionMode === 'hover' &&
			! context.window.matchMedia( '(hover: hover) and (pointer: fine)' ).matches
		) {
			return;
		}

		const rowspanRanges = getRowspanRanges( body );
		let controller: SortableController | null = null;
		let disposed = false;

		queueMicrotask( () => {
			if ( disposed ) {
				return;
			}

			const createdController = createSortableController( {
				context,
				forbiddenInsertionIndices: getForbiddenInsertionIndices( rowspanRanges ),
				interactionMode,
				nonMovableRowIndices: getNonMovableRowIndices( rowspanRanges ),
				onCommit: ( reorderedBody, focusRowIndex ) => {
					if ( focusRowIndex !== undefined ) {
						pendingFocusRowIndexRef.current = focusRowIndex;
					}
					onBodyCommitRef.current( reorderedBody );
				},
				rows: Array.isArray( body ) ? body : null,
				runtimeUrl,
			} );

			if ( disposed ) {
				createdController.destroy();
				return;
			}

			controller = createdController;
			controllerRef.current = createdController;
			const pendingFocusRowIndex = pendingFocusRowIndexRef.current;
			if (
				pendingFocusRowIndex !== null &&
				createdController.focusRowControlAt( pendingFocusRowIndex )
			) {
				pendingFocusRowIndexRef.current = null;
			}
		} );

		return () => {
			disposed = true;
			const controllerToDestroy = controller;
			controller = null;
			if ( controllerRef.current === controllerToDestroy ) {
				controllerRef.current = null;
			}
			if ( controllerToDestroy ) {
				queueMicrotask( () => {
					controllerToDestroy.destroy();
				} );
			}
		};
	}, [ anchorRef, body, clientId, enabled, interactionMode ] );

	return {
		focusRowControl: () => controllerRef.current?.focusRowControl(),
	};
};
