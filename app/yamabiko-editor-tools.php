<?php

/**
 * Plugin Name: Yamabiko Editor Tools
 * Description: Editor tools for intuitive content structure editing.
 * Version: 0.1.0
 * Requires at least: 6.8
 * Requires PHP: 8.1
 * Author: YamabikoLab
 * Text Domain: yamabiko-editor-tools
 */

declare(strict_types=1);

namespace YamabikoLab\EditorTools;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Plugin {

	public static function init(): void {
		add_action( 'init', array( self::class, 'register_blocks' ) );
	}

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
}

add_action( 'plugins_loaded', array( Plugin::class, 'init' ) );
