import { ensureSortableRuntimeImpl, type SortableInstance } from './sortable-runtime-loader';

export type { SortableInstance };

/**
 * 旧controllerテストのmock参照を新しいloader実装へ橋渡しする互換入口。
 */
export const ensureSortableRuntime = ( document: Document, view: Window, runtimeUrl: string ) =>
	ensureSortableRuntimeImpl( document, view, runtimeUrl );
