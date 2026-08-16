/** 支援技術向け説明文に付与するclass。 */
const DESCRIPTION_CLASS = 'yamabiko-table-reorder-description';

/** live statusに付与するclass。 */
const LIVE_STATUS_CLASS = 'yamabiko-table-reorder-live-status';

/** owning documentごとに一つだけ共有するlive status。 */
const liveStatusByDocument = new WeakMap< Document, HTMLElement >();

/**
 * owning document内のlive statusへ一つの通知を送る。
 *
 * 同一nodeをdocumentごとに共有し、同じ文言を再通知する必要がある場合にもDOM更新が発生するよう
 * 一度空にしてからmicrotaskで設定する。連続通知の抑制は操作状態を知るcontroller側が担当する。
 *
 * @param document 通知先のeditor document。
 * @param message  支援技術へ通知する文言。
 */
export const announceLiveStatus = ( document: Document, message: string ) => {
	let status = liveStatusByDocument.get( document );
	if ( ! status || ! status.isConnected ) {
		status = document.createElement( 'div' );
		status.className = `${ DESCRIPTION_CLASS } ${ LIVE_STATUS_CLASS }`;
		status.setAttribute( 'role', 'status' );
		status.setAttribute( 'aria-live', 'polite' );
		status.setAttribute( 'aria-atomic', 'true' );
		document.body.append( status );
		liveStatusByDocument.set( document, status );
	}

	status.textContent = '';
	queueMicrotask( () => {
		if ( status?.isConnected ) {
			status.textContent = message;
		}
	} );
};