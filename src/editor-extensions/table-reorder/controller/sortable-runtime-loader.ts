/**
 * Table Reorderが利用するSortableJS runtime loader。
 *
 * owning windowに既にあるruntimeは再利用し、同じwindowで読み込み中なら同じloading stateを返す。
 * 必要な場合だけowning documentへscriptを挿入し、instance lifecycleやGutenbergのstate / block
 * attribute更新は扱わない。
 */

import * as legacyRuntime from './sortable-runtime';

/**
 * Table ReorderがSortableJS instanceの破棄に必要とする最小interface。
 */
export type SortableInstance = {
	destroy: () => void;
};

/**
 * scriptからowning windowに公開されるSortableJS runtimeの最小interface。
 */
type SortableRuntime = {
	create: ( element: HTMLElement, options: object ) => SortableInstance;
};

/**
 * SortableJS runtimeが公開されるowning windowの形。
 */
type SortableWindow = Window & {
	Sortable?: SortableRuntime;
};

/**
 * editor document内でTable Reorder用runtime scriptを一意に識別するID。
 */
const SORTABLE_SCRIPT_ID = 'yamabiko-table-reorder-sortable-runtime';

/** loaderが挿入したruntime scriptの読み込み状態を識別するattribute。 */
const SORTABLE_SCRIPT_STATE_ATTRIBUTE = 'data-yamabiko-table-reorder-runtime-state';

/** runtime scriptがまだ読み込み中であることを示すstate。 */
const SORTABLE_SCRIPT_LOADING_STATE = 'loading';

/**
 * owning windowごとの読み込み中Promise。
 *
 * iframeとroot documentのruntimeを混同せず、同じwindowへの重複script挿入を防ぐ。
 * 成功・失敗のどちらでも解決後に削除し、後続呼び出しは現在のruntime状態を再評価する。
 */
const loadingStates = new WeakMap< Window, Promise< SortableRuntime | null > >();

/**
 * owning document / windowに対応するSortableJS runtimeを取得する実装本体。
 *
 * 既存runtime、読み込み中stateの順に再利用し、必要な場合だけscriptを追加する。
 * scriptの読み込みに失敗した場合、または読み込み後にruntimeが公開されなかった場合は`null`を返す。
 *
 * @param document   runtime scriptを探索・挿入するowning document。
 * @param view       SortableJS runtimeが公開されるowning window。
 * @param runtimeUrl 必要な場合に読み込むSortableJS runtime scriptのURL。
 */
export const ensureSortableRuntimeImpl = (
	document: Document,
	view: Window,
	runtimeUrl: string
): Promise< SortableRuntime | null > => {
	const sortableWindow = view as SortableWindow;
	if ( sortableWindow.Sortable ) {
		return Promise.resolve( sortableWindow.Sortable );
	}

	const existingLoadingState = loadingStates.get( view );
	if ( existingLoadingState ) {
		return existingLoadingState;
	}

	const loadingState = new Promise< SortableRuntime | null >( ( resolve ) => {
		const existingScript = document.getElementById(
			SORTABLE_SCRIPT_ID
		) as HTMLScriptElement | null;
		const script = existingScript ?? document.createElement( 'script' );
		let settled = false;

		const finish = ( runtime: SortableRuntime | null ) => {
			if ( settled ) {
				return;
			}

			settled = true;
			script.removeAttribute( SORTABLE_SCRIPT_STATE_ATTRIBUTE );
			loadingStates.delete( view );
			resolve( runtime );
		};
		const onLoad = () => {
			const runtime = sortableWindow.Sortable ?? null;
			if ( ! runtime ) {
				script.remove();
			}
			finish( runtime );
		};
		const onError = () => {
			script.remove();
			finish( null );
		};

		if (
			existingScript &&
			existingScript.getAttribute( SORTABLE_SCRIPT_STATE_ATTRIBUTE ) !==
				SORTABLE_SCRIPT_LOADING_STATE
		) {
			existingScript.remove();
			view.setTimeout( () => finish( null ), 0 );
			return;
		}

		script.addEventListener( 'load', onLoad, { once: true } );
		script.addEventListener( 'error', onError, { once: true } );

		if ( existingScript ) {
			view.setTimeout( () => {
				if ( sortableWindow.Sortable ) {
					finish( sortableWindow.Sortable );
				}
			}, 0 );
			return;
		}

		script.id = SORTABLE_SCRIPT_ID;
		script.src = runtimeUrl;
		script.setAttribute( SORTABLE_SCRIPT_STATE_ATTRIBUTE, SORTABLE_SCRIPT_LOADING_STATE );
		document.head.append( script );
	} );

	loadingStates.set( view, loadingState );
	return loadingState;
};

/**
 * 既存controllerテストのmock境界を保ちながらloader実装へ委譲する公開入口。
 */
export const ensureSortableRuntime = (
	document: Document,
	view: Window,
	runtimeUrl: string
): Promise< SortableRuntime | null > =>
	legacyRuntime.ensureSortableRuntime( document, view, runtimeUrl );
