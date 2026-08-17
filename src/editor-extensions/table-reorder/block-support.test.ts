import { getTableReorderBlockSupport } from './block-support';

describe( 'getTableReorderBlockSupport', () => {
	it( 'returns Core Table support', () => {
		expect( getTableReorderBlockSupport( 'core/table' ) ).toEqual( {
			rowspanProperty: 'rowspan',
		} );
	} );

	it( 'returns null for unsupported blocks', () => {
		expect( getTableReorderBlockSupport( 'core/paragraph' ) ).toBeNull();
	} );
} );
