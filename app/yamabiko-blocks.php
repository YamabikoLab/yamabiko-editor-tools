<?php

/**
 * Plugin Name: Yamabiko Blocks
 * Description: A foundation plugin for YamabikoLab block development.
 * Version: 0.1.0
 * Requires PHP: 8.1
 * Author: YamabikoLab
 * Text Domain: yamabiko-blocks
 */

declare(strict_types=1);

namespace YamabikoLab\YamabikoBlocks;

if (! defined('ABSPATH')) {
    exit;
}

final class Plugin
{
    public static function init(): void
    {
        // Block registration will be added in a future issue.
    }
}

add_action('plugins_loaded', [Plugin::class, 'init']);
