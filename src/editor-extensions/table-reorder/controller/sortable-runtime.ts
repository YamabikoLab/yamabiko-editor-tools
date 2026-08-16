import { ensureSortableRuntimeImpl, type SortableInstance } from './sortable-runtime-loader';

export type { SortableInstance };

/**
 * 旧controllerテストのmock参照を新しいloader実装へ橋渡しする互換入口。
 *
 * @param document   runtime scriptを探索・挿入するowning document。
 * @param view       SortableJS runtimeが公開されるowning window。
 * @param runtimeUrl 必要な場合に読み込むSortableJS runtime scriptのURL。
 */
export const ensureSortableRuntime = ( document: Document, view: Window, runtimeUrl: string ) =>
	ensureSortableRuntimeImpl( document, view, runtimeUrl );
