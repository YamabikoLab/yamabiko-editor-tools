<?php

/**
 * Focused smoke check for missing asset output.
 *
 * @package YamabikoBlocks
 */

declare(strict_types=1);

use YamabikoLab\Blocks\AssetLoader;

$actions = array();
$enqueued = array();

function add_action(string $hook, callable $callback): void
{
    global $actions;
    $actions[$hook] = $callback;
}

function wp_enqueue_script_module(): void
{
    global $enqueued;
    $enqueued[] = 'module';
}

function wp_enqueue_script(): void
{
    global $enqueued;
    $enqueued[] = 'script';
}

function wp_enqueue_style(): void
{
    global $enqueued;
    $enqueued[] = 'style';
}

require_once dirname(__DIR__, 2) . '/src/AssetLoader.php';

$missing_root = sys_get_temp_dir() . '/yamabiko-blocks-missing-assets-' . bin2hex(random_bytes(8));
$loader = new AssetLoader(
    $missing_root,
    'https://example.test/wp-content/plugins/yamabiko-blocks/',
    array(
        'notice/entries/notice-block' => 'yamabiko-blocks-notice-block-editor',
    )
);
$loader->register_hooks();

if (! isset($actions['enqueue_block_editor_assets'])) {
    throw new RuntimeException('Editor-parent asset hook was not registered.');
}

$actions['enqueue_block_editor_assets']();

if (array() !== $enqueued) {
    throw new RuntimeException('Missing build output must not enqueue assets.');
}

echo "AssetLoader missing-output smoke check passed.\n";
