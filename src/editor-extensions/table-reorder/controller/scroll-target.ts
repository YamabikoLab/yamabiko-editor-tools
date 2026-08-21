import type { TableContext } from '../table-context';

/** SortableJSへ渡すauto-scroll target。 */
export type AutoScrollTarget = boolean | HTMLElement;

/**
 * Table Reorderのeditor contextに対応するauto-scroll targetを解決する。
 *
 * iframe editorではSortableJSの既存の自動検出を維持する。non-iframe editorでは
 * Gutenbergの内部class名に依存せず、tbodyから最寄りの実際に縦スクロール可能な祖先を探す。
 *
 * @param context 解決済みTable context。
 * @return 明示的なscroll container。見つからない場合またはiframe editorでは`true`。
 */
export const resolveAutoScrollTarget = ( context: TableContext ): AutoScrollTarget => {
	if ( context.isIframeEditor() ) {
		return true;
	}

	let element = context.tbody.parentElement;
	while ( element ) {
		const overflowY = context.window.getComputedStyle( element ).overflowY;
		if (
			( overflowY === 'auto' || overflowY === 'scroll' ) &&
			element.scrollHeight > element.clientHeight
		) {
			return element;
		}
		element = element.parentElement;
	}

	return true;
};
