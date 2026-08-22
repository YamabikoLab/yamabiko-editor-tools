<?php
/**
 * Plugin Name: Yamabiko Editor Tools E2E Non-Iframe Fixture
 * Description: Registers an API v2 block only for the WordPress 6.8.3 CI E2E environment.
 */

add_action(
	'enqueue_block_editor_assets',
	static function (): void {
		wp_add_inline_script(
			'wp-blocks',
			"wp.blocks.registerBlockType( 'yamabiko-editor-tools/e2e-api-v2', { apiVersion: 2, title: 'YET E2E API v2', category: 'text', edit: function () { return null; }, save: function () { return null; } } );",
			'after'
		);
	}
);
