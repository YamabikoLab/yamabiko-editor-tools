import { normalizeTone } from './tone';

describe( 'normalizeTone', () => {
	it.each( [ 'info', 'tip', 'warning' ] )( 'keeps the supported %s tone', ( tone ) => {
		expect( normalizeTone( tone ) ).toBe( tone );
	} );

	it( 'falls back for an unsupported string', () => {
		expect( normalizeTone( 'success' ) ).toBe( 'info' );
	} );

	it.each( [ null, 1, [ 'info' ] ] )( 'falls back for non-string values', ( value ) => {
		expect( normalizeTone( value ) ).toBe( 'info' );
	} );
} );
