import type { FrameLocator, Page } from '@playwright/test';

export type EditorContext = Page | FrameLocator;

export async function getEditorContext(
	page: Page,
	editorCanvas: FrameLocator
): Promise< EditorContext > {
	if ( ( await page.locator( 'iframe[name="editor-canvas"]' ).count() ) > 0 ) {
		return editorCanvas;
	}

	return page;
}
