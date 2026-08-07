export type InsertionIndicator = {
	below: boolean;
	rowId: string;
};

export type TableReorderRowPlacement = {
	height: number;
	id: string;
	index: number;
};

export type TableReorderVisualRow = TableReorderRowPlacement & {
	element: HTMLTableRowElement;
};

export type RowDisplacement = {
	id: string;
	translateY: number;
};

type InlineStyles = {
	opacity: string;
	transform: string;
	transition: string;
};

const rowTransition = 'transform 150ms ease, opacity 150ms ease';

const getTransform = ( transform: string, translateY: number ): string => {
	const translation = `translateY(${ translateY }px)`;

	return transform && transform !== 'none' ? `${ transform } ${ translation }` : translation;
};

const getKeyboardReorderHandle = (
	row: TableReorderVisualRow
): HTMLButtonElement | null =>
	Array.from(
		row.element.ownerDocument.querySelectorAll< HTMLButtonElement >(
			'.yamabiko-editor-tools-table-reorder-content__handle.is-keyboard-reordering'
		)
	).find( ( handle ) => handle.dataset.tableReorderRowId === row.id ) ?? null;

export const getRowDisplacements = (
	rows: readonly TableReorderRowPlacement[],
	sourceId: string,
	insertionIndex: number
): RowDisplacement[] => {
	const source = rows.find( ( row ) => row.id === sourceId );
	if (
		! source ||
		! Number.isInteger( insertionIndex ) ||
		insertionIndex < 0 ||
		insertionIndex > rows.length ||
		insertionIndex === source.index ||
		insertionIndex === source.index + 1
	) {
		return [];
	}

	const translateY = insertionIndex < source.index ? source.height : -source.height;
	const isDisplaced =
		insertionIndex < source.index
			? ( row: TableReorderRowPlacement ) => row.index >= insertionIndex && row.index < source.index
			: ( row: TableReorderRowPlacement ) => row.index > source.index && row.index < insertionIndex;

	return rows.filter( isDisplaced ).map( ( row ) => ( { id: row.id, translateY } ) );
};

export const getSourceTranslateY = (
	rows: readonly TableReorderRowPlacement[],
	sourceId: string,
	insertionIndex: number
): number => {
	const source = rows.find( ( row ) => row.id === sourceId );
	if (
		! source ||
		! Number.isInteger( insertionIndex ) ||
		insertionIndex < 0 ||
		insertionIndex > rows.length ||
		insertionIndex === source.index ||
		insertionIndex === source.index + 1
	) {
		return 0;
	}

	if ( insertionIndex < source.index ) {
		return -rows
			.filter( ( row ) => row.index >= insertionIndex && row.index < source.index )
			.reduce( ( total, row ) => total + row.height, 0 );
	}

	return rows
		.filter( ( row ) => row.index > source.index && row.index < insertionIndex )
		.reduce( ( total, row ) => total + row.height, 0 );
};

export class TableReorderDragVisuals {
	private readonly originalStyles = new Map< HTMLElement, InlineStyles >();
	private insertionIndicator: InsertionIndicator | null = null;

	constructor(
		private readonly onInsertionIndicatorChange: ( indicator: InsertionIndicator | null ) => void
	) {}

	showCandidate(
		rows: readonly TableReorderVisualRow[],
		sourceId: string,
		targetId: string,
		insertionIndex: number
	): void {
		const source = rows.find( ( row ) => row.id === sourceId );
		const target = rows.find( ( row ) => row.id === targetId );
		const displacements = getRowDisplacements( rows, sourceId, insertionIndex );
		if ( ! source || ! target || displacements.length === 0 ) {
			this.clear();
			return;
		}

		const sourceHandle = getKeyboardReorderHandle( source );
		const displacementById = new Map(
			displacements.map( ( displacement ) => [ displacement.id, displacement.translateY ] )
		);
		const activeElements = new Set< HTMLElement >( [
			source.element,
			...rows.filter( ( row ) => displacementById.has( row.id ) ).map( ( row ) => row.element ),
		] );
		if ( sourceHandle ) {
			activeElements.add( sourceHandle );
		}

		for ( const [ element, styles ] of this.originalStyles ) {
			if ( ! activeElements.has( element ) ) {
				this.setAnimatedStyles( element, styles.transform, styles.opacity );
			}
		}

		const sourceStyles = this.getOriginalStyles( source.element );
		if ( sourceHandle ) {
			const sourceTranslateY = getSourceTranslateY( rows, sourceId, insertionIndex );
			this.setAnimatedStyles(
				source.element,
				getTransform( sourceStyles.transform, sourceTranslateY ),
				sourceStyles.opacity
			);
			const handleStyles = this.getOriginalStyles( sourceHandle );
			this.setAnimatedStyles(
				sourceHandle,
				getTransform( handleStyles.transform, sourceTranslateY ),
				handleStyles.opacity
			);

			if ( insertionIndex > source.index + 1 ) {
				const nextRow = rows.find( ( row ) => row.index === insertionIndex );
				if ( nextRow && typeof nextRow.element.scrollIntoView === 'function' ) {
					nextRow.element.scrollIntoView( {
						behavior: 'auto',
						block: 'nearest',
						inline: 'nearest',
					} );
				}
			}
		} else {
			this.setAnimatedStyles( source.element, sourceStyles.transform, '0' );
		}
		for ( const row of rows ) {
			const translateY = displacementById.get( row.id );
			if ( translateY !== undefined ) {
				this.setAnimatedStyles(
					row.element,
					getTransform( this.getOriginalStyles( row.element ).transform, translateY ),
					this.getOriginalStyles( row.element ).opacity
				);
			}
		}

		this.updateInsertionIndicator( {
			below: insertionIndex > target.index,
			rowId: target.id,
		} );
	}

	clear(): void {
		for ( const [ element, styles ] of this.originalStyles ) {
			element.style.opacity = styles.opacity;
			element.style.transform = styles.transform;
			element.style.transition = styles.transition;
		}

		this.originalStyles.clear();
		this.updateInsertionIndicator( null );
	}

	private updateInsertionIndicator( indicator: InsertionIndicator | null ): void {
		if (
			this.insertionIndicator?.below === indicator?.below &&
			this.insertionIndicator?.rowId === indicator?.rowId
		) {
			return;
		}

		this.insertionIndicator = indicator;
		this.onInsertionIndicatorChange( indicator );
	}

	private getOriginalStyles( element: HTMLElement ): InlineStyles {
		const existing = this.originalStyles.get( element );
		if ( existing ) {
			return existing;
		}

		const styles = {
			opacity: element.style.opacity,
			transform: element.style.transform,
			transition: element.style.transition,
		};
		this.originalStyles.set( element, styles );
		return styles;
	}

	private setAnimatedStyles( element: HTMLElement, transform: string, opacity: string ): void {
		this.getOriginalStyles( element );
		element.style.opacity = opacity;
		element.style.transform = transform;
		element.style.transition = rowTransition;
	}
}
