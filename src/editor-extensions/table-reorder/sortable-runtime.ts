/**
 * Table Reorder が利用する SortableJS runtime の読み込みを管理する。
 *
 * owning window に既にある runtime は再利用し、同じ window で読み込み中なら同じ loading
 * state を返す。必要な場合だけ owning document へ script を挿入し、instance lifecycle や
 * Gutenberg の state / block attribute 更新は扱わない。
 */

/**
 * Table Reorder が SortableJS instance の破棄に必要とする最小 interface。
 */
export type SortableInstance = {
	destroy: () => void;
};

/**
 * script から owning window に公開される SortableJS runtime の最小 interface。
 */
export type SortableRuntime = {
	create: ( element: HTMLElement, options: object ) => SortableInstance;
};

/**
 * SortableJS runtime が公開される owning window の形。
 */
type SortableWindow = Window & {
	Sortable?: SortableRuntime;
};

/**
 * editor document 内で Table Reorder 用 runtime script を一意に識別する ID。
 */
export const SORTABLE_SCRIPT_ID = 'yamabiko-table-reorder-sortable-runtime';

/**
 * owning window ごとの読み込み中 Promise。
 *
 * iframe と root document の runtime を混同せず、同じ window への重複 script 挿入を防ぐ。
 * 成功・失敗のどちらでも解決後に削除し、後続呼び出しは現在の runtime 状態を再評価する。
 */
const loadingStates = new WeakMap< Window, Promise< SortableRuntime | null > >();

/**
 * owning document / window に対応する SortableJS runtime を取得する。
 *
 * 既存 runtime、読み込み中 state の順に再利用し、必要な場合だけ script を追加する。
 * script の読み込みに失敗した場合、または読み込み後に runtime が公開されなかった場合は
 * `null` を返す。
 *
 * @param document   runtime script を探索・挿入する owning document。
 * @param view       SortableJS runtime が公開される owning window。
 * @param runtimeUrl 必要な場合に読み込む SortableJS runtime script の URL。
 */
export const ensureSortableRuntime = (
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
		document.head.append( script );
	} );

	loadingStates.set( view, loadingState );
	return loadingState;
};
