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

declare(strict_types=1);

namespace YamabikoLab\Blocks;

if (! defined('ABSPATH')) {
    exit;
}

final class Plugin
{
    public static function init(): void
    {
        add_action('init', [self::class, 'registerBlocks']);
    }

    public static function registerBlocks(): void
    {
        $buildPath = __DIR__ . '/build';
        $manifestPath = $buildPath . '/blocks-manifest.php';

        if (! is_readable($manifestPath)) {
            return;
        }

        wp_register_block_types_from_metadata_collection(
            $buildPath,
            $manifestPath
        );
    }
}

add_action('plugins_loaded', [Plugin::class, 'init']);
