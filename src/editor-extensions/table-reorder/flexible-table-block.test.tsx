import { createElement, createRoot } from '@wordpress/element';

import { getTableReorderBlockSupport } from './block-support';
import { getForbiddenInsertionIndices, getNonMovableRowIndices, getRowspanRanges } from './rowspan';
import { useTableReorder } from './use-table-reorder';
import { withTableReorder } from './with-table-reorder';

const { act } = jest.requireActual< { act: ( callback: () => void ) => void } >( 'react' );

jest.mock( '@wordpress/block-editor', () => ( {
	BlockControls: 'div',
} ) );

jest.mock( '@wordpress/components', () => ( {
	Button: 'button',
	Popover: 'div',
	ToolbarButton: 'button',
} ) );

jest.mock( './use-table-reorder', () => ( {
	useTableReorder: jest.fn(),
} ) );

const useTableReorderMock = useTableReorder as jest.MockedFunction< typeof useTableReorder >;

const createHookResult = (): ReturnType< typeof useTableReorder > => ( {
	anchorRef: { current: null },
	consumeTouchToolbarFocusRequest: jest.fn(),
	dismissKeyboardCoachmark: jest.fn(),
	dismissTouchCoachmark: jest.fn(),
	isHoverCapable: true,
	isKeyboardCoachmarkVisible: false,
	isTouchCoachmarkVisible: false,
	isTouchReorderMode: false,
	isTouchToolbarFocusRequested: false,
	requestRowControlFocus: jest.fn(),
	toggleTouchReorderMode: jest.fn(),
} );

const BlockEdit = jest.fn( ( { name }: { name: string } ) => createElement( 'div', null, name ) );
const WithTableReorder = withTableReorder( BlockEdit );
type WithTableReorderProps = Parameters< typeof WithTableReorder >[ 0 ];

const renderFlexibleTableBlock = ( body: unknown[] ) => {
	const props = {
		attributes: { body },
		clientId: 'flexible-table-block-client-id',
		isSelected: false,
		name: 'flexible-table-block/table',
		setAttributes: jest.fn(),
	} as unknown as WithTableReorderProps;
	const container = document.createElement( 'div' );
	const root = createRoot( container );

	act( () => {
		root.render( createElement( WithTableReorder, props ) );
	} );

	return {
		container,
		props,
		unmount: () => {
			act( () => {
				root.unmount();
			} );
		},
	};
};

beforeAll( () => {
	Object.assign( globalThis, { IS_REACT_ACT_ENVIRONMENT: true } );
} );

beforeEach( () => {
	BlockEdit.mockClear();
	useTableReorderMock.mockReset();
	useTableReorderMock.mockReturnValue( createHookResult() );
} );

describe( 'Flexible Table Block integration contract', () => {
	it( 'registers Flexible Table Block with rowSpan support', () => {
		expect( getTableReorderBlockSupport( 'flexible-table-block/table' ) ).toEqual( {
			rowspanProperty: 'rowSpan',
		} );
	} );

	it( 'derives movement restrictions from Flexible Table Block rowSpan values', () => {
		const body = [
			{ cells: [ { content: 'a', rowSpan: 2 } ] },
			{ cells: [ { content: 'b' } ] },
			{ cells: [ { content: 'c' } ] },
		];
		const ranges = getRowspanRanges( body, 'rowSpan' );

		expect( ranges ).toEqual( [ { start: 0, end: 1 } ] );
		expect( getNonMovableRowIndices( ranges ) ).toEqual( [ 0, 1 ] );
		expect( getForbiddenInsertionIndices( ranges ) ).toEqual( [ 1 ] );
	} );

	it( 'passes Flexible Table Block body and setAttributes through the shared Table Reorder path', () => {
		const body = [
			{
				cells: [
					{
						className: 'first-cell',
						colSpan: 2,
						content: 'Flexible row',
						rowSpan: 2,
						scope: 'row',
						styles: { color: '#000000' },
					},
				],
			},
		];
		const mounted = renderFlexibleTableBlock( body );

		expect( mounted.container.textContent ).toBe( 'flexible-table-block/table' );
		expect( useTableReorderMock ).toHaveBeenCalledTimes( 1 );
		expect( useTableReorderMock ).toHaveBeenCalledWith( {
			body,
			clientId: 'flexible-table-block-client-id',
			enabled: true,
			isSelected: false,
			rowspanProperty: 'rowSpan',
			setAttributes: mounted.props.setAttributes,
		} );

		mounted.unmount();
	} );
} );
