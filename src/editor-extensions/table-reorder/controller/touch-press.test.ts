import {
	createTouchPressTracker,
	TOUCH_DRAG_DELAY_MS,
	TOUCH_START_THRESHOLD_PX,
} from './touch-press';

const dispatchPointerEvent = (
	target: Element,
	type: string,
	{
		clientX = 0,
		clientY = 0,
		pointerId = 1,
		pointerType = 'touch',
	}: {
		clientX?: number;
		clientY?: number;
		pointerId?: number;
		pointerType?: string;
	} = {}
) => {
	const event = new Event( type, { bubbles: true } ) as PointerEvent;
	Object.defineProperties( event, {
		clientX: { value: clientX },
		clientY: { value: clientY },
		pointerId: { value: pointerId },
		pointerType: { value: pointerType },
	} );
	target.dispatchEvent( event );
};

const createContext = () => {
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	table.append( tbody );
	document.body.append( table );

	const cells: HTMLTableCellElement[] = [];
	for ( let index = 0; index < 2; index++ ) {
		const row = document.createElement( 'tr' );
		const cell = document.createElement( 'td' );
		row.append( cell );
		tbody.append( row );
		cells.push( cell );
	}

	return { cells, tbody };
};

describe( 'createTouchPressTracker', () => {
	beforeEach( () => {
		document.body.replaceChildren();
		jest.useFakeTimers();
	} );

	afterEach( () => {
		jest.useRealTimers();
	} );

	it( 'notifies when a non-movable row is long-pressed', () => {
		const { cells, tbody } = createContext();
		const onNonMovableRowLongPress = jest.fn();
		const tracker = createTouchPressTracker( {
			isDragging: () => false,
			nonMovableRowIndices: [ 1 ],
			onNonMovableRowLongPress,
			onRequestTouchModeExit: jest.fn(),
			tbody,
			view: window,
		} );

		dispatchPointerEvent( cells[ 1 ], 'pointerdown' );
		jest.advanceTimersByTime( TOUCH_DRAG_DELAY_MS );

		expect( onNonMovableRowLongPress ).toHaveBeenCalledTimes( 1 );
		tracker.destroy();
	} );

	it( 'clears the long-press timer after moving beyond the threshold', () => {
		const { cells, tbody } = createContext();
		const onNonMovableRowLongPress = jest.fn();
		const tracker = createTouchPressTracker( {
			isDragging: () => false,
			nonMovableRowIndices: [ 0 ],
			onNonMovableRowLongPress,
			onRequestTouchModeExit: jest.fn(),
			tbody,
			view: window,
		} );

		dispatchPointerEvent( cells[ 0 ], 'pointerdown' );
		dispatchPointerEvent( cells[ 0 ], 'pointermove', {
			clientX: TOUCH_START_THRESHOLD_PX + 1,
		} );
		jest.advanceTimersByTime( TOUCH_DRAG_DELAY_MS );

		expect( onNonMovableRowLongPress ).not.toHaveBeenCalled();
		tracker.destroy();
	} );

	it( 'requests touch reorder mode exit after a short tap', () => {
		const { cells, tbody } = createContext();
		const onRequestTouchModeExit = jest.fn();
		const tracker = createTouchPressTracker( {
			isDragging: () => false,
			nonMovableRowIndices: [],
			onNonMovableRowLongPress: jest.fn(),
			onRequestTouchModeExit,
			tbody,
			view: window,
		} );

		dispatchPointerEvent( cells[ 0 ], 'pointerdown' );
		dispatchPointerEvent( cells[ 0 ], 'pointerup' );

		expect( onRequestTouchModeExit ).toHaveBeenCalledTimes( 1 );
		tracker.destroy();
	} );

	it( 'clears the long-press timer on pointercancel', () => {
		const { cells, tbody } = createContext();
		const onNonMovableRowLongPress = jest.fn();
		const onRequestTouchModeExit = jest.fn();
		const tracker = createTouchPressTracker( {
			isDragging: () => false,
			nonMovableRowIndices: [ 0 ],
			onNonMovableRowLongPress,
			onRequestTouchModeExit,
			tbody,
			view: window,
		} );

		dispatchPointerEvent( cells[ 0 ], 'pointerdown' );
		dispatchPointerEvent( cells[ 0 ], 'pointercancel' );
		jest.advanceTimersByTime( TOUCH_DRAG_DELAY_MS );

		expect( onNonMovableRowLongPress ).not.toHaveBeenCalled();
		expect( onRequestTouchModeExit ).not.toHaveBeenCalled();
		tracker.destroy();
	} );

	it( 'clears timers and removes listeners on destroy', () => {
		const { cells, tbody } = createContext();
		const onNonMovableRowLongPress = jest.fn();
		const onRequestTouchModeExit = jest.fn();
		const tracker = createTouchPressTracker( {
			isDragging: () => false,
			nonMovableRowIndices: [ 0 ],
			onNonMovableRowLongPress,
			onRequestTouchModeExit,
			tbody,
			view: window,
		} );

		dispatchPointerEvent( cells[ 0 ], 'pointerdown' );
		tracker.destroy();
		jest.advanceTimersByTime( TOUCH_DRAG_DELAY_MS );
		dispatchPointerEvent( cells[ 0 ], 'pointerdown' );
		dispatchPointerEvent( cells[ 0 ], 'pointerup' );
		jest.advanceTimersByTime( TOUCH_DRAG_DELAY_MS );

		expect( onNonMovableRowLongPress ).not.toHaveBeenCalled();
		expect( onRequestTouchModeExit ).not.toHaveBeenCalled();
	} );
} );
