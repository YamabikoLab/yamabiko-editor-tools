<?php

/**
 * Plugin Name: Yamabiko Blocks
 * Description: A foundation plugin for YamabikoLab block development.
 * Version: 0.1.0
 * Requires at least: 6.8
 * Requires PHP: 8.1
 * Author: YamabikoLab
 * Text Domain: yamabiko-blocks
 *
 * @package YamabikoBlocks
 */

declare(strict_types=1);

if (! defined('ABSPATH')) {
    exit;
}

$yamabiko_blocks_autoloader = __DIR__ . '/vendor/autoload.php';

if (! is_readable($yamabiko_blocks_autoloader)) {
    return;
}

require_once $yamabiko_blocks_autoloader;

add_action('plugins_loaded', array('YamabikoLab\\Blocks\\Plugin', 'init'));
