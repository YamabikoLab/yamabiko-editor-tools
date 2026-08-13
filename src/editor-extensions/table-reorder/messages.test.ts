import { __, sprintf } from '@wordpress/i18n';

import {
	getDestinationChangedAnnouncement,
	getDestinationRequestedAnnouncement,
	getEmptyRowLabel,
	getKeyboardActiveMessage,
	getKeyboardHandleTooltip,
	getMoveBoundaryAnnouncement,
	getMoveCanceledAnnouncement,
	getMoveCommittedAnnouncement,
	getMoveStartedAnnouncement,
	getNoMovableRowsAnnouncement,
	getNoMovableRowsMessage,
	getPointerHandleTooltip,
	getRowControlKeyboardDescription,
	getRowControlName,
	getRowControlPointerDescription,
	getRowspanBlockedAnnouncement,
	getRowspanErrorMessage,
	getToolbarReorderDescription,
	getToolbarReorderName,
	getTouchCoachmarkMessage,
	getTouchModeMessage,
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

	it( 'builds accessibility announcements from numbered placeholders', () => {
		expect( getMoveStartedAnnouncement( 'Alpha', 2, 4 ) ).toBe( 'Moving Alpha, row 2 of 4.' );
		expect( getDestinationRequestedAnnouncement( 'Alpha' ) ).toBe(
			'Alpha selected. Choose a destination.'
		);
		expect( getDestinationChangedAnnouncement( 'Alpha', 3, 4 ) ).toBe(
			'Move Alpha to position 3 of 4.'
		);
		expect( getMoveCommittedAnnouncement( 'Alpha', 2, 3 ) ).toBe(
			'Moved Alpha from position 2 to 3.'
		);
		expect( getMoveCanceledAnnouncement( 'Alpha', 2 ) ).toBe(
			'Canceled moving Alpha. It remains at position 2.'
		);
		expect( getMoveBoundaryAnnouncement( 'Alpha', 'down' ) ).toBe(
			'Alpha cannot move any farther down.'
		);
		expect( getRowspanBlockedAnnouncement( 'Alpha' ) ).toBe(
			'Alpha cannot be moved because it is within a cell that spans multiple rows.'
		);
		expect( getNoMovableRowsAnnouncement() ).toBe(
			'There are no rows that can be reordered in this table.'
		);
	} );

	it( 'uses the Table Reorder text domain for user-facing messages', () => {
		getEmptyRowLabel();
		getPointerHandleTooltip();
		getKeyboardHandleTooltip();
		getKeyboardActiveMessage();
		getTouchModeMessage();
		getTouchCoachmarkMessage();
		getRowControlName( 1, 'Row' );
		getRowControlPointerDescription();
		getRowControlKeyboardDescription();
		getToolbarReorderName();
		getToolbarReorderDescription();
		getRowspanErrorMessage();
		getNoMovableRowsMessage();
		getMoveStartedAnnouncement( 'Row', 1, 2 );
		getMoveBoundaryAnnouncement( 'Row', 'up' );

		expect( translateMock ).toHaveBeenCalled();
		for ( const call of translateMock.mock.calls ) {
			expect( call[ 1 ] ).toBe( 'yamabiko-editor-tools' );
		}
	} );
} );
