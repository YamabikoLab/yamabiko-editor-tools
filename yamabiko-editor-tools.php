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
		add_action( 'enqueue_block_editor_assets', array( self::class, 'enqueue_editor_extensions' ) );
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
	 * Enqueues editor extensions on supported post editor screens.
	 */
	public static function enqueue_editor_extensions(): void {
		$screen = get_current_screen();

		if (
			! $screen instanceof \WP_Screen ||
			'post' !== $screen->base ||
			! in_array( $screen->post_type, array( 'post', 'page' ), true )
		) {
			return;
		}

		$script_path = __DIR__ . '/build/editor-extensions/outline/index.js';
		$asset_path  = __DIR__ . '/build/editor-extensions/outline/index.asset.php';
		$style_path  = __DIR__ . '/build/editor-extensions/outline/index.css';

		if ( ! is_readable( $script_path ) || ! is_readable( $asset_path ) ) {
			return;
		}

		$asset = require $asset_path;

		if (
			! is_array( $asset ) ||
			! isset( $asset['dependencies'], $asset['version'] ) ||
			! is_array( $asset['dependencies'] ) ||
			! is_string( $asset['version'] )
		) {
			return;
		}

		$script_handle = 'yamabiko-editor-tools-outline-editor';

		wp_enqueue_script(
			$script_handle,
			plugins_url( 'build/editor-extensions/outline/index.js', __FILE__ ),
			$asset['dependencies'],
			$asset['version'],
			true
		);
		wp_set_script_translations( $script_handle, 'yamabiko-editor-tools' );

		if ( is_readable( $style_path ) ) {
			wp_enqueue_style(
				'yamabiko-editor-tools-outline-editor',
				plugins_url( 'build/editor-extensions/outline/index.css', __FILE__ ),
				array( 'wp-components' ),
				$asset['version']
			);
		}
	}
}

add_action( 'plugins_loaded', array( Plugin::class, 'init' ) );
