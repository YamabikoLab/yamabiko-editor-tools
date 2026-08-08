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
		add_action( 'enqueue_block_editor_assets', array( self::class, 'enqueue_table_reorder_editor_assets' ) );
		add_action( 'enqueue_block_assets', array( self::class, 'enqueue_table_reorder_content_assets' ) );
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
	 * Enqueues Table Reorder assets for editor chrome.
	 */
	public static function enqueue_table_reorder_editor_assets(): void {
		self::enqueue_table_reorder_asset( 'index', 'script' );
		self::enqueue_table_reorder_asset( 'index', 'style' );
	}

	/**
	 * Enqueues Table Reorder styles and the SortableJS PoC runtime in editor content.
	 */
	public static function enqueue_table_reorder_content_assets(): void {
		if ( ! is_admin() ) {
			return;
		}

		self::enqueue_table_reorder_asset( 'content', 'style' );
		self::enqueue_sortablejs_poc_runtime();
	}

	/**
	 * Enqueues the npm-provided SortableJS UMD runtime for the PoC.
	 */
	private static function enqueue_sortablejs_poc_runtime(): void {
		$file_path = __DIR__ . '/build/editor-extensions/sortablejs-table-reorder-poc/sortable.min.js';

		if ( ! is_readable( $file_path ) ) {
			return;
		}

		wp_enqueue_script(
			'yamabiko-editor-tools-sortablejs-table-reorder-poc-content',
			plugins_url( 'build/editor-extensions/sortablejs-table-reorder-poc/sortable.min.js', __FILE__ ),
			array(),
			(string) filemtime( $file_path ),
			true
		);
	}

	/**
	 * Enqueues a generated Table Reorder asset when its metadata is available.
	 *
	 * @param string $entry Asset entry name.
	 * @param string $type  Asset type.
	 */
	private static function enqueue_table_reorder_asset( string $entry, string $type ): void {
		$asset_path = __DIR__ . "/build/editor-extensions/table-reorder/{$entry}.asset.php";
		$extension  = 'script' === $type ? 'js' : 'css';
		$file_path  = __DIR__ . "/build/editor-extensions/table-reorder/{$entry}.{$extension}";

		if ( ! is_readable( $asset_path ) || ! is_readable( $file_path ) ) {
			return;
		}

		$asset = require $asset_path;

		if ( ! is_array( $asset ) ) {
			return;
		}

		$handle  = "yamabiko-editor-tools-table-reorder-{$entry}";
		$version = isset( $asset['version'] ) && is_string( $asset['version'] )
			? $asset['version']
			: false;

		if ( 'script' === $type ) {
			$dependencies = isset( $asset['dependencies'] ) && is_array( $asset['dependencies'] )
				? $asset['dependencies']
				: array();

			wp_enqueue_script(
				$handle,
				plugins_url( "build/editor-extensions/table-reorder/{$entry}.js", __FILE__ ),
				$dependencies,
				$version,
				true
			);
			wp_set_script_translations(
				$handle,
				'yamabiko-editor-tools',
				__DIR__ . '/languages'
			);
			return;
		}

		wp_enqueue_style(
			$handle,
			plugins_url( "build/editor-extensions/table-reorder/{$entry}.css", __FILE__ ),
			array(),
			$version
		);
	}
}

add_action( 'plugins_loaded', array( Plugin::class, 'init' ) );
