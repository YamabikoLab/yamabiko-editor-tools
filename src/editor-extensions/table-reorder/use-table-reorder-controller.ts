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
import { resolveTableContext } from './table-context';

/** SortableJS runtime URLを公開するeditor windowの設定。 */
type TableReorderConfigWindow = Window & {
	yamabikoTableReorder?: {
		runtimeUrl?: string;
	};
};

/** controller lifecycle hookへ渡すReact側の入力。 */
type UseTableReorderControllerOptions = {
	anchorRef: RefObject< HTMLSpanElement >;
	body: unknown;
	clientId: string;
	enabled: boolean;
	forbiddenInsertionIndices: readonly number[];
	interactionMode: ReorderInteractionMode | null;
	nonMovableRowIndices: readonly number[];
	onBodyCommit: ( reorderedBody: unknown[] ) => void;
};

/** controller lifecycle hookが親へ公開する最小command API。 */
type TableReorderControllerCommands = {
	focusRowControl: () => FocusRowControlResult | undefined;
};

/**
 * Table Reorderのcontroller生成・cleanupとcommit後のfocus復元を所有する。
 *
 * @param options controller生成に必要なTable情報、算出済み制約、body commit callback。
 * @return Toolbarから利用するcontroller command。
 */
export const useTableReorderController = (
	options: UseTableReorderControllerOptions
): TableReorderControllerCommands => {
	const {
		anchorRef,
		body,
		clientId,
		enabled,
		forbiddenInsertionIndices,
		interactionMode,
		nonMovableRowIndices,
		onBodyCommit,
	} = options;
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

		const runtimeUrl = ( window as TableReorderConfigWindow ).yamabikoTableReorder?.runtimeUrl;
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

		let controller: SortableController | null = null;
		let disposed = false;

		queueMicrotask( () => {
			if ( disposed ) {
				return;
			}

			const createdController = createSortableController( {
				context,
				forbiddenInsertionIndices,
				interactionMode,
				nonMovableRowIndices,
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
	}, [
		anchorRef,
		body,
		clientId,
		enabled,
		forbiddenInsertionIndices,
		interactionMode,
		nonMovableRowIndices,
	] );

	return {
		focusRowControl: () => controllerRef.current?.focusRowControl(),
	};
};
