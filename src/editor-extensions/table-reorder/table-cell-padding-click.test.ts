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

const getPointerEvent = ( target: EventTarget, clientX: number, clientY: number ) =>
	( {
		button: 0,
		clientX,
		clientY,
		preventDefault: jest.fn(),
		stopPropagation: jest.fn(),
		target,
	} ) as unknown as PointerEvent;

describe( 'focusTableCellFromPaddingClick', () => {
	it( 'focuses a short cell when its padding is clicked in a mixed-height row', () => {
		document.body.innerHTML = `
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
		const [ shortCell, tallCell ] = Array.from(
			figure.querySelectorAll< HTMLTableCellElement >( 'td' )
		);
		const editable = shortCell.querySelector< HTMLElement >( '[contenteditable="true"]' )!;
		const focus = jest.spyOn( editable, 'focus' );
		jest.spyOn( shortCell, 'getBoundingClientRect' ).mockReturnValue( getRect( 0, 0, 80, 72 ) );
		jest.spyOn( tallCell, 'getBoundingClientRect' ).mockReturnValue( getRect( 80, 0, 160, 72 ) );
		const event = getPointerEvent( figure, 40, 56 );

		expect( focusTableCellFromPaddingClick( event, figure ) ).toBe( true );
		expect( event.preventDefault ).toHaveBeenCalledTimes( 1 );
		expect( event.stopPropagation ).toHaveBeenCalledTimes( 1 );
		expect( focus ).toHaveBeenCalledWith( { preventScroll: true } );
	} );

	it( 'leaves a link in a cell untouched', () => {
		document.body.innerHTML = `
			<figure class="wp-block-table" data-block="table-id">
				<table><tbody><tr><td><div contenteditable="true"><a href="#details">Details</a></div></td></tr></tbody></table>
			</figure>
		`;
		const figure = document.querySelector< HTMLElement >( 'figure' )!;
		const cell = figure.querySelector< HTMLTableCellElement >( 'td' )!;
		const editable = cell.querySelector< HTMLElement >( '[contenteditable="true"]' )!;
		const link = figure.querySelector< HTMLAnchorElement >( 'a' )!;
		const focus = jest.spyOn( editable, 'focus' );
		jest.spyOn( cell, 'getBoundingClientRect' ).mockReturnValue( getRect( 0, 0, 80, 72 ) );
		const event = getPointerEvent( link, 40, 24 );

		expect( focusTableCellFromPaddingClick( event, figure ) ).toBe( false );
		expect( event.preventDefault ).not.toHaveBeenCalled();
		expect( event.stopPropagation ).not.toHaveBeenCalled();
		expect( focus ).not.toHaveBeenCalled();
	} );
} );
