<?php
/**
 * Plugin Name: Yamabiko Editor Tools
 * Description: Editor tools for intuitive content structure editing.
 * Version: 0.1.0
 * Requires at least: 6.8
 * Requires PHP: 8.1
 * Author: YamabikoLab
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: yamabiko-editor-tools
 *
 * @package YamabikoEditorTools
 */

declare(strict_types=1);

namespace YamabikoLab\EditorTools;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Initializes the plugin and registers its blocks.
 */
final class Plugin {

	/**
	 * Registers plugin hooks.
	 */
	public static function init(): void {
		add_action( 'init', array( self::class, 'register_blocks' ) );
		add_action(
			'enqueue_block_editor_assets',
			array( self::class, 'enqueue_table_reorder_editor_assets' )
		);
		add_action(
			'enqueue_block_assets',
			array( self::class, 'enqueue_table_reorder_editor_styles' )
		);
	}

	/**
	 * Registers blocks from the generated block manifest.
	 */
	public static function register_blocks(): void {
		$blocks_path   = __DIR__ . '/build/blocks';
		$manifest_path = __DIR__ . '/build/blocks-manifest.php';

		if ( ! is_readable( $manifest_path ) || ! is_dir( $blocks_path ) ) {
			return;
		}

		wp_register_block_types_from_metadata_collection(
			$blocks_path,
			$manifest_path
		);
	}

	/**
	 * Enqueues Table Reorder assets for the editor.
	 */
	public static function enqueue_table_reorder_editor_assets(): void {
		$handle = self::enqueue_table_reorder_script();

		if ( null === $handle ) {
			return;
		}

		wp_set_script_translations(
			$handle,
			'yamabiko-editor-tools',
			__DIR__ . '/languages'
		);
		self::add_table_reorder_runtime_config( $handle );
	}

	/**
	 * Enqueues the generated Table Reorder stylesheet for editor content.
	 */
	public static function enqueue_table_reorder_editor_styles(): void {
		if ( ! is_admin() ) {
			return;
		}

		$file_path = __DIR__ . '/build/editor-extensions/table-reorder/index.css';
		if ( ! is_readable( $file_path ) ) {
			return;
		}

		wp_enqueue_style(
			'yamabiko-editor-tools-table-reorder-style',
			plugins_url( 'build/editor-extensions/table-reorder/index.css', __FILE__ ),
			array( 'wp-components' ),
			(string) filemtime( $file_path )
		);
	}

	/**
	 * Enqueues the generated Table Reorder script.
	 *
	 * @return string|null Script handle when the asset is available.
	 */
	private static function enqueue_table_reorder_script(): ?string {
		$asset_path = __DIR__ . '/build/editor-extensions/table-reorder/index.asset.php';
		$file_path  = __DIR__ . '/build/editor-extensions/table-reorder/index.js';

		if ( ! is_readable( $asset_path ) || ! is_readable( $file_path ) ) {
			return null;
		}

		$asset = require $asset_path;

		if ( ! is_array( $asset ) ) {
			return null;
		}

		$handle       = 'yamabiko-editor-tools-table-reorder-index';
		$dependencies = isset( $asset['dependencies'] ) && is_array( $asset['dependencies'] )
			? $asset['dependencies']
			: array();
		$version      = isset( $asset['version'] ) && is_string( $asset['version'] )
			? $asset['version']
			: false;

		wp_enqueue_script(
			$handle,
			plugins_url( 'build/editor-extensions/table-reorder/index.js', __FILE__ ),
			$dependencies,
			$version,
			true
		);

		return $handle;
	}

	/**
	 * Exposes the local npm-provided SortableJS runtime URL to the editor script.
	 *
	 * @param string $handle Enqueued Table Reorder script handle.
	 */
	private static function add_table_reorder_runtime_config( string $handle ): void {
		$file_path = __DIR__ . '/build/editor-extensions/table-reorder/sortable.min.js';

		if ( ! is_readable( $file_path ) ) {
			return;
		}

		$config = wp_json_encode(
			array(
				'runtimeUrl' => plugins_url(
					'build/editor-extensions/table-reorder/sortable.min.js',
					__FILE__
				),
			)
		);

		if ( ! is_string( $config ) ) {
			return;
		}

		wp_add_inline_script(
			$handle,
			"window.yamabikoEditorToolsTableReorder = {$config};",
			'before'
		);
	}
}

add_action( 'plugins_loaded', array( Plugin::class, 'init' ) );
