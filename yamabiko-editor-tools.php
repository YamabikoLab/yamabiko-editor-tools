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

	private const SORTABLEJS_POC_SCRIPT_HANDLE = 'yamabiko-editor-tools-sortablejs-table-reorder-poc-index';

	/**
	 * Registers plugin hooks.
	 */
	public static function init(): void {
		add_action( 'init', array( self::class, 'register_blocks' ) );
		add_action(
			'enqueue_block_editor_assets',
			array( self::class, 'enqueue_sortablejs_table_reorder_poc_editor_assets' )
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
	 * Enqueues the SortableJS Table Reorder PoC editor script.
	 */
	public static function enqueue_sortablejs_table_reorder_poc_editor_assets(): void {
		$asset_path = __DIR__ . '/build/editor-extensions/sortablejs-table-reorder-poc/index.asset.php';
		$file_path  = __DIR__ . '/build/editor-extensions/sortablejs-table-reorder-poc/index.js';

		if ( ! is_readable( $asset_path ) || ! is_readable( $file_path ) ) {
			return;
		}

		$asset = require $asset_path;

		if ( ! is_array( $asset ) ) {
			return;
		}

		$dependencies = isset( $asset['dependencies'] ) && is_array( $asset['dependencies'] )
			? $asset['dependencies']
			: array();
		$version      = isset( $asset['version'] ) && is_string( $asset['version'] )
			? $asset['version']
			: false;

		wp_enqueue_script(
			self::SORTABLEJS_POC_SCRIPT_HANDLE,
			plugins_url( 'build/editor-extensions/sortablejs-table-reorder-poc/index.js', __FILE__ ),
			$dependencies,
			$version,
			true
		);

		self::add_sortablejs_poc_runtime_config();
	}

	/**
	 * Exposes the local npm-provided SortableJS runtime URL to the editor script.
	 */
	private static function add_sortablejs_poc_runtime_config(): void {
		$file_path = __DIR__ . '/build/editor-extensions/sortablejs-table-reorder-poc/sortable.min.js';

		if ( ! is_readable( $file_path ) ) {
			return;
		}

		$config = wp_json_encode(
			array(
				'runtimeUrl' => plugins_url(
					'build/editor-extensions/sortablejs-table-reorder-poc/sortable.min.js',
					__FILE__
				),
			)
		);

		if ( ! is_string( $config ) ) {
			return;
		}

		wp_add_inline_script(
			self::SORTABLEJS_POC_SCRIPT_HANDLE,
			"window.yamabikoEditorToolsSortableJsPoc = {$config};",
			'before'
		);
	}
}

add_action( 'plugins_loaded', array( Plugin::class, 'init' ) );
