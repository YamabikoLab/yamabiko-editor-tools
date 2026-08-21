import type { TableContext } from '../table-context';
import { resolveAutoScrollTarget } from './scroll-target';

const createContext = () => {
	const scrollableOuter = document.createElement( 'div' );
	const scrollableInner = document.createElement( 'div' );
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	table.append( tbody );
	scrollableInner.append( table );
	scrollableOuter.append( scrollableInner );
	document.body.append( scrollableOuter );

	const context: TableContext = {
		blockElement: scrollableInner,
		document,
		window,
		tbody,
	};

	return { context, scrollableInner, scrollableOuter };
};

const makeScrollable = ( element: HTMLElement, overflowY = 'auto' ) => {
	element.style.overflowY = overflowY;
	Object.defineProperty( element, 'clientHeight', {
		configurable: true,
		value: 100,
	} );
	Object.defineProperty( element, 'scrollHeight', {
		configurable: true,
		value: 200,
	} );
};

describe( 'resolveAutoScrollTarget', () => {
	beforeEach( () => {
		document.body.replaceChildren();
	} );

	it( 'returns the nearest vertically scrollable ancestor', () => {
		const { context, scrollableInner, scrollableOuter } = createContext();
		makeScrollable( scrollableInner );
		makeScrollable( scrollableOuter );

		expect( resolveAutoScrollTarget( context ) ).toBe( scrollableInner );
	} );

	it( 'ignores hidden and non-scrollable ancestors', () => {
		const { context, scrollableInner, scrollableOuter } = createContext();
		makeScrollable( scrollableInner, 'hidden' );
		scrollableOuter.style.overflowY = 'auto';
		Object.defineProperty( scrollableOuter, 'clientHeight', {
			configurable: true,
			value: 100,
		} );
		Object.defineProperty( scrollableOuter, 'scrollHeight', {
			configurable: true,
			value: 100,
		} );

		expect( resolveAutoScrollTarget( context ) ).toBe( true );
	} );

	it( 'falls back to SortableJS automatic target detection when no ancestor matches', () => {
		const { context } = createContext();

		expect( resolveAutoScrollTarget( context ) ).toBe( true );
	} );
} );
