import { createElement, createRoot } from '@wordpress/element';

import { useTableReorder } from './use-table-reorder';
import { isTableReorderSupportedBlock, withTableReorder } from './with-table-reorder';

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
	dismissKeyboardCoachmark: jest.fn(),
	dismissTouchCoachmark: jest.fn(),
	isHoverCapable: true,
	isKeyboardCoachmarkVisible: false,
	isTouchCoachmarkVisible: false,
	isTouchReorderMode: false,
	requestRowControlFocus: jest.fn(),
	toggleTouchReorderMode: jest.fn(),
} );

const BlockEdit = jest.fn( ( { name }: { name: string } ) => createElement( 'div', null, name ) );
const WithTableReorder = withTableReorder( BlockEdit );
type WithTableReorderProps = Parameters< typeof WithTableReorder >[ 0 ];

const createProps = ( name: string ): WithTableReorderProps => {
	const props: Partial< WithTableReorderProps > = {
		attributes: { body: [] },
		clientId: 'block-client-id',
		isSelected: false,
		name,
		setAttributes: jest.fn(),
	};
	return props as WithTableReorderProps;
};

const render = ( props: WithTableReorderProps ) => {
	const container = document.createElement( 'div' );
	const root = createRoot( container );
	act( () => {
		root.render( createElement( WithTableReorder, props ) );
	} );
	return {
		container,
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

describe( 'isTableReorderSupportedBlock', () => {
	it( 'supports only core/table', () => {
		expect( isTableReorderSupportedBlock( 'core/table' ) ).toBe( true );
		expect( isTableReorderSupportedBlock( 'core/paragraph' ) ).toBe( false );
		expect( isTableReorderSupportedBlock( 'flexible-table-block/table' ) ).toBe( false );
	} );
} );

describe( 'withTableReorder', () => {
	it( 'returns the original BlockEdit without running Table Reorder hooks for unsupported blocks', () => {
		const mounted = render( createProps( 'core/paragraph' ) );

		expect( mounted.container.textContent ).toBe( 'core/paragraph' );
		expect( BlockEdit ).toHaveBeenCalledTimes( 1 );
		expect( useTableReorderMock ).not.toHaveBeenCalled();

		mounted.unmount();
	} );

	it( 'runs Table Reorder hooks only inside the supported block component', () => {
		const props = createProps( 'core/table' );
		const mounted = render( props );

		expect( mounted.container.textContent ).toBe( 'core/table' );
		expect( useTableReorderMock ).toHaveBeenCalledTimes( 1 );
		expect( useTableReorderMock ).toHaveBeenCalledWith( {
			body: [],
			clientId: 'block-client-id',
			enabled: true,
			isSelected: false,
			setAttributes: props.setAttributes,
		} );

		mounted.unmount();
	} );
} );