import { announceLiveStatus } from './live-status';

describe( 'live-status', () => {
	beforeEach( () => {
		document.body.replaceChildren();
	} );

	it( 'keeps the live status accessibility and visually-hidden contract', async () => {
		announceLiveStatus( document, 'First announcement' );
		announceLiveStatus( document, 'Second announcement' );
		await Promise.resolve();

		const statuses = document.querySelectorAll( '.yamabiko-table-reorder-live-status' );
		expect( statuses ).toHaveLength( 1 );
		expect( statuses[ 0 ].textContent ).toBe( 'Second announcement' );
		expect( statuses[ 0 ].classList ).toContain( 'yamabiko-table-reorder-description' );
		expect( statuses[ 0 ].getAttribute( 'role' ) ).toBe( 'status' );
		expect( statuses[ 0 ].getAttribute( 'aria-live' ) ).toBe( 'polite' );
		expect( statuses[ 0 ].getAttribute( 'aria-atomic' ) ).toBe( 'true' );
	} );
} );
