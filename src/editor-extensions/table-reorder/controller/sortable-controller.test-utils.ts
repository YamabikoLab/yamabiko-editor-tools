import type { TableContext } from '../table-context';
import { ensureSortableRuntime, type SortableInstance } from './sortable-runtime';

export type SortableRuntime = NonNullable<
	Awaited< ReturnType< typeof ensureSortableRuntime > >
>;

export const createSortableRuntime = < TOptions = unknown >(
	capture?: ( options: TOptions ) => void
): SortableRuntime => ( {
	create: jest.fn( ( _element: HTMLElement, options: unknown ): SortableInstance => {
		capture?.( options as TOptions );
		return { destroy: jest.fn() };
	} ),
} );

export const createTableContext = ( rowCount = 4 ) => {
	const blockElement = document.createElement( 'div' );
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	table.append( tbody );
	blockElement.append( table );
	document.body.append( blockElement );

	for ( let index = 0; index < rowCount; index++ ) {
		const row = document.createElement( 'tr' );
		const cell = document.createElement( 'td' );
		cell.textContent = `row-${ index }`;
		row.append( cell );
		tbody.append( row );
	}

	const context: TableContext = {
		blockElement,
		document,
		tbody,
		window,
	};
	return { context, tbody };
};

export const getRowControl = (
	tbody: HTMLTableSectionElement,
	rowIndex: number
): HTMLButtonElement => {
	const control = tbody.rows
		.item( rowIndex )
		?.querySelector< HTMLButtonElement >( '.yamabiko-table-reorder-handle-zone' );
	if ( ! control ) {
		throw new Error( `Expected row control for row ${ rowIndex }` );
	}
	return control;
};
