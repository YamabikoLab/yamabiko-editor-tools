import { __, sprintf } from '@wordpress/i18n';

import {
	getEmptyRowLabel,
	getKeyboardHandleTooltip,
	getNoMovableRowsMessage,
	getPointerHandleTooltip,
	getRowControlKeyboardDescription,
	getRowControlName,
	getRowControlPointerDescription,
	getRowspanErrorMessage,
	getToolbarReorderName,
} from './messages';

jest.mock( '@wordpress/i18n', () => ( {
	__: jest.fn( ( message: string ) => message ),
	sprintf: jest.fn( ( template: string, ...values: Array< string | number > ) =>
		template.replace( /%(\d+)\$[ds]/g, ( _match, position: string ) =>
			String( values[ Number( position ) - 1 ] )
		)
	),
} ) );

const translateMock = __ as jest.MockedFunction< typeof __ >;
const sprintfMock = sprintf as jest.MockedFunction< typeof sprintf >;

describe( 'messages', () => {
	beforeEach( () => {
		translateMock.mockClear();
		sprintfMock.mockClear();
	} );

	it( 'builds the row-control name from the current position and row label', () => {
		expect( getRowControlName( 2, 'Example row' ) ).toBe( 'Reorder row 2: Example row' );
		expect( sprintfMock ).toHaveBeenCalledWith( 'Reorder row %1$d: %2$s', 2, 'Example row' );
	} );

	it( 'uses the Table Reorder text domain for Phase 2 messages', () => {
		getEmptyRowLabel();
		getPointerHandleTooltip();
		getKeyboardHandleTooltip();
		getRowControlName( 1, 'Row' );
		getRowControlPointerDescription();
		getRowControlKeyboardDescription();
		getToolbarReorderName();
		getRowspanErrorMessage();
		getNoMovableRowsMessage();

		expect( translateMock ).toHaveBeenCalled();
		for ( const call of translateMock.mock.calls ) {
			expect( call[ 1 ] ).toBe( 'yamabiko-editor-tools' );
		}
	} );
} );
