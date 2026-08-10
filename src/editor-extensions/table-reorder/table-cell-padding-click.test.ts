import { focusTableCellFromPaddingClick } from './table-cell-padding-click';

const getRect = ( left: number, top: number, right: number, bottom: number ) => ( {
	bottom,
	height: bottom - top,
	left,
	right,
	top,
	width: right - left,
	x: left,
	y: top,
	toJSON: () => '',
} );

type PointerEventOptions = Partial<
	Pick<
		PointerEvent,
		'button' | 'defaultPrevented' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'
	>
>;

const getPointerEvent = (
	target: EventTarget,
	clientX: number,
	clientY: number,
	options: PointerEventOptions = {}
) =>
	( {
		altKey: false,
		button: 0,
		clientX,
		ctrlKey: false,
		defaultPrevented: false,
		metaKey: false,
		clientY,
		preventDefault: jest.fn(),
		shiftKey: false,
		stopPropagation: jest.fn(),
		target,
		...options,
	} ) as unknown as PointerEvent;

const setTableRects = ( figure: HTMLElement ) => {
	const table = figure.querySelector< HTMLTableElement >( 'table' )!;
	const [ shortCell, tallCell ] = Array.from(
		figure.querySelectorAll< HTMLTableCellElement >( 'td, th' )
	);
	jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue( getRect( 0, 0, 160, 72 ) );
	jest.spyOn( shortCell, 'getBoundingClientRect' ).mockReturnValue( getRect( 0, 0, 80, 72 ) );
	jest.spyOn( tallCell, 'getBoundingClientRect' ).mockReturnValue( getRect( 80, 0, 160, 72 ) );
	return { shortCell, table };
};

describe( 'focusTableCellFromPaddingClick', () => {
	it( 'focuses a short cell when an editor-root event is within its padding', () => {
		document.body.innerHTML = `
			<div class="is-root-container"></div>
			<figure class="wp-block-table" data-block="table-id">
				<table>
					<tbody>
						<tr>
							<td><div contenteditable="true">4</div></td>
							<td><div contenteditable="true">first<br>second<br>third</div></td>
						</tr>
					</tbody>
				</table>
			</figure>
		`;
		const figure = document.querySelector< HTMLElement >( 'figure' )!;
		const root = document.querySelector< HTMLElement >( '.is-root-container' )!;
		const { shortCell } = setTableRects( figure );
		const editable = shortCell.querySelector< HTMLElement >( '[contenteditable="true"]' )!;
		const focus = jest.spyOn( editable, 'focus' );
		const event = getPointerEvent( root, 40, 56 );

		expect( focusTableCellFromPaddingClick( event, figure ) ).toBe( true );
		expect( event.preventDefault ).toHaveBeenCalledTimes( 1 );
		expect( event.stopPropagation ).toHaveBeenCalledTimes( 1 );
		expect( focus ).toHaveBeenCalledWith( { preventScroll: true } );
	} );

	it( 'does not scan cells when the pointer is outside the table', () => {
		document.body.innerHTML = `
			<div class="is-root-container"></div>
			<figure class="wp-block-table" data-block="table-id">
				<table><tbody><tr><td><div contenteditable="true">4</div></td><td><div contenteditable="true">first<br>second<br>third</div></td></tr></tbody></table>
			</figure>
		`;
		const figure = document.querySelector< HTMLElement >( 'figure' )!;
		const root = document.querySelector< HTMLElement >( '.is-root-container' )!;
		const { shortCell, table } = setTableRects( figure );
		const event = getPointerEvent( root, 200, 56 );

		expect( focusTableCellFromPaddingClick( event, figure ) ).toBe( false );
		expect( event.preventDefault ).not.toHaveBeenCalled();
		expect( event.stopPropagation ).not.toHaveBeenCalled();
		expect( table.getBoundingClientRect ).toHaveBeenCalledTimes( 1 );
		expect( shortCell.getBoundingClientRect ).not.toHaveBeenCalled();
	} );

	it.each( [
		[ 'the existing RichText editable', '[contenteditable="true"]' ],
		[ 'a link', 'a' ],
		[ 'a button', 'button' ],
		[ 'a form control', 'input' ],
	] )( 'leaves %s untouched', ( _description, selector ) => {
		document.body.innerHTML = `
			<figure class="wp-block-table" data-block="table-id">
				<table><tbody><tr><td><div contenteditable="true">Text <a href="#details">Details</a><button>Action</button><input value="value" /></div></td><td><div contenteditable="true">first<br>second<br>third</div></td></tr></tbody></table>
			</figure>
		`;
		const figure = document.querySelector< HTMLElement >( 'figure' )!;
		const { shortCell } = setTableRects( figure );
		const editable = shortCell.querySelector< HTMLElement >( '[contenteditable="true"]' )!;
		const target = shortCell.querySelector< HTMLElement >( selector )!;
		const focus = jest.spyOn( editable, 'focus' );
		const event = getPointerEvent( target, 40, 24 );

		expect( focusTableCellFromPaddingClick( event, figure ) ).toBe( false );
		expect( event.preventDefault ).not.toHaveBeenCalled();
		expect( event.stopPropagation ).not.toHaveBeenCalled();
		expect( focus ).not.toHaveBeenCalled();
	} );

	it( 'focuses a header cell when its padding is clicked', () => {
		document.body.innerHTML = `
			<div class="is-root-container"></div>
			<figure class="wp-block-table" data-block="table-id">
				<table><thead><tr><th><div contenteditable="true">Header</div></th><th><div contenteditable="true">first<br>second<br>third</div></th></tr></thead></table>
			</figure>
		`;
		const figure = document.querySelector< HTMLElement >( 'figure' )!;
		const root = document.querySelector< HTMLElement >( '.is-root-container' )!;
		const { shortCell } = setTableRects( figure );
		const editable = shortCell.querySelector< HTMLElement >( '[contenteditable="true"]' )!;
		const focus = jest.spyOn( editable, 'focus' );
		const event = getPointerEvent( root, 40, 56 );

		expect( focusTableCellFromPaddingClick( event, figure ) ).toBe( true );
		expect( focus ).toHaveBeenCalledWith( { preventScroll: true } );
	} );

	it.each( [
		[ 'a prevented event', { defaultPrevented: true } ],
		[ 'a Shift-click', { shiftKey: true } ],
		[ 'a Ctrl-click', { ctrlKey: true } ],
		[ 'a Meta-click', { metaKey: true } ],
		[ 'an Alt-click', { altKey: true } ],
		[ 'a non-primary button click', { button: 1 } ],
	] )( 'leaves %s untouched', ( _description, options: PointerEventOptions ) => {
		document.body.innerHTML = `
			<div class="is-root-container"></div>
			<figure class="wp-block-table" data-block="table-id">
				<table><tbody><tr><td><div contenteditable="true">4</div></td><td><div contenteditable="true">first<br>second<br>third</div></td></tr></tbody></table>
			</figure>
		`;
		const figure = document.querySelector< HTMLElement >( 'figure' )!;
		const root = document.querySelector< HTMLElement >( '.is-root-container' )!;
		const { shortCell } = setTableRects( figure );
		const editable = shortCell.querySelector< HTMLElement >( '[contenteditable="true"]' )!;
		const focus = jest.spyOn( editable, 'focus' );
		const event = getPointerEvent( root, 40, 56, options );

		expect( focusTableCellFromPaddingClick( event, figure ) ).toBe( false );
		expect( event.preventDefault ).not.toHaveBeenCalled();
		expect( event.stopPropagation ).not.toHaveBeenCalled();
		expect( focus ).not.toHaveBeenCalled();
	} );
} );
