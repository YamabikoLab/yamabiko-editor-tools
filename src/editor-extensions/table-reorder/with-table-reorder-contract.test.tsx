import { createElement, createRoot } from '@wordpress/element';

import { useTableReorder } from './use-table-reorder';
import { withTableReorder } from './with-table-reorder';

const { act } = jest.requireActual< { act: ( callback: () => void ) => void } >( 'react' );

jest.mock( '@wordpress/block-editor', () => ( {
	BlockControls: 'div',
} ) );

jest.mock( '@wordpress/components', () => {
	const React = jest.requireActual< typeof import('react') >( 'react' );

	return {
		Button: ( {
			'aria-label': ariaLabel,
			children,
			className,
			onClick,
		}: {
			'aria-label'?: string;
			children?: import('react').ReactNode;
			className?: string;
			onClick?: () => void;
		} ) =>
			React.createElement( 'button', { 'aria-label': ariaLabel, className, onClick }, children ),
		Popover: ( {
			children,
			className,
		}: {
			children?: import('react').ReactNode;
			className?: string;
		} ) => React.createElement( 'div', { className }, children ),
		ToolbarButton: React.forwardRef<
			HTMLButtonElement,
			{
				'aria-describedby'?: string;
				children?: import('react').ReactNode;
				className?: string;
				label?: string;
				onClick?: () => void;
			}
		>( ( { 'aria-describedby': ariaDescribedBy, children, className, label, onClick }, ref ) =>
			React.createElement(
				'button',
				{
					'aria-describedby': ariaDescribedBy,
					'aria-label': label,
					className,
					onClick,
					ref,
				},
				children
			)
		),
	};
} );

jest.mock( './use-table-reorder', () => ( {
	useTableReorder: jest.fn(),
} ) );

const useTableReorderMock = useTableReorder as jest.MockedFunction< typeof useTableReorder >;

const consumeTouchToolbarFocusRequestMock = jest.fn();
const dismissKeyboardCoachmarkMock = jest.fn();
const dismissTouchCoachmarkMock = jest.fn();
const requestRowControlFocusMock = jest.fn();
const toggleTouchReorderModeMock = jest.fn();

const createHookResult = (
	overrides: Partial< ReturnType< typeof useTableReorder > > = {}
): ReturnType< typeof useTableReorder > => ( {
	anchorRef: { current: null },
	consumeTouchToolbarFocusRequest: consumeTouchToolbarFocusRequestMock,
	dismissKeyboardCoachmark: dismissKeyboardCoachmarkMock,
	dismissTouchCoachmark: dismissTouchCoachmarkMock,
	isHoverCapable: true,
	isKeyboardCoachmarkVisible: false,
	isTouchCoachmarkVisible: false,
	isTouchReorderMode: false,
	isTouchToolbarFocusRequested: false,
	requestRowControlFocus: requestRowControlFocusMock,
	toggleTouchReorderMode: toggleTouchReorderModeMock,
	...overrides,
} );

const BlockEdit = jest.fn( ( { name }: { name: string } ) => createElement( 'div', null, name ) );
const WithTableReorder = withTableReorder( BlockEdit );
type WithTableReorderProps = Parameters< typeof WithTableReorder >[ 0 ];

const createProps = ( overrides: Partial< WithTableReorderProps > = {} ): WithTableReorderProps =>
	( {
		attributes: { body: [] },
		clientId: 'table-client-id',
		isSelected: true,
		name: 'core/table',
		setAttributes: jest.fn(),
		...overrides,
	} ) as WithTableReorderProps;

const render = ( props: WithTableReorderProps ) => {
	const container = document.createElement( 'div' );
	document.body.append( container );
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
	document.body.replaceChildren();
	BlockEdit.mockClear();
	useTableReorderMock.mockReset();
	consumeTouchToolbarFocusRequestMock.mockReset();
	dismissKeyboardCoachmarkMock.mockReset();
	dismissTouchCoachmarkMock.mockReset();
	requestRowControlFocusMock.mockReset();
	toggleTouchReorderModeMock.mockReset();
	useTableReorderMock.mockReturnValue( createHookResult() );
} );

describe( 'withTableReorder local contract', () => {
	it( 'keeps toolbar UI hidden while the supported block is not selected', () => {
		const mounted = render( createProps( { isSelected: false } ) );

		expect( useTableReorderMock ).toHaveBeenCalledTimes( 1 );
		expect( mounted.container.querySelector( 'button' ) ).toBeNull();
		expect( mounted.container.textContent ).toContain( 'core/table' );

		mounted.unmount();
	} );

	it( 'uses the focus command for the hover-capable toolbar action', () => {
		const mounted = render( createProps() );
		const toolbarButton = mounted.container.querySelector< HTMLButtonElement >( 'button' );
		if ( ! toolbarButton ) {
			throw new Error( 'Expected toolbar button' );
		}

		act( () => {
			toolbarButton.click();
		} );

		expect( requestRowControlFocusMock ).toHaveBeenCalledTimes( 1 );
		expect( toggleTouchReorderModeMock ).not.toHaveBeenCalled();

		mounted.unmount();
	} );

	it( 'uses the touch toggle command when hover is unavailable', () => {
		useTableReorderMock.mockReturnValue(
			createHookResult( {
				isHoverCapable: false,
				isTouchReorderMode: true,
			} )
		);
		const mounted = render( createProps() );
		const toolbarButton = mounted.container.querySelector< HTMLButtonElement >( 'button' );
		if ( ! toolbarButton ) {
			throw new Error( 'Expected toolbar button' );
		}

		act( () => {
			toolbarButton.click();
		} );

		expect( toggleTouchReorderModeMock ).toHaveBeenCalledTimes( 1 );
		expect( requestRowControlFocusMock ).not.toHaveBeenCalled();

		mounted.unmount();
	} );

	it( 'renders keyboard coachmark and dismisses it through the close action', () => {
		useTableReorderMock.mockReturnValue(
			createHookResult( {
				isKeyboardCoachmarkVisible: true,
			} )
		);
		const mounted = render( createProps() );
		const buttons = mounted.container.querySelectorAll< HTMLButtonElement >( 'button' );

		expect( mounted.container.querySelector( '.yamabiko-table-reorder-coachmark' ) ).not.toBeNull();
		expect( buttons ).toHaveLength( 2 );
		act( () => {
			buttons[ 1 ]?.click();
		} );

		expect( dismissKeyboardCoachmarkMock ).toHaveBeenCalledTimes( 1 );
		expect( dismissTouchCoachmarkMock ).not.toHaveBeenCalled();

		mounted.unmount();
	} );

	it( 'renders touch coachmark and dismisses it through the close action', () => {
		useTableReorderMock.mockReturnValue(
			createHookResult( {
				isHoverCapable: false,
				isTouchCoachmarkVisible: true,
			} )
		);
		const mounted = render( createProps() );
		const buttons = mounted.container.querySelectorAll< HTMLButtonElement >( 'button' );

		expect( mounted.container.querySelector( '.yamabiko-table-reorder-coachmark' ) ).not.toBeNull();
		act( () => {
			buttons[ 1 ]?.click();
		} );

		expect( dismissTouchCoachmarkMock ).toHaveBeenCalledTimes( 1 );
		expect( dismissKeyboardCoachmarkMock ).not.toHaveBeenCalled();

		mounted.unmount();
	} );
} );
