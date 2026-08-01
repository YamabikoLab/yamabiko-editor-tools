<?php
/**
 * Plugin Name: Yamabiko Blocks
 * Description: A foundation plugin for YamabikoLab block development.
 * Version: 0.1.0
 * Requires at least: 6.8
 * Requires PHP: 8.1
 * Author: YamabikoLab
 * Text Domain: yamabiko-blocks
 */

declare( strict_types = 1 );

namespace YamabikoLab\Blocks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Plugin {
	public static function init(): void {
		add_action( 'init', array( self::class, 'register_blocks' ) );
	}

	public static function register_blocks(): void {
		$build_path    = __DIR__ . '/build';
		$manifest_path = $build_path . '/blocks-manifest.php';

		if ( ! is_readable( $manifest_path ) ) {
			return;
		}

		wp_register_block_types_from_metadata_collection(
			$build_path,
			$manifest_path
		);
	}
}

add_action( 'plugins_loaded', array( Plugin::class, 'init' ) );
