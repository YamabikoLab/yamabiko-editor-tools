import type { TableContext } from '../table-context';

/** SortableJSへ渡すauto-scroll target。 */
export type AutoScrollTarget = boolean | HTMLElement;

/**
 * Table Reorderのeditor DOM contextに対応するauto-scroll targetを解決する。
 *
 * editor modeを判定せず、対象Tableのtbodyから最寄りの実際に縦スクロール可能な祖先を探す。
 * Gutenbergの内部class名には依存しない。
 *
 * @param context 解決済みTable context。
 * @return 明示的なscroll container。見つからない場合は`true`。
 */
export const resolveAutoScrollTarget = ( context: TableContext ): AutoScrollTarget => {
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
